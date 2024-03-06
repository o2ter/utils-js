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

export const iterableToArray = <T>(iterable: Iterable<T>) => {
  const array: T[] = [];
  for (const obj of iterable) array.push(obj);
  return array;
};

export const arrayToGenerator = <T>(array: T[]) => function* () { yield* array; }();

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
      for await (const obj of base) array.push(obj);
      return array;
    })();
    return promise.then(...args);
  }

  [Symbol.asyncIterator](): AsyncGenerator<Awaited<T>, void, undefined> {
    const source = _.isFunction(this.#source) ? this.#source() : this.#source;
    const iterable = (async function* () {
      if (Symbol.iterator in source || Symbol.asyncIterator in source) yield* source;
      else yield* await source;
    })();
    return iterable[Symbol.asyncIterator]();
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
        if (Symbol.iterator in iterable || Symbol.asyncIterator in iterable) yield* iterable;
        else yield* await iterable;
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
    const self = this;
    return asyncStream(async function* () {
      const queue: Awaitable<R>[] = [];
      try {
        for await (const value of self) {
          if (queue.length >= parallel) yield queue.shift()!;
          queue.push(transform(value));
        }
        while (!_.isEmpty(queue)) yield queue.shift()!;
      } finally {
        await Promise.allSettled(queue);
      }
    });
  }

  parallelFlatMap<R>(parallel: number, transform: (value: T) => AsyncStreamSource<R>) {
    const self = this;
    return asyncStream(async function* () {
      const queue: AsyncStreamSource<R>[] = [];
      try {
        for await (const value of self) {
          if (queue.length >= parallel) {
            const iterable = queue.shift()!;
            if (Symbol.iterator in iterable || Symbol.asyncIterator in iterable) yield* iterable;
            else yield* await iterable;
          }
          queue.push(transform(value));
        }
        while (!_.isEmpty(queue)) {
          const iterable = queue.shift()!;
          if (Symbol.iterator in iterable || Symbol.asyncIterator in iterable) yield* iterable;
          else yield* await iterable;
        }
      } finally {
        await Promise.allSettled(queue);
      }
    });
  }

  async forEach(callback: (value: T) => Awaitable<void>) {
    for await (const value of this) {
      await callback(value);
    }
  }

  async parallelEach(parallel: number, callback: (value: T) => Awaitable<void>) {
    for await (const _ of this.parallelMap(parallel, callback)) { }
  }
}

export const asyncStream = <T>(source: Awaitable<T[] | AsyncIterable<T>> | (() => Awaitable<T[] | AsyncIterable<T>>)) => new AsyncStream(source);
