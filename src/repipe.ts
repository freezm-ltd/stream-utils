// Bring back Readable/WritableStream and re-pipe each other, when they are broken or other event emitted

import { EventTarget2 } from "@freezm-ltd/event-target-2"
import { PromiseLikeOrNot, sleep } from "./utils"

export type StreamGenerator<T = ReadableStream | WritableStream> = (context?: StreamGeneratorContext, signal?: AbortSignal) => PromiseLikeOrNot<T>
export type StreamGeneratorContext = any

export abstract class AbstractSwitchableStream<T> extends EventTarget2 {
    abstract readonly stream: ReadableStream<T> | WritableStream<T>
    protected controller = new AbortController()
    protected abortReason = "SwitchableStreamAbortForSwitching" // to identify intended abort

    constructor(
        readonly generator?: StreamGenerator,
        readonly context?: StreamGeneratorContext,
        readonly signal?: AbortSignal,
    ) {
        super()
    }

    protected isSwitching = false
    switch(to?: ReadableStream | WritableStream) {
        let generator: StreamGenerator
        if (!to) {
            if (this.isSwitching) return; // ignore standard switching if switching is already in progress
            if (this.generator) generator = this.generator
            else return; // switch target is null
        }
        return this.atomic("switch", async () => {
            this.isSwitching = true
            await this.abort() // abort previous piping, wait for fully aborted
            this.controller = new AbortController()
            if (this.signal) this.signal.onabort = () => this.controller.abort(this.abortReason);
            if (this.signal?.aborted) return;
            if (!to) to = await generator!(this.context, this.controller.signal); // get source
            const { readable, writable } = this.target(to)
            for (let i = 0; readable.locked || writable.locked; i += 10) await sleep(i); // wait for releaseLock
            readable.pipeTo(writable, { preventAbort: true, preventCancel: true, preventClose: true, signal: this.controller.signal })
                .then(() => {
                    writable.close(); // close
                })
                .catch(e => {
                    if (e !== this.abortReason) this.switch() // automatic repipe except intended abort
                })
            this.isSwitching = false
            this.dispatch("switch-done")
        })
    }

    async abort() { // just abort and do not repipe
        this.controller.abort(this.abortReason)
        for (let i = 0; this.locked; i += 10) {
            await sleep(i); // wait for releaseLock
        }
    }

    protected abstract target(to: ReadableStream | WritableStream): { readable: ReadableStream, writable: WritableStream }
    protected abstract get locked(): boolean
}

export class SwitchableReadableStream<T> extends AbstractSwitchableStream<T> {
    readonly stream: ReadableStream<T>
    readonly writable: WritableStream<T>

    constructor(
        readonly generator?: StreamGenerator<ReadableStream<T>>,
        readonly context?: StreamGeneratorContext,
        readonly signal?: AbortSignal,
    ) {
        super()
        const { readable, writable } = new TransformStream<T, T>()
        this.stream = readable
        this.writable = writable
        if (generator) this.switch() // immediate starting
    }

    protected target(to: ReadableStream<T>) {
        return {
            readable: to,
            writable: this.writable,
        }
    }

    get locked() {
        return this.writable.locked
    }
}

export class SwitchableWritableStream<T> extends AbstractSwitchableStream<T> {
    readonly stream: WritableStream<T>
    readonly readable: ReadableStream<T>

    constructor(
        readonly generator?: StreamGenerator<WritableStream<T>>,
        readonly context?: StreamGeneratorContext,
        readonly signal?: AbortSignal,
    ) {
        super()
        const { readable, writable } = new TransformStream<T, T>()
        this.stream = writable
        this.readable = readable
        if (generator) this.switch() // immediate starting
    }

    protected target(to: WritableStream<T>) {
        return {
            readable: this.readable,
            writable: to,
        }
    }

    get locked() {
        return this.readable.locked
    }
}
