import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TRange, Value } from "platejs";
import type { PlateEditor } from "platejs/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App, createAppQueryClient } from "../App";
import { setSessionUser } from "../api";
import type { PageSummary } from "../api";
import {
	clearPageDraftRecovery,
	readPageDraftRecovery,
	storePageDraftRecovery,
} from "../page-draft-recovery";
import { router } from "../router";

const alice = {
	id: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
	email: "alice@example.com",
	displayName: "Alice",
	role: "member" as const,
};

const bob = {
	id: "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb",
	email: "bob@example.com",
	displayName: "Bob",
	role: "member" as const,
};

function summary(
	id: string,
	title: string,
	parentId: string | null,
): PageSummary {
	return {
		id,
		parentId,
		title,
		createdAt: "2026-09-30T00:00:00.000Z",
		updatedAt: "2026-09-30T00:00:00.000Z",
	};
}

type SessionUser = typeof alice;

type StoredContent = { revision: number; value: Value };

type ApiState = {
	moveError?: { status: number; body: object };
	duplicateError?: { status: number; body: object };
	user: SessionUser | null;
	pages: PageSummary[];
	posts: Array<{ title: string; parentId: string | null }>;
	moves: Array<{
		pageId: string;
		parentId: string | null;
		expectedParentId: string | null;
	}>;
	duplicates: Array<{
		pageId: string;
		input: {
			requestId: string;
			expectedContentRevision: number;
			expectedTitle: string;
			expectedParentId: string | null;
		};
	}>;
	duplicateResults: Map<string, PageSummary>;
	duplicateFailures: number;
	holdDuplicate: boolean;
	releaseDuplicate: (() => void) | undefined;
	contents: Record<string, StoredContent>;
	puts: Array<{ pageId: string; revision: number; value: Value }>;
	createFailures: number;
	listFailures: number;
	detailFailures: number;
	putFailures: number;
	putUnauthorized: number;
	putConflict: { currentRevision: number; value: Value } | null;
	detailTitle?: string;
	patchUnauthorized: number;
	holdPatch?: boolean;
	releasePatch?: () => void;
	patches?: string[];
	holdCreate: boolean;
	releaseCreate: (() => void) | undefined;
	holdMe: boolean;
	releaseMe: (() => void) | undefined;
	holdList: boolean;
	releaseList: (() => void) | undefined;
	holdDetail: boolean;
	releaseDetail: (() => void) | undefined;
	holdPut: boolean;
	releasePut: (() => void) | undefined;
};

const emptyDocument: Value = [{ type: "p", children: [{ text: "" }] }];

function paragraph(text: string): Value {
	return [{ type: "p", children: [{ text }] }];
}

function createState(partial: Partial<ApiState> = {}): ApiState {
	return {
		user: alice,
		pages: [],
		posts: [],
		moves: [],
		duplicates: [],
		duplicateResults: new Map(),
		duplicateFailures: 0,
		holdDuplicate: false,
		releaseDuplicate: undefined,
		contents: {},
		puts: [],
		createFailures: 0,
		listFailures: 0,
		detailFailures: 0,
		putFailures: 0,
		putUnauthorized: 0,
		putConflict: null,
		patchUnauthorized: 0,
		holdCreate: false,
		releaseCreate: undefined,
		holdMe: false,
		releaseMe: undefined,
		holdList: false,
		releaseList: undefined,
		holdDetail: false,
		releaseDetail: undefined,
		holdPut: false,
		releasePut: undefined,
		...partial,
	};
}

const getRequestPath = (input: RequestInfo | URL): string => {
	if (input instanceof Request) return new URL(input.url).pathname;
	return new URL(input.toString(), "http://localhost").pathname;
};

const getMethod = (input: RequestInfo | URL, init?: RequestInit): string => {
	if (init?.method) return init.method.toUpperCase();
	if (input instanceof Request) return input.method.toUpperCase();
	return "GET";
};

function installApi(state: ApiState) {
	const fetchMock = vi.fn(
		async (input: RequestInfo | URL, init?: RequestInit) => {
			const path = getRequestPath(input);
			const method = getMethod(input, init);
			if (path.startsWith("/api/pages") && !state.user)
				return Response.json({ message: "Unauthorized" }, { status: 401 });

			if (path === "/api/auth/me") {
				if (state.holdMe) {
					await new Promise<void>((resolve) => {
						state.releaseMe = resolve;
					});
				}
				return state.user
					? Response.json({ user: state.user })
					: Response.json({ message: "Unauthorized" }, { status: 401 });
			}
			if (path === "/api/auth/refresh") {
				return Response.json({ message: "Unauthorized" }, { status: 401 });
			}
			if (path === "/api/auth/logout") {
				state.user = null;
				return Response.json({ success: true });
			}
			if (path === "/api/auth/login") {
				state.user = bob;
				state.pages = [summary("bob-page", "Bob Page", null)];
				return Response.json({ user: bob });
			}
			if (path === "/api/pages" && method === "POST") {
				const body = JSON.parse(String(init?.body)) as {
					title: string;
					parentId: string | null;
				};
				state.posts.push(body);
				if (state.holdCreate) {
					await new Promise<void>((resolve) => {
						state.releaseCreate = resolve;
					});
				}
				if (state.createFailures > 0) {
					state.createFailures -= 1;
					return Response.json(
						{ message: "作成に失敗しました" },
						{ status: 500 },
					);
				}
				const created = summary(
					`created-${state.pages.length + 1}`,
					body.title,
					body.parentId,
				);
				state.pages = [...state.pages, created];
				return Response.json(
					{ page: { ...created, ownerId: state.user?.id ?? alice.id } },
					{ status: 201 },
				);
			}
			const moveMatch = path.match(/^\/api\/pages\/([^/]+)\/move$/);
			if (moveMatch && method === "POST") {
				const pageId = decodeURIComponent(moveMatch[1] ?? "");
				const body = JSON.parse(String(init?.body)) as {
					parentId: string | null;
					expectedParentId: string | null;
				};
				state.moves.push({ pageId, ...body });
				if (state.moveError)
					return Response.json(state.moveError.body, {
						status: state.moveError.status,
					});
				state.pages = state.pages.map((page) =>
					page.id === pageId ? { ...page, parentId: body.parentId } : page,
				);
				const updated = state.pages.find((page) => page.id === pageId);
				if (!updated)
					return Response.json({ message: "Not found" }, { status: 404 });
				return Response.json({
					page: { ...updated, ownerId: state.user?.id ?? alice.id },
				});
			}
			const duplicateMatch = path.match(/^\/api\/pages\/([^/]+)\/duplicate$/);
			if (duplicateMatch && method === "POST") {
				const pageId = decodeURIComponent(duplicateMatch[1] ?? "");
				const input = JSON.parse(String(init?.body)) as {
					requestId: string;
					expectedContentRevision: number;
					expectedTitle: string;
					expectedParentId: string | null;
				};
				state.duplicates.push({ pageId, input });
				if (state.duplicateError)
					return Response.json(state.duplicateError.body, {
						status: state.duplicateError.status,
					});
				if (state.holdDuplicate) {
					await new Promise<void>((resolve) => {
						state.releaseDuplicate = resolve;
					});
				}
				const key = `${state.user?.id}:${input.requestId}`;
				const prior = state.duplicateResults.get(key);
				if (prior)
					return Response.json({ page: { ...prior, ownerId: state.user?.id } });
				const source = state.pages.find((page) => page.id === pageId);
				const content = state.contents[pageId] ?? {
					revision: 0,
					value: emptyDocument,
				};
				if (!source)
					return Response.json({ message: "Not found" }, { status: 404 });
				if (
					source.title !== input.expectedTitle ||
					source.parentId !== input.expectedParentId ||
					content.revision !== input.expectedContentRevision
				) {
					return Response.json(
						{ message: "Source page changed", code: "SOURCE_PAGE_CHANGED" },
						{ status: 409 },
					);
				}
				const duplicateNumber = state.duplicateResults.size + 1;
				const duplicated = summary(
					`cccccccc-cccc-4ccc-8ccc-${String(duplicateNumber).padStart(12, "0")}`,
					`${source.title} のコピー`,
					source.parentId,
				);
				state.pages = [...state.pages, duplicated];
				state.contents[duplicated.id] = {
					revision: 0,
					value: structuredClone(content.value).map((block, index) => ({
						...block,
						id: `copy00000${index}`,
					})),
				};
				state.duplicateResults.set(key, duplicated);
				if (state.duplicateFailures > 0) {
					state.duplicateFailures -= 1;
					return Response.json({ message: "network lost" }, { status: 500 });
				}
				return Response.json(
					{ page: { ...duplicated, ownerId: state.user?.id } },
					{ status: 201 },
				);
			}
			if (path === "/api/pages") {
				if (state.holdList) {
					await new Promise<void>((resolve) => {
						state.releaseList = resolve;
					});
				}
				if (state.listFailures > 0) {
					state.listFailures -= 1;
					return Response.json(
						{ message: "一覧の取得に失敗しました" },
						{ status: 500 },
					);
				}
				return Response.json({ pages: state.pages });
			}
			const contentMatch = path.match(/^\/api\/pages\/([^/]+)\/content$/);
			if (contentMatch && method === "PUT") {
				const pageId = decodeURIComponent(contentMatch[1] ?? "");
				const body = JSON.parse(String(init?.body)) as {
					revision: number;
					value: Value;
				};
				state.puts.push({ pageId, revision: body.revision, value: body.value });
				if (state.holdPut) {
					await new Promise<void>((resolve) => {
						state.releasePut = resolve;
					});
				}
				if (state.putFailures > 0) {
					state.putFailures -= 1;
					return Response.json(
						{ message: "保存に失敗しました" },
						{ status: 500 },
					);
				}
				if (state.putUnauthorized > 0) {
					state.putUnauthorized -= 1;
					return Response.json({ message: "Unauthorized" }, { status: 401 });
				}
				if (state.putConflict) {
					state.contents[pageId] = {
						revision: state.putConflict.currentRevision,
						value: state.putConflict.value,
					};
					return Response.json(
						{
							message: "Content revision conflict",
							currentRevision: state.putConflict.currentRevision,
						},
						{ status: 409 },
					);
				}
				const found = state.pages.find((page) => page.id === pageId);
				const stored = state.contents[pageId] ?? {
					revision: 0,
					value: emptyDocument,
				};
				if (found && body.revision !== stored.revision) {
					return Response.json(
						{
							message: "Content revision conflict",
							currentRevision: stored.revision,
						},
						{ status: 409 },
					);
				}
				if (!found) {
					return Response.json({ message: "Not found" }, { status: 404 });
				}
				const next = { revision: body.revision + 1, value: body.value };
				state.contents[pageId] = next;
				const updatedAt = new Date(
					Date.parse(found.updatedAt) + 1000,
				).toISOString();
				state.pages = state.pages.map((page) =>
					page.id === pageId ? { ...page, updatedAt } : page,
				);
				return Response.json({
					content: next,
					page: { id: pageId, updatedAt },
				});
			}
			if (path.startsWith("/api/pages/") && method === "PATCH") {
				const pageId = decodeURIComponent(path.slice("/api/pages/".length));
				const body = JSON.parse(String(init?.body)) as { title: string };
				state.patches ??= [];
				state.patches.push(body.title);
				if (state.holdPatch)
					await new Promise<void>((resolve) => {
						state.releasePatch = resolve;
					});
				if (state.patchUnauthorized > 0) {
					state.patchUnauthorized -= 1;
					return Response.json({ message: "Unauthorized" }, { status: 401 });
				}
				state.pages = state.pages.map((page) =>
					page.id === pageId ? { ...page, title: body.title } : page,
				);
				return Response.json({
					page: {
						...state.pages.find((page) => page.id === pageId),
						ownerId: state.user?.id,
					},
				});
			}
			if (path.startsWith("/api/pages/")) {
				const pageId = decodeURIComponent(path.slice("/api/pages/".length));
				const found = state.pages.find((page) => page.id === pageId);
				if (!found) {
					return Response.json({ message: "Not found" }, { status: 404 });
				}
				if (state.holdDetail) {
					await new Promise<void>((resolve) => {
						state.releaseDetail = resolve;
					});
				}
				if (state.detailFailures > 0) {
					state.detailFailures -= 1;
					return Response.json(
						{ message: "詳細の取得に失敗しました" },
						{ status: 500 },
					);
				}
				const content = state.contents[pageId] ?? {
					revision: 0,
					value: emptyDocument,
				};
				return Response.json({
					page: {
						...found,
						ownerId: state.user?.id ?? alice.id,
						title: state.detailTitle ?? found.title,
					},
					content,
				});
			}
			return new Response("not found", { status: 404 });
		},
	);
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
}

