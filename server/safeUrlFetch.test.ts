import assert from "node:assert/strict";
import { MAX_AUDIT_HTML_BYTES, SafeUrlFetchError, classifyUnsafeAddress, fetchPublicHtml } from "./safeUrlFetch.js";

let passed = 0;
const test = async (name: string, run: () => void | Promise<void>) => {
  await run();
  passed++;
  console.log(`✓ ${name}`);
};

const publicResolver = async () => [{ address: '93.184.216.34', family: 4 as const }];
const textBody = async function* (value: string) { yield Buffer.from(value); };
const publicHtml = async () => ({ statusCode: 200, headers: {}, body: textBody('<html><title>Safe</title></html>') });

await test('permits a public hostname and connects through its validated address', async () => {
  const result = await fetchPublicHtml('https://example.com/', { resolve: publicResolver, request: publicHtml });
  assert.match(result.html, /Safe/);
});

for (const [name, address] of [
  ['localhost IPv4 loopback', '127.0.0.1'],
  ['IPv6 loopback', '::1'],
  ['RFC1918 address', '10.1.2.3'],
  ['link-local address', '169.254.10.20'],
  ['cloud metadata address', '100.100.100.200'],
  ['multicast address', '239.1.2.3'],
] as const) {
  await test(`blocks ${name}`, () => assert.ok(classifyUnsafeAddress(address)));
}

await test('rejects malformed URLs', async () => {
  await assert.rejects(fetchPublicHtml('not a url'), SafeUrlFetchError);
});

await test('rejects unsupported URL protocols', async () => {
  await assert.rejects(fetchPublicHtml('file:///etc/passwd'), SafeUrlFetchError);
});

await test('validates every redirect target', async () => {
  let requests = 0;
  await assert.rejects(fetchPublicHtml('https://example.com/', {
    resolve: async hostname => hostname === 'internal.example'
      ? [{ address: '10.0.0.10', family: 4 }]
      : [{ address: '93.184.216.34', family: 4 }],
    request: async () => {
      requests++;
      return { statusCode: 302, headers: { location: 'https://internal.example/metadata' }, body: textBody('') };
    },
  }), SafeUrlFetchError);
  assert.equal(requests, 1);
});

await test('rejects oversized responses before sending them to AI', async () => {
  await assert.rejects(fetchPublicHtml('https://example.com/', {
    resolve: publicResolver,
    request: async () => ({ statusCode: 200, headers: { 'content-length': String(MAX_AUDIT_HTML_BYTES + 1) }, body: textBody('') }),
  }), (error: unknown) => error instanceof SafeUrlFetchError && error.statusCode === 413);
});

await test('propagates request timeout failures', async () => {
  await assert.rejects(fetchPublicHtml('https://example.com/', {
    resolve: publicResolver,
    request: async () => { throw new SafeUrlFetchError('The website request timed out'); },
  }), /timed out/);
});

console.log(`Safe URL fetch tests: ${passed} passed, 0 failed`);
