//
//  index.test.ts
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
