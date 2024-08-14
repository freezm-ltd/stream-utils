import { EventTarget2 } from "@freezm-ltd/event-target-2";
import { PromiseLikeOrNot } from "./utils";
export type StreamGenerator<T = ReadableStream | WritableStream> = (context?: StreamGeneratorContext, signal?: AbortSignal) => PromiseLikeOrNot<T>;
export type StreamGeneratorContext = any;
export declare abstract class AbstractSwitchableStream<T> extends EventTarget2 {
    readonly generator?: StreamGenerator | undefined;
    readonly context?: StreamGeneratorContext;
    readonly signal?: AbortSignal | undefined;
    abstract readonly stream: ReadableStream<T> | WritableStream<T>;
    protected controller: AbortController;
    protected abortReason: string;
    constructor(generator?: StreamGenerator | undefined, context?: StreamGeneratorContext, signal?: AbortSignal | undefined);
    protected isSwitching: boolean;
    switch(to?: ReadableStream | WritableStream): Promise<unknown> | undefined;
    abort(): Promise<void>;
    protected abstract target(to: ReadableStream | WritableStream): {
        readable: ReadableStream;
        writable: WritableStream;
    };
    protected abstract get locked(): boolean;
}
export declare class SwitchableReadableStream<T> extends AbstractSwitchableStream<T> {
    readonly generator?: StreamGenerator<ReadableStream<T>> | undefined;
    readonly context?: StreamGeneratorContext;
    readonly signal?: AbortSignal | undefined;
    readonly stream: ReadableStream<T>;
    readonly writable: WritableStream<T>;
    constructor(generator?: StreamGenerator<ReadableStream<T>> | undefined, context?: StreamGeneratorContext, signal?: AbortSignal | undefined);
    protected target(to: ReadableStream<T>): {
        readable: ReadableStream<T>;
        writable: WritableStream<T>;
    };
    get locked(): boolean;
}
export declare class SwitchableWritableStream<T> extends AbstractSwitchableStream<T> {
    readonly generator?: StreamGenerator<WritableStream<T>> | undefined;
    readonly context?: StreamGeneratorContext;
    readonly signal?: AbortSignal | undefined;
    readonly stream: WritableStream<T>;
    readonly readable: ReadableStream<T>;
    constructor(generator?: StreamGenerator<WritableStream<T>> | undefined, context?: StreamGeneratorContext, signal?: AbortSignal | undefined);
    protected target(to: WritableStream<T>): {
        readable: ReadableStream<T>;
        writable: WritableStream<T>;
    };
    get locked(): boolean;
}
