// endpoint1      endpoint2
// A.writable -> A.readable
// B.readable <- B.writable
export class Duplex<A, B> {
    readonly endpoint1: DuplexEndpoint<A, B>
    readonly endpoint2: DuplexEndpoint<B, A>

    constructor() {
        const streamA = new TransformStream()
        const streamB = new TransformStream()
        this.endpoint1 = new DuplexEndpoint(streamA.readable, streamB.writable)
        this.endpoint2 = new DuplexEndpoint(streamB.readable, streamA.writable)
    }
}

type ObjectifiedDuplexEndpoint<A, B> = { readable: ReadableStream<A>, writable: WritableStream<B> }
type TransferableDuplexEndpoint<A, B> = {
    endpoint: ObjectifiedDuplexEndpoint<A, B>,
    transfer: [ReadableStream<A>, WritableStream<B>]
}

export class DuplexEndpoint<A, B> {
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