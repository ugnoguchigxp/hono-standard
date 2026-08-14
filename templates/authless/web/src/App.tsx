import { RouterProvider } from "@tanstack/react-router";
import { router as defaultRouter } from "./router";

type AppProps = { router?: typeof defaultRouter };

export function App({ router = defaultRouter }: AppProps = {}) {
	return <RouterProvider router={router} />;
}
