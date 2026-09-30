import { render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it } from "vitest";
import {
	usePageAutosaveHold,
	usePageEditorAutosaveHold,
	PageEditGuardProvider,
	usePageEditGuard,
	usePublishPageAutosaveHold,
	useSyncPageEditGuard,
} from "./page-edit-guard";

function GuardReader() {
	usePageEditGuard();
	return null;
}

function GuardWriter() {
	useSyncPageEditGuard({ unsaved: true, saving: false });
	return null;
}

function HoldPublisher() {
	usePublishPageAutosaveHold(true);
	return null;
}

function HoldReader() {
	usePageAutosaveHold();
	return null;
}

describe("page edit guard", () => {
	it("requires the provider before reading or updating leave state", () => {
		expect(() => render(<GuardReader />)).toThrow("PageEditGuard is missing.");
		expect(() => render(<GuardWriter />)).toThrow("PageEditGuard is missing.");
		expect(() => render(<HoldPublisher />)).toThrow(
			"PageEditGuard is missing.",
		);
		expect(() => render(<HoldReader />)).toThrow("PageEditGuard is missing.");
	});
});

function EditorHold({ hold }: { hold: boolean }) {
	const publish = usePageEditorAutosaveHold();
	useEffect(() => {
		publish(hold);
		return () => publish(false);
	}, [hold, publish]);
	return null;
}
function HoldState() {
	return <output>{String(usePageAutosaveHold())}</output>;
}
it("combines editor holds and removes them without releasing other editors", () => {
	const view = render(
		<PageEditGuardProvider>
			<EditorHold hold />
			<EditorHold hold />
			<HoldState />
		</PageEditGuardProvider>,
	);
	expect(screen.getByRole("status")).toHaveTextContent("true");
	view.rerender(
		<PageEditGuardProvider>
			<EditorHold hold={false} />
			<EditorHold hold />
			<HoldState />
		</PageEditGuardProvider>,
	);
	expect(screen.getByRole("status")).toHaveTextContent("true");
	view.rerender(
		<PageEditGuardProvider>
			<EditorHold hold={false} />
			<EditorHold hold={false} />
			<HoldState />
		</PageEditGuardProvider>,
	);
	expect(screen.getByRole("status")).toHaveTextContent("false");
});
