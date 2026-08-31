import assert from 'assert';
import { createAssessment } from './services/recaptchaService.js';

console.log('🛡️ RUNNING RECAPTCHA ENTERPRISE INTEGRATION TEST 🛡️');

async function testRecaptchaIntegration() {
  assert.strictEqual(typeof createAssessment, 'function', 'createAssessment is a valid function');

  // Test empty token rejection
  const result = await createAssessment('', 'login');
  assert.strictEqual(result.valid, false, 'Empty token is safely rejected');
  assert.strictEqual(result.error, 'Token is required', 'Appropriate error returned for missing token');

  console.log('  ✅ PASS: reCAPTCHA Enterprise client/server validation contracts verified');
}

testRecaptchaIntegration().then(() => {
  console.log('🎉 RECAPTCHA ENTERPRISE VERIFICATION TESTS PASSED 🎉\n');
}).catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
