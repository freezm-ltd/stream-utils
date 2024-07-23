import { StreamGenerator } from "./repipe";
export declare function mergeStream<T>(parallel: number, generators: Array<StreamGenerator<ReadableStream<T>>>, writableStrategy?: QueuingStrategy<T>, readableStrategy?: QueuingStrategy<T>): ReadableStream<T>;
