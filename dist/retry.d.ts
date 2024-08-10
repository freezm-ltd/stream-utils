import { StreamGenerator, StreamGeneratorContext } from "./repipe";
export type RetryOption = {
    minSpeed?: number;
    minDuration?: number;
    slowDown?: number;
    signal?: AbortSignal;
};
export declare function retryableStream<T>(readableGenerator: StreamGenerator<ReadableStream<T>>, context: StreamGeneratorContext, option?: RetryOption, sensor?: (chunk: T) => number): ReadableStream<T>;
export declare function retryableFetchStream(input: RequestInfo | URL, init?: RequestInit, option?: RetryOption): ReadableStream<Uint8Array>;
