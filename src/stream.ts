//
//  stream.ts
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
import type { Readable } from 'node:stream';
import { Awaitable } from './types';
import { binaryToBuffer } from './buffer';

export const isReadableStream = (x: any): x is ReadableStream | Readable => {
  if (typeof ReadableStream !== 'undefined' && x instanceof ReadableStream) return true;
  if (typeof window === 'undefined' && x instanceof require('node:stream').Readable) return true;
  return false;
};

export const streamToIterable = <T>(
  stream: ReadableStream<T> | AsyncIterable<T>
) => {
  if (Symbol.asyncIterator in stream) return stream;
  return {
    [Symbol.asyncIterator]: async function* () {
      const reader = stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) return;
        yield value;
      }
    },
  };
};

const iterableToNodeStream = <T>(
  iterable: Awaitable<AsyncIterable<T>> | (() => Awaitable<AsyncIterable<T>>)
) => {
  const _Readable = require('node:stream').Readable as typeof Readable;
  return _Readable.from((async function* () {
    const _iterable = _.isFunction(iterable) ? iterable() : iterable;
    yield* await _iterable;
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
  });
}

export const iterableToStream = typeof ReadableStream === 'undefined' ? iterableToNodeStream : iterableToReadableStream;

export async function* binaryStreamChunk(
  stream: BinaryData | AsyncIterable<BinaryData>,
  chunkSize: number
) {
  if (Symbol.asyncIterator in stream) {
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, binaryToBuffer(chunk)]);
      while (buffer.byteLength >= chunkSize) {
        yield buffer.subarray(0, chunkSize);
        buffer = buffer.subarray(chunkSize);
      }
    }
    if (buffer.length) yield buffer;
  } else {
    let buffer = binaryToBuffer(stream);
    while (buffer.byteLength >= chunkSize) {
      yield buffer.subarray(0, chunkSize);
      buffer = buffer.subarray(chunkSize);
    }
    if (buffer.length) yield buffer;
  }
}
