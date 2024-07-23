import { Flowmeter } from "./flow"
import { StreamGenerator, SwitchableStream } from "./repipe"
import { fitStream, getFitter, byteFitter } from "./fit"
import { mergeSignal, sleep } from "./utils"
import { sliceStream, sliceByteStream } from "./slice"
import { mergeStream } from "./merge"

export type RetryOption = {
    minSpeed?: number
    minDuration?: number
    slowDown?: number
}

// switch <- trigger <- under minSpeed until minDuration
//    |                               |
// source -> SwitchableStream -> Flowmeter -> sink
export function streamRetry<T>(readableGenerator: StreamGenerator<ReadableStream<T>>, sensor: (chunk: T) => number, option?: RetryOption) {
    let _option = { slowDown: 5000, minSpeed: 5120, minDuration: 10000 }
    Object.assign(_option, option)
    option = _option

    // add flowmeter
    const flowmeter = new Flowmeter(sensor)
    const { readable, writable } = flowmeter // sense flow

    // add switchablestream
    const switchableStream = new SwitchableStream(readableGenerator, () => writable)

    // add trigger
    flowmeter.addTrigger(info => option.minSpeed ? info.flow <= option.minSpeed : false, () => switchableStream.switchReadable(), option.minDuration, option.slowDown)

    return readable
}

// retrying request
export function fetchRetry(input: RequestInfo | URL, init?: RequestInit, option?: RetryOption) {
    let start = 0
    let end = 0

    if (init && init.headers) {
        const headers = init.headers
        let range = ""
        // parse request.headers.Range
        if (headers instanceof Headers) range = headers.get("Range") || "";
        else if (headers instanceof Array) range = (headers.find(([key, _]) => key.toLocaleLowerCase() === "range") || [, ""])[1];
        else range = headers["Range"] || headers["range"] || "";
        if (range) {
            const [_, _start, _end] = /bytes=(\d+)-(\d+)?/.exec(range) || []
            if (_start) start = Number(_start);
            if (_end) end = Number(_end);
        }
    }

    const sensor = (chunk: Uint8Array) => {
        const length = chunk.length
        start += length // sense chunk with update start position
        return length
    }

    const readableGenerator = async (signal?: AbortSignal) => {
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

        const response = await fetch(input, init)
        let stream = response.body
        if (!stream) throw new Error("Error: Cannot find response body")
        if (response.status !== 206 && !response.headers.get("Content-Range") && start !== 0) {
            // slice stream
            stream = stream.pipeThrough(sliceByteStream(start, end !== 0 ? end : undefined))
        }
        return stream
    }

    return streamRetry(readableGenerator, sensor, option)
}

export {
    Flowmeter,
    SwitchableStream,
    fitStream, getFitter, byteFitter,
    sliceStream, sliceByteStream,
    mergeStream,
}