import type { AssetContainer } from "@babylonjs/core/assetContainer";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import type { Scene } from "@babylonjs/core/scene";

/** Scene-scoped GLB cache. Each URL is parsed once and cloned per actor. */
export class BabylonAssetCache {
	private readonly containers = new Map<string, Promise<AssetContainer>>();
	constructor(private readonly scene: Scene) {}

	private load(url: string): Promise<AssetContainer> {
		let pending = this.containers.get(url);
		if (!pending) {
			pending = LoadAssetContainerAsync(url, this.scene).catch((error) => {
				this.containers.delete(url);
				throw error;
			});
			this.containers.set(url, pending);
		}
		return pending;
	}

	async instantiate(url: string, prefix: string) {
		const container = await this.load(url);
		const entries = container.instantiateModelsToScene(
			(name) => `${prefix}-${name}`,
			false,
			{ doNotInstantiate: false },
		);
		for (const group of entries.animationGroups)
			if (group.name.startsWith(`${prefix}-`))
				group.name = group.name.slice(prefix.length + 1);
		return entries;
	}

	dispose(): void {
		for (const pending of this.containers.values())
			void pending.then(
				(container) => container.dispose(),
				() => undefined,
			);
		this.containers.clear();
	}
}
