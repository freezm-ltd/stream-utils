import { ChunkMeasurer, ChunkSlicer } from "./types";
export declare function sliceStream<T>(start: number, end: number | undefined, measurer: ChunkMeasurer<T>, slicer: ChunkSlicer<T>): TransformStream<T, T>;
export declare function sliceByteStream(start: number, end?: number): TransformStream<Uint8Array, Uint8Array>;
