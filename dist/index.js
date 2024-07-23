// node_modules/.pnpm/@freezm-ltd+event-target-2@https+++codeload.github.com+freezm-ltd+EventTarget2+tar.gz+ab35de5_waf2g56p5kfzme2plmhrbk5cai/node_modules/@freezm-ltd/event-target-2/dist/index.js
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
        this.listenOnceOnly(type, resolve, (e) => e.detail === compareValue);
      } else {
        this.listenOnce(type, resolve);
      }
    });
  }
  callback(type, callback) {
    this.waitFor(type).then((result) => callback(result));
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
  addTrigger(trigger, callback, triggerDuration = 1e4) {
    if (this.listenerWeakMap.has(trigger)) throw new Error("FlowmeterAddTriggerError: Duplication of trigger is not allowed");
    let timeout = null;
    const listener = async (e) => {
      const info = e.detail;
      if (await trigger(info)) {
        if (!timeout) timeout = globalThis.setTimeout(() => {
          if (!this.closed) callback();
        }, triggerDuration);
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

// src/repipe.ts
var SwitchableStream = class extends EventTarget2 {
  // for identify abort
  constructor(readableGenerator, writableGenerator, readableStrategy, writableStrategy) {
    super();
    this.readableGenerator = readableGenerator;
    this.writableGenerator = writableGenerator;
    this.readableAbortContorller = new AbortController();
    this.writableAbortController = new AbortController();
    this.abortReason = crypto.randomUUID();
    // switch repipe
    //    |    |
    // source -> this.writable -> this.readable -> sink
    this.readableSwitching = false;
    //                                      repipe switch
    //                                          |   |
    // source -> this.writable -> this.readable -> sink
    this.writableSwitching = false;
    const { readable, writable } = new TransformStream(void 0, writableStrategy, readableStrategy);
    this.readable = readable;
    this.writable = writable;
    this.switchWritable().then(() => this.switchReadable());
  }
  async switchReadable(to) {
    if (!to && this.readableSwitching) return;
    return this.atomic("switch-readable", async () => {
      this.readableSwitching = true;
      while (!to) {
        try {
          to = await this.readableGenerator();
        } catch (e) {
        }
      }
      this.readableAbortContorller.abort(this.abortReason);
      this.readableAbortContorller = new AbortController();
      to.pipeTo(this.writable, { preventAbort: true, preventCancel: true, preventClose: true, signal: this.readableAbortContorller.signal }).then(() => this.writable.close()).catch((e) => {
        if (e !== this.abortReason) this.switchReadable();
      });
      this.readableSwitching = false;
    });
  }
  async switchWritable(to) {
    if (!to && this.writableSwitching) return;
    return this.atomic("switch-writable", async () => {
      this.writableSwitching = true;
      while (!to) {
        try {
          to = await this.writableGenerator();
        } catch (e) {
        }
      }
      this.writableAbortController.abort(this.abortReason);
      this.writableAbortController = new AbortController();
      this.readable.pipeTo(to, { preventAbort: true, preventCancel: true, preventClose: true, signal: this.writableAbortController.signal }).then(() => to.close()).catch((e) => {
        if (e !== this.abortReason) this.switchWritable();
      });
      this.writableSwitching = false;
    });
  }
  abort() {
    this.readableAbortContorller.abort(this.abortReason);
    this.writableAbortController.abort(this.abortReason);
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

// src/utils.ts
async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
function mergeStream(parallel, generators, writableStrategy, readableStrategy) {
  const { readable, writable } = new TransformStream(void 0, writableStrategy, readableStrategy);
  const emitter = new EventTarget2();
  const buffer = {};
  const load = async (index) => {
    if (index >= generators.length) return;
    buffer[index] = await generators[index]();
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

// src/index.ts
function streamRetry(readableGenerator, sensor, option) {
  const flowmeter = new Flowmeter(sensor);
  const { readable, writable } = flowmeter;
  const switchableStream = new SwitchableStream(readableGenerator, () => writable);
  flowmeter.addTrigger((info) => info.flow < option.minSpeed, switchableStream.switchReadable, option.minDuration);
  return readable;
}
function fetchRetry(input, init, option = { slowDown: 5e3, minSpeed: 5120, minDuration: 1e4 }) {
  let start = 0;
  let end = 0;
  let first = true;
  if (init && init.headers) {
    const headers = init.headers;
    let range = "";
    if (headers instanceof Headers) range = headers.get("Range") || "";
    else if (headers instanceof Array) range = (headers.find(([key, _]) => key.toLocaleLowerCase() === "range") || [, ""])[1];
    else range = headers["Range"] || headers["range"] || "";
    if (range) {
      const [_, _start, _end] = /bytes=(\d+)-(\d+)?/.exec(range) || [];
      if (_start) start = Number(_start);
      if (_end) end = Number(_end);
    }
  }
  const sensor = (chunk) => {
    const length = chunk.length;
    start += length;
    return length;
  };
  const readableGenerator = async () => {
    if (!first) await sleep(option.slowDown);
    first = false;
    if (start !== 0) {
      const Range = `bytes=${start}-${end !== 0 ? end : ""}`;
      if (!init) init = {};
      if (!init.headers) init.headers = new Headers({ Range });
      else if (init.headers instanceof Headers) init.headers.set("Range", Range);
      else if (init.headers instanceof Array) {
        const found = init.headers.find(([key, _]) => key.toLocaleLowerCase() === "range");
        if (found) found[1] = Range;
        else init.headers.push(["Range", Range]);
      } else if (init.headers) init.headers["Range"] = Range;
    }
    const response = await fetch(input, init);
    let stream = response.body;
    if (!stream) throw new Error("Error: Cannot find response body");
    if (!response.headers.get("Content-Range") && start !== 0) {
      stream = stream.pipeThrough(sliceByteStream(start, end !== 0 ? end : void 0));
    }
    return stream;
  };
  return streamRetry(readableGenerator, sensor, option);
}
export {
  Flowmeter,
  SwitchableStream,
  byteFitter,
  fetchRetry,
  fitStream,
  getFitter,
  mergeStream,
  sliceByteStream,
  sliceStream,
  streamRetry
};
