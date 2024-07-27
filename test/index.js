// node_modules/.pnpm/@freezm-ltd+event-target-2@https+++codeload.github.com+freezm-ltd+EventTarget2+tar.gz+11ff208_3njyjyppej5icdv7ro2urw6f3a/node_modules/@freezm-ltd/event-target-2/dist/index.js
var EventTarget2 = class extends EventTarget {
  constructor() {
    super(...arguments);
    this.listeners = /* @__PURE__ */ new Map();
    this._bubbleMap = /* @__PURE__ */ new Map();
    this.atomicQueue = /* @__PURE__ */ new Map();
  }
  async waitFor(type, compareValue) {
    return new Promise((resolve) => {
      if (compareValue !== void 0) {
        this.listenOnceOnly(type, (e) => resolve(e.detail), (e) => e.detail === compareValue);
      } else {
        this.listenOnce(type, (e) => resolve(e.detail));
      }
    });
  }
  callback(type, callback) {
    this.waitFor(type).then(callback);
  }
  dispatch(type, detail) {
    this.dispatchEvent(new CustomEvent(type, detail !== void 0 ? { detail } : void 0));
  }
  listen(type, callback, options) {
    if (!this.listeners.has(type)) this.listeners.set(type, /* @__PURE__ */ new Set());
    this.listeners.get(type).add(callback);
    this.addEventListener(type, callback, options);
  }
  remove(type, callback, options) {
    if (!this.listeners.has(type)) this.listeners.set(type, /* @__PURE__ */ new Set());
    this.listeners.get(type).delete(callback);
    this.removeEventListener(type, callback, options);
  }
  destroy() {
    for (let type of this.listeners.keys()) {
      for (let callback of this.listeners.get(type)) {
        this.remove(type, callback);
      }
    }
  }
  listenOnce(type, callback) {
    this.listen(type, callback, { once: true });
  }
  listenOnceOnly(type, callback, only) {
    const wrapper = (e) => {
      if (only(e)) {
        this.remove(type, wrapper);
        callback(e);
      }
    };
    this.listen(type, wrapper);
  }
  listenDebounce(type, callback, options = { timeout: 100, mode: "last" }) {
    switch (options.mode) {
      case "first":
        return this.listenDebounceFirst(type, callback, options);
      case "last":
        return this.listenDebounceLast(type, callback, options);
    }
  }
  listenDebounceFirst(type, callback, options = { timeout: 100 }) {
    let lastMs = 0;
    this.listen(
      type,
      (e) => {
        const currentMs = Date.now();
        if (currentMs - lastMs > options.timeout) {
          callback(e);
        }
        lastMs = currentMs;
      },
      options
    );
  }
  listenDebounceLast(type, callback, options = { timeout: 100 }) {
    let timoutInstance;
    this.listen(
      type,
      (e) => {
        clearTimeout(timoutInstance);
        timoutInstance = window.setTimeout(() => callback(e), options.timeout);
      },
      options
    );
  }
  enableBubble(type) {
    if (this._bubbleMap.has(type)) return;
    const dispatcher = (e) => {
      this.parent?.dispatch(e.type, e.detail);
    };
    this.listen(type, dispatcher);
    this._bubbleMap.set(type, dispatcher);
  }
  disableBubble(type) {
    if (!this._bubbleMap.has(type)) return;
    const dispatcher = this._bubbleMap.get(type);
    this.remove(type, dispatcher);
    this._bubbleMap.delete(type);
  }
  _atomicInit(type) {
    this.atomicQueue.set(type, []);
    const atomicLoop = async () => {
      const queue = this.atomicQueue.get(type);
      while (true) {
        const task = queue.shift();
        if (task) {
          await task();
        } else {
          await this.waitFor("__atomic-add", type);
        }
      }
    };
    atomicLoop();
  }
  atomic(type, func) {
    return new Promise((resolve) => {
      const wrap = async () => resolve(await func());
      if (!this.atomicQueue.has(type)) this._atomicInit(type);
      this.atomicQueue.get(type).push(wrap);
      this.dispatch("__atomic-add", type);
    });
  }
};

