import { StreamGenerator, StreamGeneratorContext } from "./repipe";
export type RetryOption = {
    minSpeed?: number;
    minDuration?: number;
    slowDown?: number;
};
export declare function retryableStream<T>(context: StreamGeneratorContext, readableGenerator: StreamGenerator<ReadableStream<T>>, option?: RetryOption, sensor?: (chunk: T) => number): ReadableStream<T>;
export declare function retryableFetchStream(input: RequestInfo | URL, init?: RequestInit, option?: RetryOption): ReadableStream<Uint8Array>;
