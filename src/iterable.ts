//
//  iterable.ts
//
//  The MIT License
//  Copyright (c) 2021 - 2024 O2ter Limited. All rights reserved.
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
import { Awaitable } from './types';

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

class AsyncStream<T> {

  #source: AsyncStreamSource<T> | (() => AsyncStreamSource<T>);

  constructor(source: AsyncStreamSource<T> | (() => AsyncStreamSource<T>)) {
    this.#source = source;
  }

  then(...args: Parameters<Promise<T[]>['then']>) {
    const source = _.isFunction(this.#source) ? this.#source() : this.#source;
    const promise = (async () => {
      const base = await source;
      if (_.isArray(base)) return base;
      const array: T[] = [];
      for await (const value of base) array.push(value);
      return array;
    })();
    return promise.then(...args);
  }

  makeAsyncIterable() {
    const source = _.isFunction(this.#source) ? this.#source() : this.#source;
    return (async function* () {
      if (Symbol.iterator in source || Symbol.asyncIterator in source) {
        for await (const value of source) yield value;
      } else {
        for await (const value of await source) yield value;
      }
    })();
  }

  [Symbol.asyncIterator]() {
    return this.makeAsyncIterable()[Symbol.asyncIterator]();
  }

  map<R>(transform: (value: T) => Awaitable<R>) {
    const self = this;
    return asyncStream(async function* () {
      for await (const value of self) {
        yield await transform(value);
      }
    });
  }

  flatMap<R>(transform: (value: T) => AsyncStreamSource<R>) {
    const self = this;
    return asyncStream(async function* () {
      for await (const value of self) {
        const iterable = transform(value);
        if (Symbol.iterator in iterable || Symbol.asyncIterator in iterable) {
          for await (const value of iterable) yield value;
        } else {
          for await (const value of await iterable) yield value;
        }
      }
    });
  }

  filter<R>(isIncluded: (value: T) => Awaitable<boolean>) {
    const self = this;
    return asyncStream(async function* () {
      for await (const value of self) {
        if (await isIncluded(value)) yield value;
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
    for await (const value of this) {
      await callback(value);
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
  const source = Symbol.iterator in stream || Symbol.asyncIterator in stream ? stream : await stream;
  try {
    for await (const value of source) {
      if (queue.length >= parallel) yield queue.shift()!;
      queue.push((async () => transform(value))());
    }
    while (!_.isEmpty(queue)) yield queue.shift()!;
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
  const source = Symbol.iterator in stream || Symbol.asyncIterator in stream ? stream : await stream;
  try {
    for await (const value of source) {
      if (queue.length >= parallel) {
        const iterable = queue.shift()!;
        if (Symbol.iterator in iterable || Symbol.asyncIterator in iterable) {
          for await (const value of iterable) yield value;
        } else {
          for await (const value of await iterable) yield value;
        }
      }
      queue.push(transform(value));
    }
    while (!_.isEmpty(queue)) {
      const iterable = queue.shift()!;
      if (Symbol.iterator in iterable || Symbol.asyncIterator in iterable) {
        for await (const value of iterable) yield value;
      } else {
        for await (const value of await iterable) yield value;
      }
    }
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