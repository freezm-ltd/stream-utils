import { EventTarget2 } from "@freezm-ltd/event-target-2";
import { PromiseLikeOrNot } from "./utils";
import { ObjectifiedDuplexEndpoint, SwitchableDuplexEndpoint } from "./duplex";
export type Block<T> = {
    id: BlockId;
    chunk: T;
};
export type BlockId = number;
type ChunkGenerator<T> = () => PromiseLikeOrNot<ReadableStreamReadResult<T>>;
type ChunkConsumer<T> = (chunk: T) => PromiseLikeOrNot<void>;
export type ControlledReadableEndpoint<T> = SwitchableDuplexEndpoint<BlockId, Block<T>>;
export type ObjectifiedControlledReadableEndpoint<T> = ObjectifiedDuplexEndpoint<BlockId, Block<T>>;
export type ControlledWritableEndpoint<T> = SwitchableDuplexEndpoint<Block<T>, BlockId>;
export type ObjectifiedControlledWritableEndpoint<T> = ObjectifiedDuplexEndpoint<Block<T>, BlockId>;
export declare function setUpdateControlledEndpointTimeout(ms: number): void;
export declare class ControlledReadableStream<T> extends EventTarget2 {
    readonly endpoint: ControlledReadableEndpoint<T>;
    constructor(generator: ReadableStream<T> | ChunkGenerator<T>, endpoint?: ControlledReadableEndpoint<T>, strategy?: QueuingStrategy<T>, chunkCallback?: (chunk: T) => any);
}
export declare class ControlledWritableStream<T> extends EventTarget2 {
    readonly endpoint: ControlledWritableEndpoint<T>;
    constructor(consumer: WritableStream<T> | ChunkConsumer<T>, endpoint?: ControlledWritableEndpoint<T>, strategy?: QueuingStrategy<T>);
}
export declare class ControlledStreamPair<T> {
    readonly readable: ControlledReadableStream<T>;
    readonly writable: ControlledWritableStream<T>;
    constructor(generator: ReadableStream<T> | ChunkGenerator<T>, consumer: ChunkConsumer<T>, readableStrategy?: QueuingStrategy<T>, writableStrategy?: QueuingStrategy<T>);
}
export {};
