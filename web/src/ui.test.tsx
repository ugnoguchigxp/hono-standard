import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../test/render-with-providers";
import { Button, IconButton, SelectInput, TextArea, TextInput } from "./ui";

describe("UI primitives", () => {
	it("forwards props and composes optional classes", () => {
		renderWithProviders(
			<>
				<Button variant="primary" full className="custom">
					Save
				</Button>
				<IconButton aria-label="Menu" className="icon-custom" />
				<TextInput aria-label="Name" className="input-custom" />
				<SelectInput aria-label="Role" className="select-custom">
					<option>Admin</option>
				</SelectInput>
				<TextArea aria-label="Notes" className="area-custom" />
			</>,
		);

		expect(screen.getByRole("button", { name: "Save" })).toHaveClass(
			"demo-button",
			"primary",
			"full",
			"custom",
		);
		expect(screen.getByRole("button", { name: "Menu" })).toHaveClass(
			"demo-icon-button",
			"icon-custom",
		);
		expect(screen.getByLabelText("Name")).toHaveClass(
			"demo-input",
			"input-custom",
		);
		expect(screen.getByLabelText("Role")).toHaveClass(
			"demo-input",
			"select-custom",
		);
		expect(screen.getByLabelText("Notes")).toHaveClass(
			"demo-textarea",
			"area-custom",
		);
	});

	it("uses default classes when optional props are absent", () => {
		renderWithProviders(
			<>
				<Button>Default</Button>
				<IconButton aria-label="Icon" />
				<TextInput aria-label="Input" />
				<SelectInput aria-label="Select">
					<option>One</option>
				</SelectInput>
				<TextArea aria-label="Area" />
			</>,
		);

		expect(screen.getByRole("button", { name: "Default" })).toHaveClass(
			"variant-outline",
		);
		expect(screen.getByRole("button", { name: "Icon" })).toHaveClass(
			"demo-icon-button",
		);
		expect(screen.getByLabelText("Input")).toHaveClass("demo-input");
		expect(screen.getByLabelText("Select")).toHaveClass("demo-input");
		expect(screen.getByLabelText("Area")).toHaveClass("demo-textarea");
	});
});
