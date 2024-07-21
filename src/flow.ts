import { EventListener2, EventTarget2 } from "@freezm-ltd/event-target-2"

// Measure ReadableStream's flow(speed) by byte-size, chunk-number, ...etc and emit event when stream flow triggers custom trigger

export type FlowSensor<T> = (chunk: T) => number
export type FlowSensorValue = {
    time: number
    value: number
}
export type FlowInfo = {
    time: number
    value: number
    delta: number
    interval: number
    flow: number
}
export type FlowTrigger = (info: FlowInfo) => boolean | PromiseLike<boolean>

export class Flowmeter<T> extends EventTarget2 {
    protected buffer: Array<FlowSensorValue> = []
    protected lastWatchInfo: FlowInfo
    protected listenerWeakMap: WeakMap<FlowTrigger, EventListener2> = new WeakMap()

    constructor(
        readonly sensor: FlowSensor<T>,
        readonly interval: number = 1000
    ) {
        super()
        this.lastWatchInfo = { time: Date.now(), value: 0, delta: 0, interval: 0, flow: 0 }
        setInterval(this.watch, interval)
    }

    // custom trigger depends on flow info
    // callback if trigger===true duration overs triggerDuration
    addTrigger(trigger: FlowTrigger, callback: () => any, triggerDuration: number = 10_000) {
        if (this.listenerWeakMap.has(trigger)) throw new Error("FlowmeterAddTriggerError: Duplication of trigger is not allowed");
        let timeout: number | null = null
        const listener = async (e: CustomEvent<FlowInfo>) => {
            const info = e.detail
            if (await trigger(info)) { // initiate timeout for callback
                if (!timeout) timeout = (globalThis as WindowOrWorkerGlobalScope).setTimeout(callback, triggerDuration);
            } else { // clear timeout
                if (timeout) clearTimeout(timeout);
                timeout = null
            }
        }
        this.listen("flow", listener)
        this.listenerWeakMap.set(trigger, listener)
    }

    delTrigger(trigger: FlowTrigger) {
        if (!this.listenerWeakMap.has(trigger)) throw new Error("FlowmeterDelTriggerError: This trigger is not attached");
        this.remove("flow", this.listenerWeakMap.get(trigger)!)
        this.listenerWeakMap.delete(trigger)
    }

    protected watch() { // create flow info
        const buffer = this.buffer; this.buffer = []
        const time = Date.now()
        const value = buffer.reduce((a, b) => a + b.value, 0)
        const delta = value - this.lastWatchInfo.value
        const interval = time - this.lastWatchInfo.time
        const flow = delta / interval
        const info = { time, value, delta, interval, flow }
        this.lastWatchInfo = info
        this.dispatch("flow", info) // emit event with flow info
    }

    protected process(chunk: T) { // create raw value with custom sensor function
        const time = Date.now()
        const value = this.sensor(chunk)
        this.buffer.push({ time, value })
    }

    get tube() { // To measure, pipeThrough this
        const _this = this
        return new TransformStream<T, T>({
            transform(chunk, controller) {
                controller.enqueue(chunk)
                _this.process(chunk)
            }
        })
    }
}