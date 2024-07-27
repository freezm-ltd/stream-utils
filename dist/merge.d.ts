import { StreamGenerator, StreamGeneratorContext } from "./repipe";
export type MergeOption = {
    parallel?: number;
    signal?: AbortSignal;
    writableStrategy?: QueuingStrategy;
    readableStrategy?: QueuingStrategy;
};
export declare function mergeStream<T>(generators: Array<StreamGenerator<ReadableStream<T>>>, context?: StreamGeneratorContext, option?: MergeOption): ReadableStream<T>;