// src/flow.ts
var Flowmeter = class extends EventTarget2 {
  constructor(sensor, interval = 1e3) {
    super();
    this.sensor = sensor;
    this.interval = interval;
    this.buffer = [];
    this.listenerWeakMap = /* @__PURE__ */ new WeakMap();
    this.closed = false;
    this.lastWatchInfo = { time: Date.now(), value: 0, delta: 0, interval: 0, flow: 0 };
    setInterval(() => this.watch(), interval);
    const _this = this;
    const { readable, writable } = new TransformStream({
      transform(chunk, controller) {
        controller.enqueue(chunk);
        _this.process(chunk);
      },
      flush() {
        _this.closed = true;
        _this.destroy();
      }
    });
    this.readable = readable;
    this.writable = writable;
  }
  // custom trigger depends on flow info
  // callback if trigger===true duration overs triggerDuration
  // if trigger fired, other triggers skipped while slowDown
  addTrigger(trigger, callback, triggerDuration = 1e4, slowDown = 5e3) {
    if (this.listenerWeakMap.has(trigger)) throw new Error("FlowmeterAddTriggerError: Duplication of trigger is not allowed");
    let timeout = null;
    let skip = false;
    const setTimeout2 = globalThis.setTimeout;
    const listener = async (e) => {
      const info = e.detail;
      if (await trigger(info)) {
        if (!timeout && !skip) {
          const handler = () => {
            if (!this.closed) callback();
            timeout = null;
            skip = true;
            setTimeout2(() => {
              skip = false;
            }, slowDown);
          };
          timeout = setTimeout2(handler, triggerDuration);
        }
      } else {
        if (timeout) clearTimeout(timeout);
        timeout = null;
      }
    };
    this.listen("flow", listener);
    this.listenerWeakMap.set(trigger, listener);
  }
  delTrigger(trigger) {
    if (!this.listenerWeakMap.has(trigger)) throw new Error("FlowmeterDelTriggerError: This trigger is not attached");
    this.remove("flow", this.listenerWeakMap.get(trigger));
    this.listenerWeakMap.delete(trigger);
  }
  watch() {
    const buffer = this.buffer;
    this.buffer = [];
    const time = Date.now();
    const value = buffer.reduce((a, b) => a + b.value, 0);
    const delta = value - this.lastWatchInfo.value;
    const interval = time - this.lastWatchInfo.time;
    const flow = delta / interval;
    const info = { time, value, delta, interval, flow };
    this.lastWatchInfo = info;
    this.dispatch("flow", info);
  }
  process(chunk) {
    const time = Date.now();
    const value = this.sensor(chunk);
    this.buffer.push({ time, value });
  }
};
function chunkCallback(callback) {
  return new TransformStream({
    transform(chunk, controller) {
      callback(chunk);
      controller.enqueue(chunk);
    }
  });
}
function lengthCallback(callback, key = "length") {
  return new TransformStream({
    transform(chunk, controller) {
      callback(chunk[key]);
      controller.enqueue(chunk);
    }
  });
}

// src/utils.ts
async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function mergeSignal(signal1, signal2) {
  const controller = new AbortController();
  signal1.onabort = (e) => controller.abort(e.target.reason);
  signal2.onabort = (e) => controller.abort(e.target.reason);
  return controller.signal;
}

