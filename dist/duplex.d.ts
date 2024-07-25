export declare class Duplex<A, B> {
    readonly endpoint1: DuplexEndpoint<A, B>;
    readonly endpoint2: DuplexEndpoint<B, A>;
    constructor();
}
type ObjectifiedDuplexEndpoint<A, B> = {
    readable: ReadableStream<A>;
    writable: WritableStream<B>;
};
type TransferableDuplexEndpoint<A, B> = {
    endpoint: ObjectifiedDuplexEndpoint<A, B>;
    transfer: [ReadableStream<A>, WritableStream<B>];
};
export declare class DuplexEndpoint<A, B> {
    readonly readable: ReadableStream<A>;
    readonly writable: WritableStream<B>;
    constructor(readable: ReadableStream<A>, writable: WritableStream<B>);
    static transferify<A, B>(endpoint: DuplexEndpoint<A, B>): TransferableDuplexEndpoint<A, B>;
    static instancify<A, B>(objectifiedEndpoint: ObjectifiedDuplexEndpoint<A, B>): DuplexEndpoint<A, B>;
}
export {};
