import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "../../db/schema";
import {
	artifacts,
	conversations,
	messages as messageTable,
	retrievalLogs,
} from "../../db/schema";
import { HttpError } from "../auth/errors";
import type { LlmProvider } from "../../providers/types";
import type { ChatMessage } from "../../types/llm";
import { extractArtifactsFromText } from "../artifacts/extract";
import type { Artifact } from "../artifacts/types";
import type {
	SearchEvidence,
	SearchEvidenceCollector,
} from "../rag/search-evidence";
import type { Citation, RetrievedFragment } from "../rag/types";
import type { SettingsRepository } from "../settings/settings.repository";
import {
	normalizeInstructionLocale,
	renderPrompt,
	type InstructionLocale,
} from "../../prompts/catalog";

export type ChatResult = {
	id: string;
	conversationId: string;
	text: string;
	citations: Citation[];
	artifacts: Artifact[];
	retrieved: RetrievedFragment[];
	usage?: {
		promptTokens: number;
		completionTokens: number;
		totalTokens: number;
	};
};

type ChatServiceDeps = {
	db: NodePgDatabase<typeof schema>;
	llmProvider: LlmProvider;
	evidenceCollector: SearchEvidenceCollector;
	settingsRepository?: Pick<SettingsRepository, "getSystemContextForUser">;
};

type ChatRequest = {
	messages: ChatMessage[];
	userId: string;
	conversationId?: string;
	topK?: number;
	category?: string;
};

function buildSystemPrompt(
	localContext: string,
	instructionLocale: InstructionLocale,
): string {
	return renderPrompt(instructionLocale, "chat.grounded-answer", {
		localContext,
	}).content.text;
}

type ChatSearchDecision = {
	shouldSearch: boolean;
	searchQuery?: string;
	answer?: string;
};

function extractJsonObject(input: string): string | null {
	const fenced = input.match(/```(?:json)?\s*([\s\S]*?)```/i);
	const candidate = fenced?.[1] ?? input;
	const start = candidate.indexOf("{");
	const end = candidate.lastIndexOf("}");
	if (start < 0 || end < start) return null;
	return candidate.slice(start, end + 1);
}

function parseSearchDecision(input: string): ChatSearchDecision | null {
	const json = extractJsonObject(input);
	if (!json) return null;
	try {
		const parsed = JSON.parse(json) as Record<string, unknown>;
		return {
			shouldSearch: parsed.shouldSearch === true,
			searchQuery:
				typeof parsed.searchQuery === "string" ? parsed.searchQuery : undefined,
			answer: typeof parsed.answer === "string" ? parsed.answer : undefined,
		};
	} catch {
		return null;
	}
}

function buildSearchDecisionPrompt(
	instructionLocale: InstructionLocale,
): string {
	return renderPrompt(instructionLocale, "chat.search-decision", {}).content
		.text;
}

function buildDirectAnswerPrompt(instructionLocale: InstructionLocale): string {
	return renderPrompt(instructionLocale, "chat.direct-answer", {}).content.text;
}

function conversationTitleFromQuery(query: string): string {
	const trimmed = query.trim();
	if (!trimmed) return "Conversation";
	return trimmed.length > 80 ? `${trimmed.slice(0, 77)}...` : trimmed;
}

export class ChatService {
	constructor(private readonly deps: ChatServiceDeps) {}

	private async findOwnedConversation(
		conversationId: string,
		userId: string,
	): Promise<{ id: string } | null> {
		const existing = await this.deps.db.query.conversations.findFirst({
			where: and(
				eq(conversations.id, conversationId),
				eq(conversations.userId, userId),
			),
			columns: { id: true },
		});
		return existing ?? null;
	}

	private async ensureConversation(
		conversationId: string | undefined,
		userId: string,
		query: string,
	): Promise<string> {
		if (conversationId) return conversationId;
		const [inserted] = await this.deps.db
			.insert(conversations)
			.values({
				userId,
				title: conversationTitleFromQuery(query),
				metadata: {},
			})
			.returning({ id: conversations.id });
		return inserted.id;
	}

	private async decideSearch(
		messages: ChatMessage[],
		instructionLocale: InstructionLocale,
	): Promise<ChatSearchDecision> {
		const response = await this.deps.llmProvider.chatCompletion(
			[
				{
					role: "system",
					content: buildSearchDecisionPrompt(instructionLocale),
				},
				...messages,
			],
			{ temperature: 0 },
		);
		const decision = parseSearchDecision(response.content);
		if (decision) return decision;
		return {
			shouldSearch: false,
			answer: response.content,
		};
	}

	private async directAnswer(
		messages: ChatMessage[],
		instructionLocale: InstructionLocale,
	) {
		return await this.deps.llmProvider.chatCompletion([
			{ role: "system", content: buildDirectAnswerPrompt(instructionLocale) },
			...messages,
		]);
	}