// src/repipe.ts
var AbstractSwitchableStream = class extends EventTarget2 {
  // to identify intended abort
  constructor(generator, context, strategy) {
    super();
    this.generator = generator;
    this.context = context;
    this.strategy = strategy;
    this.controller = new AbortController();
    this.abortReason = "SwitchableStreamAbortForSwitching";
    this.isSwitching = false;
  }
  switch(to) {
    let generator;
    if (!to) {
      if (this.isSwitching) return;
      if (this.generator) generator = this.generator;
      else return;
    }
    return this.atomic("switch", async () => {
      this.isSwitching = true;
      this.controller.abort(this.abortReason);
      this.controller = new AbortController();
      if (!to) to = await generator(this.context, this.controller.signal);
      const { readable, writable } = this.target(to);
      for (let i = 0; readable.locked || writable.locked; i += 10) await sleep(i);
      readable.pipeTo(writable, { preventAbort: true, preventCancel: true, preventClose: true, signal: this.controller.signal }).then(() => {
        writable.close().catch();
      }).catch((e) => {
        if (e !== this.abortReason) this.switch();
      });
      this.isSwitching = false;
      this.dispatch("switch-done");
    });
  }
  abort() {
    this.controller.abort(this.abortReason);
  }
};
var SwitchableReadableStream = class extends AbstractSwitchableStream {
  constructor(generator, context, strategy) {
    super();
    this.generator = generator;
    this.context = context;
    this.strategy = strategy;
    const _this = this;
    const pipe = new TransformStream({
      async transform(chunk, controller) {
        if (_this.isSwitching) await _this.waitFor("switch-done");
        controller.enqueue(chunk);
      }
    }, void 0, strategy);
    this.stream = pipe.readable;
    this.writable = pipe.writable;
    if (generator) this.switch();
  }
  target(to) {
    return {
      readable: to,
      writable: this.writable
    };
  }
};
var SwitchableWritableStream = class extends AbstractSwitchableStream {
  constructor(generator, context, strategy) {
    super();
    this.generator = generator;
    this.context = context;
    this.strategy = strategy;
    const _this = this;
    const pipe = new TransformStream({
      async transform(chunk, controller) {
        if (_this.isSwitching) await _this.waitFor("switch-done");
        controller.enqueue(chunk);
      }
    }, strategy);
    this.stream = pipe.writable;
    this.readable = pipe.readable;
    if (generator) this.switch();
  }
  target(to) {
    return {
      readable: this.readable,
      writable: to
    };
  }
};

// src/fit.ts
function fitStream(size, fitter) {
  const buffer = [];
  return new TransformStream({
    transform(chunk, controller) {
      buffer.push(chunk);
      const fitteds = fitter(size, buffer);
      for (let fitted of fitteds) controller.enqueue(fitted);
    },
    flush(controller) {
      for (let remain of buffer) controller.enqueue(remain);
    }
  });
}
function getFitter(measurer, splicer, slicer) {
  return (size, chunks) => {
    const result = [];
    let buffer;
    for (let chunk of chunks.splice(0, chunks.length)) {
      const temp = buffer ? splicer([buffer, chunk]) : chunk;
      const total = measurer(temp);
      const fitable = Math.floor(total / size);
      for (let i = 0; i < fitable; i++) {
        result.push(slicer(temp, i * size, (i + 1) * size));
      }
      buffer = slicer(temp, fitable * size, total);
    }
    if (buffer) chunks.push(buffer);
  };
}
function byteFitter() {
  return getFitter(
    (chunk) => chunk.length,
    (chunks) => {
      const result = new Uint8Array(chunks.reduce((a, b) => a + b.length, 0));
      let index = 0;
      for (let chunk of chunks) {
        result.set(chunk, index);
        index += chunk.length;
      }
      return result;
    },
    (chunk, start, end) => chunk.slice(start, end)
  );
}

// src/slice.ts
function sliceStream(start, end = Number.POSITIVE_INFINITY, measurer, slicer) {
  let index = 0;
  return new TransformStream({
    transform(chunk, controller) {
      const size = measurer(chunk);
      const nextIndex = index + size;
      if (start <= index && nextIndex <= end) {
        controller.enqueue(chunk);
      } else if (index <= start && end <= nextIndex) {
        controller.enqueue(slicer(chunk, start - index, end - index));
      } else if (index <= start && start < nextIndex) {
        controller.enqueue(slicer(chunk, start - index, size));
      } else if (index < end && end <= nextIndex) {
        controller.enqueue(slicer(chunk, 0, end - index));
      } else {
      }
      index = nextIndex;
    }
  });
}
function sliceByteStream(start, end) {
  return sliceStream(
    start,
    end,
    (chunk) => chunk.length,
    (chunk, start2, end2) => chunk.slice(start2, end2)
  );
}

// src/merge.ts
function mergeStream(generators, context, option) {
  const { readable, writable } = new TransformStream(void 0, option?.writableStrategy, option?.readableStrategy);
  const emitter = new EventTarget2();
  const buffer = {};
  const signal = option?.signal;
  const parallel = option?.parallel || 1;
  const load = async (index) => {
    if (index >= generators.length) return;
    buffer[index] = await generators[index](context, signal);
    emitter.dispatch("load", index);
  };
  emitter.listen("next", (e) => load(e.detail));
  const task = async () => {
    let index = 0;
    while (index < generators.length) {
      if (!buffer[index]) await emitter.waitFor("load", index);
      try {
        await buffer[index].pipeTo(writable, { preventClose: true });
      } catch (e) {
        Object.values(buffer).forEach((stream) => stream.cancel(e).catch(
          /* silent catch */
        ));
        throw e;
      }
      emitter.dispatch("next", index + parallel);
      index++;
    }
    await writable.close();
    emitter.destroy();
  };
  task();
  for (let i = 0; i < parallel; i++) load(i);
  return readable;
}

