import 'web-streams-polyfill';

if (typeof globalThis.ReadableStream === 'undefined') {
  // @ts-ignore
  globalThis.ReadableStream = require('web-streams-polyfill').ReadableStream;
}
if (typeof globalThis.WritableStream === 'undefined') {
  // @ts-ignore
  globalThis.WritableStream = require('web-streams-polyfill').WritableStream;
}
if (typeof globalThis.TransformStream === 'undefined') {
  // @ts-ignore
  globalThis.TransformStream = require('web-streams-polyfill').TransformStream;
}
if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = require('web-streams-polyfill').TextEncoder;
}
if (typeof globalThis.TextDecoder === 'undefined') {
  globalThis.TextDecoder = require('web-streams-polyfill').TextDecoder;
}

console.log('✅ Stream polyfill đã được áp dụng');