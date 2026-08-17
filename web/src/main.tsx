import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

export function mountApp(doc: Document = document): Root {
	const root = doc.getElementById("root");
	if (!root) {
		throw new Error("Root element not found");
	}

	const reactRoot = createRoot(root);
	reactRoot.render(
		<StrictMode>
			<App />
		</StrictMode>,
	);
	return reactRoot;
}

export const webRoot = mountApp();
