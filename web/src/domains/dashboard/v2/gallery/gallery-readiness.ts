export type GalleryReadiness = {
	manifest: boolean;
	panels: number;
	readyPanels: number;
	errorPanels: number;
};

export function isGalleryReady(value: GalleryReadiness) {
	return (
		value.manifest &&
		value.panels > 0 &&
		value.readyPanels === value.panels &&
		value.errorPanels === 0
	);
}
