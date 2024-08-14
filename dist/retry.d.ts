import { StreamGenerator, StreamGeneratorContext } from "./repipe";
export type RetryOption<T> = {
    minSpeed?: number;
    minDuration?: number;
    slowDown?: number;
    signal?: AbortSignal;
    sensor?: (chunk: T) => number;
};
export declare function retryableStream<T>(readableGenerator: StreamGenerator<ReadableStream<T>>, context: StreamGeneratorContext, option?: RetryOption<T>): ReadableStream<T>;
export declare function retryableFetchStream(input: RequestInfo | URL, init?: RequestInit, option?: RetryOption<Uint8Array>): ReadableStream<Uint8Array>;
