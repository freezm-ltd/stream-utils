import { EventListener2, EventTarget2 } from "@freezm-ltd/event-target-2";
import { PromiseLikeOrNot } from "./utils";
export type FlowSensor<T> = (chunk: T) => number;
export type FlowInfo = {
    time: number;
    value: number;
    delta: number;
    interval: number;
    flow: number;
};
export type FlowTrigger = (info: FlowInfo) => PromiseLikeOrNot<boolean>;
export declare class Flowmeter<T> extends EventTarget2 {
    readonly sensor: FlowSensor<T>;
    readonly interval: number;
    protected written: number;
    protected lastWatchInfo: FlowInfo;
    protected listenerWeakMap: WeakMap<FlowTrigger, EventListener2>;
    protected closed: boolean;
    readonly readable: ReadableStream<T>;
    readonly writable: WritableStream<T>;
    constructor(sensor: FlowSensor<T>, interval?: number);
    addTrigger(trigger: FlowTrigger, callback: () => any, triggerDuration?: number, slowDown?: number): void;
    delTrigger(trigger: FlowTrigger): void;
    protected watch(): void;
}
export declare function chunkCallback<T>(callback: (chunk: T) => void): TransformStream<T, T>;
export declare function lengthCallback(callback: (delta: number) => void, key?: string): TransformStream<any, any>;
