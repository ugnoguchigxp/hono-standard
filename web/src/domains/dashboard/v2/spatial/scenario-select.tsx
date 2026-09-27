import { appFetch } from "../../../../api";
import { scenarioSchema, type Scenario } from "@shared/schemas/observatory";
import { useEffect, useState } from "react";
import { z } from "zod";

const scenarioListSchema = z.object({
	scenarios: z.array(z.object({ id: scenarioSchema, label: z.string() })),
	current: scenarioSchema,
	editable: z.boolean().default(true),
});

export function ScenarioSelect({
	current,
	live,
	onChanged,
}: {
	current: Scenario;
	live: boolean;
	onChanged: () => void;
}) {
	const [list, setList] = useState<z.infer<typeof scenarioListSchema> | null>(
		null,
	);
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	useEffect(() => {
		const controller = new AbortController();
		void (async () => {
			try {
				const response = await appFetch("/api/observatory/mock/scenarios", {
					signal: controller.signal,
				});
				if (!response.ok) throw new Error("Scenario list unavailable");
				const data = scenarioListSchema.parse(await response.json());
				if (!controller.signal.aborted) setList(data);
			} catch {
				if (!controller.signal.aborted)
					setError("Could not load mock scenarios.");
			}
		})();
		return () => controller.abort();
	}, []);
	const change = async (scenario: Scenario) => {
		setPending(true);
		setError(null);
		try {
			const response = await appFetch("/api/observatory/mock/scenario", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ scenario }),
			});
			if (!response.ok) throw new Error("Scenario change failed");
			onChanged();
		} catch {
			setError("Could not change the mock scenario. Try again.");
		} finally {
			setPending(false);
		}
	};
	return (
		<div className="spatial-scenario-control">
			<label htmlFor="spatial-scenario">Mock scenario</label>
			<select
				id="spatial-scenario"
				value={current}
				disabled={!list?.editable || !live || pending}
				onChange={(event) =>
					void change(scenarioSchema.parse(event.target.value))
				}
			>
				{list?.scenarios.map((scenario) => (
					<option key={scenario.id} value={scenario.id}>
						{scenario.label}
					</option>
				)) ?? <option value={current}>{current}</option>}
			</select>
			{pending ? <span role="status">Changing scenario…</span> : null}
			{list && !list.editable ? (
				<span>Demo controls are unavailable in production.</span>
			) : null}
			{error ? <span role="alert">{error}</span> : null}
		</div>
	);
}
