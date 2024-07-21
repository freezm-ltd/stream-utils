// node_modules/.pnpm/@freezm-ltd+event-target-2@https+++codeload.github.com+freezm-ltd+EventTarget2+tar.gz+36ba089_bolpylkksoeea65grmz4vnz36u/node_modules/@freezm-ltd/event-target-2/dist/index.js
var EventTarget2 = class extends EventTarget {
  constructor() {
    super(...arguments);
    this.listeners = /* @__PURE__ */ new Map();
    this._bubbleMap = /* @__PURE__ */ new Map();
  }
  async waitFor(type, compareValue) {
    return new Promise((resolve) => {
      if (compareValue) {
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
    this.dispatchEvent(new CustomEvent(type, detail ? { detail } : void 0));
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
};

// src/flow.ts
var Flowmeter = class extends EventTarget2 {
  constructor(sensor, interval = 1e3) {
    super();
    this.sensor = sensor;
    this.interval = interval;
    this.buffer = [];
    this.listenerWeakMap = /* @__PURE__ */ new WeakMap();
    this.lastWatchInfo = { time: Date.now(), value: 0, delta: 0, interval: 0, flow: 0 };
    setInterval(this.watch, interval);
  }
  // custom trigger depends on flow info
  // callback if trigger===true duration overs triggerDuration
  addTrigger(trigger, callback, triggerDuration = 1e4) {
    if (this.listenerWeakMap.has(trigger)) throw new Error("FlowmeterAddTriggerError: Duplication of trigger is not allowed");
    let timeout = null;
    const listener = async (e) => {
      const info = e.detail;
      if (await trigger(info)) {
        if (!timeout) timeout = globalThis.setTimeout(callback, triggerDuration);
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
  get tube() {
    const _this = this;
    return new TransformStream({
      transform(chunk, controller) {
        controller.enqueue(chunk);
        _this.process(chunk);
      }
    });
  }
};

// src/repipe.ts
var SwitchableStream = class {
  // for identify abort
  constructor(readableGenerator, writableGenerator, readableStrategy, writableStrategy) {
    this.readableGenerator = readableGenerator;
    this.writableGenerator = writableGenerator;
    this.readableAbortContorller = new AbortController();
    this.writableAbortController = new AbortController();
    this.abortReason = crypto.randomUUID();
    const { readable, writable } = new TransformStream(void 0, writableStrategy, readableStrategy);
    this.readable = readable;
    this.writable = writable;
    this.switchWritable().then(() => this.switchReadable());
  }
  // switch repipe
  //    |    |
  // source -> this.writable -> this.readable -> sink
  async switchReadable(to) {
    this.readableAbortContorller.abort(this.abortReason);
    this.readableAbortContorller = new AbortController();
    while (!to) {
      try {
        to = await this.readableGenerator();
      } catch (e) {
      }
    }
    to.pipeTo(this.writable, { preventAbort: true, preventCancel: true, preventClose: true, signal: this.readableAbortContorller.signal }).then(() => this.writable.close()).catch((e) => {
      if (e !== this.abortReason) this.switchReadable();
    });
  }
  //                                      repipe switch
  //                                          |   |
  // source -> this.writable -> this.readable -> sink
  async switchWritable(to) {
    this.writableAbortController.abort();
    this.writableAbortController = new AbortController();
    while (!to) {
      try {
        to = await this.writableGenerator();
      } catch (e) {
      }
    }
    this.readable.pipeTo(to, { preventAbort: true, preventCancel: true, preventClose: true, signal: this.writableAbortController.signal }).then(() => to.close()).catch((e) => {
      if (e !== this.abortReason) this.switchWritable();
    });
  }
  abort() {
    this.readableAbortContorller.abort(this.abortReason);
    this.writableAbortController.abort(this.abortReason);
  }
};

// src/utils.ts
async function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}

// src/index.ts
function streamRetry(readableGenerator, sensor, option) {
  const flowmeter = new Flowmeter(sensor);
  const { readable, writable } = flowmeter.tube;
  const switchableStream = new SwitchableStream(readableGenerator, () => writable);
  flowmeter.addTrigger((info) => info.flow < option.minSpeed, switchableStream.switchReadable, option.minDuration);
  return readable;
}
function fetchRetry(input, init, option = { slowDown: 5e3, minSpeed: 5120, minDuration: 1e4 }) {
  let start = -1;
  let end = -1;
  const sensor = (chunk) => {
    const length = chunk.length;
    start += length;
    return length;
  };
  const readableGenerator = async () => {
    if (start !== -1) await sleep(option.slowDown);
    if (!init) init = { headers: { Range: `bytes=${start}-${end !== -1 ? end : ""}` } };
    const response = await fetch(input, init);
    if (!response.body) throw new Error("Error: Cannot find response body");
    const [match, _start, _end] = /bytes (\d+)-(\d+)/.exec(response.headers.get("Content-Range") || "") || [];
    if (!match) throw new Error("Error: Range request not supported");
    [start, end] = [Number(start), Number(end ? end : -1)];
    return response.body;
  };
  return streamRetry(readableGenerator, sensor, option);
}
export {
  fetchRetry,
  streamRetry
};
