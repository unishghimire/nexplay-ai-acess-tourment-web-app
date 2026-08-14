import { lookup as dnsLookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";

export const MAX_AUDIT_HTML_BYTES = 120_000;
const MAX_REDIRECTS = 3;
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_HEADER_BYTES = 16 * 1024;

type ResolvedAddress = { address: string; family: 4 | 6 };

type FetchResponse = {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: AsyncIterable<Uint8Array>;
};

type FetchDependencies = {
  resolve?: (hostname: string) => Promise<ResolvedAddress[]>;
  request?: (url: URL, address: ResolvedAddress) => Promise<FetchResponse>;
};

export class SafeUrlFetchError extends Error {
  constructor(message: string, readonly statusCode = 400) {
    super(message);
    this.name = "SafeUrlFetchError";
  }
}

function parseIpv4(address: string): number[] | null {
  if (isIP(address) !== 4) return null;
  return address.split(".").map(Number);
}

function classifyIpv4(address: string): string | null {
  const octets = parseIpv4(address);
  if (!octets) return "invalid IPv4 address";
  const [a, b] = octets;

  if (a === 0) return "unspecified IPv4 address";
  if (a === 10 || a === 127) return "private or loopback IPv4 address";
  if (a === 100 && b >= 64 && b <= 127) return "shared private IPv4 address";
  if (a === 169 && b === 254) return "link-local or cloud metadata IPv4 address";
  if (a === 172 && b >= 16 && b <= 31) return "private IPv4 address";
  if (a === 192 && b === 168) return "private IPv4 address";
  if (a === 192 && b === 0) return "reserved infrastructure IPv4 address";
  if (a === 192 && b === 2) return "documentation IPv4 address";
  if (a === 198 && (b === 18 || b === 19)) return "benchmark IPv4 address";
  if (a === 198 && b === 51) return "documentation IPv4 address";
  if (a === 203 && b === 0) return "documentation IPv4 address";
  if (a >= 224) return "multicast or reserved IPv4 address";
  if (address === "100.100.100.200") return "cloud metadata IPv4 address";
  return null;
}

function parseIpv6(address: string): number[] | null {
  if (isIP(address) !== 6) return null;
  const normalized = address.toLowerCase();
  const [head, tail = ""] = normalized.split("::");
  if (normalized.split("::").length > 2) return null;

  const toGroups = (part: string): string[] => part ? part.split(":") : [];
  const headGroups = toGroups(head);
  const tailGroups = toGroups(tail);
  const hasIpv4Tail = tailGroups.length > 0 && tailGroups[tailGroups.length - 1].includes(".");
  if (hasIpv4Tail) {
    const ipv4 = parseIpv4(tailGroups.pop()!);
    if (!ipv4) return null;
    tailGroups.push(((ipv4[0] << 8) | ipv4[1]).toString(16), ((ipv4[2] << 8) | ipv4[3]).toString(16));
  }

  const supplied = headGroups.length + tailGroups.length;
  if ((!normalized.includes("::") && supplied !== 8) || supplied > 8) return null;
  const groups = [
    ...headGroups,
    ...Array(Math.max(0, 8 - supplied)).fill("0"),
    ...tailGroups,
  ].map(group => Number.parseInt(group, 16));
  return groups.length === 8 && groups.every(group => Number.isInteger(group) && group >= 0 && group <= 0xffff)
    ? groups
    : null;
}

function classifyIpv6(address: string): string | null {
  const groups = parseIpv6(address);
  if (!groups) return "invalid IPv6 address";
  const [first, second] = groups;
  const allZero = groups.every(group => group === 0);
  const isV4Mapped = groups.slice(0, 5).every(group => group === 0) && groups[5] === 0xffff;
  const isV4Compatible = groups.slice(0, 6).every(group => group === 0);

  if (allZero) return "unspecified IPv6 address";
  if (groups.slice(0, 7).every(group => group === 0) && groups[7] === 1) return "loopback IPv6 address";
  if ((first & 0xff00) === 0xff00) return "multicast IPv6 address";
  if ((first & 0xffc0) === 0xfe80) return "link-local IPv6 address";
  if ((first & 0xfe00) === 0xfc00 || (first & 0xffc0) === 0xfec0) return "private IPv6 address";
  if (first === 0x2001 && second === 0x0db8) return "documentation IPv6 address";
  if (first === 0x2001 && second === 0) return "Teredo IPv6 address";

  if (isV4Mapped || isV4Compatible) {
    const mapped = `${groups[6] >> 8}.${groups[6] & 0xff}.${groups[7] >> 8}.${groups[7] & 0xff}`;
    return classifyIpv4(mapped);
  }

  return null;
}

export function classifyUnsafeAddress(address: string): string | null {
  const family = isIP(address);
  if (family === 4) return classifyIpv4(address);
  if (family === 6) return classifyIpv6(address);
  return "invalid IP address";
}

function parsePublicHttpUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new SafeUrlFetchError("Invalid URL format");
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new SafeUrlFetchError("Only HTTP and HTTPS URLs can be audited");
  }
  if (url.username || url.password) {
    throw new SafeUrlFetchError("URLs with credentials cannot be audited");
  }
  if (url.port && !((url.protocol === 'http:' && url.port === '80') || (url.protocol === 'https:' && url.port === '443'))) {
    throw new SafeUrlFetchError("Only standard HTTP and HTTPS ports can be audited");
  }
  return url;
}

