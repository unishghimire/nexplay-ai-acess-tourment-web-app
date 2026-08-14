import assert from "node:assert/strict";
import { isNexplayUrl } from "./seo.js";

assert.equal(isNexplayUrl('https://www.nexplayorg.app/tournaments'), true);
assert.equal(isNexplayUrl('https://www.nexplayorg.app.evil.example/'), false);
assert.equal(isNexplayUrl('https://evil.example/?next=https://www.nexplayorg.app'), false);
assert.equal(isNexplayUrl('https://user:pass@www.nexplayorg.app/'), false);
assert.equal(isNexplayUrl('not a URL'), false);

console.log('SEO endpoint validation tests: 5 passed, 0 failed');
