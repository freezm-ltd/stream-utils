export declare function sleep(ms: number): Promise<void>;
export declare function mergeSignal(signal1: AbortSignal, signal2: AbortSignal): AbortSignal;
export declare function blackhole(): WritableStream<any>;
export declare function noop(..._: any[]): void;
export type PromiseLikeOrNot<T> = PromiseLike<T> | T;
