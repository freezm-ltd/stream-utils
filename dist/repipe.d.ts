import { EventTarget2 } from "@freezm-ltd/event-target-2";
import { PromiseLikeOrNot } from "./utils";
export type StreamGenerator<T = ReadableStream | WritableStream> = (context: StreamGeneratorContext) => PromiseLikeOrNot<T>;
export type StreamGeneratorContext = {
    signal?: AbortSignal;
} & any;
export declare class SwitchableStream extends EventTarget2 {
    readonly readableGenerator?: StreamGenerator<ReadableStream> | undefined;
    readonly writableGenerator?: StreamGenerator<WritableStream> | undefined;
    readonly readableContext: StreamGeneratorContext;
    readonly writableContext: StreamGeneratorContext;
    protected readonly readable: ReadableStream;
    protected readonly writable: WritableStream;
    protected readableAbortContorller: AbortController;
    protected writableAbortController: AbortController;
    protected abortReason: string;
    constructor(readableGenerator?: StreamGenerator<ReadableStream> | undefined, writableGenerator?: StreamGenerator<WritableStream> | undefined, readableContext?: StreamGeneratorContext, writableContext?: StreamGeneratorContext, readableStrategy?: QueuingStrategy, writableStrategy?: QueuingStrategy);
    protected readableSwitching: boolean;
    switchReadable(to?: ReadableStream): Promise<unknown>;
    protected writableSwitching: boolean;
    switchWritable(to?: WritableStream): Promise<unknown>;
    abort(): void;
}
