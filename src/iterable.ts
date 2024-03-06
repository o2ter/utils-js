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

class AsyncStream<T> {

  #source: Awaitable<T[] | AsyncIterable<T>> | (() => Awaitable<T[] | AsyncIterable<T>>);

  constructor(source: Awaitable<T[] | AsyncIterable<T>> | (() => Awaitable<T[] | AsyncIterable<T>>)) {
    this.#source = source;
  }

  then(...args: Parameters<Promise<T[]>['then']>) {
    const self = this;
    const promise = (async () => {
      const base = _.isFunction(self.#source) ? await self.#source() : await self.#source;
      if (_.isArray(base)) return base;
      const array: T[] = [];
      for await (const obj of await base) array.push(obj);
      return array;
    })();
    return promise.then(...args);
  }

  [Symbol.asyncIterator]() {
    const self = this;
    const iterable = (async function* () {
      const base = _.isFunction(self.#source) ? await self.#source() : await self.#source;
      yield* base;
    })();
    return iterable[Symbol.asyncIterator]();
  }

  map<R>(transform: (value: T) => Awaitable<R>) {
    const self = this;
    return asyncStream(async function* () {
      for await (const value of self) {
        yield await transform(value);
      }
    })
  }
}

export const asyncStream = <T>(source: Awaitable<T[] | AsyncIterable<T>> | (() => Awaitable<T[] | AsyncIterable<T>>)) => new AsyncStream(source);

export async function* parallelMap<T, R>(
  stream: Awaitable<AsyncIterable<T>>,
  parallel: number,
  transform: (value: T) => PromiseLike<R>
) {
  const queue: Promise<R>[] = [];
  try {
    for await (const value of await stream) {
      if (queue.length >= parallel) yield queue.shift()!;
      queue.push((async () => transform(value))());
    }
    while (!_.isEmpty(queue)) yield queue.shift()!;
  } finally {
    await Promise.allSettled(queue);
  }
}

export async function parallelEach<T>(
  stream: Awaitable<AsyncIterable<T>>,
  parallel: number,
  callback: (value: T) => PromiseLike<void>
) {
  for await (const _ of parallelMap(stream, parallel, callback)) { }
}