async function openPages(
	path: "/" | "/pages" | "/pages/$pageId" = "/pages",
	pageId?: string,
) {
	render(<App queryClient={createAppQueryClient()} />);
	if (path === "/pages/$pageId") {
		await router.navigate({
			to: path,
			params: { pageId: pageId ?? "missing" },
		});
		return;
	}
	await router.navigate({ to: path });
}

function editorFrom(container: HTMLElement): PlateEditor {
	const textbox = container.querySelector("[data-slate-editor]");
	if (!(textbox instanceof HTMLElement)) {
		throw new Error("editor textbox missing");
	}
	const fiberKey = Object.keys(textbox).find(
		(key) =>
			key.startsWith("__reactFiber$") ||
			key.startsWith("__reactInternalInstance$"),
	);
	let fiber: unknown = fiberKey
		? (textbox as unknown as Record<string, unknown>)[fiberKey]
		: null;
	const seen = new Set<unknown>();
	while (fiber && typeof fiber === "object" && !seen.has(fiber)) {
		seen.add(fiber);
		const props = (fiber as { memoizedProps?: { editor?: PlateEditor } })
			.memoizedProps;
		if (props?.editor && typeof props.editor.tf?.insertText === "function") {
			return props.editor;
		}
		fiber = (fiber as { return?: unknown }).return;
	}
	throw new Error("Plate editor instance was not found");
}

async function replaceDocumentText(text: string) {
	const textbox = await screen.findByRole("textbox", { name: "本文" });
	const editor = editorFrom(textbox.parentElement ?? document.body);
	const block = editor.children[0];
	const leaf =
		block && typeof block === "object" && "children" in block
			? block.children[0]
			: undefined;
	const current =
		leaf &&
		typeof leaf === "object" &&
		"text" in leaf &&
		typeof leaf.text === "string"
			? leaf.text
			: "";
	const range: TRange = {
		anchor: { path: [0, 0], offset: 0 },
		focus: { path: [0, 0], offset: current.length },
	};
	await act(async () => {
		editor.tf.select(range);
		editor.tf.insertText(text, { marks: false });
		await Promise.resolve();
	});
}

function detailKey(userId: string, pageId: string) {
	return ["pages", userId, "detail", pageId] as const;
}

