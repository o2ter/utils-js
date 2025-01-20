//
//  pool.ts
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
import { AsyncStreamSource } from '../types/iterable';
import { withResolvers } from '../internal';

export const PoolledIterator = <T>(size: number, source: AsyncStreamSource<T> | (() => AsyncStreamSource<T>)) => {
  let pool: T[] = [];
  let done: boolean | undefined;
  let push = withResolvers<T[]>();
  let poll = withResolvers<void>();

  (async () => {
    try {
      const stream = typeof source === 'function' ? source() : source;
      const iterable = Symbol.iterator in stream || Symbol.asyncIterator in stream ? stream : await stream;
      for await (const value of iterable) {
        if (pool.length >= size) {
          await poll[2];
          poll = withResolvers();
        }
        pool.push(value);
        push[0](pool);
      }
      push[0]([]);
    } catch (e) {
      push[1](e);
    } finally {
      done = true;
    }
  })();

  return (async function* () {
    while (!done) {
      try {
        yield* await push[2];
        push = withResolvers();
        pool = [];
        poll[0]();
      } catch (e) {
        console.error(e);
      }
    }
  })();
};
