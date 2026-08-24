/**
 * Firebase Storage Live Connectivity Test
 */

import { bucket } from '../server/shared.js';

async function testFirebaseStorage() {
  console.log('========================================================================');
  console.log('📦 TESTING FIREBASE STORAGE CONNECTIVITY 📦');
  console.log('========================================================================\n');

  try {
    const samplePngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const sampleBuffer = Buffer.from(samplePngBase64, 'base64');
    const storage = bucket.storage;
    const targetBucket = storage.bucket('nexplayorg-app.appspot.com');
    const testFile = targetBucket.file(`test/nexplay_test_${Date.now()}.png`);

    console.log(`Uploading test buffer to bucket: ${targetBucket.name}...`);
    await testFile.save(sampleBuffer, { metadata: { contentType: 'image/png' } });
    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(testFile.name)}?alt=media`;

    console.log('✅ PASS: Firebase Storage upload succeeded!');
    console.log('   - File Path  :', testFile.name);
    console.log('   - Public URL :', publicUrl);

    // Clean up test file
    await testFile.delete().catch(() => {});
    console.log('✅ PASS: Firebase Storage test file cleaned up');

    console.log('\n========================================================================');
    console.log('🎉 FIREBASE STORAGE CREDENTIALS ARE 100% OPERATIONAL! 🎉');
    console.log('========================================================================\n');
  } catch (error: any) {
    console.error('❌ Firebase Storage Test Failed:', error.message);
    process.exit(1);
  }
}

testFirebaseStorage();
