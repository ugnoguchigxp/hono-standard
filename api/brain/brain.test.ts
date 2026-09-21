import { describe, expect, it } from "vitest";
import { resolveBrainConfig } from "./core/config";
import { BrainRuntime } from "./runtime/brain-runtime";
import { EventQueue } from "./runtime/event-queue";
import { createRandomStreams } from "./runtime/random";
import { generateNetwork } from "./topology/generator";
import { Network, createNeuron } from "./core/network";
import {
	recordPostSpike,
	recordPreArrival,
	applyReward,
} from "./plasticity/stdp";

describe("brain core", () => {
	it("rejects unsafe config values", () => {
		expect(() => resolveBrainConfig({ neuronCount: 99 })).toThrow();
		expect(() => resolveBrainConfig({ minDelayMs: 0 })).toThrow();
		expect(() => resolveBrainConfig({ neuronCount: Number.NaN })).toThrow();
	});
	it("orders events by time, phase, then insertion sequence", () => {
		const queue = new EventQueue(3);
		queue.push({ atMs: 2, phase: 1, kind: "tick" });
		queue.push({ atMs: 1, phase: 2, kind: "tick" });
		queue.push({ atMs: 1, phase: 1, kind: "tick" });
		expect([
			queue.pop()?.phase,
			queue.pop()?.phase,
			queue.pop()?.phase,
		]).toEqual([1, 2, 1]);
		expect(() => queue.push({ atMs: 3, phase: 1, kind: "tick" })).not.toThrow();
	});
	it("is deterministic and propagates a sensory input without a full scan", () => {
		const config = resolveBrainConfig({
			neuronCount: 100,
			initialOutdegree: 1,
			synapseBudget: 100,
		});
		const build = () =>
			generateNetwork(config, createRandomStreams(7).topology);
		expect(build().cloneSnapshot()).toEqual(build().cloneSnapshot());
		const runtime = new BrainRuntime(build());
		runtime.inject(0, 2);
		expect(runtime.advanceTo(100, 1000).needsContinuation).toBe(false);
		expect(runtime.readSnapshot().counters.spikes).toBeGreaterThan(0);
		expect(runtime.visitedNeurons).toBeLessThan(config.neuronCount);
	});
	it("applies delayed reward only to locally eligible excitatory edges", () => {
		const config = resolveBrainConfig({
			neuronCount: 100,
			initialOutdegree: 0,
		});
		const network = new Network(config);
		network.addNeuron(createNeuron(0, "excitatory", "internal", 0, 0, config));
		network.addNeuron(createNeuron(1, "excitatory", "internal", 1, 1, config));
		const synapse = network.addSynapse({
			source: 0,
			target: 1,
			type: "excitatory",
			weight: 0.2,
			delayMs: 1,
			createdAt: 0,
			lastUsedAt: 0,
			eligibility: 0,
			traceUpdatedAt: 0,
			preTrace: 0,
			postTrace: 0,
			lastPlasticityDelta: 0,
		});
		recordPreArrival(network, synapse.id, 10);
		recordPostSpike(network, 1, 11);
		const before = synapse.weight;
		expect(applyReward(network, 111, 1)).toBe(1);
		expect(synapse.weight).toBeGreaterThan(before);
	});
	it("contains malformed deliveries and bounded queue failures", () => {
		const config = resolveBrainConfig({
			neuronCount: 100,
			initialOutdegree: 0,
		});
		const network = new Network(config);
		network.addNeuron(createNeuron(0, "excitatory", "internal", 0, 0, config));
		const runtime = new BrainRuntime(network);
		runtime.queue.push({ atMs: 1, phase: 1, kind: "input" });
		runtime.queue.push({ atMs: 2, phase: 2, kind: "arrival", synapseId: 99 });
		expect(runtime.advanceTo(2)).toMatchObject({ eventsProcessed: 2 });
		expect(runtime.invalidDeliveries).toBe(2);
		expect(() => runtime.inject(9, 1)).toThrow(/invalid/i);
		expect(() => runtime.advanceTo(-1)).toThrow(/invalid/i);
		const limited = new EventQueue(1);
		limited.push({ atMs: 1, phase: 1, kind: "tick" });
		expect(() => limited.push({ atMs: 2, phase: 1, kind: "tick" })).toThrow(
			/queue_limit/,
		);
	});

	it("enforces graph ownership and edge invariants", () => {
		const config = resolveBrainConfig({
			neuronCount: 100,
			initialOutdegree: 0,
		});
		const network = new Network(config);
		network.addNeuron(createNeuron(0, "excitatory", "internal", 0, 0, config));
		network.addNeuron(createNeuron(1, "inhibitory", "internal", 1, 1, config));
		expect(() =>
			network.addNeuron(
				createNeuron(0, "excitatory", "internal", 0, 0, config),
			),
		).toThrow();
		expect(() => network.addSynapse({ source: 0, target: 0 } as never)).toThrow(
			/self/i,
		);
		expect(network.removeSynapse(1)).toBe(false);
		expect(() => network.updateNeuron(99, {})).toThrow(/unknown/i);
	});
});
