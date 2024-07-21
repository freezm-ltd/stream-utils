import { Flowmeter } from "./flow"
import { StreamGenerator, SwitchableStream } from "./repipe"
import { sleep } from "./utils"

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

    const sensor = (chunk: Uint8Array) => {
        const length = chunk.length
        start += length // sense chunk with update start position
        return length
    }

    const readableGenerator = async () => {
        if (start !== -1) await sleep(option.slowDown); // retry slowdown
        if (!init) init = { headers: { Range: `bytes=${start}-${end !== -1 ? end : ""}` } } // retry with continuous range
        const response = await fetch(input, init)
        if (!response.body) throw new Error("Error: Cannot find response body")
        const [match, _start, _end] = /bytes (\d+)-(\d+)/.exec(response.headers.get("Content-Range") || "") || []
        if (!match) throw new Error("Error: Range request not supported");
        [start, end] = [Number(start), Number(end ? end : -1)]; // update range
        return response.body
    }

    return streamRetry(readableGenerator, sensor, option)
}
