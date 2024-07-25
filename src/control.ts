import { EventTarget2 } from "@freezm-ltd/event-target-2"
import { PromiseLikeOrNot } from "./utils"
import { chunkCallback } from "./flow"

type Block<T> = { id: BlockId, chunk: T }
type BlockId = number
type ChunkGenerator<T> = () => PromiseLikeOrNot<{ value: T, done: boolean }>
type ChunkConsumer<T> = (chunk: T) => PromiseLikeOrNot<void>

function wrapQueuingStrategy<T>(strategy?: QueuingStrategy<T>) {
    if (strategy) {
        const size = strategy.size
        return {
            highWaterMark: strategy.highWaterMark,
            size: size ? (block) => size(block.chunk) : undefined
        } as QueuingStrategy<Block<T>>
    }
    return undefined
}

//      enqueue signal <----- (signaler) ----- consuming done signal
//            |                                           | 
// ControlledReadableStream -> ... pipings ... -> ControlledWritableStream (async-sink consume)
export class ControlledReadableStream<T> extends ReadableStream<Block<T>> {
    constructor(generator: ChunkGenerator<T>, signaler: ReadableStream<BlockId>, strategy?: QueuingStrategy<T>) {
        const signal = signaler.getReader()
        let consumedId = -1

        let id = 0
        super({
            async pull(controller) {
                const { value, done } = await generator()
                if (done) {
                    controller.close()
                } else {
                    controller.enqueue({ id, chunk: value })
                    while(consumedId < id) {
                        const result = await signal.read()
                        if (result.done) return;
                        consumedId = result.value
                    }
                    id++
                }
            }
        }, wrapQueuingStrategy(strategy))
    }
}

export class ControlledWritableStream<T> extends WritableStream<Block<T>> {
    readonly signaler: ReadableStream<BlockId>
    constructor(consumer: ChunkConsumer<T>, strategy?: QueuingStrategy<T>) {
        const initEmitter = new EventTarget2()
        let initFired = false
        let controller: ReadableStreamDefaultController<number>

        super({
            async write(block) {
                await consumer(block.chunk)
                if (!initFired) await initEmitter.waitFor("start");
                controller.enqueue(block.id)
            },
            async close() {
                if (!initFired) await initEmitter.waitFor("start");
                controller.close()
            },
            async abort(reason) {
                if (!initFired) await initEmitter.waitFor("start");
                controller.error(reason)
            },
        }, wrapQueuingStrategy(strategy))

        this.signaler = new ReadableStream<BlockId>({
            start(_controller) {
                initFired = true
                initEmitter.dispatch("start")
                controller = _controller
            },
        })
    }
}

export class ControlledStreamPair<T> {
    readonly readable: ControlledReadableStream<T>
    readonly writable: ControlledWritableStream<T>
    constructor(generator: ChunkGenerator<T>, consumer: ChunkConsumer<T>, readableStrategy?: QueuingStrategy<T>, writableStrategy?: QueuingStrategy<T>) {
        this.writable = new ControlledWritableStream(consumer, writableStrategy)
        this.readable = new ControlledReadableStream(generator, this.writable.signaler, readableStrategy)
    }
}