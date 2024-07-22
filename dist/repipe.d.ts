import { EventTarget2 } from "@freezm-ltd/event-target-2";
export type StreamGenerator<T = ReadableStream | WritableStream> = () => T | PromiseLike<T>;
export declare class SwitchableStream extends EventTarget2 {
    readonly readableGenerator: StreamGenerator<ReadableStream>;
    readonly writableGenerator: StreamGenerator<WritableStream>;
    protected readonly readable: ReadableStream;
    protected readableAbortContorller: AbortController;
    protected readonly writable: WritableStream;
    protected writableAbortController: AbortController;
    protected abortReason: `${string}-${string}-${string}-${string}-${string}`;
    constructor(readableGenerator: StreamGenerator<ReadableStream>, writableGenerator: StreamGenerator<WritableStream>, readableStrategy?: QueuingStrategy, writableStrategy?: QueuingStrategy);
    protected readableSwitching: boolean;
    switchReadable(to?: ReadableStream): Promise<unknown>;
    protected writableSwitching: boolean;
    switchWritable(to?: WritableStream): Promise<unknown>;
    abort(): void;
}
