//
//  event.ts
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
import { Awaitable } from '../types/promise';
import { withResolvers } from '../internal';
import { asyncStream } from './iterable';

export const _EventIterator = <T, R = any>(
  callback: (
    push: (item: T) => void,
    stop: (result?: R) => void,
  ) => Awaitable<void>,
) => async function* () {

  let [resolve, reject, promise] = withResolvers<void>();
  let queue: T[] = [];
  let stopped = false;
  let result: R | undefined;

  const push = (item: T) => {
    if (stopped) return;
    queue.push(item);
    resolve();
  };

  const stop = (res?: R) => {
    stopped = true;
    result = res;
    resolve();
  };

  (async () => {
    try {
      await callback(push, stop);
    } catch (e) {
      reject(e);
    }
  })();

  while (true) {
    try {
      await promise;
      if (stopped) return result;
      let _queue = queue;
      [resolve, reject, promise] = withResolvers<void>();
      queue = [];
      yield* _queue;
    } catch (e) {
      console.error(e);
    }
  }
};

export const EventIterator = <T, R = any>(
  callback: (
    push: (item: T) => void,
    stop: (result?: R) => void,
  ) => Awaitable<void>,
) => asyncStream(_EventIterator(callback));
