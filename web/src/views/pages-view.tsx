import { Link, useBlocker, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LockKeyhole } from "lucide-react";
import type { Value } from "platejs";
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import type { GetPageResponse } from "@shared/schemas/pages.schema";
import type { DuplicatePageInput, Page } from "@shared/schemas/pages.schema";
import {
	DuplicatePageConflictError,
	type DuplicatePageConflictCode,
	HttpStatusError,
	useCreatePageMutation,
	useMovePageMutation,
	PageParentConflictError,
	InvalidPageHierarchyError,
	useDuplicatePageMutation,
	usePageQuery,
	usePagesQuery,
	useUpdatePageContentMutation,
	type PageSummary,
} from "../api";
import { useAuth } from "../auth-context";
import { PageTitleEditor } from "../components/page-title-editor";
import { PageDuplicateDialog } from "../components/page-duplicate-dialog";
import { PageEditor } from "../components/page-editor";
import { PageMoveDialog } from "../components/page-move-dialog";
import { PageTree, type PageTreeItem } from "../components/page-tree";
import {
	clearPageDraftRecovery,
	clearPageDraftRecoveryIfVersion,
	pageDraftRecoveryVersion,
	readPageDraftRecovery,
	storePageDraftRecovery,
	storePageDraftRecoveryIfVersion,
} from "../page-draft-recovery";
import {
	pageAutosaveStatusLabel,
	usePageAutosave,
	type PageAutosaveStatus,
} from "../hooks/use-page-autosave";
import {
	PageLeaveDialog,
	type PageEditGuardState,
	usePageAutosaveHold,
	usePageEditGuard,
	useSyncPageEditGuard,
} from "../page-edit-guard";
import { fetchPage } from "../api";
import { authMeQueryKey, type AuthUser } from "../api";

function parentsWithChildren(pages: readonly PageTreeItem[]): Set<string> {
	const ids = new Set(pages.map((page) => page.id));
	const parents = new Set<string>();
	for (const page of pages) {
		if (page.parentId && ids.has(page.parentId)) parents.add(page.parentId);
	}
	return parents;
}

function isNotFound(error: unknown): boolean {
	return error instanceof HttpStatusError && error.status === 404;
}

