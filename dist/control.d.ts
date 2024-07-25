import { PromiseLikeOrNot } from "./utils";
type Block<T> = {
    id: BlockId;
    chunk: T;
};
type BlockId = number;
type ChunkGenerator<T> = () => PromiseLikeOrNot<{
    value: T;
    done: boolean;
}>;
type ChunkConsumer<T> = (chunk: T) => PromiseLikeOrNot<void>;
export declare class ControlledReadableStream<T> extends ReadableStream<Block<T>> {
    constructor(generator: ChunkGenerator<T>, signaler: ReadableStream<BlockId>, strategy?: QueuingStrategy<T>);
}
export declare class ControlledWritableStream<T> extends WritableStream<Block<T>> {
    readonly signaler: ReadableStream<BlockId>;
    constructor(consumer: ChunkConsumer<T>, strategy?: QueuingStrategy<T>);
}
export declare class ControlledStreamPair<T> {
    readonly readable: ControlledReadableStream<T>;
    readonly writable: ControlledWritableStream<T>;
    constructor(generator: ChunkGenerator<T>, consumer: ChunkConsumer<T>, readableStrategy?: QueuingStrategy<T>, writableStrategy?: QueuingStrategy<T>);
}
export {};