describe("pages view", () => {
	beforeEach(async () => {
		await router.navigate({ to: "/", ignoreBlocker: true });
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		clearPageDraftRecovery(alice.id, "a");
		clearPageDraftRecovery(alice.id, "alice-page");
		clearPageDraftRecovery(bob.id, "a");
	});

	it("protects a title draft for navigation, logout and beforeunload, leaving body edits intact on cancel", async () => {
		const state = createState({
			pages: [summary("a", "A", null), summary("b", "B", null)],
		});
		installApi(state);
		await openPages("/pages/$pageId", "a");
		const user = userEvent.setup();
		await user.click(await screen.findByText("タイトルを編集"));
		await user.clear(screen.getByLabelText("ページタイトル"));
		await user.type(screen.getByLabelText("ページタイトル"), "新題");
		const unload = new Event("beforeunload", { cancelable: true });
		window.dispatchEvent(unload);
		expect(unload.defaultPrevented).toBe(true);
		await user.click(screen.getByRole("button", { name: "B" }));
		await screen.findByText("未保存の変更を破棄して移動しますか");
		await user.click(screen.getByText("戻る"));
		expect(screen.getByLabelText("ページタイトル")).toHaveValue("新題");
		await user.click(screen.getByRole("button", { name: "Logout" }));
		await screen.findByText("未保存の変更を破棄してログアウトしますか");
		await user.click(screen.getByText("戻る"));
		await replaceDocumentText("本文下書き");
		await user.click(screen.getByText("キャンセル"));
		expect(screen.getByText("本文下書き")).toBeVisible();
		const bodyUnload = new Event("beforeunload", { cancelable: true });
		window.dispatchEvent(bodyUnload);
		expect(bodyUnload.defaultPrevented).toBe(true);
	});

	it("restores a title 401 draft for its owner and never exposes it to another user", async () => {
		const view = userEvent.setup();
		const queryClient = createAppQueryClient();
		const state = createState({
			pages: [summary("a", "Alice page", null)],
			patchUnauthorized: 1,
		});
		installApi(state);
		render(<App queryClient={queryClient} />);
		await router.navigate({ to: "/pages/$pageId", params: { pageId: "a" } });
		await view.click(
			await screen.findByRole("button", { name: "タイトルを編集" }),
		);
		await view.clear(screen.getByRole("textbox", { name: "ページタイトル" }));
		await view.type(
			screen.getByRole("textbox", { name: "ページタイトル" }),
			"Alice private title",
		);
		await view.click(screen.getByRole("button", { name: "タイトルを保存" }));
		expect(
			await screen.findByRole("heading", { name: "Login required" }),
		).toBeVisible();

		await act(async () => setSessionUser(queryClient, alice));
		expect(
			await screen.findByRole("textbox", { name: "ページタイトル" }),
		).toHaveValue("Alice private title");
		expect(screen.getByRole("button", { name: "再試行" })).toBeEnabled();

		state.user = bob;
		state.pages = [summary("a", "Bob page", null)];
		state.contents.a = { revision: 0, value: paragraph("Bob body") };
		await act(async () => setSessionUser(queryClient, bob));
		expect(
			await screen.findByRole("heading", { name: "Bob page" }),
		).toBeVisible();
		expect(
			screen.queryByDisplayValue("Alice private title"),
		).not.toBeInTheDocument();
	});

	it("restores a body 401 draft after the same owner reauthenticates", async () => {
		const view = userEvent.setup();
		const queryClient = createAppQueryClient();
		const state = createState({
			pages: [summary("a", "Alice page", null)],
			contents: { a: { revision: 2, value: emptyDocument } },
			putUnauthorized: 1,
		});
		installApi(state);
		render(<App queryClient={queryClient} />);
		await router.navigate({ to: "/pages/$pageId", params: { pageId: "a" } });
		await replaceDocumentText("Alice private body");
		await view.click(await screen.findByRole("button", { name: "保存" }));
		expect(
			await screen.findByRole("heading", { name: "Login required" }),
		).toBeVisible();

		state.holdPut = true;
		await act(async () => setSessionUser(queryClient, alice));
		expect(await screen.findByText("Alice private body")).toBeVisible();
		expect(screen.getByRole("status")).not.toHaveTextContent("保存済み");
		expect(state.puts[0]).toMatchObject({ pageId: "a", revision: 2 });
	});

	it("keeps a newer body recovery when an old successful PUT returns late", async () => {
		const view = userEvent.setup();
		const queryClient = createAppQueryClient();
		const state = createState({
			pages: [summary("a", "Alice page", null)],
			contents: { a: { revision: 2, value: emptyDocument } },
			holdPut: true,
		});
		installApi(state);
		render(<App queryClient={queryClient} />);
		await router.navigate({ to: "/pages/$pageId", params: { pageId: "a" } });
		await replaceDocumentText("Old in-flight body");
		await view.click(await screen.findByRole("button", { name: "保存" }));
		await waitFor(() => expect(state.releasePut).toBeTypeOf("function"));
		const releaseOldPut = state.releasePut;
		await act(async () => setSessionUser(queryClient, null));
		expect(
			await screen.findByRole("heading", { name: "Login required" }),
		).toBeVisible();
		storePageDraftRecovery(alice.id, "a", {
			kind: "content",
			value: paragraph("New recovery body"),
			revision: 2,
		});

		await act(async () => {
			releaseOldPut?.();
			await new Promise<void>((resolve) => setTimeout(resolve, 0));
		});
		expect(readPageDraftRecovery(alice.id, "a", "content")).toEqual({
			kind: "content",
			value: paragraph("New recovery body"),
			revision: 2,
		});
	});

	it("protects a saving title while allowing body save, then reflects the title in the tree", async () => {
		const state = createState({
			pages: [summary("a", "A", null), summary("b", "B", null)],
			holdPatch: true,
		});
		installApi(state);
		await openPages("/pages/$pageId", "a");
		const user = userEvent.setup();
		await user.click(await screen.findByText("タイトルを編集"));
		await user.clear(screen.getByLabelText("ページタイトル"));
		await user.type(screen.getByLabelText("ページタイトル"), "新題");
		await user.click(screen.getByText("タイトルを保存"));
		await waitFor(() => expect(state.patches).toEqual(["新題"]));
		expect(screen.getByRole("button", { name: "B" })).toBeDisabled();
		expect(screen.getByRole("button", { name: "Logout" })).toBeDisabled();
		const unload = new Event("beforeunload", { cancelable: true });
		window.dispatchEvent(unload);
		expect(unload.defaultPrevented).toBe(true);
		await replaceDocumentText("並行保存の本文");
		await user.click(screen.getByRole("button", { name: "保存" }));
		await waitFor(() => expect(state.contents.a?.revision).toBe(1));
		state.holdPatch = false;
		await act(async () => {
			state.releasePatch?.();
		});
		await screen.findByRole("heading", { name: "新題" });
		expect(screen.getByRole("button", { name: "新題" })).toBeVisible();
		expect(screen.getByRole("textbox", { name: "本文" })).toHaveTextContent(
			"並行保存の本文",
		);
		expect(state.contents.a?.revision).toBe(1);
	});

	it("shows the login gate and does not request pages when signed out", async () => {
		const state = createState({ user: null, holdMe: true });
		const fetchMock = installApi(state);
		await openPages();

		expect(await screen.findByText("Checking session...")).toBeVisible();
		expect(
			fetchMock.mock.calls.map(([input]) => getRequestPath(input ?? "")),
		).not.toContain("/api/pages");

		state.releaseMe?.();
		expect(
			await screen.findByRole("heading", { name: "Login required" }),
		).toBeVisible();
		expect(
			within(screen.getByRole("main")).getByRole("link", { name: "Login" }),
		).toHaveAttribute("href", "/login?redirect=%2Fpages");
		expect(
			fetchMock.mock.calls.map(([input]) => getRequestPath(input ?? "")),
		).not.toContain("/api/pages");
	});

	it("shows an empty library and the root create button", async () => {
		installApi(createState());
		await openPages();

		expect(await screen.findByText("ページがありません")).toBeVisible();
		expect(screen.getByRole("button", { name: "新しいページ" })).toBeEnabled();
		expect(screen.getByText("ページを選択してください")).toBeVisible();
	});

	it("renders a nested page tree from the list response", async () => {
		const view = userEvent.setup();
		installApi(
			createState({
				pages: [
					summary("a", "A", null),
					summary("b", "B", "a"),
					summary("c", "C", "b"),
				],
			}),
		);
		await openPages();

		expect(await screen.findByRole("button", { name: "A" })).toBeVisible();
		expect(screen.getByRole("button", { name: "B" })).toBeVisible();
		expect(screen.getByRole("button", { name: "C" })).toBeVisible();
		expect(screen.getByRole("button", { name: "Aを開閉" })).toHaveAttribute(
			"aria-expanded",
			"true",
		);

		await view.click(screen.getByRole("button", { name: "Bを開閉" }));
		expect(screen.getByRole("button", { name: "Bを開閉" })).toHaveAttribute(
			"aria-expanded",
			"false",
		);
		expect(screen.queryByRole("button", { name: "C" })).not.toBeInTheDocument();

		await view.click(screen.getByRole("button", { name: "Bを開閉" }));
		expect(screen.getByRole("button", { name: "C" })).toBeVisible();

		await view.click(screen.getByRole("button", { name: "Aを開閉" }));
		await view.click(screen.getByRole("button", { name: "A" }));
		expect(await screen.findByRole("heading", { name: "A" })).toBeVisible();
		expect(screen.getByRole("button", { name: "Aを開閉" })).toHaveAttribute(
			"aria-expanded",
			"false",
		);
		expect(screen.queryByRole("button", { name: "B" })).not.toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Pages" })).toHaveAttribute(
			"aria-current",
			"page",
		);
	});

	it("creates a root page and opens it", async () => {
		const view = userEvent.setup();
		const state = createState();
		installApi(state);
		await openPages();
		await screen.findByText("ページがありません");

		await view.click(screen.getByRole("button", { name: "新しいページ" }));

		expect(await screen.findByRole("heading", { name: "無題" })).toBeVisible();
		expect(router.state.location.pathname).toBe("/pages/created-1");
		expect(state.posts).toEqual([{ title: "無題", parentId: null }]);
		expect(screen.getByRole("button", { name: "無題" })).toHaveAttribute(
			"aria-current",
			"page",
		);
	});

	it("creates a child under the expanded parent", async () => {
		const view = userEvent.setup();
		const state = createState({
			pages: [summary("a", "A", null), summary("b", "B", "a")],
		});
		installApi(state);
		await openPages();
		await screen.findByRole("button", { name: "B" });

		await view.click(screen.getByRole("button", { name: "Aを開閉" }));
		expect(screen.queryByRole("button", { name: "B" })).not.toBeInTheDocument();
		await view.click(screen.getByRole("button", { name: "Aの子ページを作成" }));

		expect(await screen.findByRole("heading", { name: "無題" })).toBeVisible();
		expect(state.posts).toEqual([{ title: "無題", parentId: "a" }]);
		expect(router.state.location.pathname).toBe("/pages/created-3");
		expect(screen.getByRole("button", { name: "Aを開閉" })).toHaveAttribute(
			"aria-expanded",
			"true",
		);
		expect(screen.getByRole("button", { name: "B" })).toBeVisible();
		expect(screen.getByRole("button", { name: "無題" })).toBeVisible();
	});

	it("duplicates the selected saved page, opens the new detail, and preserves the source", async () => {
		const view = userEvent.setup();
		const parentId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
		const value = [
			{
				type: "h1" as const,
				id: "source0001",
				children: [{ text: "保存済み本文", bold: true }],
			},
		];
		const state = createState({
			pages: [
				summary(parentId, "親", null),
				summary("source", "議事録", parentId),
			],
			contents: { source: { revision: 3, value } },
		});
		installApi(state);
		await openPages("/pages/$pageId", "source");
		await screen.findByRole("heading", { name: "議事録" });
		const duplicateButton = await screen.findByRole("button", {
			name: "ページを複製",
		});
		await waitFor(() => expect(duplicateButton).toBeEnabled());
		await view.click(duplicateButton);
		const dialog = screen.getByRole("dialog", {
			name: "「議事録」を複製しますか",
		});
		expect(
			within(dialog).getByText(
				"このページのタイトルと保存済み本文を複製します。子ページは含みません。",
			),
		).toBeVisible();
		expect(
			within(dialog).getByRole("button", { name: "複製する" }),
		).toBeVisible();
		await view.click(within(dialog).getByRole("button", { name: "複製する" }));
		expect(
			await screen.findByRole("heading", { name: "議事録 のコピー" }),
		).toBeVisible();
		expect(router.state.location.pathname).toBe(
			"/pages/cccccccc-cccc-4ccc-8ccc-000000000001",
		);
		expect(screen.getByText("保存済み本文")).toBeVisible();
		expect(state.duplicates).toHaveLength(1);
		expect(state.duplicates[0]).toMatchObject({
			pageId: "source",
			input: {
				expectedContentRevision: 3,
				expectedTitle: "議事録",
				expectedParentId: parentId,
			},
		});
		expect(state.pages.find((page) => page.id === "source")).toEqual(
			summary("source", "議事録", parentId),
		);
		expect(state.contents.source).toEqual({ revision: 3, value });
	});

	it("retries a lost duplicate response with the same request ID and creates one page", async () => {
		const view = userEvent.setup();
		const state = createState({
			pages: [summary("source", "原本", null)],
			contents: { source: { revision: 2, value: paragraph("保存済み") } },
			duplicateFailures: 1,
		});
		installApi(state);
		await openPages("/pages/$pageId", "source");
		await screen.findByRole("heading", { name: "原本" });
		const button = await screen.findByRole("button", { name: "ページを複製" });
		await waitFor(() => expect(button).toBeEnabled());
		await view.click(button);
		await view.click(screen.getByRole("button", { name: "複製する" }));
		await screen.findByRole("alert");
		expect(state.duplicates).toHaveLength(1);
		const firstRequestId = state.duplicates[0]?.input.requestId;
		await view.click(screen.getByRole("button", { name: "再試行" }));
		expect(
			await screen.findByRole("heading", { name: "原本 のコピー" }),
		).toBeVisible();
		expect(state.duplicates).toHaveLength(2);
		expect(state.duplicates.map((call) => call.input.requestId)).toEqual([
			firstRequestId,
			firstRequestId,
		]);
		expect(
			state.pages.filter((page) => page.title === "原本 のコピー"),
		).toHaveLength(1);
	});

	it("refreshes an explicit source conflict and requires a new confirmed request", async () => {
		const view = userEvent.setup();
		const state = createState({
			pages: [summary("source", "原本", null)],
			contents: { source: { revision: 1, value: paragraph("保存済み") } },
		});
		installApi(state);
		await openPages("/pages/$pageId", "source");
		await screen.findByRole("heading", { name: "原本" });
		const button = await screen.findByRole("button", { name: "ページを複製" });
		await waitFor(() => expect(button).toBeEnabled());
		await view.click(button);
		state.contents.source = {
			revision: 2,
			value: paragraph("新しい保存済み本文"),
		};
		await view.click(screen.getByRole("button", { name: "複製する" }));
		await screen.findByRole("alert");
		const oldRequestId = state.duplicates[0]?.input.requestId;
		await view.click(screen.getByRole("button", { name: "最新の状態を取得" }));
		await view.click(screen.getByRole("button", { name: "複製する" }));
		expect(
			await screen.findByRole("heading", { name: "原本 のコピー" }),
		).toBeVisible();
		expect(state.duplicates).toHaveLength(2);
		expect(state.duplicates[0]?.input.expectedContentRevision).toBe(1);
		expect(state.duplicates[1]?.input.expectedContentRevision).toBe(2);
		expect(state.duplicates[1]?.input.requestId).not.toBe(oldRequestId);
	});

	it("keeps the current tree when creation fails and allows another attempt", async () => {
		const view = userEvent.setup();
		const state = createState({
			pages: [summary("a", "A", null)],
			createFailures: 1,
		});
		installApi(state);
		await openPages();
		await screen.findByRole("button", { name: "A" });

		await view.click(screen.getByRole("button", { name: "新しいページ" }));
		expect(await screen.findByText("作成に失敗しました")).toBeVisible();
		expect(screen.getByRole("button", { name: "新しいページ" })).toBeEnabled();
		expect(
			screen.queryByRole("button", { name: "無題" }),
		).not.toBeInTheDocument();
		expect(router.state.location.pathname).toBe("/pages");

		await view.click(screen.getByRole("button", { name: "新しいページ" }));
		expect(await screen.findByRole("heading", { name: "無題" })).toBeVisible();
		expect(screen.queryByText("作成に失敗しました")).not.toBeInTheDocument();
	});

	it("disables create controls while the request is in flight", async () => {
		const view = userEvent.setup();
		const state = createState({
			pages: [summary("a", "A", null)],
			holdCreate: true,
		});
		installApi(state);
		await openPages();
		await screen.findByRole("button", { name: "A" });

		await view.click(screen.getByRole("button", { name: "新しいページ" }));
		await waitFor(() => {
			expect(
				screen.getByRole("button", { name: "新しいページ" }),
			).toBeDisabled();
		});
		expect(
			screen.getByRole("button", { name: "Aの子ページを作成" }),
		).toBeDisabled();

		state.releaseCreate?.();
		expect(await screen.findByRole("heading", { name: "無題" })).toBeVisible();
		expect(state.posts).toHaveLength(1);
	});

	it.each([
		"home",
		"logout",
	] as const)("does not navigate to a created page after a pending create ends in %s", async (destination) => {
		const view = userEvent.setup();
		const state = createState({ holdCreate: true });
		installApi(state);
		await openPages();
		await screen.findByText("ページがありません");
		await view.click(screen.getByRole("button", { name: "新しいページ" }));
		await waitFor(() => expect(state.releaseCreate).toBeTypeOf("function"));

		if (destination === "home") {
			await router.navigate({ to: "/" });
		} else {
			await view.click(screen.getByRole("button", { name: "Logout" }));
			expect(
				await screen.findByRole("heading", { name: "Login required" }),
			).toBeVisible();
		}

		await act(async () => {
			state.releaseCreate?.();
			await new Promise<void>((resolve) => setTimeout(resolve, 0));
		});
		expect(state.pages).toHaveLength(1);
		expect(router.state.location.pathname).toBe(
			destination === "home" ? "/" : "/pages",
		);
		expect(
			screen.queryByRole("heading", { name: "無題" }),
		).not.toBeInTheDocument();
	});

	it("keeps the login redirect pointed at the requested page", async () => {
		installApi(createState({ user: null }));
		await openPages("/pages/$pageId", "missing");

		expect(
			await screen.findByRole("heading", { name: "Login required" }),
		).toBeVisible();
		expect(
			within(screen.getByRole("main")).getByRole("link", { name: "Login" }),
		).toHaveAttribute("href", "/login?redirect=%2Fpages%2Fmissing");
	});

	it("expands a parent that was still on the initial open state", async () => {
		const view = userEvent.setup();
		const state = createState({
			pages: [summary("a", "A", null)],
		});
		installApi(state);
		await openPages();
		await screen.findByRole("button", { name: "A" });

		await view.click(screen.getByRole("button", { name: "Aの子ページを作成" }));

		expect(await screen.findByRole("heading", { name: "無題" })).toBeVisible();
		expect(state.posts).toEqual([{ title: "無題", parentId: "a" }]);
		expect(screen.getByRole("button", { name: "Aを開閉" })).toHaveAttribute(
			"aria-expanded",
			"true",
		);
	});

	it("shows a missing page without dropping the tree", async () => {
		installApi(createState({ pages: [summary("a", "A", null)] }));
		await openPages("/pages/$pageId", "missing");

		expect(await screen.findByText("ページが見つかりません")).toBeVisible();
		expect(
			screen.queryByRole("textbox", { name: "本文" }),
		).not.toBeInTheDocument();
		expect(screen.getByRole("button", { name: "A" })).toBeVisible();
		expect(
			screen.queryByRole("heading", { name: "A" }),
		).not.toBeInTheDocument();
	});

	it("retries a failed page list and a failed page detail", async () => {
		const view = userEvent.setup();
		const state = createState({
			pages: [summary("a", "A", null)],
			listFailures: 1,
			detailFailures: 1,
			detailTitle: "詳細タイトル",
		});
		installApi(state);
		await openPages();

		expect(await screen.findByText("一覧の取得に失敗しました")).toBeVisible();
		await view.click(screen.getByRole("button", { name: "再試行" }));
		await view.click(await screen.findByRole("button", { name: "A" }));

		expect(await screen.findByText("詳細の取得に失敗しました")).toBeVisible();
		const detail = screen.getByRole("region", { name: "選択中のページ" });
		expect(
			within(detail).queryByRole("textbox", { name: "本文" }),
		).not.toBeInTheDocument();
		await view.click(within(detail).getByRole("button", { name: "再試行" }));
		expect(
			await within(detail).findByRole("heading", { name: "詳細タイトル" }),
		).toBeVisible();
	});

	it("shows the list loading state", async () => {
		const state = createState({ holdList: true });
		installApi(state);
		await openPages();

		expect(await screen.findByText("読み込み中")).toBeVisible();
		state.releaseList?.();
		expect(await screen.findByText("ページがありません")).toBeVisible();
	});

	it("drops the previous user's pages after logout and shows the next user's pages", async () => {
		const view = userEvent.setup();
		const queryClient = createAppQueryClient();
		const state = createState({
			pages: [summary("alice-page", "Alice Page", null)],
		});
		installApi(state);
		render(<App queryClient={queryClient} />);
		await router.navigate({ to: "/pages" });

		expect(
			await screen.findByRole("button", { name: "Alice Page" }),
		).toBeVisible();
		await view.click(screen.getByRole("button", { name: "Logout" }));
		expect(
			await screen.findByRole("heading", { name: "Login required" }),
		).toBeVisible();
		await waitFor(() => {
			expect(
				queryClient.getQueryData(["pages", alice.id, "list"]),
			).toBeUndefined();
		});
		expect(
			screen.queryByRole("button", { name: "Alice Page" }),
		).not.toBeInTheDocument();

		await view.click(
			within(screen.getByRole("main")).getByRole("link", { name: "Login" }),
		);
		await view.type(screen.getByLabelText("Email"), bob.email);
		await view.type(screen.getByLabelText("Password"), "password123456");
		await view.click(screen.getByRole("button", { name: "ログイン" }));

		expect(
			await screen.findByRole("button", { name: "Bob Page" }),
		).toBeVisible();
		expect(
			screen.queryByRole("button", { name: "Alice Page" }),
		).not.toBeInTheDocument();
		expect(
			queryClient.getQueryData(["pages", alice.id, "list"]),
		).toBeUndefined();
	});

	it("shows the saved document from the page detail", async () => {
		const state = createState({
			pages: [summary("a", "A", null)],
			contents: { a: { revision: 4, value: paragraph("初期本文") } },
		});
		installApi(state);
		await openPages("/pages/$pageId", "a");

		const detail = await screen.findByRole("region", {
			name: "選択中のページ",
		});
		expect(
			await within(detail).findByRole("heading", { name: "A" }),
		).toBeVisible();
		expect(within(detail).getByText("初期本文")).toBeVisible();
		expect(within(detail).getByRole("status")).toHaveTextContent("保存済み");
		expect(within(detail).getByRole("button", { name: "保存" })).toBeDisabled();
	});

	it("saves the edited document and shows it again after reload", async () => {
		const view = userEvent.setup();
		const queryClient = createAppQueryClient();
		const state = createState({
			pages: [summary("a", "A", null)],
			contents: { a: { revision: 0, value: emptyDocument } },
		});
		installApi(state);
		render(<App queryClient={queryClient} />);
		await router.navigate({ to: "/pages/$pageId", params: { pageId: "a" } });
		await screen.findByRole("textbox", { name: "本文" });
		const cacheBefore = queryClient.getQueryData(detailKey(alice.id, "a"));

		await replaceDocumentText("hello");
		expect(await screen.findByRole("status")).toHaveTextContent("未保存");
		expect(queryClient.getQueryData(detailKey(alice.id, "a"))).toEqual(
			cacheBefore,
		);
		expect(queryClient.getQueryData(detailKey(alice.id, "a"))).toMatchObject({
			content: { revision: 0, value: emptyDocument },
		});

		await view.click(screen.getByRole("button", { name: "保存" }));
		expect(await screen.findByRole("status")).toHaveTextContent("保存済み");
		expect(state.puts).toHaveLength(1);
		expect(state.puts[0]).toMatchObject({ pageId: "a", revision: 0 });
		expect(JSON.stringify(state.puts[0]?.value)).toContain("hello");
		expect(queryClient.getQueryData(detailKey(alice.id, "a"))).toMatchObject({
			content: { revision: 1 },
			page: { updatedAt: "2026-09-30T00:00:01.000Z" },
		});
		expect(queryClient.getQueryData(["pages", alice.id, "list"])).toMatchObject(
			[{ id: "a", updatedAt: "2026-09-30T00:00:01.000Z" }],
		);
		expect(
			JSON.stringify(queryClient.getQueryData(detailKey(alice.id, "a"))),
		).toContain("hello");

		await replaceDocumentText("hello again");
		expect(await screen.findByRole("status")).toHaveTextContent("未保存");
		await view.click(screen.getByRole("button", { name: "保存" }));
		expect(await screen.findByRole("status")).toHaveTextContent("保存済み");
		expect(state.puts[1]).toMatchObject({ pageId: "a", revision: 1 });
		expect(JSON.stringify(state.puts[1]?.value)).toContain("hello again");

		render(<App queryClient={createAppQueryClient()} />);
		await router.navigate({ to: "/pages/$pageId", params: { pageId: "a" } });
		expect(await screen.findByText(/hello again/)).toBeVisible();
		expect(screen.getByRole("status")).toHaveTextContent("保存済み");
	});

	it("keeps a dirty draft when the detail cache changes", async () => {
		const view = userEvent.setup();
		const queryClient = createAppQueryClient();
		const state = createState({
			pages: [summary("a", "A", null)],
			contents: { a: { revision: 0, value: emptyDocument } },
		});
		installApi(state);
		render(<App queryClient={queryClient} />);
		await router.navigate({ to: "/pages/$pageId", params: { pageId: "a" } });
		await replaceDocumentText("local draft");
		expect(await screen.findByRole("status")).toHaveTextContent("未保存");

		const content = { revision: 4, value: paragraph("other session") };
		state.contents.a = content;
		act(() => {
			queryClient.setQueryData(detailKey(alice.id, "a"), {
				page: { ...summary("a", "A", null), ownerId: alice.id },
				content,
			});
		});

		expect(screen.getByText("local draft")).toBeVisible();
		expect(screen.queryByText("other session")).not.toBeInTheDocument();
		expect(screen.getByRole("status")).toHaveTextContent("未保存");
		expect(screen.getByRole("button", { name: "新しいページ" })).toBeDisabled();

		await view.click(screen.getByRole("button", { name: "保存" }));
		expect(await screen.findByText("別の場所で更新されています")).toBeVisible();
		expect(screen.getByText("local draft")).toBeVisible();
		expect(state.puts[0]).toMatchObject({ pageId: "a", revision: 0 });
	});

	it("shows a newer server copy when the open page has no local changes", async () => {
		const queryClient = createAppQueryClient();
		const state = createState({
			pages: [summary("a", "A", null)],
			contents: { a: { revision: 0, value: paragraph("初期本文") } },
		});
		installApi(state);
		render(<App queryClient={queryClient} />);
		await router.navigate({ to: "/pages/$pageId", params: { pageId: "a" } });
		expect(await screen.findByText("初期本文")).toBeVisible();

		const content = { revision: 5, value: paragraph("fresh") };
		state.contents.a = content;
		act(() => {
			queryClient.setQueryData(detailKey(alice.id, "a"), {
				page: { ...summary("a", "A", null), ownerId: alice.id },
				content,
			});
		});

		expect(await screen.findByText("fresh")).toBeVisible();
		expect(screen.queryByText("初期本文")).not.toBeInTheDocument();
		expect(screen.getByRole("status")).toHaveTextContent("保存済み");
	});

	it("keeps the draft when saving fails and resends it on retry", async () => {
		const view = userEvent.setup();
		const state = createState({
			pages: [summary("a", "A", null)],
			contents: { a: { revision: 2, value: emptyDocument } },
			putFailures: 1,
		});
		installApi(state);
		await openPages("/pages/$pageId", "a");
		await replaceDocumentText("draft");
		await view.click(await screen.findByRole("button", { name: "保存" }));

		expect(await screen.findByText("保存できませんでした")).toBeVisible();
		expect(screen.getByText("draft")).toBeVisible();
		await view.click(screen.getByRole("button", { name: "再試行" }));

		expect(await screen.findByRole("status")).toHaveTextContent("保存済み");
		expect(state.puts).toHaveLength(2);
		expect(state.puts[0]).toMatchObject({ pageId: "a", revision: 2 });
		expect(state.puts[1]).toMatchObject({ pageId: "a", revision: 2 });
		expect(state.puts[0]?.value).toEqual(state.puts[1]?.value);
		expect(JSON.stringify(state.puts[0]?.value)).toContain("draft");
	});

	it("replaces the visible draft when the reloaded server revision is unchanged", async () => {
		const view = userEvent.setup();
		const state = createState({
			pages: [summary("a", "A", null)],
			contents: { a: { revision: 0, value: emptyDocument } },
			putConflict: { currentRevision: 0, value: paragraph("server copy") },
		});
		installApi(state);
		await openPages("/pages/$pageId", "a");
		await replaceDocumentText("local draft");
		await view.click(await screen.findByRole("button", { name: "保存" }));
		await view.click(
			await screen.findByRole("button", { name: "サーバー版を読み込み直す" }),
		);
		await view.click(
			screen.getByRole("button", { name: "破棄して読み込み直す" }),
		);

		expect(await screen.findByText("server copy")).toBeVisible();
		expect(screen.queryByText("local draft")).not.toBeInTheDocument();
		expect(screen.getByRole("status")).toHaveTextContent("保存済み");
	});

	it("keeps the draft when reloading the server copy fails", async () => {
		const view = userEvent.setup();
		const state = createState({
			pages: [summary("a", "A", null)],
			contents: { a: { revision: 0, value: emptyDocument } },
			putConflict: { currentRevision: 3, value: paragraph("server copy") },
		});
		installApi(state);
		await openPages("/pages/$pageId", "a");
		await replaceDocumentText("local draft");
		await view.click(await screen.findByRole("button", { name: "保存" }));
		await view.click(
			await screen.findByRole("button", { name: "サーバー版を読み込み直す" }),
		);
		state.detailFailures = 1;
		await view.click(
			screen.getByRole("button", { name: "破棄して読み込み直す" }),
		);

		expect(await screen.findByText("詳細の取得に失敗しました")).toBeVisible();
		expect(screen.getByText("local draft")).toBeVisible();
		expect(screen.getByRole("status")).toHaveTextContent(
			"別の場所で更新されています",
		);
	});

	it.each([
		false,
		true,
	])("ignores a cancelled reload response (failure: %s)", async (fails) => {
		const view = userEvent.setup();
		const state = createState({
			pages: [summary("a", "A", null)],
			contents: { a: { revision: 0, value: emptyDocument } },
			putConflict: { currentRevision: 3, value: paragraph("server copy") },
		});
		const fetchMock = installApi(state);
		await openPages("/pages/$pageId", "a");
		await replaceDocumentText("local draft");
		await view.click(await screen.findByRole("button", { name: "保存" }));
		await view.click(
			await screen.findByRole("button", { name: "サーバー版を読み込み直す" }),
		);
		state.holdDetail = true;
		state.detailFailures = fails ? 1 : 0;
		await view.click(
			screen.getByRole("button", { name: "破棄して読み込み直す" }),
		);
		await waitFor(() => expect(state.releaseDetail).toBeTypeOf("function"));
		await view.click(screen.getByRole("button", { name: "戻る" }));
		await replaceDocumentText("new draft after cancellation");
		const latestDraft = screen.getByRole("textbox", {
			name: "本文",
		}).textContent;
		await act(async () => {
			state.releaseDetail?.();
			await Promise.all(fetchMock.mock.results.map((result) => result.value));
		});
		await waitFor(() =>
			expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
		);
		expect(screen.getByRole("textbox", { name: "本文" }).textContent).toBe(
			latestDraft,
		);
		expect(screen.queryByText("server copy")).not.toBeInTheDocument();
		expect(screen.getByRole("status")).toHaveTextContent(
			"別の場所で更新されています",
		);
		// Reopening must not show an error from the cancelled request.
		await view.click(
			screen.getByRole("button", { name: "サーバー版を読み込み直す" }),
		);
		expect(
			screen.queryByText("詳細の取得に失敗しました"),
		).not.toBeInTheDocument();
		await view.click(screen.getByRole("button", { name: "戻る" }));
	});

	it("keeps the draft on conflict and reloads the server copy only after confirmation", async () => {
		const view = userEvent.setup();
		const state = createState({
			pages: [summary("a", "A", null)],
			contents: { a: { revision: 0, value: emptyDocument } },
			putConflict: { currentRevision: 3, value: paragraph("server copy") },
		});
		installApi(state);
		await openPages("/pages/$pageId", "a");
		await replaceDocumentText("local draft");
		await view.click(await screen.findByRole("button", { name: "保存" }));

		expect(await screen.findByText("別の場所で更新されています")).toBeVisible();
		expect(screen.getByText("local draft")).toBeVisible();
		expect(state.puts).toHaveLength(1);

		await view.click(
			screen.getByRole("button", { name: "サーバー版を読み込み直す" }),
		);
		await view.click(screen.getByRole("button", { name: "戻る" }));
		expect(screen.getByText("local draft")).toBeVisible();
		expect(state.puts).toHaveLength(1);

		await view.click(
			screen.getByRole("button", { name: "サーバー版を読み込み直す" }),
		);
		await view.click(
			screen.getByRole("button", { name: "破棄して読み込み直す" }),
		);
		expect(await screen.findByText("server copy")).toBeVisible();
		expect(screen.queryByText("local draft")).not.toBeInTheDocument();
		expect(screen.getByRole("status")).toHaveTextContent("保存済み");
		expect(state.puts).toHaveLength(1);
	});

	it("keeps the editor editable during a save and blocks leaving", async () => {
		const view = userEvent.setup();
		const queryClient = createAppQueryClient();
		const state = createState({
			pages: [summary("a", "A", null), summary("b", "B", null)],
			contents: { a: { revision: 0, value: emptyDocument } },
			holdPut: true,
		});
		installApi(state);
		render(<App queryClient={queryClient} />);
		await router.navigate({ to: "/pages/$pageId", params: { pageId: "a" } });
		await replaceDocumentText("pending");
		await view.click(await screen.findByRole("button", { name: "保存" }));

		expect(await screen.findByRole("status")).toHaveTextContent("保存中");
		expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
		expect(screen.getByLabelText("本文")).toHaveAttribute(
			"contenteditable",
			"true",
		);
		expect(screen.getByRole("button", { name: "Logout" })).toBeDisabled();
		expect(screen.getByRole("button", { name: "B" })).toBeDisabled();
		expect(screen.getByRole("button", { name: "新しいページ" })).toBeDisabled();

		await replaceDocumentText("pending more");
		expect(screen.getByRole("status")).toHaveTextContent("保存中");
		expect(state.puts).toHaveLength(1);
		expect(JSON.stringify(state.puts[0]?.value)).toContain("pending");
		expect(JSON.stringify(state.puts[0]?.value)).not.toContain("pending more");
		expect(screen.getByText("pending more")).toBeVisible();

		const unloadEvent = new Event("beforeunload", { cancelable: true });
		window.dispatchEvent(unloadEvent);
		expect(unloadEvent.defaultPrevented).toBe(true);
		expect(router.state.location.pathname).toBe("/pages/a");

		await view.click(screen.getByRole("link", { name: "Home" }));
		expect(
			await screen.findByText("保存が終わるまで移動できません"),
		).toBeVisible();
		expect(
			screen.queryByRole("button", { name: "破棄して移動" }),
		).not.toBeInTheDocument();
		expect(router.state.location.pathname).toBe("/pages/a");

		state.releasePut?.();
		expect(await screen.findByRole("status")).toHaveTextContent("未保存");
		expect(screen.getByText("pending more")).toBeVisible();
		expect(state.puts).toHaveLength(1);
		const cached = JSON.stringify(
			queryClient.getQueryData(detailKey(alice.id, "a")),
		);
		expect(cached).toContain("pending");
		expect(cached).not.toContain("pending more");
		expect(
			screen.queryByText("保存が終わるまで移動できません"),
		).not.toBeInTheDocument();
		expect(router.state.location.pathname).toBe("/pages/a");
		expect(screen.getByRole("button", { name: "B" })).toBeEnabled();
	});

	it("asks before leaving an unsaved page, logging out, or closing the tab", async () => {
		const view = userEvent.setup();
		const state = createState({
			pages: [summary("a", "A", null), summary("b", "B", null)],
			contents: {
				a: { revision: 0, value: emptyDocument },
				b: { revision: 0, value: paragraph("page b") },
			},
		});
		installApi(state);
		await openPages("/pages/$pageId", "a");
		await screen.findByRole("textbox", { name: "本文" });

		const cleanUnload = new Event("beforeunload", { cancelable: true });
		window.dispatchEvent(cleanUnload);
		expect(cleanUnload.defaultPrevented).toBe(false);

		await replaceDocumentText("only a");
		expect(await screen.findByRole("status")).toHaveTextContent("未保存");
		expect(screen.getByRole("button", { name: "新しいページ" })).toBeDisabled();
		expect(
			screen.getByRole("button", { name: "Aの子ページを作成" }),
		).toBeDisabled();
		const dirtyUnload = new Event("beforeunload", { cancelable: true });
		window.dispatchEvent(dirtyUnload);
		expect(dirtyUnload.defaultPrevented).toBe(true);

		await view.click(screen.getByRole("button", { name: "B" }));
		expect(
			await screen.findByRole("heading", {
				name: "未保存の変更を破棄して移動しますか",
			}),
		).toBeVisible();
		await view.click(screen.getByRole("button", { name: "戻る" }));
		expect(screen.getByText("only a")).toBeVisible();
		expect(router.state.location.pathname).toBe("/pages/a");

		await view.click(screen.getByRole("button", { name: "B" }));
		await view.click(
			await screen.findByRole("button", { name: "破棄して移動" }),
		);
		expect(await screen.findByText("page b")).toBeVisible();
		expect(screen.queryByText("only a")).not.toBeInTheDocument();
		expect(state.puts).toHaveLength(0);
		expect(router.state.location.pathname).toBe("/pages/b");
		expect(screen.getByRole("button", { name: "新しいページ" })).toBeEnabled();

		await router.navigate({ to: "/pages/$pageId", params: { pageId: "a" } });
		await replaceDocumentText("only a");
		await view.click(screen.getByRole("button", { name: "Logout" }));
		expect(
			await screen.findByRole("heading", {
				name: "未保存の変更を破棄してログアウトしますか",
			}),
		).toBeVisible();
		await view.click(screen.getByRole("button", { name: "戻る" }));
		expect(screen.getByText("only a")).toBeVisible();
		expect(screen.getByText("Alice (member)")).toBeVisible();

		await view.click(screen.getByRole("button", { name: "Logout" }));
		await view.click(
			await screen.findByRole("button", { name: "破棄してログアウト" }),
		);
		expect(
			await screen.findByRole("heading", { name: "Login required" }),
		).toBeVisible();
	});

	it("drops the previous user's page content after signing in as someone else", async () => {
		const view = userEvent.setup();
		const queryClient = createAppQueryClient();
		const state = createState({
			pages: [summary("alice-page", "Alice Page", null)],
			contents: {
				"alice-page": { revision: 0, value: paragraph("alice secret") },
			},
		});
		installApi(state);
		render(<App queryClient={queryClient} />);
		await router.navigate({
			to: "/pages/$pageId",
			params: { pageId: "alice-page" },
		});
		expect(await screen.findByText("alice secret")).toBeVisible();

		await view.click(screen.getByRole("button", { name: "Logout" }));
		expect(
			await screen.findByRole("heading", { name: "Login required" }),
		).toBeVisible();
		await waitFor(() => {
			expect(
				queryClient.getQueryData(detailKey(alice.id, "alice-page")),
			).toBeUndefined();
		});

		await view.click(
			within(screen.getByRole("main")).getByRole("link", { name: "Login" }),
		);
		await view.type(screen.getByLabelText("Email"), bob.email);
		await view.type(screen.getByLabelText("Password"), "password123456");
		await view.click(screen.getByRole("button", { name: "ログイン" }));

		expect(
			await screen.findByRole("button", { name: "Bob Page" }),
		).toBeVisible();
		expect(screen.queryByText("alice secret")).not.toBeInTheDocument();
		expect(
			queryClient.getQueryData(detailKey(alice.id, "alice-page")),
		).toBeUndefined();
	});

	it("moves the selected page under a new parent without replacing its editor", async () => {
		const view = userEvent.setup();
		const state = createState({
			pages: [
				summary("destination", "Destination", null),
				summary("source", "Source", null),
				summary("child", "Child", "source"),
			],
			contents: { source: { revision: 2, value: paragraph("preserved body") } },
		});
		installApi(state);
		await openPages("/pages/$pageId", "source");
		const editor = await screen.findByRole("textbox", { name: "本文" });
		expect(editor).toHaveTextContent("preserved body");
		const currentUrl = router.state.location.pathname;
		await view.click(
			await screen.findByRole("button", { name: "ページを移動" }),
		);
		const dialog = await screen.findByRole("dialog", { name: "ページを移動" });
		const select = within(dialog).getByLabelText("移動先");
		expect(
			within(dialog).queryByRole("option", { name: "Source" }),
		).not.toBeInTheDocument();
		expect(
			within(dialog).queryByRole("option", { name: "Source › Child" }),
		).not.toBeInTheDocument();
		await view.selectOptions(select, "destination");
		await view.click(within(dialog).getByRole("button", { name: "移動する" }));
		await waitFor(() =>
			expect(state.moves).toEqual([
				{ pageId: "source", parentId: "destination", expectedParentId: null },
			]),
		);
		expect(
			await screen.findByRole("heading", { name: "Source" }),
		).toBeVisible();
		expect(screen.getByRole("textbox", { name: "本文" })).toHaveTextContent(
			"preserved body",
		);
		expect(router.state.location.pathname).toBe(currentUrl);
		const destinationRow = screen
			.getByRole("button", { name: "Destination" })
			.closest("li");
		expect(destinationRow).toContainElement(
			screen.getByRole("button", { name: "Source" }),
		);
		expect(screen.getByRole("button", { name: "Child" })).toBeVisible();
	});

	it("does not resend a successful move when refreshing the list fails", async () => {
		const view = userEvent.setup();
		const state = createState({
			pages: [
				summary("destination", "Destination", null),
				summary("source", "Source", null),
			],
		});
		installApi(state);
		await openPages("/pages/$pageId", "source");
		await screen.findByRole("heading", { name: "Source" });
		state.listFailures = 1;
		await view.click(
			await screen.findByRole("button", { name: "ページを移動" }),
		);
		const dialog = await screen.findByRole("dialog", { name: "ページを移動" });
		await view.selectOptions(
			within(dialog).getByLabelText("移動先"),
			"destination",
		);
		await view.click(within(dialog).getByRole("button", { name: "移動する" }));
		expect(
			await screen.findByText(
				"移動しました。一覧を更新できませんでした。状態を確認してください。",
			),
		).toBeVisible();
		expect(state.moves).toHaveLength(1);
		await view.click(screen.getByRole("button", { name: "状態を確認" }));
		await waitFor(() => expect(state.moves).toHaveLength(1));
		await waitFor(() => {
			expect(screen.getByRole("button", { name: /^Source$/ })).toBeVisible();
		});
	});
});