function PageDocument({
	userId,
	pageId,
	detail,
	pages,
	moveRequest,
	onMoveSuccess,
	duplicateLocked,
	duplicatePending,
}: {
	userId: string;
	pageId: string;
	detail: GetPageResponse;
	pages: readonly PageSummary[];
	moveRequest: number;
	onMoveSuccess: (parentId: string | null) => void;
	duplicateLocked: boolean;
	duplicatePending: boolean;
}) {
	const queryClient = useQueryClient();
	const pageQuery = usePageQuery(userId, pageId);
	const mutation = useUpdatePageContentMutation(userId, pageId);
	const moveMutation = useMovePageMutation(userId, pageId);
	const serverValue = detail.content.value as Value;
	const [recoveredContent, setRecoveredContent] = useState(() =>
		readPageDraftRecovery(userId, pageId, "content"),
	);
	const recovery =
		recoveredContent?.kind === "content" ? recoveredContent : null;
	const initialValue = recovery?.value ?? serverValue;
	const latestValueRef = useRef(initialValue);
	const logoutHold = usePageAutosaveHold();
	const [reloadConfirmOpen, setReloadConfirmOpen] = useState(false);
	const [reloadError, setReloadError] = useState<string | null>(null);
	const [moveOpen, setMoveOpen] = useState(false);
	const [moveError, setMoveError] = useState<string | null>(null);
	const [moveExpectedParentId, setMoveExpectedParentId] = useState<
		string | null
	>(detail.page.parentId);
	const [moveTargetParentId, setMoveTargetParentId] = useState<string | null>(
		null,
	);
	const [moveNeedsCheck, setMoveNeedsCheck] = useState(false);
	const [moveChecking, setMoveChecking] = useState(false);
	const moveSendingRef = useRef(false);
	const handledMoveRequest = useRef(moveRequest);
	const reloadRequestRef = useRef(0);
	useEffect(
		() => () => {
			reloadRequestRef.current += 1;
		},
		[],
	);
	const [titleGuard, setTitleGuard] = useState<PageEditGuardState>({
		unsaved: false,
		saving: false,
	});
	const leaveRef = useRef({ unsaved: false, saving: false });
	const shouldBlockFn = useCallback(
		() => leaveRef.current.unsaved || leaveRef.current.saving,
		[],
	);
	const enableBeforeUnload = useCallback(
		() => leaveRef.current.unsaved || leaveRef.current.saving,
		[],
	);
	const blocker = useBlocker({
		shouldBlockFn,
		enableBeforeUnload,
		withResolver: true,
	});
	const bodyStatusRef = useRef<PageAutosaveStatus>("saved");
	const discardHold =
		logoutHold ||
		reloadConfirmOpen ||
		(blocker.status === "blocked" && bodyStatusRef.current !== "saving");
	const autosave = usePageAutosave({
		userId,
		pageId,
		serverValue: initialValue,
		serverRevision: recovery?.revision ?? detail.content.revision,
		initialUnsaved: Boolean(recovery),
		hold: discardHold,
		save: async (input) => {
			const recoveryVersion = pageDraftRecoveryVersion(
				userId,
				pageId,
				"content",
			);
			try {
				const body = await mutation.mutateAsync({
					revision: input.revision,
					value: input.value as GetPageResponse["content"]["value"],
				});
				if (
					JSON.stringify(latestValueRef.current) === JSON.stringify(input.value)
				) {
					const cleared = clearPageDraftRecoveryIfVersion(
						userId,
						pageId,
						"content",
						recoveryVersion,
					);
					if (cleared) setRecoveredContent(null);
				}
				return {
					revision: body.content.revision,
					value: body.content.value as Value,
				};
			} catch (error) {
				if (error instanceof HttpStatusError && error.status === 401) {
					storePageDraftRecoveryIfVersion(
						userId,
						pageId,
						{
							kind: "content",
							value: latestValueRef.current,
							revision: input.revision,
						},
						recoveryVersion,
					);
				}
				throw error;
			}
		},
	});
	latestValueRef.current = autosave.latestValue;
	const phase = autosave.status;
	bodyStatusRef.current = phase;
	const bodyUnsaved =
		phase === "unsaved" || phase === "failed" || phase === "conflict";
	const unsaved = bodyUnsaved || titleGuard.unsaved;
	const saving =
		phase === "saving" ||
		titleGuard.saving ||
		moveMutation.isPending ||
		duplicatePending;
	leaveRef.current = { unsaved, saving };
	useSyncPageEditGuard({ unsaved, saving });
	useEffect(() => {
		if (moveRequest === handledMoveRequest.current) return;
		handledMoveRequest.current = moveRequest;
		if (leaveRef.current.unsaved || leaveRef.current.saving) {
			setMoveError("変更を保存するか取り消してから移動してください");
			return;
		}
		setMoveExpectedParentId(detail.page.parentId);
		setMoveTargetParentId(null);
		setMoveError(null);
		setMoveNeedsCheck(false);
		setMoveOpen(true);
	}, [detail.page.parentId, moveRequest]);
	const blockedDuringSave = useRef(false);
	useEffect(() => {
		if (blocker.status !== "blocked") {
			blockedDuringSave.current = false;
			return;
		}
		if (saving) {
			blockedDuringSave.current = true;
			return;
		}
		if (blockedDuringSave.current) {
			blockedDuringSave.current = false;
			blocker.reset();
		}
	}, [blocker, saving]);

	const reloadServer = async () => {
		const requestId = ++reloadRequestRef.current;
		const result = await pageQuery.refetch();
		// A cancelled request may still finish and update the query cache.
		// Only the active confirmation may replace the local draft or show errors.
		if (requestId !== reloadRequestRef.current) return;
		if (result.isError || !result.data) {
			const message =
				result.error instanceof Error
					? result.error.message
					: "読み込みに失敗しました";
			setReloadError(message);
			return;
		}
		clearPageDraftRecovery(userId, pageId, "content");
		setRecoveredContent(null);
		autosave.resetToServer(
			structuredClone(result.data.content.value) as Value,
			result.data.content.revision,
		);
		mutation.reset();
		setReloadError(null);
		setReloadConfirmOpen(false);
	};

	const checkMoveState = async () => {
		setMoveError(null);
		setMoveChecking(true);
		try {
			await queryClient.refetchQueries(
				{ queryKey: ["pages", userId, "list"], type: "active" },
				{ throwOnError: true },
			);
			const result = await pageQuery.refetch({ throwOnError: true });
			if (!result.data) throw new Error("状態を確認できませんでした");
			const latestParentId = result.data.page.parentId;
			setMoveExpectedParentId(latestParentId);
			setMoveNeedsCheck(false);
			setMoveError(
				latestParentId === moveTargetParentId
					? "現在この場所にあります"
					: "最新の場所を確認しました。移動を続ける場合は、もう一度「移動する」を選んでください。",
			);
		} catch (error) {
			setMoveNeedsCheck(true);
			setMoveError(
				error instanceof Error ? error.message : "状態を確認できませんでした",
			);
		} finally {
			setMoveChecking(false);
		}
	};

	const submitMove = async (parentId: string | null) => {
		if (
			leaveRef.current.unsaved ||
			leaveRef.current.saving ||
			moveMutation.isPending ||
			moveSendingRef.current ||
			moveNeedsCheck
		) {
			setMoveError("変更の保存中または未保存の変更があるため移動できません");
			return;
		}
		moveSendingRef.current = true;
		setMoveError(null);
		setMoveTargetParentId(parentId);
		try {
			await moveMutation.mutateAsync({
				parentId,
				expectedParentId: moveExpectedParentId,
			});
			onMoveSuccess(parentId);
			const listState = queryClient.getQueryState(["pages", userId, "list"]);
			const detailState = queryClient.getQueryState([
				"pages",
				userId,
				"detail",
				pageId,
			]);
			setMoveError(
				listState?.status === "error" || detailState?.status === "error"
					? "移動しました。一覧を更新できませんでした。状態を確認してください。"
					: null,
			);
			setMoveExpectedParentId(parentId);
			setMoveNeedsCheck(false);
			setMoveOpen(false);
		} catch (error) {
			setMoveNeedsCheck(true);
			if (error instanceof PageParentConflictError) {
				setMoveError(
					"別の場所でページが移動されています。状態を確認してください。",
				);
			} else if (error instanceof InvalidPageHierarchyError) {
				setMoveError("自分自身や子ページの中には移動できません。");
			} else if (error instanceof HttpStatusError && error.status === 404) {
				setMoveError(
					"ページまたは移動先が見つかりません。状態を確認してください。",
				);
			} else {
				setMoveError(
					"移動結果を確認できませんでした。状態を確認してください。",
				);
			}
		} finally {
			moveSendingRef.current = false;
		}
	};

	return (
		<article className="page-document">
			{moveError && !moveOpen ? (
				<div>
					<p className="pages-error" role="alert">
						{moveError}
					</p>
					<button
						className="auth-open-button"
						onClick={() => void checkMoveState()}
						type="button"
					>
						状態を確認
					</button>
				</div>
			) : null}
			<PageTitleEditor
				userId={userId}
				pageId={pageId}
				title={detail.page.title}
				onGuardChange={setTitleGuard}
				editingDisabled={moveOpen || duplicateLocked}
			/>
			<PageEditor
				initialValue={autosave.latestValue}
				key={autosave.generation}
				onChange={(value) => {
					autosave.onChange(value);
					if (recovery) {
						storePageDraftRecovery(userId, pageId, {
							kind: "content",
							value,
							revision: autosave.confirmedRevision,
						});
					}
				}}
				pageId={pageId}
				readOnly={moveOpen || duplicateLocked}
			/>
			<div className="page-save-bar">
				<p className="page-save-status" role="status">
					{pageAutosaveStatusLabel[phase]}
				</p>
				{phase === "conflict" ? (
					<button
						className="auth-open-button"
						onClick={() => {
							setReloadError(null);
							setReloadConfirmOpen(true);
						}}
						type="button"
					>
						サーバー版を読み込み直す
					</button>
				) : (
					<button
						className="auth-open-button"
						disabled={phase !== "unsaved" && phase !== "failed"}
						onClick={() => autosave.saveNow()}
						type="button"
					>
						{phase === "failed" ? "再試行" : "保存"}
					</button>
				)}
			</div>
			{blocker.status === "blocked" && saving ? (
				<p className="page-save-status">保存が終わるまで移動できません</p>
			) : null}
			{blocker.status === "blocked" && !saving ? (
				<PageLeaveDialog
					confirmLabel="破棄して移動"
					onCancel={() => blocker.reset()}
					onConfirm={() => blocker.proceed()}
					title="未保存の変更を破棄して移動しますか"
					titleId="page-nav-leave-title"
				/>
			) : null}
			{reloadConfirmOpen && blocker.status !== "blocked" ? (
				<PageLeaveDialog
					confirmDisabled={pageQuery.isFetching}
					confirmLabel="破棄して読み込み直す"
					message={reloadError}
					onCancel={() => {
						reloadRequestRef.current += 1;
						setReloadError(null);
						setReloadConfirmOpen(false);
					}}
					onConfirm={() => void reloadServer()}
					title="未保存の変更を破棄して、サーバーの本文を読み込み直しますか"
					titleId="page-reload-leave-title"
				/>
			) : null}
			{moveOpen ? (
				<PageMoveDialog
					busy={moveMutation.isPending || moveChecking}
					currentParentId={detail.page.parentId}
					error={moveError}
					onCancel={() => setMoveOpen(false)}
					onCheckState={() => void checkMoveState()}
					onMove={(parentId) => void submitMove(parentId)}
					requiresCheck={moveNeedsCheck}
					pageId={pageId}
					pageTitle={detail.page.title}
					pages={pages}
				/>
			) : null}
		</article>
	);
}

