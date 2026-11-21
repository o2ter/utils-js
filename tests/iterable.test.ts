//
//  index.test.ts
//
//  The MIT License
//  Copyright (c) 2021 - 2026 O2ter Limited. All rights reserved.
//
//  Permission is hereby granted, free of charge, to any person obtaining a copy
//  of this software and associated documentation files (the "Software"), to deal
//  in the Software without restriction, including without limitation the rights
//  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
//  copies of the Software, and to permit persons to whom the Software is
//  furnished to do so, subject to the following conditions:
//
//  The above copyright notice and this permission notice shall be included in
//  all copies or substantial portions of the Software.
//
//  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
//  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
//  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
//  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
//  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
//  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
//  THE SOFTWARE.
//

import _ from 'lodash';
import { expect, jest, test } from '@jest/globals';
import { once } from 'node:events';
import { Readable } from 'node:stream';
import { asyncStream, binaryStreamChunk, iterableToStream, parallelEach, parallelMap } from '../src';

test('test asyncStream 1', async () => {

  const result = await asyncStream([1, 2, 3, 4, 5]);

  expect(result).toEqual([1, 2, 3, 4, 5]);
});

test('test asyncStream 2', async () => {

  const result = await asyncStream(Promise.resolve([1, 2, 3, 4, 5]));

  expect(result).toEqual([1, 2, 3, 4, 5]);
});

test('test asyncStream 3', async () => {

  const result = await asyncStream(() => Promise.resolve([1, 2, 3, 4, 5]));

  expect(result).toEqual([1, 2, 3, 4, 5]);
});

test('test asyncStream 4', async () => {

  const result = await asyncStream(async function* () { 
    yield* [1, 2, 3, 4, 5];
  });

  expect(result).toEqual([1, 2, 3, 4, 5]);
});

test('test asyncStream 5', async () => {

  const stream = asyncStream([1, 2, 3, 4, 5]);

  const result: number[] = [];
  for await (const val of stream) {
    result.push(val);
  }

  expect(result).toEqual([1, 2, 3, 4, 5]);
});

test('test asyncStream 6', async () => {

  const stream = asyncStream(Promise.resolve([1, 2, 3, 4, 5]));

  const result: number[] = [];
  for await (const val of stream) {
    result.push(val);
  }

  expect(result).toEqual([1, 2, 3, 4, 5]);
});

test('test asyncStream 7', async () => {

  const stream = asyncStream(() => Promise.resolve([1, 2, 3, 4, 5]));

  const result: number[] = [];
  for await (const val of stream) {
    result.push(val);
  }

  expect(result).toEqual([1, 2, 3, 4, 5]);
});

test('test asyncStream 8', async () => {

  const stream = asyncStream(async function* () {
    yield* [1, 2, 3, 4, 5];
  });

  const result: number[] = [];
  for await (const val of stream) {
    result.push(val);
  }

  expect(result).toEqual([1, 2, 3, 4, 5]);
});

test('test asyncStream map 1', async () => {

  const stream = asyncStream(async function* () {
    yield* [1, 2, 3, 4, 5];
  });

  const result: number[] = [];
  for await (const val of stream.map(v => v + 1)) {
    result.push(val);
  }

  expect(result).toEqual([2, 3, 4, 5, 6]);
});

test('test asyncStream map 2', async () => {

  const stream = asyncStream(async function* () {
    yield* [1, 2, 3, 4, 5];
  });

  const result: number[] = [];
  for await (const val of stream.map(async v => v + 1)) {
    result.push(val);
  }

  expect(result).toEqual([2, 3, 4, 5, 6]);
});

test('test asyncStream flatMap 1', async () => {

  const stream = asyncStream(async function* () {
    yield* [1, 2, 3, 4, 5];
  });

  const result: number[] = [];
  for await (const val of stream.flatMap(v => _.range(v))) {
    result.push(val);
  }

  expect(result).toEqual([0, 0, 1, 0, 1, 2, 0, 1, 2, 3, 0, 1, 2, 3, 4]);
});

