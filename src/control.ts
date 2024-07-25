import { EventTarget2 } from "@freezm-ltd/event-target-2"
import { PromiseLikeOrNot } from "./utils"

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
    readonly signaler: WritableStream<BlockId>
    constructor(generator: ChunkGenerator<T>, strategy?: QueuingStrategy<T>) {
        const signal = new EventTarget2()
        let id = 0
        super({
            async pull(controller) {
                const { value, done } = await generator()
                if (done) {
                    controller.close()
                } else {
                    controller.enqueue({ id, chunk: value })
                    await signal.waitFor("next", id)
                    id++
                }
            }
        }, wrapQueuingStrategy(strategy))
        this.signaler = new WritableStream({
            write(chunk) {
                signal.dispatch("next", chunk)
            }
        })
    }
}

export class ControlledWritableStream<T> extends WritableStream<Block<T>> {
    constructor(consumer: ChunkConsumer<T>, signaler: WritableStream<BlockId>, strategy?: QueuingStrategy<T>) {
        const signal = signaler.getWriter();
        super({
            async write(block) {
                await consumer(block.chunk)
                await signal.write(block.id)
            },
            async close() {
                await signal.close()
            },
            async abort() {
                await signal.close()
            },
        }, wrapQueuingStrategy(strategy))
    }
}

export class ControlledStreamPair<T> {
    readonly readable: ControlledReadableStream<T>
    readonly writable: ControlledWritableStream<T>
    constructor(generator: ChunkGenerator<T>, consumer: ChunkConsumer<T>, readableStrategy?: QueuingStrategy<T>, writableStrategy?: QueuingStrategy<T>) {
        this.readable = new ControlledReadableStream(generator, readableStrategy)
        this.writable = new ControlledWritableStream(consumer, this.readable.signaler, writableStrategy)
    }
}