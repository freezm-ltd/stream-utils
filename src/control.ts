import { EventTarget2 } from "@freezm-ltd/event-target-2"
import { PromiseLikeOrNot } from "./utils"
import { ObjectifiedDuplexEndpoint, SwitchableDuplexEndpoint } from "./duplex"

export type Block<T> = { id: BlockId, chunk: T }
export type BlockId = number
type ChunkGenerator<T> = () => PromiseLikeOrNot<ReadableStreamReadResult<T>>
type ChunkConsumer<T> = (chunk: T) => PromiseLikeOrNot<void>
export type ControlledReadableEndpoint<T> = SwitchableDuplexEndpoint<BlockId, Block<T>>
export type ObjectifiedControlledReadableEndpoint<T> = ObjectifiedDuplexEndpoint<BlockId, Block<T>>
export type ControlledWritableEndpoint<T> = SwitchableDuplexEndpoint<Block<T>, BlockId>
export type ObjectifiedControlledWritableEndpoint<T> = ObjectifiedDuplexEndpoint<Block<T>, BlockId>

/*                                               Block<T>
            T                                     --->                                     T
    source ---> ControlledReadableStream <endpoint>   <endpoint> ControlledWritableStream ---> sink (async consumed)
       |                                          <---                                               |
            <---       pull       <---           BlockId       <---          signal          <---
*/


export class ControlledReadableStream<T> extends EventTarget2 {
    readonly endpoint: ControlledReadableEndpoint<T>
    constructor(generator: ReadableStream<T> | ChunkGenerator<T>, endpoint?: ControlledReadableEndpoint<T>, strategy?: QueuingStrategy<T>) {
        super()

        if (generator instanceof ReadableStream) generator = generatorify(generator);

        // setup endpoint(switchable)
        this.endpoint = endpoint ? endpoint : new SwitchableDuplexEndpoint()
        const signal = this.endpoint.readable.getReader()

        // setup blockStream
        let enqueued = 0
        let consumed = -1
        const stream = new ReadableStream({
            async pull(controller) {
                const { value, done } = await generator()
                if (done) {
                    controller.close()
                } else {
                    const block = { id: enqueued, chunk: value }
                    while (consumed < enqueued) { // continuously enqueue and wait for consume current chunk
                        controller.enqueue(block)
                        const result = await signal.read()
                        if (result.done) return; // end
                        consumed = result.value // consumed
                    }
                    enqueued++
                }
            }
        }, wrapQueuingStrategy(strategy))

        // pipeTo endpoint
        stream.pipeTo(this.endpoint.writable).then(() => this.dispatch("close"))
        if (endpoint) this.endpoint.switch()
    }
}

export class ControlledWritableStream<T> extends EventTarget2 {
    readonly endpoint: ControlledWritableEndpoint<T>
    constructor(consumer: ChunkConsumer<T>, endpoint?: ControlledWritableEndpoint<T>,  strategy?: QueuingStrategy<T>) {
        super()

        // setup endpoint(switchable)
        this.endpoint = endpoint ? endpoint : new SwitchableDuplexEndpoint()
        const signal = this.endpoint.writable.getWriter()

        // setup consumeStream
        let consumed = -1
        let interval: number
        const stream = new WritableStream({
            async write(block) {
                if (interval) clearInterval(interval);
                if (block.id > consumed) { // consume only new block
                    await consumer(block.chunk)
                    consumed = block.id
                }
                signal.write(block.id)
                interval = (globalThis as WindowOrWorkerGlobalScope).setInterval(() => { // continuously write signal
                    signal.write(block.id).catch(async () => {
                        if (await signal.closed) clearInterval(interval); // if closed, clearInterval
                    })
                }, 1000)
            },
            async close() {
                if (interval) clearInterval(interval);
                signal.close()
            },
            async abort(reason) {
                if (interval) clearInterval(interval);
                signal.abort(reason)
            },
        }, wrapQueuingStrategy(strategy))

        // pipeFrom endpoint
        this.endpoint.readable.pipeTo(stream).then(() => this.dispatch("close"))
        if (endpoint) this.endpoint.switch()
    }
}

export class ControlledStreamPair<T> {
    readonly readable: ControlledReadableStream<T>
    readonly writable: ControlledWritableStream<T>
    constructor(
        generator: ChunkGenerator<T>, consumer: ChunkConsumer<T>, 
        readableStrategy?: QueuingStrategy<T>, writableStrategy?: QueuingStrategy<T>
    ) {
        this.readable = new ControlledReadableStream(generator, undefined, readableStrategy)
        this.writable = new ControlledWritableStream(consumer, undefined, writableStrategy)
    }
}

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
export class _ControlledReadableStream<T> {
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
                    while (consumedId < id) {
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

export class _ControlledWritableStream<T> {
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

export class _ControlledStreamPair<T> {
    readonly readable: ReadableStream<Block<T>>
    readonly writable: WritableStream<Block<T>>
    constructor(generator: ChunkGenerator<T>, consumer: ChunkConsumer<T>, readableStrategy?: QueuingStrategy<T>, writableStrategy?: QueuingStrategy<T>) {
        const { writable, signaler } = new _ControlledWritableStream(consumer, writableStrategy)
        const { readable } = new _ControlledReadableStream(generator, signaler, readableStrategy)
        this.writable = writable
        this.readable = readable
    }
}