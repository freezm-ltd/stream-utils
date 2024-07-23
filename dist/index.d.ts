import { Flowmeter } from "./flow";
import { StreamGenerator, SwitchableStream } from "./repipe";
import { fitStream, getFitter, byteFitter } from "./fit";
import { sliceStream, sliceByteStream } from "./slice";
import { mergeStream } from "./merge";
export type RetryOption = {
    minSpeed?: number;
    minDuration?: number;
    slowDown?: number;
};
export declare function streamRetry<T>(readableGenerator: StreamGenerator<ReadableStream<T>>, sensor: (chunk: T) => number, option?: RetryOption): ReadableStream<T>;
export declare function fetchRetry(input: RequestInfo | URL, init?: RequestInit, option?: RetryOption): ReadableStream<Uint8Array>;
export { Flowmeter, SwitchableStream, fitStream, getFitter, byteFitter, sliceStream, sliceByteStream, mergeStream, };
