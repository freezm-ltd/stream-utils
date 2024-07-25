import { lengthCallback, Flowmeter } from "./flow"
import { StreamGenerator, StreamGeneratorContext, SwitchableReadableStream } from "./repipe"
import { mergeSignal } from "./utils"
import { sliceByteStream } from "./slice"

export type RetryOption = {
    minSpeed?: number
    minDuration?: number
    slowDown?: number
}

// switch <- trigger <- under minSpeed until minDuration
//    |                               |
// source -> SwitchableStream -> Flowmeter -> sink
export function retryableStream<T>(context: StreamGeneratorContext, readableGenerator: StreamGenerator<ReadableStream<T>>, option?: RetryOption, sensor?: (chunk: T) => number) {
    let _option = { slowDown: 5000, minSpeed: 5120, minDuration: 10000 }
    Object.assign(_option, option)
    option = _option

    if (!sensor) sensor = (any: any) => any.length;

    // add flowmeter
    const flowmeter = new Flowmeter(sensor)
    const { readable, writable } = flowmeter // sense flow

    // add switchablestream
    const switchable = new SwitchableReadableStream(readableGenerator, context)
    switchable.stream.pipeTo(writable)

    // add trigger
    flowmeter.addTrigger(info => option.minSpeed ? info.flow <= option.minSpeed : false, () => switchable.switch(), option.minDuration, option.slowDown)

    return readable
}

// retrying request
export function retryableFetchStream(input: RequestInfo | URL, init?: RequestInit, option?: RetryOption) {
    const context = { start: 0, end: 0 }

    if (init && init.headers) {
        const headers = init.headers
        let range = ""
        // parse request.headers.Range
        if (headers instanceof Headers) range = headers.get("Range") || "";
        else if (headers instanceof Array) range = (headers.find(([key, _]) => key.toLocaleLowerCase() === "range") || [, ""])[1];
        else range = headers["Range"] || headers["range"] || "";
        if (range) {
            const [_, start, end] = /bytes=(\d+)-(\d+)?/.exec(range) || []
            if (start) context.start = Number(start);
            if (end) context.end = Number(end);
        }
    }

    const readableGenerator = async (context: StreamGeneratorContext) => {
        const { start, end } = context
        if (!init) init = {};
        if (start !== 0) { // retry with continuous range
            const Range = `bytes=${start}-${end !== 0 ? end : ""}` // inject request.headers.Range
            if (!init.headers) init.headers = new Headers({ Range });
            else if (init.headers instanceof Headers) init.headers.set("Range", Range);
            else if (init.headers instanceof Array) {
                const found = init.headers.find(([key, _]) => key.toLocaleLowerCase() === "range")
                if (found) found[1] = Range;
                else init.headers.push(["Range", Range]);
            }
            else if (init.headers) init.headers["Range"] = Range;
        }

        const signal = context?.signal
        init.signal = signal ? (init.signal ? mergeSignal(init.signal, signal) : signal) : init.signal // set signal

        const response = await fetch(input, init)
        let stream = response.body
        if (!stream) throw new Error("Error: Cannot find response body")
        if (response.status !== 206 && !response.headers.get("Content-Range") && start !== 0) {
            // slice stream
            stream = stream.pipeThrough(sliceByteStream(start, end !== 0 ? end : undefined))
        }
        stream = stream.pipeThrough(lengthCallback((delta) => { context.start += delta })) // count byte flow
        return stream
    }

    return retryableStream(context, readableGenerator, option)
}