// src/retry.ts
function retryableStream(readableGenerator, context, option, sensor) {
  let _option = { slowDown: 5e3, minSpeed: 5120, minDuration: 1e4 };
  Object.assign(_option, option);
  option = _option;
  if (!sensor) sensor = (any) => any.length;
  const flowmeter = new Flowmeter(sensor);
  const { readable, writable } = flowmeter;
  const switchable = new SwitchableReadableStream(readableGenerator, context);
  switchable.stream.pipeTo(writable);
  flowmeter.addTrigger((info) => option.minSpeed ? info.flow <= option.minSpeed : false, () => switchable.switch(), option.minDuration, option.slowDown);
  return readable;
}
function retryableFetchStream(input, init, option) {
  const context = { start: 0, end: 0 };
  if (init && init.headers) {
    const headers = init.headers;
    let range = "";
    if (headers instanceof Headers) range = headers.get("Range") || "";
    else if (headers instanceof Array) range = (headers.find(([key, _]) => key.toLocaleLowerCase() === "range") || [, ""])[1];
    else range = headers["Range"] || headers["range"] || "";
    if (range) {
      const [_, start, end] = /bytes=(\d+)-(\d+)?/.exec(range) || [];
      if (start) context.start = Number(start);
      if (end) context.end = Number(end);
    }
  }
  const readableGenerator = async (context2, signal) => {
    const { start, end } = context2;
    if (!init) init = {};
    if (start !== 0) {
      const Range = `bytes=${start}-${end !== 0 ? end : ""}`;
      if (!init.headers) init.headers = new Headers({ Range });
      else if (init.headers instanceof Headers) init.headers.set("Range", Range);
      else if (init.headers instanceof Array) {
        const found = init.headers.find(([key, _]) => key.toLocaleLowerCase() === "range");
        if (found) found[1] = Range;
        else init.headers.push(["Range", Range]);
      } else if (init.headers) init.headers["Range"] = Range;
    }
    init.signal = signal ? init.signal ? mergeSignal(init.signal, signal) : signal : init.signal;
    const response = await fetch(input, init);
    let stream = response.body;
    if (!stream) throw new Error("Error: Cannot find response body");
    if (response.status !== 206 && !response.headers.get("Content-Range") && start !== 0) {
      stream = stream.pipeThrough(sliceByteStream(start, end !== 0 ? end : void 0));
    }
    stream = stream.pipeThrough(lengthCallback((delta) => {
      context2.start += delta;
    }));
    return stream;
  };
  return retryableStream(readableGenerator, context, option);
}

// src/duplex.ts
var Duplex = class {
  constructor() {
    const streamA = new TransformStream();
    const streamB = new TransformStream();
    this.endpoint1 = new DuplexEndpoint(streamA.readable, streamB.writable);
    this.endpoint2 = new DuplexEndpoint(streamB.readable, streamA.writable);
  }
};
var DuplexEndpoint = class _DuplexEndpoint {
  constructor(readable, writable) {
    this.readable = readable;
    this.writable = writable;
  }
  // transfer duplex by postMessage
  static transferify(endpoint) {
    const { readable, writable } = endpoint;
    return {
      endpoint: { readable, writable },
      transfer: [readable, writable]
    };
  }
  // restore duplex from postMessage
  static instancify(objectifiedEndpoint) {
    return new _DuplexEndpoint(objectifiedEndpoint.readable, objectifiedEndpoint.writable);
  }
};
var SwitchableDuplexEndpoint = class extends DuplexEndpoint {
  constructor(generator, context = {}) {
    const switchEmitter = new EventTarget2();
    if (generator) {
      let readableRequired = false, writableRequired = false;
      switchEmitter.listen("require", async (e) => {
        if (e.detail === "readable") readableRequired = true;
        if (e.detail === "writable") writableRequired = true;
        if (readableRequired && writableRequired) {
          readableRequired = false;
          writableRequired = false;
          switchEmitter.dispatch("generate", await generator(context));
        }
      });
    }
    const switchableReadable = new SwitchableReadableStream(generator ? async () => {
      return (await switchEmitter.waitFor("generate")).readable;
    } : void 0);
    const switchableWritable = new SwitchableWritableStream(generator ? async () => {
      return (await switchEmitter.waitFor("generate")).writable;
    } : void 0);
    super(switchableReadable.stream, switchableWritable.stream);
    this.generator = generator;
    this.context = context;
    this.switchableReadable = new SwitchableReadableStream();
    this.switchableWritable = new SwitchableWritableStream();
    this.switchableReadable = switchableReadable;
    this.switchableWritable = switchableWritable;
  }
  async switch(endpoint) {
    if (this.generator) endpoint = await this.generator(this.context);
    if (!endpoint) return;
    await Promise.all([
      this.switchableReadable.switch(endpoint.readable),
      this.switchableWritable.switch(endpoint.writable)
    ]);
  }
};

