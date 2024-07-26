import { SwitchableReadableStream, SwitchableWritableStream } from "./repipe";
import { PromiseLikeOrNot } from "./utils";
export declare class Duplex<A = any, B = any> {
    readonly endpoint1: DuplexEndpoint<A, B>;
    readonly endpoint2: DuplexEndpoint<B, A>;
    constructor();
}
export type ObjectifiedDuplexEndpoint<A = any, B = any> = {
    readable: ReadableStream<A>;
    writable: WritableStream<B>;
};
export type TransferableDuplexEndpoint<A = any, B = any> = {
    endpoint: ObjectifiedDuplexEndpoint<A, B>;
    transfer: [ReadableStream<A>, WritableStream<B>];
};
export declare class DuplexEndpoint<A = any, B = any> {
    readonly readable: ReadableStream<A>;
    readonly writable: WritableStream<B>;
    constructor(readable: ReadableStream<A>, writable: WritableStream<B>);
    static transferify<A, B>(endpoint: DuplexEndpoint<A, B>): TransferableDuplexEndpoint<A, B>;
    static instancify<A, B>(objectifiedEndpoint: ObjectifiedDuplexEndpoint<A, B>): DuplexEndpoint<A, B>;
}
export declare class SwitchableDuplexEndpoint<A = any, B = any> extends DuplexEndpoint<A, B> {
    readonly generator?: ((context: any) => PromiseLikeOrNot<DuplexEndpoint<A, B>>) | undefined;
    readonly context: any;
    readonly switchableReadable: SwitchableReadableStream<A>;
    readonly switchableWritable: SwitchableWritableStream<B>;
    constructor(generator?: ((context: any) => PromiseLikeOrNot<DuplexEndpoint<A, B>>) | undefined, context?: any);
    switch(endpoint?: DuplexEndpoint<A, B>): Promise<void>;
}
