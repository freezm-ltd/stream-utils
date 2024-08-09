import { ChunkMeasurer, ChunkSlicer, ChunkSplicer } from "./types";
import { sleep } from "./utils";

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

// total size fitted meta-stream
export function fitMetaStream<T>(size: number, measurer: ChunkMeasurer<T>, slicer: ChunkSlicer<T>) {
    const transform = new TransformStream<T, T>()
    const tReadable = transform.readable
    const tWriter = transform.writable.getWriter()
    let tWriterClosed: string | undefined = undefined
    const buffer: Array<T> = []
    let written = 0
    let writer: WritableStreamDefaultWriter<T> | undefined
    const readable = new ReadableStream<ReadableStream<T>>({
        async start(controller: ReadableStreamDefaultController<ReadableStream<T>>) {
            for await (const chunk of tReadable) {
                buffer.push(chunk)
                while (buffer.length > 0) {
                    if (!writer) {
                        const stream = new TransformStream<T, T>()
                        writer = stream.writable.getWriter()
                        controller.enqueue(stream.readable)
                    }
                    const chunk = buffer.pop()!
                    const total = measurer(chunk)
                    const need = size - written
                    if (total > need) {
                        await writer.write(slicer(chunk, 0, need))
                        await writer.close()
                        written = 0
                        writer = undefined
                        buffer.push(slicer(chunk, need, total))
                    } else {
                        await writer.write(chunk)
                        written += total
                    }
                }
            }
            if (writer) await writer.close();
            controller.close();
        },
        cancel(reason) {
            writer?.close()
            tWriterClosed = String(reason)
        },
    })
    const writable = new WritableStream<T>({
        write(chunk, controller) {
            if (tWriterClosed) return controller.error(tWriterClosed);
            tWriter.write(chunk)
        },
        close() {
            tWriter.close()
        },
        abort(reason) {
            tWriter.abort(reason)
        }
    })
    return { readable, writable }
}

export function fitMetaByteStream(size: number) {
    return fitMetaStream<Uint8Array>(size, chunk => chunk.length, (chunk, start, end) => chunk.slice(start, end))
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