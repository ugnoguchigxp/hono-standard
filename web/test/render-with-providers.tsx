import {
	type DefaultOptions,
	QueryClient,
	QueryClientProvider,
} from "@tanstack/react-query";
import {
	type RenderOptions,
	type RenderResult,
	render,
} from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import type { ReactElement, ReactNode } from "react";

const testQueryDefaults: DefaultOptions = {
	queries: {
		retry: false,
		gcTime: Number.POSITIVE_INFINITY,
	},
	mutations: {
		retry: false,
	},
};

export function createTestQueryClient(): QueryClient {
	return new QueryClient({ defaultOptions: testQueryDefaults });
}

export function createQueryClientWrapper(
	queryClient = createTestQueryClient(),
) {
	return function QueryClientWrapper({ children }: { children: ReactNode }) {
		return (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		);
	};
}

type RenderWithProvidersOptions = Omit<RenderOptions, "wrapper"> & {
	queryClient?: QueryClient;
};

type RenderWithProvidersResult = RenderResult & {
	queryClient: QueryClient;
	user: UserEvent;
};

export function renderWithProviders(
	ui: ReactElement,
	options: RenderWithProvidersOptions = {},
): RenderWithProvidersResult {
	const { queryClient = createTestQueryClient(), ...renderOptions } = options;
	const wrapper = createQueryClientWrapper(queryClient);

	return {
		user: userEvent.setup(),
		queryClient,
		...render(ui, { wrapper, ...renderOptions }),
	};
}
