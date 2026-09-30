export type PageTreeItem = {
	id: string;
	parentId: string | null;
	title: string;
};

type PageTreeProps = {
	pages: readonly PageTreeItem[];
	selectedPageId?: string;
	expandedIds: ReadonlySet<string>;
	onToggle: (pageId: string) => void;
	onSelect: (pageId: string) => void;
	onCreateChild: (parentId: string) => void;
	createDisabled: boolean;
	selectDisabled?: boolean;
};

function childrenOf(
	pages: readonly PageTreeItem[],
	parentId: string | null,
): PageTreeItem[] {
	return pages.filter((page) => page.parentId === parentId);
}

function accessibleNames(pages: readonly PageTreeItem[]): Map<string, string> {
	const totals = new Map<string, number>();
	for (const page of pages) {
		totals.set(page.title, (totals.get(page.title) ?? 0) + 1);
	}
	const seen = new Map<string, number>();
	const names = new Map<string, string>();
	const visit = (parentId: string | null) => {
		for (const page of childrenOf(pages, parentId)) {
			const total = totals.get(page.title);
			if (total === 1) {
				names.set(page.id, page.title);
			} else {
				const index = (seen.get(page.title) ?? 0) + 1;
				seen.set(page.title, index);
				names.set(page.id, `${page.title} (${index})`);
			}
			visit(page.id);
		}
	};
	visit(null);
	return names;
}

function PageTreeLevel({
	pages,
	parentId,
	selectedPageId,
	expandedIds,
	onToggle,
	onSelect,
	onCreateChild,
	createDisabled,
	selectDisabled = false,
	names,
}: PageTreeProps & { parentId: string | null; names: Map<string, string> }) {
	const nodes = childrenOf(pages, parentId);
	if (nodes.length === 0) return null;

	return (
		<ul className="page-tree">
			{nodes.map((page) => {
				const hasChildren = childrenOf(pages, page.id).length > 0;
				const expanded = expandedIds.has(page.id);
				const name = names.get(page.id) as string;
				return (
					<li key={page.id}>
						<div className="page-tree-row">
							{hasChildren ? (
								<button
									type="button"
									className="page-tree-toggle"
									aria-expanded={expanded}
									aria-label={`${name}を開閉`}
									onClick={() => onToggle(page.id)}
								>
									{expanded ? "▾" : "▸"}
								</button>
							) : (
								<span className="page-tree-toggle-spacer" aria-hidden="true" />
							)}
							<button
								type="button"
								className="page-tree-title"
								aria-current={selectedPageId === page.id ? "page" : undefined}
								aria-label={name === page.title ? undefined : name}
								disabled={selectDisabled}
								onClick={() => onSelect(page.id)}
							>
								{page.title}
							</button>
							<button
								type="button"
								className="page-tree-add"
								aria-label={`${name}の子ページを作成`}
								disabled={createDisabled}
								onClick={() => onCreateChild(page.id)}
							>
								子ページ
							</button>
						</div>
						{hasChildren && expanded ? (
							<PageTreeLevel
								pages={pages}
								parentId={page.id}
								selectedPageId={selectedPageId}
								expandedIds={expandedIds}
								onToggle={onToggle}
								onSelect={onSelect}
								onCreateChild={onCreateChild}
								createDisabled={createDisabled}
								selectDisabled={selectDisabled}
								names={names}
							/>
						) : null}
					</li>
				);
			})}
		</ul>
	);
}

export function PageTree(props: PageTreeProps) {
	return (
		<PageTreeLevel
			{...props}
			names={accessibleNames(props.pages)}
			parentId={null}
		/>
	);
}
