import { EventTarget2 } from "@freezm-ltd/event-target-2"
import { SwitchableReadableStream, SwitchableWritableStream } from "./repipe"
import { PromiseLikeOrNot, sleep } from "./utils"

// endpoint1      endpoint2
// A.writable -> A.readable
// B.readable <- B.writable
export class Duplex<A = any, B = any> {
    readonly endpoint1: DuplexEndpoint<A, B>
    readonly endpoint2: DuplexEndpoint<B, A>

    constructor() {
        const streamA = new TransformStream<A, A>()
        const streamB = new TransformStream<B, B>()
        this.endpoint1 = new DuplexEndpoint(streamA.readable, streamB.writable)
        this.endpoint2 = new DuplexEndpoint(streamB.readable, streamA.writable)
    }
}

export type ObjectifiedDuplexEndpoint<A = any, B = any> = { readable: ReadableStream<A>, writable: WritableStream<B> }
export type TransferableDuplexEndpoint<A = any, B = any> = {
    endpoint: ObjectifiedDuplexEndpoint<A, B>,
    transfer: [ReadableStream<A>, WritableStream<B>]
}

export class DuplexEndpoint<A = any, B = any> extends EventTarget2 {
    constructor(
        readonly readable: ReadableStream<A>,
        readonly writable: WritableStream<B>
    ) {
        super()
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
    readonly switchableReadable: SwitchableReadableStream<A>
    readonly switchableWritable: SwitchableWritableStream<B>

    constructor(
        readonly generator?: (context?: any) => PromiseLikeOrNot<DuplexEndpoint<A, B>>,
        readonly context?: any
    ) {
        const switchableReadable = new SwitchableReadableStream<A>()
        const switchableWritable = new SwitchableWritableStream<B>()
        super(switchableReadable.stream, switchableWritable.stream)
        this.switchableReadable = switchableReadable
        this.switchableWritable = switchableWritable
        if (generator) this.switch();
    }

    switch(endpoint?: DuplexEndpoint<A, B>) {
        return this.atomic("switch", async () => {
            if (!endpoint && this.generator) endpoint = await this.generator(this.context);
            if (!endpoint) return;
            const { readable, writable } = endpoint
            await this.switchableWritable.switch(writable) // writable first switch(abort)
            await this.switchableReadable.switch(readable) // sencondary
        })
    }
}