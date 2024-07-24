export declare class ControlledWritableStream<T> extends WritableStream<T> {
    constructor(underlyingSink: UnderlyingSink<T>, strategy?: QueuingStrategy<T>);
}
