import { createMemoryHistory } from "@tanstack/react-router";
import ReactDOMServer from "react-dom/server";
import { App } from "./App";
import { createAppRouter } from "./router";

export async function render(url: string) {
	const history = createMemoryHistory({
		initialEntries: [url],
	});
	const router = createAppRouter(history);

	await router.load();

	return {
		html: ReactDOMServer.renderToString(<App router={router} />),
	};
}
