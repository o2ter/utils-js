//
//  base64.ts
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

export const base64ToBuffer = typeof window === 'undefined' ?
  (base64: string) => Buffer.from(base64, 'base64') :
  (base64: string) => Uint8Array.from(window.atob(base64), x => x.codePointAt(0) as number);

const _stringToBase64 = typeof window === 'undefined' ?
  (buffer: string) => Buffer.from(buffer).toString('base64') :
  (buffer: string) => window.btoa(buffer);

const _bufferToBase64 = typeof window === 'undefined' ?
  (buffer: ArrayBufferLike) => Buffer.from(buffer).toString('base64') :
  (buffer: ArrayBufferLike) => window.btoa(String.fromCharCode(...new Uint8Array(buffer)));

export const bufferToBase64 = (buffer: string | BinaryData) => {
  if (_.isString(buffer)) return _stringToBase64(buffer);
  if (typeof Buffer !== 'undefined' && buffer instanceof Buffer) return Buffer.from(buffer).toString('base64');
  if (ArrayBuffer.isView(buffer)) buffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  return _bufferToBase64(buffer);
}
