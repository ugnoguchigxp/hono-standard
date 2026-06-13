import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { router as defaultRouter } from "./router";
import { ShowcaseSettingsProvider } from "./showcase-settings-context";

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			retry: false,
		},
	},
});

type AppProps = {
	router?: typeof defaultRouter;
};

export function App({ router = defaultRouter }: AppProps) {
	return (
		<QueryClientProvider client={queryClient}>
			<ShowcaseSettingsProvider>
				<RouterProvider router={router} />
			</ShowcaseSettingsProvider>
		</QueryClientProvider>
	);
}
