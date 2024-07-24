export class ControlledWritableStream<T> extends WritableStream<T> {
    constructor(underlyingSink: UnderlyingSink<T>, strategy?: QueuingStrategy<T>) {
        underlyingSink.write = async () => {
            
        }
        super(underlyingSink, strategy)
    }
}