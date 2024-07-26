// endpoint1      endpoint2
// A.writable -> A.readable

import { EventTarget2 } from "@freezm-ltd/event-target-2"
import { SwitchableReadableStream, SwitchableWritableStream } from "./repipe"
import { PromiseLikeOrNot } from "./utils"

// B.readable <- B.writable
export class Duplex<A = any, B = any> {
    readonly endpoint1: DuplexEndpoint<A, B>
    readonly endpoint2: DuplexEndpoint<B, A>

    constructor() {
        const streamA = new TransformStream()
        const streamB = new TransformStream()
        this.endpoint1 = new DuplexEndpoint(streamA.readable, streamB.writable)
        this.endpoint2 = new DuplexEndpoint(streamB.readable, streamA.writable)
    }
}

export type ObjectifiedDuplexEndpoint<A = any, B = any> = { readable: ReadableStream<A>, writable: WritableStream<B> }
export type TransferableDuplexEndpoint<A = any, B = any> = {
    endpoint: ObjectifiedDuplexEndpoint<A, B>,
    transfer: [ReadableStream<A>, WritableStream<B>]
}

export class DuplexEndpoint<A = any, B = any> {
    constructor(
        readonly readable: ReadableStream<A>,
        readonly writable: WritableStream<B>
    ) {

    }

    // transfer duplex by postMessage
    static transferify<A, B>(endpoint: DuplexEndpoint<A, B>): TransferableDuplexEndpoint<A, B> {
        const { readable, writable } = endpoint
        return {
            endpoint: { readable, writable },
            transfer: [readable, writable]
        }
    }

    // restore duplex from postMessage
    static instancify<A, B>(objectifiedEndpoint: ObjectifiedDuplexEndpoint<A, B>): DuplexEndpoint<A, B> {
        return new DuplexEndpoint(objectifiedEndpoint.readable, objectifiedEndpoint.writable)
    }
}

export class SwitchableDuplexEndpoint<A = any, B = any> extends DuplexEndpoint<A, B> {
    readonly switchableReadable = new SwitchableReadableStream<A>()
    readonly switchableWritable = new SwitchableWritableStream<B>()

    constructor(generator?: (context: any) => PromiseLikeOrNot<DuplexEndpoint<A, B>>, context: any = {}) {
        const switchEmitter = new EventTarget2()
        if (generator) { // automatic switching
            let readableRequired = false, writableRequired = false;
            switchEmitter.listen<"readable" | "writable", void>("require", async (e) => {
                if (e.detail === "readable") readableRequired = true;
                if (e.detail === "writable") writableRequired = true;
                if (readableRequired && writableRequired) {
                    readableRequired = false; writableRequired = false;
                    switchEmitter.dispatch("generate", await generator(context))
                }
            })
        }
        const switchableReadable = new SwitchableReadableStream<A>(generator ? async () => {
            return (await switchEmitter.waitFor<DuplexEndpoint<A, B>>("generate")).readable
        } : undefined)
        const switchableWritable = new SwitchableWritableStream<B>(generator ? async () => {
            return (await switchEmitter.waitFor<DuplexEndpoint<A, B>>("generate")).writable
        } : undefined)
        super(switchableReadable.stream, switchableWritable.stream)
        this.switchableReadable = switchableReadable
        this.switchableWritable = switchableWritable
    }

    async switch(endpoint: DuplexEndpoint<A, B>) {
        await Promise.all([
            this.switchableReadable.switch(endpoint.readable),
            this.switchableWritable.switch(endpoint.writable)
        ])
    }
}