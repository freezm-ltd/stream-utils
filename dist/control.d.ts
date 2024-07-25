import { PromiseLikeOrNot } from "./utils";
import { DuplexEndpoint } from "./duplex";
type Block<T> = {
    id: BlockId;
    chunk: T;
};
type BlockId = number;
type ChunkGenerator<T> = () => PromiseLikeOrNot<ReadableStreamReadResult<T>>;
type ChunkConsumer<T> = (chunk: T) => PromiseLikeOrNot<void>;
export declare class ControlledReadableStream2<T> {
    constructor(generator: ReadableStream<T> | ChunkGenerator<T>, endpoint: DuplexEndpoint<Block<T>, BlockId>, strategy?: QueuingStrategy<T>);
}
export declare class ControlledWritableStream2<T> {
    constructor(consumer: ChunkConsumer<T>, endpoint: DuplexEndpoint<BlockId, Block<T>>, strategy?: QueuingStrategy<T>);
}
export declare class ControlledReadableStream<T> {
    readonly readable: ReadableStream<Block<T>>;
    constructor(generator: ReadableStream<T> | ChunkGenerator<T>, signaler: ReadableStream<BlockId>, strategy?: QueuingStrategy<T>);
}
export declare class ControlledWritableStream<T> {
    readonly writable: WritableStream<Block<T>>;
    readonly signaler: ReadableStream<BlockId>;
    constructor(consumer: ChunkConsumer<T>, strategy?: QueuingStrategy<T>);
}
export declare class ControlledStreamPair<T> {
    readonly readable: ReadableStream<Block<T>>;
    readonly writable: WritableStream<Block<T>>;
    constructor(generator: ChunkGenerator<T>, consumer: ChunkConsumer<T>, readableStrategy?: QueuingStrategy<T>, writableStrategy?: QueuingStrategy<T>);
}
export {};