test('test asyncStream flatMap 2', async () => {

  const stream = asyncStream(async function* () {
    yield* [1, 2, 3, 4, 5];
  });

  const result: number[] = [];
  for await (const val of stream.flatMap(async v => _.range(v))) {
    result.push(val);
  }

  expect(result).toEqual([0, 0, 1, 0, 1, 2, 0, 1, 2, 3, 0, 1, 2, 3, 4]);
});

test('test asyncStream parallelMap 1', async () => {

  const stream = asyncStream(async function* () {
    yield* [1, 2, 3, 4, 5];
  });

  const result: number[] = [];
  for await (const val of stream.parallelMap(2, v => v + 1)) {
    result.push(val);
  }

  expect(result).toEqual([2, 3, 4, 5, 6]);
});

test('test asyncStream parallelMap 2', async () => {

  const stream = asyncStream(async function* () {
    yield* [1, 2, 3, 4, 5];
  });

  const result: number[] = [];
  for await (const val of stream.parallelMap(2, async v => v + 1)) {
    result.push(val);
  }

  expect(result).toEqual([2, 3, 4, 5, 6]);
});

test('test asyncStream parallelMap limits concurrency and preserves input order', async () => {

  const resolvers = new Map<number, (value: number) => void>();
  const started = new Map<number, () => void>();
  const startedPromises = Array.from({ length: 5 }, (_, i) =>
    new Promise<void>(resolve => started.set(i + 1, resolve))
  );
  let active = 0;
  let maximumActive = 0;
  const iterable = asyncStream([1, 2, 3, 4, 5]).parallelMap(3, v => {
    active++;
    maximumActive = Math.max(maximumActive, active);
    return new Promise<number>(resolve => {
      resolvers.set(v, value => {
        active--;
        resolve(value);
      });
      started.get(v)!();
    });
  }).makeAsyncIterable();

  const first = iterable.next();
  await Promise.all(startedPromises.slice(0, 3));
  expect([...resolvers.keys()]).toEqual([1, 2, 3]);

  resolvers.get(3)!(30);
  resolvers.get(2)!(20);
  resolvers.get(1)!(10);
  await expect(first).resolves.toEqual({ value: 10, done: false });

  const second = iterable.next();
  await expect(second).resolves.toEqual({ value: 20, done: false });

  const third = iterable.next();
  await expect(third).resolves.toEqual({ value: 30, done: false });

  const fourth = iterable.next();
  await startedPromises[3];
  resolvers.get(4)!(40);
  await expect(fourth).resolves.toEqual({ value: 40, done: false });
  const fifth = iterable.next();
  await startedPromises[4];
  resolvers.get(5)!(50);
  await expect(fifth).resolves.toEqual({ value: 50, done: false });
  await expect(iterable.next()).resolves.toEqual({ value: undefined, done: true });
  expect(maximumActive).toBe(3);
});

test('parallelMap yields completed values while the next source value is pending', async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let waiting!: () => void;
  const sourceWaiting = new Promise<void>(resolve => { waiting = resolve; });
  async function* source() {
    yield 1;
    waiting();
    await gate;
    yield 2;
  }
  const iterator = parallelMap(source(), 2, value => value * 10);
  try {
    const first = iterator.next();
    await sourceWaiting;
    await expect(first).resolves.toEqual({ value: 10, done: false });
    release();
    await expect(iterator.next()).resolves.toEqual({ value: 20, done: false });
    await expect(iterator.next()).resolves.toEqual({ value: undefined, done: true });
  } finally {
    release();
    await iterator.return(undefined);
  }
});

test('test asyncStream parallelMap rejects invalid parallel limits', async () => {

  for (const parallel of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    await expect(asyncStream([1]).parallelMap(parallel, v => v))
      .rejects.toThrow('parallel must be a positive integer');
  }
});

