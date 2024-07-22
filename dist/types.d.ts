export type ChunkMeasurer<T> = (chunk: T) => number;
export type ChunkSlicer<T> = (chunk: T, start: number, end: number) => T;
export type ChunkSplicer<T> = (chunks: Array<T>) => T;
