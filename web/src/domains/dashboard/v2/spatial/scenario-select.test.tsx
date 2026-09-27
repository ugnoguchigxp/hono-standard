import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScenarioSelect } from "./scenario-select";

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock("../../../../api", () => ({ appFetch: fetchMock }));

const list = { scenarios: [
	{ id: "normal", label: "Normal" },
	{ id: "host-load-spike", label: "Load spike" },
], current: "normal", editable: true };

afterEach(() => fetchMock.mockReset());

describe("ScenarioSelect", () => {
	it("accepts an already-running server without the editable field", async () => {
		const legacyList = { scenarios: list.scenarios, current: list.current };
		fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(legacyList), { status: 200 }));
		fetchMock.mockResolvedValueOnce(new Response("{}", { status: 200 }));
		const changed = vi.fn();
		render(<ScenarioSelect current="normal" live onChanged={changed} />);
		const select = screen.getByRole("combobox", { name: "Mock scenario" });
		await waitFor(() => expect(select).toBeEnabled());
		fireEvent.change(select, { target: { value: "host-load-spike" } });
		await waitFor(() => expect(changed).toHaveBeenCalledOnce());
	});

	it("changes the server scenario and refreshes only after a successful response", async () => {
		fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(list), { status: 200 }));
		fetchMock.mockResolvedValueOnce(new Response("{}", { status: 200 }));
		const changed = vi.fn();
		render(<ScenarioSelect current="normal" live onChanged={changed} />);
		const select = await screen.findByRole("combobox", { name: "Mock scenario" });
		await waitFor(() => expect(select).toBeEnabled());
		fireEvent.change(select, { target: { value: "host-load-spike" } });
		await waitFor(() => expect(changed).toHaveBeenCalledOnce());
		expect(fetchMock).toHaveBeenCalledWith("/api/observatory/mock/scenario", expect.objectContaining({ method: "POST", body: JSON.stringify({ scenario: "host-load-spike" }) }));
	});

	it("keeps the current scenario when the API rejects a change", async () => {
		fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(list), { status: 200 }));
		fetchMock.mockResolvedValueOnce(new Response("{}", { status: 500 }));
		const changed = vi.fn();
		render(<ScenarioSelect current="normal" live onChanged={changed} />);
		const select = await screen.findByRole("combobox", { name: "Mock scenario" });
		await waitFor(() => expect(select).toBeEnabled());
		fireEvent.change(select, { target: { value: "host-load-spike" } });
		await screen.findByRole("alert");
		expect(select).toHaveValue("normal");
		expect(changed).not.toHaveBeenCalled();
	});

	it("disables edits when the server is read-only", async () => {
		fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ...list, editable: false }), { status: 200 }));
		render(<ScenarioSelect current="normal" live onChanged={vi.fn()} />);
		await screen.findByText("Demo controls are unavailable in production.");
		expect(screen.getByRole("combobox", { name: "Mock scenario" })).toBeDisabled();
	});
});
