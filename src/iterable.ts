//
//  iterable.ts
//
//  The MIT License
//  Copyright (c) 2021 - 2025 O2ter Limited. All rights reserved.
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
import { Awaitable } from './types/promise';

export const arrayToGenerator = <T>(array: T[]) => function* () { for (const value of array) yield value; }();

export const iterableToArray = <T>(iterable: Iterable<T>) => {
  const array: T[] = [];
  for (const obj of iterable) array.push(obj);
  return array;
};

export const asyncIterableToArray = async <T>(asyncIterable: Awaitable<AsyncIterable<T>>) => {
  const array: T[] = [];
  for await (const obj of await asyncIterable) array.push(obj);
  return array;
};

type AsyncStreamSource<T> = Awaitable<T[] | AsyncIterable<T>>;

const makeIterator = async <T>(source: AsyncStreamSource<T>) => {
  const iterable = Symbol.iterator in source || Symbol.asyncIterator in source ? source : await source;
  return Symbol.iterator in iterable ? iterable[Symbol.iterator]() : iterable[Symbol.asyncIterator]();
};

class AsyncStream<T> {

  #source: AsyncStreamSource<T> | (() => AsyncStreamSource<T>);

  constructor(source: AsyncStreamSource<T> | (() => AsyncStreamSource<T>)) {
    this.#source = source;
  }

  then(...args: Parameters<Promise<T[]>['then']>) {
    const source = typeof this.#source === 'function' ? this.#source() : this.#source;
    const promise = (async () => {
      const iterable = Symbol.iterator in source || Symbol.asyncIterator in source ? source : await source;
      if (_.isArray(iterable)) return iterable;
      const array: T[] = [];
      for await (const value of iterable) array.push(value);
      return array;
    })();
    return promise.then(...args);
  }

  makeAsyncIterable() {
    const source = typeof this.#source === 'function' ? this.#source() : this.#source;
    return (async function* () {
      const iterator = await makeIterator(source);
      try {
        for (let step = await iterator.next(); !step.done; step = await iterator.next())
          yield step.value;
      } catch (error) {
        if ('throw' in iterator && _.isFunction(iterator.throw)) await iterator.throw(error);
        else throw error;
      }
    })();
  }

  [Symbol.asyncIterator]() {
    return this.makeAsyncIterable()[Symbol.asyncIterator]();
  }

  map<R>(transform: (value: T) => Awaitable<R>) {
    const iterable = this.makeAsyncIterable();
    return asyncStream(async function* () {
      try {
        for await (const value of iterable) {
          yield await transform(value);
        }
      } catch (error) {
        await iterable.throw(error);
      }
    });
  }

  flatMap<R>(transform: (value: T) => AsyncStreamSource<R>) {
    const iterable = this.makeAsyncIterable();
    return asyncStream(async function* () {
      try {
        for await (const value of iterable) {
          const transformed = transform(value);
          const iterable = Symbol.iterator in transformed || Symbol.asyncIterator in transformed ? transformed : await transformed;
          for await (const value of iterable) yield value;
        }
      } catch (error) {
        await iterable.throw(error);
      }
    });
  }

  filter<R>(isIncluded: (value: T) => Awaitable<boolean>) {
    const iterable = this.makeAsyncIterable();
    return asyncStream(async function* () {
      try {
        for await (const value of iterable) {
          if (await isIncluded(value)) yield value;
        }
      } catch (error) {
        await iterable.throw(error);
      }
    });
  }

  parallelMap<R>(parallel: number, transform: (value: T) => Awaitable<R>) {
    return asyncStream(parallelMap(this, parallel, transform));
  }

  parallelFlatMap<R>(parallel: number, transform: (value: T) => AsyncStreamSource<R>) {
    return asyncStream(parallelFlatMap(this, parallel, transform));
  }

  async forEach(callback: (value: T) => Awaitable<void>) {
    const iterable = this.makeAsyncIterable();
    try {
      for await (const value of iterable) {
        await callback(value);
      }
    } catch (error) {
      await iterable.throw(error);
    }
  }

  async parallelEach(parallel: number, callback: (value: T) => Awaitable<void>) {
    await parallelEach(this, parallel, callback);
  }
}

export type { AsyncStream };

export const asyncStream = <T>(source: AsyncStreamSource<T> | (() => AsyncStreamSource<T>)) => new AsyncStream(source);

export async function* parallelMap<T, R>(
  stream: AsyncStreamSource<T>,
  parallel: number,
  transform: (value: T) => Awaitable<R>
) {
  const queue: Promise<R>[] = [];
  const iterator = await makeIterator(stream);
  try {
    for (let step = await iterator.next(); !step.done; step = await iterator.next()) {
      if (queue.length >= parallel) yield await queue.shift()!;
      queue.push((async () => transform(step.value))());
    }
    while (!_.isEmpty(queue)) yield await queue.shift()!;
  } catch (error) {
    if ('throw' in iterator && _.isFunction(iterator.throw)) await iterator.throw(error);
    else throw error;
  } finally {
    await Promise.allSettled(queue);
  }
}

export async function* parallelFlatMap<T, R>(
  stream: AsyncStreamSource<T>,
  parallel: number,
  transform: (value: T) => AsyncStreamSource<R>
) {
  const queue: AsyncStreamSource<R>[] = [];
  const iterator = await makeIterator(stream);
  try {
    for (let step = await iterator.next(); !step.done; step = await iterator.next()) {
      if (queue.length >= parallel) {
        const iterator = await makeIterator(queue.shift()!);
        try {
          for (let step = await iterator.next(); !step.done; step = await iterator.next())
            yield step.value;
        } catch (error) {
          if ('throw' in iterator && _.isFunction(iterator.throw)) await iterator.throw(error);
          else throw error;
        }
      }
      queue.push(transform(step.value));
    }
    while (!_.isEmpty(queue)) {
      const iterator = await makeIterator(queue.shift()!);
      try {
        for (let step = await iterator.next(); !step.done; step = await iterator.next())
          yield step.value;
      } catch (error) {
        if ('throw' in iterator && _.isFunction(iterator.throw)) await iterator.throw(error);
        else throw error;
      }
    }
  } catch (error) {
    if ('throw' in iterator && _.isFunction(iterator.throw)) await iterator.throw(error);
    else throw error;
  } finally {
    await Promise.allSettled(queue);
  }
}

export async function parallelEach<T>(
  stream: AsyncStreamSource<T>,
  parallel: number,
  callback: (value: T) => Awaitable<void>
) {
  for await (const _ of parallelMap(stream, parallel, callback)) { }
}