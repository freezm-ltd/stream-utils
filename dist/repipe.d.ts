export type StreamGenerator<T = ReadableStream | WritableStream> = () => T | PromiseLike<T>;
export declare class SwitchableStream {
    readonly readableGenerator: StreamGenerator<ReadableStream>;
    readonly writableGenerator: StreamGenerator<WritableStream>;
    protected readonly readable: ReadableStream;
    protected readableAbortContorller: AbortController;
    protected readonly writable: WritableStream;
    protected writableAbortController: AbortController;
    protected abortReason: `${string}-${string}-${string}-${string}-${string}`;
    constructor(readableGenerator: StreamGenerator<ReadableStream>, writableGenerator: StreamGenerator<WritableStream>, readableStrategy?: QueuingStrategy, writableStrategy?: QueuingStrategy);
    switchReadable(to?: ReadableStream): Promise<void>;
    switchWritable(to?: WritableStream): Promise<void>;
    abort(): void;
}
