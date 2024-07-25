// Bring back Readable/WritableStream and re-pipe each other, when they are broken or other event emitted

import { EventTarget2 } from "@freezm-ltd/event-target-2"
import { PromiseLikeOrNot } from "./utils"

export type StreamGenerator<T = ReadableStream | WritableStream> = (context: StreamGeneratorContext) => PromiseLikeOrNot<T>
export type StreamGeneratorContext = { signal?: AbortSignal } & any

export class SwitchableStream extends EventTarget2 {
    protected readonly readable: ReadableStream
    protected readonly writable: WritableStream
    protected readableAbortContorller = new AbortController()
    protected writableAbortController = new AbortController()
    protected abortReason = "SwitchableStreamAbortForSwitching" // to identify intended abort

    constructor(
        readonly readableGenerator?: StreamGenerator<ReadableStream>,
        readonly writableGenerator?: StreamGenerator<WritableStream>,
        readonly readableContext: StreamGeneratorContext = { signal: undefined },
        readonly writableContext: StreamGeneratorContext = { signal: undefined },
        readableStrategy?: QueuingStrategy,
        writableStrategy?: QueuingStrategy,
    ) {
        super()
        const { readable, writable } = new TransformStream(undefined, writableStrategy, readableStrategy)
        this.readable = readable
        this.writable = writable
        this.switchWritable().then(() => this.switchReadable())
    }

    // switch repipe
    //    |    |
    // source -> this.writable -> this.readable -> sink
    protected readableSwitching = false
    async switchReadable(to?: ReadableStream) {
        let generator: StreamGenerator<ReadableStream<any>>;
        if (!to) {
            if (this.readableSwitching) return; // ignore standard switching if switching is already in progress
            if (this.readableGenerator) generator = this.readableGenerator;
            else return; // switch target is null
        }
        return this.atomic("switch-readable", async () => { // wait for previous switching ends
            this.readableSwitching = true
            this.readableAbortContorller.abort(this.abortReason) // abort previous piping
            this.readableAbortContorller = new AbortController()
            this.readableContext.signal = this.readableAbortContorller.signal
            while (!to) {
                try {
                    to = await generator(this.readableContext); // get source
                } catch (e) {
                    // slient catch, restart
                }
            }
            to.pipeTo(this.writable, { preventAbort: true, preventCancel: true, preventClose: true, signal: this.readableContext.signal })
                .then(() => {
                    this.writable.close()
                })
                .catch(e => {
                    if (e !== this.abortReason) this.switchReadable() // automatic repipe except intended abort
                })
            this.readableSwitching = false
        })
    }

    //                                      repipe switch
    //                                          |   |
    // source -> this.writable -> this.readable -> sink
    protected writableSwitching = false
    async switchWritable(to?: WritableStream) {
        let generator: StreamGenerator<WritableStream<any>>
        if (!to) {
            if (this.writableSwitching) return; // ignore standard switching if switching is already in progress
            if (this.writableGenerator) generator = this.writableGenerator;
            else return; // switch target is null
        }
        return this.atomic("switch-writable", async () => { // wait for previous switching ends
            this.writableSwitching = true
            this.writableAbortController.abort(this.abortReason) // abort previous piping
            this.writableAbortController = new AbortController()
            this.writableContext.signal = this.writableAbortController.signal
            while (!to) {
                try {
                    to = await generator(this.writableContext); // get sink
                } catch (e) {
                    // slient catch, restart
                }
            }
            this.readable.pipeTo(to, { preventAbort: true, preventCancel: true, preventClose: true, signal: this.writableContext.signal })
                .then(() => to!.close())
                .catch(e => {
                    if (e !== this.abortReason) this.switchWritable() // automatic repipe except intended abort
                })
            this.writableSwitching = false
        })
    }

    abort() { // just abort and do not repipe
        this.readableAbortContorller.abort(this.abortReason)
        this.writableAbortController.abort(this.abortReason)
    }
}