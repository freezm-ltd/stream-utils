// Bring back Readable/WritableStream and re-pipe each other, when they are broken or other event emitted

export type StreamGenerator<T = ReadableStream | WritableStream> = () => T | PromiseLike<T>

export class SwitchableStream {
    protected readonly readable: ReadableStream
    protected readableAbortContorller = new AbortController()
    protected readonly writable: WritableStream
    protected writableAbortController = new AbortController()
    protected abortReason = crypto.randomUUID() // for identify abort

    constructor(
        readonly readableGenerator: StreamGenerator<ReadableStream>, 
        readonly writableGenerator: StreamGenerator<WritableStream>,
        readableStrategy?: QueuingStrategy,
        writableStrategy?: QueuingStrategy, 
    ) {
        const { readable, writable } = new TransformStream(undefined, writableStrategy, readableStrategy)
        this.readable = readable
        this.writable = writable
        this.switchWritable().then(() => this.switchReadable())
    }

    // switch repipe
    //    |    |
    // source -> this.writable -> this.readable -> sink
    async switchReadable(to?: ReadableStream) {
        this.readableAbortContorller.abort(this.abortReason) // abort first
        this.readableAbortContorller = new AbortController()
        while(!to) {
            try {
                to = await this.readableGenerator(); // get source
            } catch (e) {
                // slient catch, restart
            }
        }
        to.pipeTo(this.writable, { preventAbort: true, preventCancel: true, preventClose: true, signal: this.readableAbortContorller.signal })
        .then(() => this.writable.close())
        .catch(e => {
            if (e !== this.abortReason) this.switchReadable() // automatic repipe except intended abort
        })
    }

    //                                      repipe switch
    //                                          |   |
    // source -> this.writable -> this.readable -> sink
    async switchWritable(to?: WritableStream) {
        this.writableAbortController.abort() // abort first
        this.writableAbortController = new AbortController()
        while(!to) {
            try {
                to = await this.writableGenerator(); // get sink
            } catch (e) {
                // slient catch, restart
            }
        }
        this.readable.pipeTo(to, { preventAbort: true, preventCancel: true, preventClose: true, signal: this.writableAbortController.signal })
        .then(() => to.close())
        .catch(e => {
            if (e !== this.abortReason) this.switchWritable() // automatic repipe except intended abort
        })
    }

    abort() { // just abort and do not repipe
        this.readableAbortContorller.abort(this.abortReason)
        this.writableAbortController.abort(this.abortReason)
    }
}