	async run(request: ChatRequest): Promise<ChatResult> {
		const lastUserMessage =
			[...request.messages].reverse().find((message) => message.role === "user")
				?.content ?? "";
		if (
			request.conversationId &&
			!(await this.findOwnedConversation(
				request.conversationId,
				request.userId,
			))
		) {
			throw new HttpError(404, "Conversation not found.");
		}
		const topK = request.topK ?? 8;
		const category = request.category?.trim() || undefined;
		const settings =
			await this.deps.settingsRepository?.getSystemContextForUser(
				request.userId,
			);
		const instructionLocale = normalizeInstructionLocale(
			settings?.instructionLocale,
		);
		const decision = await this.decideSearch(
			request.messages,
			instructionLocale,
		);
		let evidence: SearchEvidence | undefined;
		let llmResponse: Awaited<ReturnType<LlmProvider["chatCompletion"]>>;
		if (decision.shouldSearch) {
			const searchQuery = decision.searchQuery?.trim() || lastUserMessage;
			evidence = await this.deps.evidenceCollector.collect({
				query: searchQuery,
				topK,
				category,
			});
			const systemPrompt = buildSystemPrompt(
				evidence.localContext,
				instructionLocale,
			);
			llmResponse = await this.deps.llmProvider.chatCompletion([
				{ role: "system", content: systemPrompt },
				...request.messages,
			]);
		} else if (decision.answer?.trim()) {
			llmResponse = {
				id: randomUUID(),
				content: decision.answer,
			};
		} else {
			llmResponse = await this.directAnswer(
				request.messages,
				instructionLocale,
			);
		}
		const extracted = extractArtifactsFromText(llmResponse.content);
		const retrieved = evidence?.retrieved ?? [];
		const citations = evidence?.citations ?? [];

		const conversationId = await this.ensureConversation(
			request.conversationId,
			request.userId,
			lastUserMessage,
		);

		let userMessageId: string = randomUUID();
		if (lastUserMessage.trim()) {
			const [userMessage] = await this.deps.db
				.insert(messageTable)
				.values({
					conversationId,
					role: "user",
					content: lastUserMessage,
					metadata: {},
				})
				.returning({ id: messageTable.id });
			userMessageId = userMessage.id;
		}

		const [assistantMessage] = await this.deps.db
			.insert(messageTable)
			.values({
				conversationId,
				role: "assistant",
				content: extracted.cleanText,
				metadata: { citations },
			})
			.returning({ id: messageTable.id });

		if (extracted.artifacts.length > 0) {
			await this.deps.db.insert(artifacts).values(
				extracted.artifacts.map((artifact) => ({
					conversationId,
					messageId: assistantMessage.id,
					type: artifact.type,
					title: artifact.title ?? null,
					content: artifact.content as Record<string, unknown>,
					version: artifact.version,
					metadata: artifact.metadata,
				})),
			);
		}

		await this.deps.db.insert(retrievalLogs).values({
			conversationId,
			messageId: assistantMessage.id,
			query: lastUserMessage,
			fragmentIds: retrieved.map((item) => item.id),
			scores: {
				selected: retrieved.map((item) => ({
					id: item.id,
					combinedScore: item.combinedScore,
					vectorScore: item.vectorScore,
					textScore: item.textScore,
					trigramScore: item.trigramScore,
				})),
				vector: (evidence?.evaluation.vectorResults ?? []).map((item) => ({
					id: item.id,
					vectorScore: item.vectorScore,
				})),
				text: (evidence?.evaluation.textResults ?? []).map((item) => ({
					id: item.id,
					textScore: item.textScore,
				})),
				merged: (evidence?.evaluation.mergedResults ?? []).map((item) => ({
					id: item.id,
					combinedScore: item.combinedScore,
					vectorScore: item.vectorScore,
					textScore: item.textScore,
				})),
			},
			context: {
				userMessageId,
				searchUsed: Boolean(evidence),
				searchQuery: evidence?.query ?? null,
				contextLength: evidence?.localContext.length ?? 0,
				category: category ?? "all",
				retrievalStrategy: evidence?.evaluation.strategy ?? null,
				selectedCount: retrieved.length,
				vectorCount: evidence?.evaluation.vectorResults.length ?? 0,
				textCount: evidence?.evaluation.textResults.length ?? 0,
				mergedCount: evidence?.evaluation.mergedResults.length ?? 0,
			},
		});

		await this.deps.db
			.update(conversations)
			.set({ updatedAt: new Date() })
			.where(eq(conversations.id, conversationId));

		return {
			id: llmResponse.id,
			conversationId,
			text: extracted.cleanText,
			citations,
			artifacts: extracted.artifacts,
			retrieved,
			usage: llmResponse.usage,
		};
	}
}
