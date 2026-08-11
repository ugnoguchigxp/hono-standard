import type { StoryState } from "../model";
import type { ContentCondition } from "./schema";

export function evaluateContentCondition(
	condition: ContentCondition | undefined,
	story: Pick<StoryState, "flags" | "relationships">,
): boolean {
	if (!condition) return true;
	switch (condition.type) {
		case "flag.equals":
			return (
				(Object.hasOwn(story.flags, condition.flagId)
					? story.flags[condition.flagId]
					: false) === condition.value
			);
		case "relationship.gte":
			return (
				(Object.hasOwn(story.relationships, condition.relationshipId)
					? story.relationships[condition.relationshipId]
					: 0) >= condition.value
			);
		case "relationship.lte":
			return (
				(Object.hasOwn(story.relationships, condition.relationshipId)
					? story.relationships[condition.relationshipId]
					: 0) <= condition.value
			);
		case "all":
			return condition.conditions.every((child) =>
				evaluateContentCondition(child, story),
			);
		case "any":
			return condition.conditions.some((child) =>
				evaluateContentCondition(child, story),
			);
		case "not":
			return !evaluateContentCondition(condition.condition, story);
	}
}
