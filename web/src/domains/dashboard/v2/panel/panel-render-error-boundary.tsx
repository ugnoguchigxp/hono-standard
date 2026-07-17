import { Component, type ErrorInfo, type ReactNode } from "react";
export class PanelRenderErrorBoundary extends Component<
	{ children: ReactNode; onRetry?: () => void; resetKey?: string },
	{ error: Error | null }
> {
	state = { error: null };
	static getDerivedStateFromError(error: Error) {
		return { error };
	}
	componentDidCatch(_error: Error, _info: ErrorInfo) {
		/* panel isolation boundary */
	}
	componentDidUpdate(previous: Readonly<{ resetKey?: string }>) {
		if (this.state.error && previous.resetKey !== this.props.resetKey)
			this.setState({ error: null });
	}
	render() {
		return this.state.error ? (
			<div className="dashboard-panel-state dashboard-panel-error" role="alert">
				<p>Visualization failed to render.</p>
				<button
					type="button"
					onClick={() => {
						this.props.onRetry?.();
						this.setState({ error: null });
					}}
				>
					Retry
				</button>
			</div>
		) : (
			this.props.children
		);
	}
}
