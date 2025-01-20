//
//  stream.ts
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
import type { Readable } from 'node:stream';
import { Awaitable } from '../types/promise';
import { binaryToBuffer } from '../buffer';
import { BinaryData } from '../types/buffer';

export const isReadableStream = (x: any): x is ReadableStream | Readable => {
  if (typeof ReadableStream !== 'undefined' && x instanceof ReadableStream) return true;
  if (typeof window === 'undefined' && x instanceof require('node:stream').Readable) return true;
  return false;
};

const iterableToNodeStream = <T>(
  iterable: Awaitable<AsyncIterable<T>> | (() => Awaitable<AsyncIterable<T>>)
) => {
  const _Readable = require('node:stream').Readable as typeof Readable;
  return _Readable.from((async function* () {
    const source = _.isFunction(iterable) ? iterable() : iterable;
    const iterator = (await source)[Symbol.asyncIterator]();
    try {
      while (true) {
        const { value, done } = await iterator.next();
        if (done) return value;
        yield value;
      }
    } catch (error) {
      if ('throw' in iterator && _.isFunction(iterator.throw)) await iterator.throw(error);
      else throw error;
    }
  })());
}

const iterableToReadableStream = <T>(
  iterable: Awaitable<AsyncIterable<T>> | (() => Awaitable<AsyncIterable<T>>)
) => {
  let iterator: AsyncIterator<T>;
  return new ReadableStream<T>({
    async start(controller) {
      try {
        const _iterable = _.isFunction(iterable) ? iterable() : iterable;
        iterator = (await _iterable)[Symbol.asyncIterator]();
      } catch (e) {
        controller.error(e);
      }
    },
    async pull(controller) {
      try {
        const { value, done } = await iterator?.next() ?? { done: true };
        if (done) {
          controller.close();
        } else {
          controller.enqueue(value);
        }
      } catch (e) {
        controller.error(e);
      }
    },
    async cancel(reason) {
      await iterator.throw?.(_.isString(reason) ? Error(reason) : reason ?? Error('aborted'));
    },
  });
}

export const iterableToStream = typeof ReadableStream === 'undefined' ? iterableToNodeStream : iterableToReadableStream;

export async function* binaryStreamChunk(
  stream: BinaryData | AsyncIterable<BinaryData>,
  chunkSize: number
) {
  if (Symbol.asyncIterator in stream) {
    let buffer = Buffer.from([]);
    const iterator = stream[Symbol.asyncIterator]();
    try {
      for (let step = await iterator.next(); !step.done; step = await iterator.next()) {
        buffer = Buffer.concat([buffer, binaryToBuffer(step.value)] as any);
        while (buffer.byteLength >= chunkSize) {
          yield buffer.subarray(0, chunkSize);
          buffer = buffer.subarray(chunkSize);
        }
      }
      if (buffer.length) yield buffer;
    } catch (error) {
      if ('throw' in iterator && _.isFunction(iterator.throw)) await iterator.throw(error);
      else throw error;
    }
  } else {
    let buffer = binaryToBuffer(stream);
    while (buffer.byteLength >= chunkSize) {
      yield buffer.subarray(0, chunkSize);
      buffer = buffer.subarray(chunkSize);
    }
    if (buffer.length) yield buffer;
  }
}