test('test asyncStream parallelMap propagates transform errors', async () => {

  const error = new Error('transform failed');
  const source = asyncStream([1, 2, 3]);

  await expect(source.parallelMap(2, v => {
    if (v === 2) throw error;
    return v;
  })).rejects.toBe(error);
});

test('parallelMap propagates source errors', async () => {
  const error = new Error('source failed');
  async function* source() {
    yield 1;
    throw error;
  }
  await expect(asyncStream(parallelMap(source(), 2, value => value))).rejects.toBe(error);
});

test('parallelMap emits earlier transforms before a later source error', async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let rejected!: () => void;
  const sourceRejected = new Promise<void>(resolve => { rejected = resolve; });
  const error = Error('source failed');
  async function* source() {
    yield 1;
    rejected();
    throw error;
  }
  const iterator = parallelMap(source(), 2, async value => {
    await gate;
    return value;
  });
  try {
    const first = iterator.next().then(
      value => ({ value }),
      error => ({ error }),
    );
    await sourceRejected;
    await new Promise<void>(resolve => setImmediate(resolve));
    release();
    await expect(first).resolves.toEqual({ value: { value: 1, done: false } });
    await expect(iterator.next()).rejects.toBe(error);
  } finally {
    release();
    await iterator.return(undefined);
  }
});

test('parallelEach waits for started callbacks before rejecting', async () => {
  let release!: () => void;
  let fail!: () => void;
  let started!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const failureGate = new Promise<void>(resolve => { fail = resolve; });
  const startedGate = new Promise<void>(resolve => { started = resolve; });
  const error = Error('callback failed');
  let finished = false;
  let rejected = false;
  const result = parallelEach([1, 2], 2, async value => {
    if (value === 1) {
      await failureGate;
      throw error;
    }
    started();
    await gate;
    finished = true;
  }).catch(reason => {
    rejected = true;
    throw reason;
  });
  try {
    await startedGate;
    fail();
    await new Promise<void>(resolve => setImmediate(resolve));
    expect(rejected).toBe(false);
    release();
    await expect(result).rejects.toBe(error);
    expect(finished).toBe(true);
  } finally {
    fail();
    release();
  }
});

test('parallelMap reports the original error and source cleanup errors', async () => {
  const original = Error('transform failed');
  const cleanup = Error('source throw failed');
  const source: AsyncIterable<number> = {
    [Symbol.asyncIterator]() {
      return {
        async next() { return { done: false as const, value: 1 }; },
        async throw() { throw cleanup; },
        async return() { return { done: true as const, value: undefined }; },
      };
    },
  };
  const iterator = parallelMap(source, 1, () => { throw original; });
  await expect(iterator.next()).rejects.toMatchObject({ errors: [original, cleanup] });
});

test('test parallelMap preserves source return value', async () => {

  async function* source() {
    yield 1;
    yield 2;
    return 'source done';
  }

  const iterator = parallelMap(source(), 2, v => v * 10)[Symbol.asyncIterator]();
  await expect(iterator.next()).resolves.toEqual({ value: 10, done: false });
  await expect(iterator.next()).resolves.toEqual({ value: 20, done: false });
  await expect(iterator.next()).resolves.toEqual({ value: 'source done', done: true });
});

test('test parallelMap closes the source when cancelled', async () => {

  let sourceClosed = false;
  async function* source() {
    try {
      yield 1;
      yield 2;
    } finally {
      sourceClosed = true;
    }
  }

  for await (const _ of parallelMap(source(), 2, v => v)) {
    break;
  }

  expect(sourceClosed).toBe(true);
});

test('parallelMap closes a source after its pending next call settles', async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let waiting!: () => void;
  const sourceWaiting = new Promise<void>(resolve => { waiting = resolve; });
  let closed = false;
  async function* source() {
    try {
      yield 1;
      waiting();
      await gate;
      yield 2;
    } finally {
      closed = true;
    }
  }
  const iterator = parallelMap(source(), 2, value => value);
  try {
    const first = iterator.next();
    await sourceWaiting;
    await expect(first).resolves.toEqual({ value: 1, done: false });
    const closing = iterator.return(undefined);
    release();
    await closing;
    expect(closed).toBe(true);
  } finally {
    release();
    await iterator.return(undefined);
  }
});

