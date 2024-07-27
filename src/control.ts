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
    constructor(consumer: ChunkConsumer<T>, endpoint?: ControlledWritableEndpoint<T>, strategy?: QueuingStrategy<T>) {
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
        generator: ReadableStream<T> | ChunkGenerator<T>, consumer: ChunkConsumer<T>,
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
    const generator = (async function* _() {
        for await (const chunk of readable) {
            yield chunk
        }
        return null
    })()
    return (async () => { return await generator.next() }) as ChunkGenerator<T>
}