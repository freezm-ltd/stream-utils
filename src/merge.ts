import { EventTarget2 } from "@freezm-ltd/event-target-2";
import { StreamGenerator } from "./repipe";

// merge multiple streams, parallel loading and sequential piping
// need to mind parallel option and strategy when stream's total size is unknown, can cause OOM
export function mergeStream<T>(generators: Array<StreamGenerator<ReadableStream<T>>>, parallel: number = 1, signal?: AbortSignal, writableStrategy?: QueuingStrategy<T>, readableStrategy?: QueuingStrategy<T>) {
    const { readable, writable } = new TransformStream<T, T>(undefined, writableStrategy, readableStrategy)
    const emitter = new EventTarget2() // event emitter
    const buffer: Record<number, ReadableStream<T>> = {} // generated streams

    const load = async (index: number) => {
        if (index >= generators.length) return; // out of bound
        buffer[index] = await generators[index](signal) // load stream
        emitter.dispatch("load", index) // call stream loaded
    }

    emitter.listen("next", (e: CustomEvent<number>) => load(e.detail))

    const task = async () => {
        let index = 0
        while (index < generators.length) {
            if (!buffer[index]) await emitter.waitFor("load", index); // wait for load
            try {
                await buffer[index].pipeTo(writable, { preventClose: true })
            } catch (e) {
                // error occurred, cancel all
                Object.values(buffer).forEach(stream => stream.cancel(e).catch(/* silent catch */))
                throw e // forward error
            }
            emitter.dispatch("next", index + parallel) // load request
            index++
        }
        await writable.close()
        emitter.destroy()
    }
    task()

    for (let i = 0; i < parallel; i++) load(i); // initial load

    return readable
}