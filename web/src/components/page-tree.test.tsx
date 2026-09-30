import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { PageTree, type PageTreeItem } from "./page-tree";

const pages: PageTreeItem[] = [
	{
		id: "d",
		parentId: null,
		title: "D",
	},
	{
		id: "a",
		parentId: null,
		title: "A",
	},
	{
		id: "b",
		parentId: "a",
		title: "B",
	},
	{
		id: "c",
		parentId: "b",
		title: "C",
	},
];

function TreeHarness({
	items = pages,
	createDisabled = false,
	onCreateChild = vi.fn(),
}: {
	items?: readonly PageTreeItem[];
	createDisabled?: boolean;
	onCreateChild?: (parentId: string) => void;
}) {
	const [expandedIds, setExpandedIds] = useState(
		() => new Set(items.map((page) => page.id)),
	);
	const [selectedPageId, setSelectedPageId] = useState<string>();

	return (
		<PageTree
			pages={items}
			selectedPageId={selectedPageId}
			expandedIds={expandedIds}
			createDisabled={createDisabled}
			onToggle={(pageId) => {
				setExpandedIds((current) => {
					const next = new Set(current);
					if (next.has(pageId)) next.delete(pageId);
					else next.add(pageId);
					return next;
				});
			}}
			onSelect={setSelectedPageId}
			onCreateChild={onCreateChild}
		/>
	);
}

function titleOrder(): string[] {
	return screen
		.getAllByRole("button")
		.map((button) => button.textContent)
		.filter(
			(title): title is string =>
				title === "A" || title === "B" || title === "C" || title === "D",
		);
}

describe("page tree", () => {
	it("nests children under their parent in list order", () => {
		render(<TreeHarness />);

		expect(titleOrder()).toEqual(["D", "A", "B", "C"]);
		const rootA = screen.getByRole("button", { name: "A" }).closest("li");
		const childB = screen.getByRole("button", { name: "B" }).closest("li");
		expect(rootA).toContainElement(screen.getByRole("button", { name: "B" }));
		expect(childB).toContainElement(screen.getByRole("button", { name: "C" }));
		expect(
			screen.queryByRole("button", { name: "Cを開閉" }),
		).not.toBeInTheDocument();
	});

	it("hides and shows descendants from the expand control", async () => {
		const view = userEvent.setup();
		render(<TreeHarness />);

		const toggle = screen.getByRole("button", { name: "Aを開閉" });
		expect(toggle).toHaveAttribute("aria-expanded", "true");
		await view.click(toggle);
		expect(toggle).toHaveAttribute("aria-expanded", "false");
		expect(screen.queryByRole("button", { name: "B" })).not.toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "C" })).not.toBeInTheDocument();

		await view.click(toggle);
		expect(toggle).toHaveAttribute("aria-expanded", "true");
		expect(screen.getByRole("button", { name: "B" })).toBeVisible();
		expect(screen.getByRole("button", { name: "C" })).toBeVisible();
	});

	it("selects a page and requests a child page", async () => {
		const onCreateChild = vi.fn();
		const view = userEvent.setup();
		render(<TreeHarness onCreateChild={onCreateChild} />);

		await view.click(screen.getByRole("button", { name: "B" }));
		expect(screen.getByRole("button", { name: "B" })).toHaveAttribute(
			"aria-current",
			"page",
		);
		await view.click(screen.getByRole("button", { name: "Aの子ページを作成" }));
		expect(onCreateChild).toHaveBeenCalledWith("a");
	});

	it("distinguishes pages that share a title", () => {
		render(
			<TreeHarness
				items={[
					{ id: "1", parentId: null, title: "無題" },
					{ id: "2", parentId: "1", title: "無題" },
				]}
			/>,
		);

		expect(screen.getByRole("button", { name: "無題 (1)" })).toHaveTextContent(
			"無題",
		);
		expect(screen.getByRole("button", { name: "無題 (2)" })).toHaveTextContent(
			"無題",
		);
		expect(
			screen.getByRole("button", { name: "無題 (1)の子ページを作成" }),
		).toBeVisible();
		expect(
			screen.getByRole("button", { name: "無題 (2)の子ページを作成" }),
		).toBeVisible();
	});

	it("disables child creation and renders nothing for an empty list", () => {
		const { rerender } = render(<TreeHarness createDisabled />);
		expect(
			screen.getByRole("button", { name: "Aの子ページを作成" }),
		).toBeDisabled();

		rerender(<TreeHarness items={[]} />);
		expect(screen.queryByRole("list")).not.toBeInTheDocument();
	});
});
