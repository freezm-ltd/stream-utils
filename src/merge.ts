import { EventTarget2 } from "@freezm-ltd/event-target-2";
import { StreamGenerator, StreamGeneratorContext } from "./repipe";

export type MergeOption = {
    parallel?: number
    signal?: AbortSignal
    writableStrategy?: QueuingStrategy
    readableStrategy?: QueuingStrategy
}

// merge multiple streams, parallel loading and sequential piping
// need to mind parallel option and strategy when stream's total size is unknown, can cause OOM
export function mergeStream<T>(generators: Array<StreamGenerator<ReadableStream<T>>>, context?: StreamGeneratorContext, option?: MergeOption) {
    const { readable, writable } = new TransformStream<T, T>(undefined, option?.writableStrategy, option?.readableStrategy)
    const emitter = new EventTarget2() // event emitter
    const buffer: Record<number, ReadableStream<T>> = {} // generated streams
    const signal = option?.signal
    const parallel = option?.parallel || 1
    
    const load = async (index: number) => {
        if (index >= generators.length) return; // out of bound
        buffer[index] = await generators[index](context, signal) // load stream
        emitter.dispatch("load", index) // call stream loaded
    }

    emitter.listen("next", (e: CustomEvent<number>) => load(e.detail))

    const task = async () => {
        let index = 0
        while (index < generators.length) {
            if (!buffer[index]) await emitter.waitFor("load", index); // wait for load
            let errored = false
            await buffer[index].pipeTo(writable, { preventClose: true }).catch(e => {
                // error occurred, cancel all
                Object.values(buffer).forEach(stream => stream.cancel(e).catch(/* silent catch */))
                console.debug("mergeStream error:", e)
                errored = true
            })
            if (errored) break;
            emitter.dispatch("next", index + parallel) // load request
            index++
        }
        writable.close().catch(/* silent catch */)
        emitter.destroy()
    }
    task()

    for (let i = 0; i < parallel; i++) load(i); // initial load

    return readable
}