function PageDetail({
	userId,
	pageId,
	pages,
	moveRequest,
	onMoveSuccess,
	duplicateLocked,
	duplicatePending,
}: {
	userId: string;
	pageId: string;
	pages: readonly PageSummary[];
	moveRequest: number;
	onMoveSuccess: (parentId: string | null) => void;
	duplicateLocked: boolean;
	duplicatePending: boolean;
}) {
	const pageQuery = usePageQuery(userId, pageId);
	const detail = pageQuery.data;

	if (!detail) {
		if (pageQuery.isError) {
			if (isNotFound(pageQuery.error)) {
				return <p>ページが見つかりません</p>;
			}
			return (
				<div className="pages-status">
					<p className="pages-error">{pageQuery.error.message}</p>
					<button
						type="button"
						className="auth-open-button"
						onClick={() => void pageQuery.refetch()}
					>
						再試行
					</button>
				</div>
			);
		}
		return <p className="muted">読み込み中</p>;
	}

	return (
		<PageDocument
			detail={detail}
			key={`${userId}:${pageId}`}
			moveRequest={moveRequest}
			onMoveSuccess={onMoveSuccess}
			pageId={pageId}
			pages={pages}
			userId={userId}
			duplicateLocked={duplicateLocked}
			duplicatePending={duplicatePending}
		/>
	);
}

