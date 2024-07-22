import { StreamGenerator } from "./repipe";
export declare function mergeStream<T>(parallel: number, generators: Array<StreamGenerator<ReadableStream<T>>>): ReadableStream<T>;