async function resolvePublicAddress(hostname: string, resolve: NonNullable<FetchDependencies['resolve']>): Promise<ResolvedAddress> {
  const addresses = await resolve(hostname);
  if (addresses.length === 0) throw new SafeUrlFetchError("The hostname did not resolve to an address");

  for (const address of addresses) {
    const reason = classifyUnsafeAddress(address.address);
    if (reason) throw new SafeUrlFetchError(`The requested host resolves to a blocked ${reason}`);
  }
  return addresses[0];
}

async function defaultResolve(hostname: string): Promise<ResolvedAddress[]> {
  const addresses = await dnsLookup(hostname, { all: true, verbatim: true });
  return addresses
    .filter(address => address.family === 4 || address.family === 6)
    .map(address => ({ address: address.address, family: address.family as 4 | 6 }));
}

function readHeader(headers: FetchResponse['headers'], name: string): string | undefined {
  const value = headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

async function defaultRequest(url: URL, address: ResolvedAddress): Promise<FetchResponse> {
  const request = url.protocol === 'https:' ? httpsRequest : httpRequest;
  return new Promise((resolve, reject) => {
    const req = request({
      protocol: url.protocol,
      hostname: address.address,
      family: address.family,
      servername: url.hostname,
      port: url.port || undefined,
      path: `${url.pathname}${url.search}`,
      method: 'GET',
      agent: false,
      maxHeaderSize: MAX_HEADER_BYTES,
      headers: {
        Host: url.host,
        Accept: 'text/html,application/xhtml+xml;q=0.9',
        'User-Agent': 'NexPlay-Audit/1.0',
      },
    }, response => {
      resolve({
        statusCode: response.statusCode || 0,
        headers: response.headers,
        body: response,
      });
    });

    req.setTimeout(REQUEST_TIMEOUT_MS, () => req.destroy(new SafeUrlFetchError("The website request timed out")));
    req.once('error', error => reject(error));
    req.end();
  });
}

async function readHtml(response: FetchResponse): Promise<string> {
  const contentLength = Number(readHeader(response.headers, 'content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_AUDIT_HTML_BYTES) {
    throw new SafeUrlFetchError(`The website response exceeds the ${MAX_AUDIT_HTML_BYTES}-byte audit limit`, 413);
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  for await (const chunk of response.body) {
    total += chunk.byteLength;
    if (total > MAX_AUDIT_HTML_BYTES) {
      throw new SafeUrlFetchError(`The website response exceeds the ${MAX_AUDIT_HTML_BYTES}-byte audit limit`, 413);
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function fetchPublicHtml(value: string, dependencies: FetchDependencies = {}): Promise<{ html: string; url: string }> {
  const resolve = dependencies.resolve || defaultResolve;
  const request = dependencies.request || defaultRequest;
  let currentUrl = parsePublicHttpUrl(value);

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
    const address = await resolvePublicAddress(currentUrl.hostname, resolve);
    const response = await request(currentUrl, address);
    const location = readHeader(response.headers, 'location');

    if (response.statusCode >= 300 && response.statusCode < 400 && location) {
      if (redirectCount === MAX_REDIRECTS) throw new SafeUrlFetchError("The website redirected too many times");
      currentUrl = parsePublicHttpUrl(new URL(location, currentUrl).toString());
      continue;
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new SafeUrlFetchError(`Failed to fetch web page. HTTP status: ${response.statusCode}`);
    }
    return { html: await readHtml(response), url: currentUrl.toString() };
  }

  throw new SafeUrlFetchError("The website redirected too many times");
}