// src/control.ts
var ControlledReadableStream = class extends EventTarget2 {
  constructor(generator, endpoint, strategy) {
    super();
    if (generator instanceof ReadableStream) generator = generatorify(generator);
    this.endpoint = endpoint ? endpoint : new SwitchableDuplexEndpoint();
    const signal = this.endpoint.readable.getReader();
    let enqueued = 0;
    let consumed = -1;
    const stream = new ReadableStream({
      async pull(controller) {
        const { value, done } = await generator();
        if (done) {
          controller.close();
        } else {
          const block = { id: enqueued, chunk: value };
          while (consumed < enqueued) {
            controller.enqueue(block);
            const result = await signal.read();
            if (result.done) return;
            consumed = result.value;
          }
          enqueued++;
        }
      }
    }, wrapQueuingStrategy(strategy));
    stream.pipeTo(this.endpoint.writable).then(() => this.dispatch("close"));
    if (endpoint) this.endpoint.switch();
  }
};
var ControlledWritableStream = class extends EventTarget2 {
  constructor(consumer, endpoint, strategy) {
    super();
    this.endpoint = endpoint ? endpoint : new SwitchableDuplexEndpoint();
    const signal = this.endpoint.writable.getWriter();
    let consumed = -1;
    let interval;
    const stream = new WritableStream({
      async write(block) {
        if (interval) clearInterval(interval);
        if (block.id > consumed) {
          await consumer(block.chunk);
          consumed = block.id;
        }
        signal.write(block.id);
        interval = globalThis.setInterval(() => {
          signal.write(block.id).catch(async () => {
            if (await signal.closed) clearInterval(interval);
          });
        }, 1e3);
      },
      async close() {
        if (interval) clearInterval(interval);
        signal.close();
      },
      async abort(reason) {
        if (interval) clearInterval(interval);
        signal.abort(reason);
      }
    }, wrapQueuingStrategy(strategy));
    this.endpoint.readable.pipeTo(stream).then(() => this.dispatch("close"));
    if (endpoint) this.endpoint.switch();
  }
};
var ControlledStreamPair = class {
  constructor(generator, consumer, readableStrategy, writableStrategy) {
    this.readable = new ControlledReadableStream(generator, void 0, readableStrategy);
    this.writable = new ControlledWritableStream(consumer, void 0, writableStrategy);
  }
};
function wrapQueuingStrategy(strategy) {
  if (strategy) {
    const size = strategy.size;
    return {
      highWaterMark: strategy.highWaterMark,
      size: size ? (block) => size(block.chunk) : void 0
    };
  }
  return void 0;
}
function generatorify(readable) {
  const generator = async function* _() {
    for await (const chunk of readable) {
      yield chunk;
    }
    return null;
  }();
  return async () => {
    return await generator.next();
  };
}
export {
  ControlledReadableStream,
  ControlledStreamPair,
  ControlledWritableStream,
  Duplex,
  DuplexEndpoint,
  Flowmeter,
  SwitchableDuplexEndpoint,
  SwitchableReadableStream,
  SwitchableWritableStream,
  byteFitter,
  chunkCallback,
  fitStream,
  getFitter,
  lengthCallback,
  mergeStream,
  retryableFetchStream,
  retryableStream,
  sliceByteStream,
  sliceStream
};
