// Bring back Readable/WritableStream and re-pipe each other, when they are broken or other event emitted

import { EventTarget2 } from "@freezm-ltd/event-target-2"
import { PromiseLikeOrNot } from "./utils"

export type StreamGenerator<T = ReadableStream | WritableStream> = (context: StreamGeneratorContext) => PromiseLikeOrNot<T>
export type StreamGeneratorContext = { signal?: AbortSignal } & any

export abstract class AbstractSwitchableStream<T> extends EventTarget2 {
    abstract readonly stream: ReadableStream<T> | WritableStream<T>
    protected controller = new AbortController()
    protected abortReason = "SwitchableStreamAbortForSwitching" // to identify intended abort
    
    constructor(
        readonly generator?: StreamGenerator,
        readonly context: StreamGeneratorContext = { signal: undefined },
        readonly strategy?: QueuingStrategy<T>
    ) {
        super()
    }

    protected isSwitching = false
    async switch(to?: ReadableStream | WritableStream) {
        let generator: StreamGenerator
        if (!to) {
            if (this.isSwitching) return; // ignore standard switching if switching is already in progress
            if (this.generator) generator = this.generator
            else return; // switch target is null
        }
        return this.atomic("switch", async () => {
            this.isSwitching = true
            this.controller.abort(this.abortReason) // abort previous piping
            this.controller = new AbortController()
            this.context.signal = this.controller.signal // update abort signal
            while (!to) {
                try {
                    to = await generator!(this.context); // get source
                } catch (e) {
                    // slient catch, restart
                }
            }
            const { readable, writable } = this.target(to)
            readable.pipeTo(writable, { preventAbort: true, preventCancel: true, preventClose: true, signal: this.context.signal })
                .then(() => {
                    writable.close()
                })
                .catch(e => {
                    if (e !== this.abortReason) this.switch() // automatic repipe except intended abort
                })
            this.isSwitching = false
        })
    }

    abstract target(to: ReadableStream | WritableStream): { readable: ReadableStream, writable: WritableStream }

    abort() { // just abort and do not repipe
        this.controller.abort(this.abortReason)
    }
}

export class SwitchableReadableStream<T> extends AbstractSwitchableStream<T> {
    readonly stream: ReadableStream<T>
    protected readonly writable: WritableStream<T>

    constructor(
        readonly generator?: StreamGenerator<ReadableStream<T>>,
        readonly context: StreamGeneratorContext = { signal: undefined },
        readonly strategy?: QueuingStrategy<T>
    ) {
        super()
        const pipe = new TransformStream(undefined, undefined, strategy)
        this.stream = pipe.readable
        this.writable = pipe.writable
    }

    target(to: ReadableStream<T>) {
        return {
            readable: to,
            writable: this.writable,
        }
    }
}

export class SwitchableWritableStream<T> extends AbstractSwitchableStream<T> {
    readonly stream: WritableStream<T>
    protected readonly readable: ReadableStream<T>

    constructor(
        readonly generator?: StreamGenerator<ReadableStream<T>>,
        readonly context: StreamGeneratorContext = { signal: undefined },
        readonly strategy?: QueuingStrategy<T>
    ) {
        super()
        const pipe = new TransformStream(undefined, strategy)
        this.stream = pipe.writable
        this.readable = pipe.readable
    }

    target(to: WritableStream<T>) {
        return {
            readable: this.readable,
            writable: to,
        }
    }
}