export function PagesView({ pageId }: { pageId?: string } = {}) {
	const { authUser, authLoading } = useAuth();
	const { saving, unsaved } = usePageEditGuard();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const pagesQuery = usePagesQuery(authUser?.id);
	const activePageQuery = usePageQuery(authUser?.id, pageId);
	const createMutation = useCreatePageMutation(authUser?.id);
	const createGeneration = useRef(0);
	const createScope = useRef({ userId: authUser?.id, pageId });
	useLayoutEffect(() => {
		createGeneration.current += 1;
		createScope.current = { userId: authUser?.id, pageId };
		return () => {
			createGeneration.current += 1;
		};
	}, [authUser?.id, pageId]);
	const duplicateMutation = useDuplicatePageMutation(authUser?.id);
	const [expandedIds, setExpandedIds] = useState<Set<string> | null>(null);
	const [moveRequest, setMoveRequest] = useState(0);
	const [duplicateOperation, setDuplicateOperation] = useState<{
		userId: string;
		pageId: string;
		input: DuplicatePageInput;
		title: string;
		error: string | null;
		errorCode: DuplicatePageConflictCode | null;
	} | null>(null);
	const [duplicatedPage, setDuplicatedPage] = useState<Page | null>(null);
	const pages = pagesQuery.data ?? [];
	const visibleExpanded = expandedIds ?? parentsWithChildren(pages);
	const [duplicateNavigation, setDuplicateNavigation] = useState<{
		userId: string;
		sourceId: string;
		targetId: string;
	} | null>(null);
	const duplicatePending = duplicateMutation.isPending;
	const activePage = activePageQuery.data;
	const duplicateBlocked = saving || unsaved || duplicatePending;
	const currentScopeRef = useRef({ userId: authUser?.id, pageId });
	currentScopeRef.current = { userId: authUser?.id, pageId };

	useEffect(() => {
		if (
			duplicateOperation &&
			!duplicatePending &&
			(duplicateOperation.userId !== authUser?.id ||
				duplicateOperation.pageId !== pageId)
		) {
			setDuplicateOperation(null);
		}
	}, [authUser?.id, duplicateOperation, duplicatePending, pageId]);

	useEffect(() => {
		if (!duplicateNavigation || duplicatePending || saving) return;
		setDuplicateNavigation(null);
		if (
			duplicateNavigation.userId !== authUser?.id ||
			duplicateNavigation.sourceId !== pageId
		)
			return;
		void navigate({
			to: "/pages/$pageId",
			params: { pageId: duplicateNavigation.targetId },
		})
			.then(() => setDuplicatedPage(null))
			.catch(() => {});
	}, [
		duplicateNavigation,
		duplicatePending,
		saving,
		authUser?.id,
		pageId,
		navigate,
	]);

	const openDuplicate = () => {
		if (
			!authUser ||
			!pageId ||
			!activePage ||
			activePageQuery.isError ||
			pagesQuery.isError ||
			duplicateBlocked ||
			activePage.page.id !== pageId
		)
			return;
		setDuplicatedPage(null);
		setDuplicateOperation({
			userId: authUser.id,
			pageId,
			title: activePage.page.title,
			error: null,
			errorCode: null,
			input: {
				requestId: crypto.randomUUID(),
				expectedContentRevision: activePage.content.revision,
				expectedTitle: activePage.page.title,
				expectedParentId: activePage.page.parentId,
			},
		});
	};

	const duplicate = async () => {
		const operation = duplicateOperation;
		if (!operation || duplicateBlocked || !activePage || saving || unsaved)
			return;
		if (
			operation.userId !== authUser?.id ||
			operation.pageId !== pageId ||
			activePage.page.title !== operation.input.expectedTitle ||
			activePage.page.parentId !== operation.input.expectedParentId ||
			activePage.content.revision !== operation.input.expectedContentRevision
		) {
			setDuplicateOperation({
				...operation,
				error: "元のページが更新されています。状態を取得してください。",
				errorCode: "SOURCE_PAGE_CHANGED",
			});
			return;
		}
		try {
			const result = await duplicateMutation.mutateAsync({
				pageId: operation.pageId,
				input: operation.input,
			});
			if (
				currentScopeRef.current.userId !== operation.userId ||
				currentScopeRef.current.pageId !== operation.pageId ||
				queryClient.getQueryData<AuthUser | null>(authMeQueryKey)?.id !==
					operation.userId
			)
				return;
			setDuplicateOperation(null);
			setDuplicatedPage(result.page);
			const pageById = new Map(pages.map((page) => [page.id, page]));
			setExpandedIds((current) => {
				const next = new Set(current ?? parentsWithChildren(pages));
				let ancestorId = result.page.parentId;
				const visited = new Set<string>();
				while (ancestorId && !visited.has(ancestorId)) {
					visited.add(ancestorId);
					next.add(ancestorId);
					ancestorId = pageById.get(ancestorId)?.parentId ?? null;
				}
				return next;
			});
			try {
				await queryClient.fetchQuery({
					queryKey: ["pages", operation.userId, "detail", result.page.id],
					queryFn: ({ signal }) => fetchPage(result.page.id, { signal }),
				});
				if (
					currentScopeRef.current.userId !== operation.userId ||
					currentScopeRef.current.pageId !== operation.pageId ||
					queryClient.getQueryData<AuthUser | null>(authMeQueryKey)?.id !==
						operation.userId
				)
					return;
				setDuplicateNavigation({
					userId: operation.userId,
					sourceId: operation.pageId,
					targetId: result.page.id,
				});
			} catch {
				// Keep a direct link to the created page; this flow never replays POST.
			}
		} catch (error) {
			if (
				currentScopeRef.current.userId !== operation.userId ||
				currentScopeRef.current.pageId !== operation.pageId
			)
				return;
			const errorCode =
				error instanceof DuplicatePageConflictError ? error.code : null;
			const message =
				error instanceof DuplicatePageConflictError
					? error.code === "SOURCE_PAGE_CHANGED"
						? "元のページが更新されています。状態を再取得して、内容を確認してください。"
						: error.code === "DUPLICATE_REQUEST_CONFLICT"
							? "複製操作の識別情報が競合しました。新しい複製を開始してください。"
							: "作成済みの複製ページを利用できません。"
					: error instanceof HttpStatusError && error.status === 404
						? "ページが見つかりません。状態を再取得してください。"
						: error instanceof HttpStatusError && error.status === 413
							? "本文が複製可能なサイズを超えています。"
							: "複製に失敗しました。再試行すると同じ操作IDで状態を確認できます。";
			setDuplicateOperation({ ...operation, error: message, errorCode });
		}
	};

	const refreshDuplicateSource = async () => {
		const operation = duplicateOperation;
		if (
			!operation ||
			duplicatePending ||
			operation.errorCode !== "SOURCE_PAGE_CHANGED"
		)
			return;
		const result = await activePageQuery.refetch();
		if (
			currentScopeRef.current.userId !== operation.userId ||
			currentScopeRef.current.pageId !== operation.pageId
		)
			return;
		if (result.isError || !result.data) {
			setDuplicateOperation({
				...operation,
				error:
					"最新のページ状態を取得できませんでした。もう一度お試しください。",
			});
			return;
		}
		setDuplicateOperation({
			...operation,
			title: result.data.page.title,
			error: null,
			errorCode: null,
			input: {
				requestId: crypto.randomUUID(),
				expectedContentRevision: result.data.content.revision,
				expectedTitle: result.data.page.title,
				expectedParentId: result.data.page.parentId,
			},
		});
	};

	const create = async (parentId: string | null) => {
		if (saving || unsaved || duplicatePending) return;
		const requestGeneration = createGeneration.current;
		const requestScope = createScope.current;
		const page = await createMutation.mutateAsync(parentId).catch(() => null);
		if (
			!page ||
			createGeneration.current !== requestGeneration ||
			createScope.current !== requestScope
		)
			return;
		if (parentId) {
			setExpandedIds((current) => {
				const next = new Set(current ?? parentsWithChildren(pages));
				next.add(parentId);
				return next;
			});
		}
		await navigate({
			to: "/pages/$pageId",
			params: { pageId: page.id },
		});
	};

	const toggle = (targetId: string) => {
		setExpandedIds((current) => {
			const next = new Set(current ?? parentsWithChildren(pages));
			if (next.has(targetId)) next.delete(targetId);
			else next.add(targetId);
			return next;
		});
	};

	const expandToParent = (parentId: string | null) => {
		if (!parentId) return;
		const byId = new Map(pages.map((page) => [page.id, page]));
		const ancestors = new Set<string>();
		const visited = new Set<string>();
		let cursor: string | null = parentId;
		while (cursor && !visited.has(cursor)) {
			visited.add(cursor);
			ancestors.add(cursor);
			cursor = byId.get(cursor)?.parentId ?? null;
		}
		setExpandedIds(
			(current) =>
				new Set([...(current ?? parentsWithChildren(pages)), ...ancestors]),
		);
	};

	if (authLoading) {
		return (
			<main className="center-shell">
				<div className="muted">Checking session...</div>
			</main>
		);
	}

	if (!authUser) {
		return (
			<main className="center-shell">
				<section className="signed-in-panel">
					<LockKeyhole className="icon" />
					<h1>Login required</h1>
					<p>This sample route only displays its content after sign-in.</p>
					<Link
						to="/login"
						search={{ redirect: pageId ? `/pages/${pageId}` : "/pages" }}
						className="auth-open-button"
					>
						Login
					</Link>
				</section>
			</main>
		);
	}

	return (
		<main className="pages-shell">
			<aside className="pages-sidebar" aria-label="ページ">
				<button
					type="button"
					className="auth-open-button"
					disabled={
						createMutation.isPending || saving || unsaved || duplicatePending
					}
					onClick={() => void create(null)}
				>
					新しいページ
				</button>
				{pageId &&
				pagesQuery.isSuccess &&
				pages.some((page) => page.id === pageId) ? (
					<button
						className="auth-open-button"
						disabled={saving || unsaved}
						onClick={() => setMoveRequest((current) => current + 1)}
						type="button"
					>
						ページを移動
					</button>
				) : null}
				<button
					type="button"
					className="auth-open-button"
					disabled={
						!pageId ||
						!activePage ||
						activePageQuery.isError ||
						pagesQuery.isError ||
						duplicateBlocked
					}
					onClick={openDuplicate}
				>
					ページを複製
				</button>
				{pagesQuery.isPending ? (
					<p className="muted">読み込み中</p>
				) : pagesQuery.isError ? (
					<div className="pages-status">
						<p className="pages-error">{pagesQuery.error.message}</p>
						<button
							type="button"
							className="auth-open-button"
							onClick={() => void pagesQuery.refetch()}
						>
							再試行
						</button>
					</div>
				) : pages.length === 0 ? (
					<p>ページがありません</p>
				) : (
					<PageTree
						pages={pages}
						selectedPageId={pageId}
						expandedIds={visibleExpanded}
						onToggle={toggle}
						onSelect={(nextPageId) => {
							if (duplicatePending || duplicateOperation) return;
							void navigate({
								to: "/pages/$pageId",
								params: { pageId: nextPageId },
							});
						}}
						onCreateChild={(parentId) => {
							void create(parentId);
						}}
						createDisabled={
							createMutation.isPending ||
							saving ||
							unsaved ||
							duplicatePending ||
							Boolean(duplicateOperation)
						}
						selectDisabled={
							saving || duplicatePending || Boolean(duplicateOperation)
						}
					/>
				)}
				{createMutation.isError ? (
					<p className="pages-error">{createMutation.error.message}</p>
				) : null}
			</aside>
			<section className="pages-main" aria-label="選択中のページ">
				{pageId ? (
					<PageDetail
						userId={authUser.id}
						pageId={pageId}
						pages={pages}
						moveRequest={moveRequest}
						onMoveSuccess={expandToParent}
						duplicateLocked={Boolean(duplicateOperation) || duplicatePending}
						duplicatePending={duplicatePending}
					/>
				) : (
					<p>ページを選択してください</p>
				)}
			</section>
			{duplicateOperation ? (
				<PageDuplicateDialog
					error={duplicateOperation.error}
					onRefresh={
						duplicateOperation.errorCode === "SOURCE_PAGE_CHANGED"
							? () => void refreshDuplicateSource()
							: null
					}
					onCancel={() => {
						if (!duplicatePending) {
							duplicateMutation.reset();
							setDuplicateOperation(null);
						}
					}}
					onConfirm={() => void duplicate()}
					pending={duplicatePending}
					title={duplicateOperation.title}
				/>
			) : null}
			{duplicatedPage ? (
				<p className="pages-status" role="status">
					複製しました。{" "}
					<Link to="/pages/$pageId" params={{ pageId: duplicatedPage.id }}>
						複製したページを開く
					</Link>
				</p>
			) : null}
		</main>
	);
}