test('parallelMap cancellation waits for started transforms', async () => {
  let release!: () => void;
  let releaseFirst!: () => void;
  let started!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const firstGate = new Promise<void>(resolve => { releaseFirst = resolve; });
  const startedGate = new Promise<void>(resolve => { started = resolve; });
  let finished = false;
  let closed = false;
  const iterator = parallelMap([1, 2], 2, async value => {
    if (value === 1) {
      await firstGate;
    } else {
      started();
      await gate;
      finished = true;
    }
    return value;
  });
  try {
    const first = iterator.next();
    await startedGate;
    releaseFirst();
    await expect(first).resolves.toEqual({ value: 1, done: false });
    const closing = iterator.return(undefined).then(() => { closed = true; });
    await new Promise<void>(resolve => setImmediate(resolve));
    expect(closed).toBe(false);
    release();
    await closing;
    expect(finished).toBe(true);
  } finally {
    releaseFirst();
    release();
    await iterator.return(undefined);
  }
});

test('test asyncStream parallelFlatMap 1', async () => {

  const stream = asyncStream(async function* () {
    yield* [1, 2, 3, 4, 5];
  });

  const result: number[] = [];
  for await (const val of stream.parallelFlatMap(2, v => _.range(v))) {
    result.push(val);
  }

  expect(result).toEqual([0, 0, 1, 0, 1, 2, 0, 1, 2, 3, 0, 1, 2, 3, 4]);
});

test('test asyncStream parallelFlatMap 2', async () => {

  const stream = asyncStream(async function* () {
    yield* [1, 2, 3, 4, 5];
  });

  const result: number[] = [];
  for await (const val of stream.parallelFlatMap(2, async v => _.range(v))) {
    result.push(val);
  }

  expect(result).toEqual([0, 0, 1, 0, 1, 2, 0, 1, 2, 3, 0, 1, 2, 3, 4]);
});

test('test asyncStream throw', async () => {

  let check;
  const result = asyncStream(async function* () {
    try {
      for (const i of [1, 2, 3, 4]) {
        yield i;
      }
    } catch (e) {
      check = e;
      throw e;
    }
  });

  const error = new Error('thrown');

  const iterable = result.makeAsyncIterable();
  await iterable.next();
  await iterable.next();
  await expect(() => iterable.throw(error)).rejects.toThrow('thrown');
  expect(check).toEqual(error);
});

test('test asyncStream throw 2', async () => {

  let check;
  const result = asyncStream(async function* () {
    try {
      for (const i of [1, 2, 3, 4]) {
        yield i;
      }
    } catch (e) {
      check = e;
      throw e;
    }
  }).parallelMap(1, v => v + 1);

  const error = new Error('thrown');

  const iterable = result.makeAsyncIterable();
  await iterable.next();
  await iterable.next();
  await expect(() => iterable.throw(error)).rejects.toThrow('thrown');
  expect(check).toEqual(error);
});

test('test asyncStream throw 3', async () => {

  let check;
  const result = asyncStream(async function* () {
    try {
      for (const i of [1, 2, 3, 4]) {
        yield i;
      }
    } catch (e) {
      check = e;
      throw e;
    }
  }).parallelFlatMap(1, v => _.range(v));

  const error = new Error('thrown');

  const iterable = result.makeAsyncIterable();
  await iterable.next();
  await iterable.next();
  await expect(() => iterable.throw(error)).rejects.toThrow('thrown');
  expect(check).toEqual(error);
});

