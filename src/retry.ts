import { lengthCallback, Flowmeter } from "./flow"
import { StreamGenerator, StreamGeneratorContext, SwitchableReadableStream } from "./repipe"
import { mergeSignal, sleep } from "./utils"
import { sliceByteStream } from "./slice"

export type RetryOption<T> = {
    minSpeed?: number
    minDuration?: number
    slowDown?: number
    signal?: AbortSignal
    sensor?: (chunk: T) => number
}

// switch <- trigger <- under minSpeed until minDuration
//    |                               |
// source -> SwitchableStream -> Flowmeter -> sink
export function retryableStream<T>(readableGenerator: StreamGenerator<ReadableStream<T>>, context: StreamGeneratorContext, option?: RetryOption<T>) {
    let _option = { slowDown: 0, minSpeed: 0, minDuration: 1_000 }
    Object.assign(_option, option)
    option = _option

    if (!option.sensor) option.sensor = (any: any) => any.length;

    // add flowmeter
    const flowmeter = new Flowmeter(option.sensor)
    const { readable, writable } = flowmeter // sense flow

    // add switchablestream
    const switchable = new SwitchableReadableStream(readableGenerator, context, option?.signal)
    switchable.stream.pipeTo(writable)

    // add trigger
    flowmeter.addTrigger(
        info => option.minSpeed ? info.flow <= option.minSpeed : false, 
        () => {
            if (!option?.signal?.aborted) {
                switchable.switch()
            }
        }, 
        option.minDuration, 
        option.slowDown
    )

    return readable
}

// retrying request
export function retryableFetchStream(input: RequestInfo | URL, init?: RequestInit, option?: RetryOption<Uint8Array>) {
    let _option = { slowDown: 5_000, minSpeed: 5_120, minDuration: 10_000 }
    Object.assign(_option, option)
    option = _option

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

    const readableGenerator = async (context: StreamGeneratorContext, signal?: AbortSignal) => {
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

        init.signal = signal ? (init.signal ? mergeSignal(init.signal, signal) : signal) : init.signal // set signal

        let response: Response | undefined = undefined
        while (!response) {
            if (init.signal?.aborted) throw new Error("retryableFetchStream: aborted")
            try {
                response = await fetch(input, init)
                if (!response.ok) throw new Error(`Response not ok: ${response.status} - ${response.statusText}`);
            } catch (e) {
                response = undefined
                console.log("retryableFetchStream: Fetch error:", e)
                await sleep(option.slowDown || _option.slowDown)
            }
        }
        let stream = response.body
        if (!stream) throw new Error("Error: Cannot find response body")
        if (response.status !== 206 && !response.headers.get("Content-Range") && start !== 0) {
            // slice stream
            stream = stream.pipeThrough(sliceByteStream(start, end !== 0 ? end : undefined))
        }
        stream = stream.pipeThrough(lengthCallback((delta) => { context.start += delta })) // count byte flow
        return stream
    }

    return retryableStream(readableGenerator, context, option)
}