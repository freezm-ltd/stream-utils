import { EventTarget2 } from "@freezm-ltd/event-target-2"
import { PromiseLikeOrNot } from "./utils"

type Block<T> = { id: BlockId, chunk: T }
type BlockId = number
type ChunkGenerator<T> = () => PromiseLikeOrNot<ReadableStreamReadResult<T>>
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

function generatorify<T>(readable: ReadableStream<T>): ChunkGenerator<T> {
    const reader = readable.getReader()
    return reader.read
}

//      enqueue signal <------ signaler(ReadableStream) ------ consuming done signal
//            |                                                            | 
// ControlledReadableStream.readable -> piping & transfer -> ControlledWritableStream.writable (async-sink consume)
export class ControlledReadableStream<T> {
    readonly readable: ReadableStream<Block<T>>
    constructor(generator: ReadableStream<T> | ChunkGenerator<T>, signaler: ReadableStream<BlockId>, strategy?: QueuingStrategy<T>) {
        if (generator instanceof ReadableStream) generator = generatorify(generator);

        const signal = signaler.getReader()
        let consumedId = -1

        let id = 0
        this.readable = new ReadableStream({
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

export class ControlledWritableStream<T> {
    readonly writable: WritableStream<Block<T>>
    readonly signaler: ReadableStream<BlockId>
    constructor(consumer: ChunkConsumer<T>, strategy?: QueuingStrategy<T>) {
        const initEmitter = new EventTarget2()
        let initFired = false
        let controller: ReadableStreamDefaultController<number>

        this.writable = new WritableStream({
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
    readonly readable: ReadableStream<Block<T>>
    readonly writable: WritableStream<Block<T>>
    constructor(generator: ChunkGenerator<T>, consumer: ChunkConsumer<T>, readableStrategy?: QueuingStrategy<T>, writableStrategy?: QueuingStrategy<T>) {
        const { writable, signaler } = new ControlledWritableStream(consumer, writableStrategy)
        const { readable } = new ControlledReadableStream(generator, signaler, readableStrategy)
        this.writable = writable
        this.readable = readable
    }
}