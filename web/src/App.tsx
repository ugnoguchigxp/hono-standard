import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";
import { ShowcaseSettingsProvider } from "./showcase-settings-context";

export function createAppQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
			},
		},
	});
}

const defaultQueryClient = createAppQueryClient();

export function App({
	queryClient = defaultQueryClient,
}: {
	queryClient?: QueryClient;
} = {}) {
	return (
		<QueryClientProvider client={queryClient}>
			<ShowcaseSettingsProvider>
				<RouterProvider router={router} />
			</ShowcaseSettingsProvider>
		</QueryClientProvider>
	);
}
