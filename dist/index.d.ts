import { StreamGenerator } from "./repipe";
export type RetryOption = {
    minSpeed: number;
    minDuration: number;
};
export declare function streamRetry<T>(readableGenerator: StreamGenerator<ReadableStream<T>>, sensor: (chunk: T) => number, option: RetryOption): ReadableStream<T>;
export declare function fetchRetry(input: RequestInfo | URL, init?: RequestInit, option?: RetryOption & {
    slowDown: number;
}): ReadableStream<Uint8Array>;
