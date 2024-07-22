import { ChunkMeasurer, ChunkSlicer } from "./types";

export function sliceStream<T>(start: number, end: number = Number.POSITIVE_INFINITY, measurer: ChunkMeasurer<T>, slicer: ChunkSlicer<T>) { // <, >
    let index = 0 // [
    return new TransformStream<T, T>({
        transform(chunk, controller) {
            const size = measurer(chunk)
            const nextIndex = index + size // ]
            if (start <= index && nextIndex <= end) { // --<--[==]-->--  ;  [==]
                controller.enqueue(chunk)
            }
            else if (index <= start && end <= nextIndex) { // --[==<==>==]--  ;  <==>
                controller.enqueue(slicer(chunk, start - index, end - index))
            }
            else if (index <= start && start < nextIndex) { // --[==<==]-->--  ;  <==]
                controller.enqueue(slicer(chunk, start - index, size))
            }
            else if (index < end && end <= nextIndex) { // --<--[==>==]--  ;  [==>
                controller.enqueue(slicer(chunk, 0, end - index))
            } else { //  --[==]--<-->-- or --<-->--[==]--
                // skip
            }
            index = nextIndex
        }
    })
}

export function sliceByteStream(start: number, end?: number) {
    return sliceStream<Uint8Array>(start, end, 
        (chunk) => chunk.length,
        (chunk, start, end) => chunk.slice(start, end)
    )
}