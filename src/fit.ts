import { ChunkMeasurer, ChunkSlicer, ChunkSplicer } from "./types";

// chunks size are fitted
export function fitStream<T>(size: number, fitter: (size: number, chunks: Array<T>) => Array<T>) {
    const buffer: Array<T> = []
    return new TransformStream<T, T>({
        transform(chunk, controller) {
            buffer.push(chunk)
            const fitteds = fitter(size, buffer)
            for (let fitted of fitteds) controller.enqueue(fitted);
        },
        flush(controller) {
            for (let remain of buffer) controller.enqueue(remain);
        }
    })
}

export function getFitter<T>(measurer: ChunkMeasurer<T>, splicer: ChunkSplicer<T>, slicer: ChunkSlicer<T>) {
    return (size: number, chunks: Array<T>) => {
        const result: Array<T> = []
        let buffer: T | undefined;
        for (let chunk of chunks.splice(0, chunks.length)) { // popping all chunks
            const temp = buffer ? splicer([buffer, chunk]) : chunk // merge
            const total = measurer(temp)
            const fitable = Math.floor(total / size)
            for (let i = 0; i < fitable; i++) { // divide
                result.push(slicer(temp, i * size, (i + 1) * size))
            }
            buffer = slicer(temp, fitable * size, total) // buffer remain
        }
        if (buffer) chunks.push(buffer);
    }
}

export function byteFitter() {
    return getFitter<Uint8Array>(
        chunk => chunk.length,
        chunks => {
            const result = new Uint8Array(chunks.reduce((a, b) => a + b.length, 0))
            let index = 0
            for (let chunk of chunks) {
                result.set(chunk, index)
                index += chunk.length
            }
            return result
        },
        (chunk, start, end) => chunk.slice(start, end)
    )
}