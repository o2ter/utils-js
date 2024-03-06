//
//  index.test.ts
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
import { expect, test } from '@jest/globals';
import { asyncStream, base64ToBuffer, bufferToBase64, bufferToString } from '../src';

test('test base64 encode', async () => {
  expect(bufferToBase64('hello, world')).toBe('aGVsbG8sIHdvcmxk');
});

test('test base64 decode', async () => {
  expect(bufferToString(base64ToBuffer('aGVsbG8sIHdvcmxk'))).toBe('hello, world');
});

test('test asyncStream 1', async () => {

  const result = await asyncStream([1, 2, 3, 4, 5]);

  expect(result).toEqual([1, 2, 3, 4, 5]);
});

test('test asyncStream 2', async () => {

  const result = await asyncStream(Promise.resolve([1, 2, 3, 4, 5]));

  expect(result).toEqual([1, 2, 3, 4, 5]);
});

test('test asyncStream 3', async () => {

  const result = await asyncStream(() => Promise.resolve([1, 2, 3, 4, 5]));

  expect(result).toEqual([1, 2, 3, 4, 5]);
});

test('test asyncStream 4', async () => {

  const result = await asyncStream(async function* () { 
    yield* [1, 2, 3, 4, 5];
  });

  expect(result).toEqual([1, 2, 3, 4, 5]);
});

test('test asyncStream 5', async () => {

  const stream = asyncStream([1, 2, 3, 4, 5]);

  const result: number[] = [];
  for await (const val of stream) {
    result.push(val);
  }

  expect(result).toEqual([1, 2, 3, 4, 5]);
});

test('test asyncStream 6', async () => {

  const stream = asyncStream(Promise.resolve([1, 2, 3, 4, 5]));

  const result: number[] = [];
  for await (const val of stream) {
    result.push(val);
  }

  expect(result).toEqual([1, 2, 3, 4, 5]);
});

test('test asyncStream 7', async () => {

  const stream = asyncStream(() => Promise.resolve([1, 2, 3, 4, 5]));

  const result: number[] = [];
  for await (const val of stream) {
    result.push(val);
  }

  expect(result).toEqual([1, 2, 3, 4, 5]);
});

test('test asyncStream 8', async () => {

  const stream = asyncStream(async function* () {
    yield* [1, 2, 3, 4, 5];
  });

  const result: number[] = [];
  for await (const val of stream) {
    result.push(val);
  }

  expect(result).toEqual([1, 2, 3, 4, 5]);
});

test('test asyncStream 9', async () => {

  const stream = asyncStream(async function* () {
    yield* [1, 2, 3, 4, 5];
  });

  const result: number[] = [];
  for await (const val of stream.map(v => v + 1)) {
    result.push(val);
  }

  expect(result).toEqual([2, 3, 4, 5, 6]);
});

test('test asyncStream 10', async () => {

  const stream = asyncStream(async function* () {
    yield* [1, 2, 3, 4, 5];
  });

  const result: number[] = [];
  for await (const val of stream.map(async v => v + 1)) {
    result.push(val);
  }

  expect(result).toEqual([2, 3, 4, 5, 6]);
});

test('test asyncStream 11', async () => {

  const stream = asyncStream(async function* () {
    yield* [1, 2, 3, 4, 5];
  });

  const result: number[] = [];
  for await (const val of stream.flatMap(v => _.range(0, v))) {
    result.push(val);
  }

  expect(result).toEqual([0, 0, 1, 0, 1, 2, 0, 1, 2, 3, 0, 1, 2, 3, 4]);
});

test('test asyncStream 12', async () => {

  const stream = asyncStream(async function* () {
    yield* [1, 2, 3, 4, 5];
  });

  const result: number[] = [];
  for await (const val of stream.flatMap(async v => _.range(0, v))) {
    result.push(val);
  }

  expect(result).toEqual([0, 0, 1, 0, 1, 2, 0, 1, 2, 3, 0, 1, 2, 3, 4]);
});
