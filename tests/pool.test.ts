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
import { expect, test } from '@jest/globals';
import { asyncIterableToArray, IteratorPool } from '../src';

test('test PoolledIterator', async () => {

  const list = IteratorPool(5, async function* () {
    for (const value of _.range(10)) {
      yield value;
      await new Promise(res => setTimeout(res, 100));
    }
  });

  const result = await asyncIterableToArray(list);

  expect(result).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

});

test('test PoolledIterator 2', async () => {

  const list = IteratorPool(5, async function* () {
    for (const value of _.range(10)) {
      yield value;
      await new Promise(res => setTimeout(res, 10));
    }
  });

  const result: number[] = [];
  for await (const value of list) {
    result.push(value);
    await new Promise(res => setTimeout(res, 200));
  }

  expect(result).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

});

test('test PoolledIterator 3', async () => {

  const list = IteratorPool(5, async function* () {
    for (const value of _.range(10)) {
      yield value;
      await new Promise(res => setTimeout(res, 200));
    }
  });

  const result: number[] = [];
  for await (const value of list) {
    result.push(value);
    await new Promise(res => setTimeout(res, 10));
  }

  expect(result).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

});

test('test PoolledIterator 4', async () => {

  const result: number[] = [];

  const list = IteratorPool(5, async function* () {
    for (const value of _.range(10)) {
      yield value;
      await new Promise(res => setTimeout(res, 20));
      result.push(value);
    }
  });

  const iterator = list.makeAsyncIterable();
  await iterator.next();
  await iterator.next();
  await new Promise(res => setTimeout(res, 1000));

  expect(result).toEqual([0, 1, 2, 3, 4, 5, 6]);

});

test('test PoolledIterator 5', async () => {

  const result: number[] = [];

  const list = IteratorPool(Number.MAX_SAFE_INTEGER, async function* () {
    for (const value of _.range(10)) {
      yield value;
      await new Promise(res => setTimeout(res, 20));
      result.push(value);
    }
  });

  const iterator = list.makeAsyncIterable();
  await iterator.next();
  await iterator.next();
  await new Promise(res => setTimeout(res, 1000));

  expect(result).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

});

test('IteratorPool preserves buffered values before reporting source errors', async () => {
  const error = Error('source failed');
  let failed!: () => void;
  const failureStarted = new Promise<void>(resolve => { failed = resolve; });
  async function* source() {
    yield 1;
    failed();
    throw error;
  }
  const iterator = IteratorPool(5, source()).makeAsyncIterable();
  await expect(iterator.next()).resolves.toEqual({ value: 1, done: false });
  await failureStarted;
  await new Promise<void>(resolve => setImmediate(resolve));
  await expect(iterator.next()).rejects.toBe(error);
});

test('IteratorPool closes its producer when the consumer stops', async () => {
  let closed = false;
  async function* source() {
    try {
      let value = 0;
      while (true) yield value++;
    } finally {
      closed = true;
    }
  }
  const iterator = IteratorPool(2, source()).makeAsyncIterable();
  expect((await iterator.next()).value).toBe(0);
  await iterator.return(undefined);
  expect(closed).toBe(true);
});

test('IteratorPool rejects invalid sizes', async () => {
  for (const size of [0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    await expect(asyncIterableToArray(IteratorPool(size, [1]))).rejects.toThrow('Iterator pool size must be a positive integer');
  }
});