test('binaryStreamChunk rejects invalid sizes for buffers and streams', async () => {
  for (const size of [0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    await expect(binaryStreamChunk(Buffer.from('a'), size).next()).rejects.toThrow('Chunk size must be a positive integer');
    await expect(binaryStreamChunk((async function* () { yield Buffer.from('a'); })(), size).next())
      .rejects.toThrow('Chunk size must be a positive integer');
  }
});

test('binaryStreamChunk preserves bytes across source boundaries', async () => {
  async function* source() {
    yield Buffer.from('abc');
    yield Buffer.from('defgh');
  }
  const chunks = [];
  for await (const chunk of binaryStreamChunk(source(), 3)) chunks.push(chunk.toString());
  expect(chunks).toEqual(['abc', 'def', 'gh']);
});

test('readable stream cancellation closes an iterator without throw', async () => {
  let closed = false;
  const source: AsyncIterable<number> = {
    [Symbol.asyncIterator]() {
      return {
        async next() { return { done: false as const, value: 1 }; },
        async return() {
          closed = true;
          return { done: true as const, value: undefined };
        },
      };
    },
  };
  const stream = iterableToStream(source);
  if (!(stream instanceof ReadableStream)) throw Error('ReadableStream unavailable');
  const reader = stream.getReader();
  expect((await reader.read()).value).toBe(1);
  await reader.cancel();
  expect(closed).toBe(true);
});

test('readable stream cancellation closes an iterator that handles throw', async () => {
  let closed = false;
  let thrown: unknown;
  const source: AsyncIterable<number> = {
    [Symbol.asyncIterator]() {
      return {
        async next() { return { done: false as const, value: 1 }; },
        async throw(reason?: unknown) {
          thrown = reason;
          return { done: false as const, value: 2 };
        },
        async return() {
          closed = true;
          return { done: true as const, value: undefined };
        },
      };
    },
  };
  const stream = iterableToStream(source);
  if (!(stream instanceof ReadableStream)) throw Error('ReadableStream unavailable');
  const reader = stream.getReader();
  await reader.read();
  const reason = Error('cancelled');
  await reader.cancel(reason);
  expect(thrown).toBe(reason);
  expect(closed).toBe(true);
});

test('readable stream cancellation reports throw and cleanup errors', async () => {
  const failure = Error('throw failed');
  const cleanup = Error('cleanup failed');
  const source: AsyncIterable<number> = {
    [Symbol.asyncIterator]() {
      return {
        async next() { return { done: false as const, value: 1 }; },
        async throw() { throw failure; },
        async return() { throw cleanup; },
      };
    },
  };
  const stream = iterableToStream(source);
  if (!(stream instanceof ReadableStream)) throw Error('ReadableStream unavailable');
  const reader = stream.getReader();
  await reader.read();
  await expect(reader.cancel()).rejects.toMatchObject({ errors: [failure, cleanup] });
});

test('Node stream cancellation closes its source iterator', async () => {
  let closed = false;
  const source: AsyncIterable<number> = {
    [Symbol.asyncIterator]() {
      return {
        async next() { return { done: false as const, value: 1 }; },
        async return() {
          closed = true;
          return { done: true as const, value: undefined };
        },
      };
    },
  };
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'ReadableStream');
  let stream: Readable | undefined;
  try {
    Object.defineProperty(globalThis, 'ReadableStream', { value: undefined, configurable: true });
    jest.isolateModules(() => {
      const { iterableToStream } = require('../src/iterable/stream') as typeof import('../src/iterable/stream');
      const result = iterableToStream(source);
      if (!(result instanceof Readable)) throw Error('Node stream unavailable');
      stream = result;
    });
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'ReadableStream', descriptor);
    else Reflect.deleteProperty(globalThis, 'ReadableStream');
  }
  if (!stream) throw Error('Node stream unavailable');
  const iterator = stream[Symbol.asyncIterator]();
  expect((await iterator.next()).value).toBe(1);
  const closedEvent = once(stream, 'close');
  stream.destroy();
  await closedEvent;
  expect(closed).toBe(true);
});
