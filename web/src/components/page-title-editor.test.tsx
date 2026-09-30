import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	act,
	fireEvent,
	render,
	renderHook,
	screen,
	waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	setSessionUser,
	useUpdatePageContentMutation,
	usePageQuery,
	useUpdatePageTitleMutation,
} from "../api";
import { PageTitleEditor } from "./page-title-editor";
import {
	clearPageDraftRecovery,
	readPageDraftRecovery,
	storePageDraftRecovery,
} from "../page-draft-recovery";

const page = {
	id: "page",
	ownerId: "user",
	parentId: null,
	title: "無題",
	createdAt: "2026-09-30T00:00:00Z",
	updatedAt: "2026-09-30T00:00:00Z",
};
const content = {
	pageId: "page",
	revision: 0,
	value: [{ type: "p" as const, children: [{ text: "本文" }] }],
};
const detailKey = ["pages", "user", "detail", "page"];
const listKey = ["pages", "user", "list"];
function setup() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	client.setQueryData(detailKey, { page, content });
	client.setQueryData(listKey, [page]);
	const wrapper = ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={client}>{children}</QueryClientProvider>
	);
	return { client, wrapper };
}
function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}
afterEach(() => {
	vi.unstubAllGlobals();
	clearPageDraftRecovery("user", "page");
	clearPageDraftRecovery("bob", "page");
});
async function edit() {
	const user = userEvent.setup();
	await user.click(screen.getByRole("button", { name: "タイトルを編集" }));
	return {
		user,
		input: screen.getByRole("textbox", { name: "ページタイトル" }),
	};
}
function ui(
	fetcher = vi
		.fn()
		.mockResolvedValue(Response.json({ page: { ...page, title: "新題" } })),
) {
	vi.stubGlobal("fetch", fetcher);
	const { client, wrapper } = setup();
	const guard = vi.fn();
	const result = render(
		<PageTitleEditor
			userId="user"
			pageId="page"
			title="無題"
			onGuardChange={guard}
		/>,
		{ wrapper },
	);
	return { ...result, client, guard, fetcher, wrapper };
}
describe("page title editing", () => {
	it("trims and saves, updating only titles in both caches", async () => {
		const { client, fetcher } = ui();
		const { user, input } = await edit();
		await user.clear(input);
		await user.type(input, " 新題 ");
		await user.click(screen.getByText("タイトルを保存"));
		await screen.findByText("タイトルを編集");
		expect(fetcher).toHaveBeenCalledTimes(1);
		expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
			title: "新題",
		});
		expect(client.getQueryData(detailKey)).toEqual({
			page: { ...page, title: "新題" },
			content,
		});
		expect(client.getQueryData(listKey)).toEqual([{ ...page, title: "新題" }]);
	});
	it("rejects invalid drafts and protects them; accepts 200 characters", async () => {
		const { fetcher, guard } = ui();
		const { user, input } = await edit();
		for (const value of ["   ", "a".repeat(201)]) {
			fireEvent.change(input, { target: { value } });
			await user.click(screen.getByText("タイトルを保存"));
			expect(screen.getByRole("alert")).toHaveTextContent("1〜200文字");
			expect(guard).toHaveBeenLastCalledWith({ unsaved: true, saving: false });
		}
		expect(fetcher).not.toHaveBeenCalled();
		fireEvent.change(input, { target: { value: "a".repeat(200) } });
		await user.click(screen.getByText("タイトルを保存"));
		await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
	});
	it("closes unchanged normalized titles and cancels without requests", async () => {
		const { fetcher } = ui();
		let editing = await edit();
		fireEvent.change(editing.input, { target: { value: " 無題 " } });
		await editing.user.click(screen.getByText("タイトルを保存"));
		editing = await edit();
		fireEvent.change(editing.input, { target: { value: "破棄" } });
		fireEvent.keyDown(editing.input, { key: "Escape" });
		expect(screen.getByRole("heading")).toHaveTextContent("無題");
		editing = await edit();
		await editing.user.click(screen.getByText("キャンセル"));
		expect(fetcher).not.toHaveBeenCalled();
	});
	it("ignores IME Enter and keyCode229, then saves with Enter and prevents duplicates", async () => {
		const gate = deferred<Response>();
		const { fetcher, guard } = ui(vi.fn(() => gate.promise));
		const { input } = await edit();
		fireEvent.change(input, { target: { value: "新題" } });
		fireEvent.compositionStart(input);
		fireEvent.keyDown(input, { key: "Enter" });
		fireEvent.keyDown(input, { key: "Escape" });
		expect(input).toBeVisible();
		fireEvent.compositionEnd(input);
		fireEvent.keyDown(input, { key: "Enter", keyCode: 229 });
		expect(fetcher).not.toHaveBeenCalled();
		fireEvent.keyDown(input, { key: "Enter" });
		fireEvent.keyDown(input, { key: "Enter" });
		await waitFor(() => expect(input).toBeDisabled());
		expect(screen.getByText("キャンセル")).toBeDisabled();
		expect(screen.getByText("タイトルを保存")).toBeDisabled();
		expect(guard).toHaveBeenLastCalledWith({ unsaved: true, saving: true });
		expect(fetcher).toHaveBeenCalledTimes(1);
		await act(async () =>
			gate.resolve(Response.json({ page: { ...page, title: "新題" } })),
		);
	});
	it.each([
		404, 500,
	])("retains draft after status %s and retries explicitly", async (status) => {
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(Response.json({ message: "失敗" }, { status }))
			.mockResolvedValueOnce(
				Response.json({ page: { ...page, title: "新題" } }),
			);
		ui(fetcher);
		const { input, user } = await edit();
		fireEvent.change(input, { target: { value: "新題" } });
		await user.click(screen.getByText("タイトルを保存"));
		await screen.findByRole("alert");
		expect(input).toHaveValue("新題");
		expect(fetcher).toHaveBeenCalledTimes(1);
		expect(screen.getByRole("alert")).toHaveTextContent(
			status === 404 ? "ページが見つかりません" : "保存できませんでした",
		);
		await user.click(screen.getByText("再試行"));
		await screen.findByText("タイトルを編集");
		expect(fetcher).toHaveBeenCalledTimes(2);
	});
	it("retains draft when fetched title changes", async () => {
		const { rerender } = ui();
		const { input } = await edit();
		fireEvent.change(input, { target: { value: "下書き" } });
		rerender(
			<PageTitleEditor
				userId="user"
				pageId="page"
				title="他の場所の更新"
				onGuardChange={() => {}}
			/>,
		);
		expect(input).toHaveValue("下書き");
	});
	it("restores a 401 draft only for the same owner and keeps retry available", async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(
				Response.json({ message: "Unauthorized" }, { status: 401 }),
			)
			.mockResolvedValueOnce(
				Response.json({ page: { ...page, title: "Alice title draft" } }),
			);
		const first = ui(fetcher);
		const { input, user } = await edit();
		fireEvent.change(input, { target: { value: "Alice title draft" } });
		await user.click(screen.getByText("タイトルを保存"));
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"タイトルを保存できませんでした",
		);
		first.unmount();

		const restored = render(
			<PageTitleEditor
				userId="user"
				pageId="page"
				title="無題"
				onGuardChange={() => {}}
			/>,
			{ wrapper: first.wrapper },
		);
		expect(screen.getByRole("textbox", { name: "ページタイトル" })).toHaveValue(
			"Alice title draft",
		);
		expect(screen.getByRole("button", { name: "再試行" })).toBeEnabled();
		expect(await screen.findByRole("alert")).toHaveTextContent("再認証後");
		restored.unmount();

		render(
			<PageTitleEditor
				userId="bob"
				pageId="page"
				title="Bob title"
				onGuardChange={() => {}}
			/>,
			{ wrapper: first.wrapper },
		);
		await user.click(screen.getByRole("button", { name: "タイトルを編集" }));
		expect(screen.getByRole("textbox", { name: "ページタイトル" })).toHaveValue(
			"Bob title",
		);
		expect(
			screen.queryByDisplayValue("Alice title draft"),
		).not.toBeInTheDocument();
	});
	it("does not let an old successful PATCH delete a newer recovered title", async () => {
		const gate = deferred<Response>();
		const first = ui(vi.fn(() => gate.promise));
		const { input, user } = await edit();
		fireEvent.change(input, { target: { value: "Old in-flight title" } });
		await user.click(screen.getByText("タイトルを保存"));
		await waitFor(() => expect(first.fetcher).toHaveBeenCalledTimes(1));
		first.unmount();
		await act(async () => {
			await setSessionUser(first.client, null);
			await setSessionUser(first.client, {
				id: "user",
				email: "u@example.com",
				displayName: "U",
				role: "member",
			});
		});
		storePageDraftRecovery("user", "page", {
			kind: "title",
			value: "New recovery title",
		});

		await act(async () => {
			gate.resolve(
				Response.json({ page: { ...page, title: "Old in-flight title" } }),
			);
			await new Promise<void>((resolve) => setTimeout(resolve, 0));
		});
		expect(readPageDraftRecovery("user", "page", "title")).toEqual({
			kind: "title",
			value: "New recovery title",
		});
	});
});
describe("independent mutation responses", () => {
	it.each([
		true,
		false,
	])("preserves body and title with title-first=%s", async (titleFirst) => {
		const titleGate = deferred<Response>();
		const bodyGate = deferred<Response>();
		vi.stubGlobal(
			"fetch",
			vi.fn((_url, init) =>
				init.method === "PATCH" ? titleGate.promise : bodyGate.promise,
			),
		);
		const { client, wrapper } = setup();
		const { result } = renderHook(
			() => ({
				title: useUpdatePageTitleMutation("user", "page"),
				body: useUpdatePageContentMutation("user", "page"),
			}),
			{ wrapper },
		);
		let titlePromise!: Promise<unknown>;
		let bodyPromise!: Promise<unknown>;
		act(() => {
			titlePromise = result.current.title.mutateAsync({ title: "新題" });
			bodyPromise = result.current.body.mutateAsync({
				revision: 0,
				value: content.value,
			});
		});
		const updatedContent = {
			...content,
			revision: 1,
			value: [{ type: "p" as const, children: [{ text: "新本文" }] }],
		};
		await act(async () => {
			if (titleFirst) {
				titleGate.resolve(Response.json({ page: { ...page, title: "新題" } }));
				await titlePromise;
				bodyGate.resolve(
					Response.json({
						content: updatedContent,
						page: { id: page.id, updatedAt: page.updatedAt },
					}),
				);
				await bodyPromise;
			} else {
				bodyGate.resolve(
					Response.json({
						content: updatedContent,
						page: { id: page.id, updatedAt: page.updatedAt },
					}),
				);
				await bodyPromise;
				titleGate.resolve(Response.json({ page: { ...page, title: "新題" } }));
				await titlePromise;
			}
		});
		expect(client.getQueryData(detailKey)).toEqual({
			page: { ...page, title: "新題" },
			content: updatedContent,
		});
	});
	it("cancels a GET started before rename and keeps newer body revisions on refetch", async () => {
		const oldGet = deferred<Response>();
		let gets = 0;
		const renamedPage = { ...page, title: "新題" };
		vi.stubGlobal(
			"fetch",
			vi.fn((_url, init) => {
				if (init.method === "PATCH")
					return Promise.resolve(Response.json({ page: renamedPage }));
				gets += 1;
				return gets === 1
					? oldGet.promise
					: Promise.resolve(Response.json({ page: renamedPage, content }));
			}),
		);
		const { client, wrapper } = setup();
		const { result } = renderHook(
			() => ({
				query: usePageQuery("user", "page"),
				title: useUpdatePageTitleMutation("user", "page"),
			}),
			{ wrapper },
		);
		await waitFor(() => expect(gets).toBe(1));
		await act(async () => {
			await result.current.title.mutateAsync({ title: "新題" });
		});
		await waitFor(() => expect(client.isFetching()).toBe(0));
		await act(async () => oldGet.resolve(Response.json({ page, content })));
		expect(result.current.query.data?.page.title).toBe("新題");
		const newerContent = { ...content, revision: 3 };
		act(() =>
			client.setQueryData(detailKey, {
				page: renamedPage,
				content: newerContent,
			}),
		);
		await act(async () => {
			await result.current.query.refetch();
		});
		expect(
			client.getQueryData<{ content: { revision: number } }>(detailKey)?.content
				.revision,
		).toBe(3);
		await waitFor(() =>
			expect(result.current.query.data?.content.revision).toBe(3),
		);
	});
	it("does not create missing caches from a title response", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ page })));
		const { client, wrapper } = setup();
		client.removeQueries({ queryKey: ["pages"] });
		const { result } = renderHook(
			() => useUpdatePageTitleMutation("user", "page"),
			{ wrapper },
		);
		await act(async () => {
			await result.current.mutateAsync({ title: "無題" });
		});
		expect(client.getQueryData(detailKey)).toBeUndefined();
		expect(client.getQueryData(listKey)).toBeUndefined();
	});
	it("ignores an old body response after a session change", async () => {
		const gate = deferred<Response>();
		vi.stubGlobal(
			"fetch",
			vi.fn(() => gate.promise),
		);
		const { client, wrapper } = setup();
		const { result } = renderHook(
			() => useUpdatePageContentMutation("user", "page"),
			{ wrapper },
		);
		let pending!: Promise<unknown>;
		act(() => {
			pending = result.current.mutateAsync({
				revision: 0,
				value: content.value,
			});
		});
		await waitFor(() => expect(result.current.isPending).toBe(true));
		await act(async () => {
			await setSessionUser(client, null);
		});
		await act(async () => {
			gate.resolve(Response.json({ content: { ...content, revision: 1 } }));
			await pending;
		});
		expect(client.getQueryData(detailKey)).toBeUndefined();
	});
	it("ignores delayed responses after logout and same-user login", async () => {
		const gate = deferred<Response>();
		vi.stubGlobal(
			"fetch",
			vi.fn(() => gate.promise),
		);
		const { client, wrapper } = setup();
		const { result } = renderHook(
			() => useUpdatePageTitleMutation("user", "page"),
			{ wrapper },
		);
		let pending!: Promise<unknown>;
		act(() => {
			pending = result.current.mutateAsync({ title: "旧セッション" });
		});
		await waitFor(() => expect(result.current.isPending).toBe(true));
		await act(async () => {
			await setSessionUser(client, null);
			await setSessionUser(client, {
				id: "user",
				email: "u@example.com",
				displayName: "U",
				role: "member",
			});
		});
		const newPage = { ...page, title: "新セッション" };
		act(() => {
			client.setQueryData(detailKey, { page: newPage, content });
			client.setQueryData(listKey, [newPage]);
		});
		await act(async () => {
			gate.resolve(Response.json({ page: { ...page, title: "旧セッション" } }));
			await pending;
		});
		expect(client.getQueryData(detailKey)).toEqual({ page: newPage, content });
		expect(client.getQueryData(listKey)).toEqual([newPage]);
	});
	it("does not send a title PATCH when its session changes during query cancellation", async () => {
		const gate = deferred<void>();
		const { client, wrapper } = setup();
		const cancel = vi
			.spyOn(client, "cancelQueries")
			.mockReturnValue(gate.promise);
		const fetcher = vi.fn().mockResolvedValue(Response.json({ page }));
		vi.stubGlobal("fetch", fetcher);
		const { result } = renderHook(
			() => useUpdatePageTitleMutation("user", "page"),
			{ wrapper },
		);
		let pending!: Promise<unknown>;
		act(() => {
			pending = result.current.mutateAsync({ title: "Old session title" }).then(
				() => null,
				(error: unknown) => error,
			);
		});
		await waitFor(() => expect(cancel).toHaveBeenCalledTimes(2));

		let sessionChange!: Promise<void>;
		act(() => {
			sessionChange = setSessionUser(client, null);
		});
		await waitFor(() => expect(cancel).toHaveBeenCalledTimes(3));
		await act(async () => {
			gate.resolve();
			await sessionChange;
			await pending;
		});

		expect(fetcher).not.toHaveBeenCalled();
		expect(await pending).toMatchObject({ status: 401 });
	});
});

it("keeps edits to a recovered title in recovery storage and ignores Escape while saving", async () => {
	storePageDraftRecovery("user", "page", { kind: "title", value: "Recovered" });
	const pending = deferred<Response>();
	const fetcher = vi.fn().mockReturnValue(pending.promise);
	ui(fetcher);
	const input = screen.getByRole("textbox", { name: "ページタイトル" });
	fireEvent.change(input, { target: { value: "Recovered newer" } });
	expect(readPageDraftRecovery("user", "page", "title")?.value).toBe(
		"Recovered newer",
	);
	fireEvent.click(screen.getByRole("button", { name: "再試行" }));
	await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
	fireEvent.keyDown(input, { key: "Escape" });
	expect(input).toBeInTheDocument();
	await act(async () =>
		pending.resolve(
			Response.json({ page: { ...page, title: "Recovered newer" } }),
		),
	);
	await screen.findByText("タイトルを編集");
});
