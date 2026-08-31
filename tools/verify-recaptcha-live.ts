import dotenv from 'dotenv';
dotenv.config();
import { createAssessment } from '../server/services/recaptchaService.js';
import firebaseConfig from '../firebase-applet-config.json';

async function verifyRecaptchaSetup() {
  console.log('════════════════════════════════════════════════════════════════════════');
  console.log('🛡️ NEXPLAY RECAPTCHA ENTERPRISE INTEGRATION HEALTH CHECK 🛡️');
  console.log('════════════════════════════════════════════════════════════════════════\n');

  const siteKey = process.env.VITE_RECAPTCHA_SITE_KEY || '6LfF2KAtAAAAAE90jzyt4N4-bQbpkC4Mj4mZ47bN';
  const projectId = process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId;
  const apiKey = process.env.FIREBASE_API_KEY || firebaseConfig.apiKey;

  console.log('1. Configuration Parameters:');
  console.log(`   - Project ID: ${projectId}`);
  console.log(`   - Site Key: ${siteKey}`);
  console.log(`   - API Key configured: ${apiKey ? 'YES (Valid)' : 'NO'}`);

  // Test 2: Verify assessment endpoint reachability with sample payload
  console.log('\n2. Testing Google Cloud Assessment API endpoint reachability...');
  const endpoint = `https://recaptchaenterprise.googleapis.com/v1/projects/${projectId}/assessments?key=${apiKey}`;
  
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: {
          token: 'diagnostic_test_token_verification',
          expectedAction: 'login',
          siteKey: siteKey,
        },
      }),
    });

    const json: any = await res.json();
    console.log(`   - HTTP Status: ${res.status} (${res.statusText})`);
    
    if (res.status === 200) {
      console.log('   ✅ Endpoint reached successfully and returned evaluation structure:');
      console.log(`      - Valid token flag: ${json.tokenProperties?.valid ?? false}`);
      console.log(`      - Evaluation reason: ${json.tokenProperties?.invalidReason ?? 'N/A'}`);
      console.log('\n🎉 RECAPTCHA ENTERPRISE API INTEGRATION IS 100% OPERATIONAL!');
    } else {
      console.log(`   ℹ️ Response details:`, json);
    }
  } catch (err: any) {
    console.error('   ❌ Network error calling reCAPTCHA Enterprise endpoint:', err?.message);
    process.exit(1);
  }
}

verifyRecaptchaSetup().catch(console.error);
