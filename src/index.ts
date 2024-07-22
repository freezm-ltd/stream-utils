import { Flowmeter } from "./flow"
import { StreamGenerator, SwitchableStream } from "./repipe"
import { fitStream, getFitter, byteFitter } from "./fit"
import { sleep } from "./utils"
import { sliceByteStream } from "./slice"
import { mergeStream } from "./merge"

export type RetryOption = {
    minSpeed: number
    minDuration: number
}

// switch <- trigger <- under minSpeed until minDuration
//    |                               |
// source -> SwitchableStream -> Flowmeter -> sink
export function streamRetry<T>(readableGenerator: StreamGenerator<ReadableStream<T>>, sensor: (chunk: T) => number, option: RetryOption) {
    // add flowmeter
    const flowmeter = new Flowmeter(sensor)
    const { readable, writable } = flowmeter.tube // sense flow

    // add switchablestream
    const switchableStream = new SwitchableStream(readableGenerator, () => writable)

    // add trigger
    flowmeter.addTrigger(info => info.flow < option.minSpeed, switchableStream.switchReadable, option.minDuration)

    return readable
}

export function fetchRetry(input: RequestInfo | URL, init?: RequestInit, option: RetryOption & { slowDown: number } = { slowDown: 5000, minSpeed: 5120, minDuration: 10000 }) {
    let start = -1
    let end = -1
    let first = true

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

    const readableGenerator = async () => {
        if (!first) await sleep(option.slowDown); first = false; // retry slowdown
        if (start !== -1) { // retry with continuous range
            const Range = `bytes=${start}-${end !== -1 ? end : ""}` // inject request.headers.Range
            if (!init) init = {};
            if (!init.headers) init.headers = new Headers({ Range });
            else if (init.headers instanceof Headers) init.headers.set("Range", Range);
            else if (init.headers instanceof Array) {
                const found = init.headers.find(([key, _]) => key.toLocaleLowerCase() === "range")
                if (found) found[1] = Range;
                else init.headers.push(["Range", Range]);
            }
            else if (init.headers) init.headers["Range"] = Range;
        }
        const response = await fetch(input, init)
        let stream = response.body
        if (!stream) throw new Error("Error: Cannot find response body")
        if (!response.headers.get("Content-Range") && start !== -1) {
            // slice stream
            stream = stream.pipeThrough(sliceByteStream(start, end !== -1 ? end : undefined))
        }
        return stream
    }

    return streamRetry(readableGenerator, sensor, option)
}

export {
    Flowmeter,
    SwitchableStream,
    fitStream, getFitter, byteFitter,
    mergeStream,
}