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
    protected closed = false
    readonly readable: ReadableStream<T>
    readonly writable: WritableStream<T>

    constructor(
        readonly sensor: FlowSensor<T>,
        readonly interval: number = 1000
    ) {
        super()
        this.lastWatchInfo = { time: Date.now(), value: 0, delta: 0, interval: 0, flow: 0 }
        setInterval(() => this.watch(), interval)

        // to measure flow, pipeThrough this
        const _this = this
        const { readable, writable } = new TransformStream<T, T>({
            transform(chunk, controller) {
                controller.enqueue(chunk)
                _this.process(chunk)
            },
            flush() {
                _this.closed = true
                _this.destroy()
            }
        })
        this.readable = readable
        this.writable = writable
    }

    // custom trigger depends on flow info
    // callback if trigger===true duration overs triggerDuration
    // if trigger fired, other triggers skipped while slowDown
    addTrigger(trigger: FlowTrigger, callback: () => any, triggerDuration: number = 10_000, slowDown: number = 5_000) {
        if (this.listenerWeakMap.has(trigger)) throw new Error("FlowmeterAddTriggerError: Duplication of trigger is not allowed");
        let timeout: number | null = null
        let skip = false
        const setTimeout = (globalThis as WindowOrWorkerGlobalScope).setTimeout
        const listener = async (e: CustomEvent<FlowInfo>) => {
            const info = e.detail
            if (await trigger(info)) { // if triggered
                if (!timeout && !skip) {
                    const handler = () => {
                        if (!this.closed) callback(); // trigger callback
                        timeout = null
                        skip = true; // apply slowDown
                        setTimeout(() => { skip = false }, slowDown); // slowDown timeout
                    }
                    timeout = setTimeout(handler, triggerDuration); // initiate timeout
                }
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
}

export function lengthCounter(record: Record<any, any>, key: any) {
    let total = record[key]
    return new TransformStream({
        transform(chunk, controller) {
            total += chunk.length
            record[key] = total
            controller.enqueue(chunk)
        }
    })
}