describe("integrated move and duplicate failure recovery", () => {
	it.each([
		{
			status: 409,
			body: {
				message: "Page parent conflict",
				code: "PAGE_PARENT_CONFLICT",
				currentParentId: null,
			},
			message: "別の場所でページが移動されています。状態を確認してください。",
		},
		{
			status: 409,
			body: {
				message: "Invalid page hierarchy",
				code: "INVALID_PAGE_HIERARCHY",
			},
			message: "自分自身や子ページの中には移動できません。",
		},
		{
			status: 404,
			body: { message: "missing" },
			message: "ページまたは移動先が見つかりません。状態を確認してください。",
		},
		{
			status: 500,
			body: { message: "failed" },
			message: "移動結果を確認できませんでした。状態を確認してください。",
		},
	])("retains the editor and requires checking a failed move $status", async ({
		status,
		body,
		message,
	}) => {
		const user = userEvent.setup();
		const state = createState({
			pages: [
				summary("source", "Source", null),
				summary("destination", "Destination", null),
			],
			contents: { source: { revision: 2, value: paragraph("retained") } },
			moveError: { status, body },
		});
		installApi(state);
		await openPages("/pages/$pageId", "source");
		const retainedEditor = await screen.findByRole("textbox", { name: "本文" });
		await user.click(
			await screen.findByRole("button", { name: "ページを移動" }),
		);
		const dialog = await screen.findByRole("dialog", { name: "ページを移動" });
		await user.selectOptions(
			within(dialog).getByLabelText("移動先"),
			"destination",
		);
		await user.click(within(dialog).getByRole("button", { name: "移動する" }));
		await screen.findByText(message);
		expect(state.moves).toHaveLength(1);
		expect(retainedEditor).toHaveTextContent("retained");
		await user.click(screen.getByRole("button", { name: "状態を確認" }));
		await screen.findByText(
			"最新の場所を確認しました。移動を続ける場合は、もう一度「移動する」を選んでください。",
		);
		expect(state.moves).toHaveLength(1);
		state.moveError = undefined;
		await user.click(within(dialog).getByRole("button", { name: "移動する" }));
		await waitFor(() =>
			expect(state.pages.find((p) => p.id === "source")?.parentId).toBe(
				"destination",
			),
		);
	});
	it.each([
		{
			status: 409,
			body: { message: "conflict", code: "DUPLICATE_REQUEST_CONFLICT" },
			message:
				"複製操作の識別情報が競合しました。新しい複製を開始してください。",
		},
		{
			status: 409,
			body: { message: "missing", code: "DUPLICATED_PAGE_UNAVAILABLE" },
			message: "作成済みの複製ページを利用できません。",
		},
		{
			status: 404,
			body: { message: "missing" },
			message: "ページが見つかりません。状態を再取得してください。",
		},
		{
			status: 413,
			body: { message: "large" },
			message: "本文が複製可能なサイズを超えています。",
		},
	])("keeps source data when duplication fails $status", async ({
		status,
		body,
		message,
	}) => {
		const user = userEvent.setup();
		const state = createState({
			pages: [summary("source", "Source", null)],
			contents: { source: { revision: 2, value: paragraph("retained") } },
			duplicateError: { status, body },
		});
		installApi(state);
		await openPages("/pages/$pageId", "source");
		await screen.findByRole("heading", { name: "Source" });
		const button = await screen.findByRole("button", { name: "ページを複製" });
		await waitFor(() => expect(button).toBeEnabled());
		await user.click(button);
		await user.click(screen.getByRole("button", { name: "複製する" }));
		await screen.findByText(message);
		expect(state.pages).toHaveLength(1);
		expect(state.contents.source?.revision).toBe(2);
		expect(router.state.location.pathname).toContain("source");
		await user.click(screen.getByRole("button", { name: "キャンセル" }));
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	});
});

