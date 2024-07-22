import { ChunkMeasurer, ChunkSlicer, ChunkSplicer } from "./types";
export declare function fitStream<T>(size: number, fitter: (size: number, chunks: Array<T>) => Array<T>): TransformStream<T, T>;
export declare function getFitter<T>(measurer: ChunkMeasurer<T>, splicer: ChunkSplicer<T>, slicer: ChunkSlicer<T>): (size: number, chunks: Array<T>) => void;
export declare function byteFitter(): (size: number, chunks: Uint8Array[]) => void;
