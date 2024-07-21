import { EventListener2, EventTarget2 } from "@freezm-ltd/event-target-2";
export type FlowSensor<T> = (chunk: T) => number;
export type FlowSensorValue = {
    time: number;
    value: number;
};
export type FlowInfo = {
    time: number;
    value: number;
    delta: number;
    interval: number;
    flow: number;
};
export type FlowTrigger = (info: FlowInfo) => boolean | PromiseLike<boolean>;
export declare class Flowmeter<T> extends EventTarget2 {
    readonly sensor: FlowSensor<T>;
    readonly interval: number;
    protected buffer: Array<FlowSensorValue>;
    protected lastWatchInfo: FlowInfo;
    protected listenerWeakMap: WeakMap<FlowTrigger, EventListener2>;
    constructor(sensor: FlowSensor<T>, interval?: number);
    addTrigger(trigger: FlowTrigger, callback: () => any, triggerDuration?: number): void;
    delTrigger(trigger: FlowTrigger): void;
    protected watch(): void;
    protected process(chunk: T): void;
    get tube(): TransformStream<T, T>;
}