it("retains a move failure if checking current state also fails", async () => {
	const user = userEvent.setup();
	const state = createState({
		pages: [
			summary("source", "Source", null),
			summary("destination", "Destination", null),
		],
		moveError: { status: 500, body: { message: "offline" } },
	});
	installApi(state);
	await openPages("/pages/$pageId", "source");
	await screen.findByRole("heading", { name: "Source" });
	await user.click(screen.getByRole("button", { name: "ページを移動" }));
	const dialog = await screen.findByRole("dialog", { name: "ページを移動" });
	await user.selectOptions(
		within(dialog).getByLabelText("移動先"),
		"destination",
	);
	await user.click(within(dialog).getByRole("button", { name: "移動する" }));
	await screen.findByText(
		"移動結果を確認できませんでした。状態を確認してください。",
	);
	state.listFailures = 1;
	await user.click(screen.getByRole("button", { name: "状態を確認" }));
	await screen.findByRole("alert");
	expect(state.moves).toHaveLength(1);
	expect(
		within(dialog).getByRole("button", { name: "移動する" }),
	).toBeDisabled();
});
it("retains the source conflict when fetching the latest duplicate snapshot fails", async () => {
	const user = userEvent.setup();
	const state = createState({
		pages: [summary("source", "Source", null)],
		contents: { source: { revision: 1, value: paragraph("saved") } },
		duplicateError: {
			status: 409,
			body: { code: "SOURCE_PAGE_CHANGED", message: "changed" },
		},
	});
	installApi(state);
	await openPages("/pages/$pageId", "source");
	await screen.findByRole("heading", { name: "Source" });
	const button = screen.getByRole("button", { name: "ページを複製" });
	await waitFor(() => expect(button).toBeEnabled());
	await user.click(button);
	await user.click(screen.getByRole("button", { name: "複製する" }));
	await screen.findByRole("alert");
	state.detailFailures = 1;
	await user.click(screen.getByRole("button", { name: "最新の状態を取得" }));
	await screen.findByText(
		"最新のページ状態を取得できませんでした。もう一度お試しください。",
	);
	expect(state.duplicates).toHaveLength(1);
	expect(state.pages).toHaveLength(1);
});

