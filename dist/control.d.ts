import { PromiseLikeOrNot } from "./utils";
import { SwitchableDuplexEndpoint } from "./duplex";
export type Block<T> = {
    id: BlockId;
    chunk: T;
};
export type BlockId = number;
type ChunkGenerator<T> = () => PromiseLikeOrNot<ReadableStreamReadResult<T>>;
type ChunkConsumer<T> = (chunk: T) => PromiseLikeOrNot<void>;
export type ControlledReadableEndpoint<T> = SwitchableDuplexEndpoint<BlockId, Block<T>>;
export type ControlledWritableEndpoint<T> = SwitchableDuplexEndpoint<Block<T>, BlockId>;
export declare class ControlledReadableStream<T> {
    readonly endpoint: ControlledReadableEndpoint<T>;
    constructor(generator: ReadableStream<T> | ChunkGenerator<T>, strategy?: QueuingStrategy<T>);
}
export declare class ControlledWritableStream<T> {
    readonly endpoint: ControlledWritableEndpoint<T>;
    constructor(consumer: ChunkConsumer<T>, strategy?: QueuingStrategy<T>);
}
export declare class ControlledStreamPair<T> {
    readonly readable: ControlledReadableStream<T>;
    readonly writable: ControlledWritableStream<T>;
    constructor(generator: ChunkGenerator<T>, consumer: ChunkConsumer<T>, readableStrategy?: QueuingStrategy<T>, writableStrategy?: QueuingStrategy<T>);
}
export declare class _ControlledReadableStream<T> {
    readonly readable: ReadableStream<Block<T>>;
    constructor(generator: ReadableStream<T> | ChunkGenerator<T>, signaler: ReadableStream<BlockId>, strategy?: QueuingStrategy<T>);
}
export declare class _ControlledWritableStream<T> {
    readonly writable: WritableStream<Block<T>>;
    readonly signaler: ReadableStream<BlockId>;
    constructor(consumer: ChunkConsumer<T>, strategy?: QueuingStrategy<T>);
}
export declare class _ControlledStreamPair<T> {
    readonly readable: ReadableStream<Block<T>>;
    readonly writable: WritableStream<Block<T>>;
    constructor(generator: ChunkGenerator<T>, consumer: ChunkConsumer<T>, readableStrategy?: QueuingStrategy<T>, writableStrategy?: QueuingStrategy<T>);
}
export {};
