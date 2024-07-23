import { StreamGenerator } from "./repipe";
export type MergeOption = {
    parallel?: number;
    signal?: AbortSignal;
    writableStrategy?: QueuingStrategy;
    readableStrategy?: QueuingStrategy;
};
export declare function mergeStream<T>(generators: Array<StreamGenerator<ReadableStream<T>>>, option: MergeOption): ReadableStream<T>;
