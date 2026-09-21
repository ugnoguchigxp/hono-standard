import type { Action } from "../environment/world";
import type { Mulberry32 } from "../runtime/random";
const actions: Action[] = [
	"move_forward",
	"turn_left",
	"turn_right",
	"eat",
	"rest",
	"mate",
];
export function decodeMotor(
	counts: readonly number[],
	random: Mulberry32,
): Action | undefined {
	const max = Math.max(...counts);
	if (max <= 0) return undefined;
	const choices = counts
		.map((v, i) => (v === max ? i : -1))
		.filter((i) => i >= 0);
	const selected = choices[random.int(choices.length)];
	return selected === undefined ? undefined : actions[selected];
}
