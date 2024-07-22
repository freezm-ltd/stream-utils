import { EventTarget2 } from "@freezm-ltd/event-target-2";
import { StreamGenerator } from "./repipe";

// merge multiple streams, parallel loading and sequential piping
// need to mind parallel option when stream's total size is unknown, can cause OOM
export function mergeStream<T>(parallel: number, generators: Array<StreamGenerator<ReadableStream<T>>>) {
    const { readable, writable } = new TransformStream<T, T>()
    const emitter = new EventTarget2() // event emitter
    const buffer: Record<number, ReadableStream<T>> = {} // generated streams

    const load = async (index: number) => {
        if (!generators[index]) return; // out of bound
        buffer[index] = await generators[index]() // load stream
        emitter.dispatch("load", index) // call stream loaded
    }

    for (let i = 0; i < generators.length; i++) { // listen for load request
        emitter.listenOnceOnly("next", () => load(i), (e: CustomEvent<number>) => e.detail === i)
    }

    let index = 0
    const task = async () => {
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
    }
    task()

    for (let i = 0; i < parallel; i++) load(i); // initial load

    return readable
}