it("ignores a held duplicate response after the user session is cleared", async () => {
	const user = userEvent.setup();
	const state = createState({
		pages: [summary("source", "Source", null)],
		holdDuplicate: true,
	});
	installApi(state);
	const client = createAppQueryClient();
	render(<App queryClient={client} />);
	await router.navigate({ to: "/pages/$pageId", params: { pageId: "source" } });
	await screen.findByRole("heading", { name: "Source" });
	const button = screen.getByRole("button", { name: "ページを複製" });
	await waitFor(() => expect(button).toBeEnabled());
	await user.click(button);
	await user.click(screen.getByRole("button", { name: "複製する" }));
	await waitFor(() => expect(state.releaseDuplicate).toBeDefined());
	state.user = null;
	await act(async () => {
		await setSessionUser(client, null);
	});
	await act(async () => {
		state.releaseDuplicate?.();
		await Promise.resolve();
	});
	await waitFor(() => expect(client.getQueryData(["auth", "me"])).toBeNull());
	expect(client.getQueryData(["pages", alice.id, "list"])).toBeUndefined();
	expect(
		screen.queryByRole("heading", { name: "Source のコピー" }),
	).not.toBeInTheDocument();
});

it("recognizes a move already completed when the original response was lost", async () => {
	const user = userEvent.setup();
	const state = createState({
		pages: [
			summary("source", "Source", null),
			summary("destination", "Destination", null),
		],
		moveError: { status: 500, body: { message: "offline" } },
	});
	installApi(state);
	await openPages("/pages/$pageId", "source");
	await screen.findByRole("heading", { name: "Source" });
	await user.click(screen.getByRole("button", { name: "ページを移動" }));
	const dialog = await screen.findByRole("dialog", { name: "ページを移動" });
	await user.selectOptions(
		within(dialog).getByLabelText("移動先"),
		"destination",
	);
	await user.click(within(dialog).getByRole("button", { name: "移動する" }));
	await screen.findByText(
		"移動結果を確認できませんでした。状態を確認してください。",
	);
	state.pages = state.pages.map((p) =>
		p.id === "source" ? { ...p, parentId: "destination" } : p,
	);
	await user.click(screen.getByRole("button", { name: "状態を確認" }));
	await screen.findByText("現在この場所にあります");
	expect(state.moves).toHaveLength(1);
});
