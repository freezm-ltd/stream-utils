import { EventTarget2 } from "@freezm-ltd/event-target-2";
import { PromiseLikeOrNot } from "./utils";
export type StreamGenerator<T = ReadableStream | WritableStream> = (context: StreamGeneratorContext) => PromiseLikeOrNot<T>;
export type StreamGeneratorContext = {
    signal?: AbortSignal;
} & any;
export declare abstract class AbstractSwitchableStream<T> extends EventTarget2 {
    readonly generator?: StreamGenerator | undefined;
    readonly context: StreamGeneratorContext;
    readonly strategy?: QueuingStrategy<T> | undefined;
    abstract readonly stream: ReadableStream<T> | WritableStream<T>;
    protected controller: AbortController;
    protected abortReason: string;
    constructor(generator?: StreamGenerator | undefined, context?: StreamGeneratorContext, strategy?: QueuingStrategy<T> | undefined);
    protected isSwitching: boolean;
    switch(to?: ReadableStream | WritableStream): Promise<unknown> | undefined;
    abort(): void;
    protected abstract target(to: ReadableStream | WritableStream): {
        readable: ReadableStream;
        writable: WritableStream;
    };
}
export declare class SwitchableReadableStream<T> extends AbstractSwitchableStream<T> {
    readonly generator?: StreamGenerator<ReadableStream<T>> | undefined;
    readonly context: StreamGeneratorContext;
    readonly strategy?: QueuingStrategy<T> | undefined;
    readonly stream: ReadableStream<T>;
    protected readonly writable: WritableStream<T>;
    constructor(generator?: StreamGenerator<ReadableStream<T>> | undefined, context?: StreamGeneratorContext, strategy?: QueuingStrategy<T> | undefined);
    protected target(to: ReadableStream<T>): {
        readable: ReadableStream<T>;
        writable: WritableStream<T>;
    };
}
export declare class SwitchableWritableStream<T> extends AbstractSwitchableStream<T> {
    readonly generator?: StreamGenerator<WritableStream<T>> | undefined;
    readonly context: StreamGeneratorContext;
    readonly strategy?: QueuingStrategy<T> | undefined;
    readonly stream: WritableStream<T>;
    protected readonly readable: ReadableStream<T>;
    constructor(generator?: StreamGenerator<WritableStream<T>> | undefined, context?: StreamGeneratorContext, strategy?: QueuingStrategy<T> | undefined);
    protected target(to: WritableStream<T>): {
        readable: ReadableStream<T>;
        writable: WritableStream<T>;
    };
}
