import { lazy, Suspense } from "react";
import type { ComponentProps } from "react";

const LazyLayer = lazy(() =>
	import("./annotation-layer").then((module) => ({
		default: module.AnnotationLayer,
	})),
);
const LazyList = lazy(() =>
	import("./annotation-layer").then((module) => ({
		default: module.AnnotationList,
	})),
);

export function DeferredAnnotationLayer(
	props: ComponentProps<typeof LazyLayer>,
) {
	return (
		<Suspense fallback={null}>
			<LazyLayer {...props} />
		</Suspense>
	);
}

export function DeferredAnnotationList(props: ComponentProps<typeof LazyList>) {
	return (
		<Suspense fallback={null}>
			<LazyList {...props} />
		</Suspense>
	);
}
