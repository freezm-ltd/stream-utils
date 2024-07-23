import { StreamGenerator } from "./repipe";
export declare function mergeStream<T>(generators: Array<StreamGenerator<ReadableStream<T>>>, parallel?: number, signal?: AbortSignal, writableStrategy?: QueuingStrategy<T>, readableStrategy?: QueuingStrategy<T>): ReadableStream<T>;
