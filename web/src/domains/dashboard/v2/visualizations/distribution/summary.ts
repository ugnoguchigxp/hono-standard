import type { BoxDatum } from "./box-plot";
import type { CalendarCell } from "./calendar";
import type { MatrixModel } from "./matrix";

export const histogramSummary = (
	bins: readonly { count: number }[],
	mode: string,
) =>
	`Histogram: ${bins.length} bins, ${bins.reduce((sum, bin) => sum + bin.count, 0)} values, ${mode}.`;
export const matrixSummary = (model: MatrixModel) =>
	`Heatmap: ${model.x.length} columns × ${model.y.length} rows, ${model.values.length} populated values.`;
export const boxSummary = (boxes: readonly BoxDatum[]) =>
	`Box plot: ${boxes.length} groups${boxes.some((box) => box.outliers.length) ? ", with outliers" : ""}.`;
export const calendarSummary = (cells: readonly CalendarCell[]) =>
	`Calendar heatmap: ${cells.length} dates, ${cells.filter((cell) => cell.inRange).length} populated.`;
