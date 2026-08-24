/**
 * Live ImgBB API Key Verification Test
 */

import { uploadToImgBB, uploadBase64ToImgBB } from '../server/shared.js';

async function testImgBBUpload() {
  console.log('========================================================================');
  console.log('📸 TESTING IMGBB LIVE UPLOAD WITH PROVIDED API KEY 📸');
  console.log('========================================================================\n');

  // Small 1x1 transparent PNG buffer
  const samplePngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const sampleBuffer = Buffer.from(samplePngBase64, 'base64');

  try {
    console.log('1. Testing binary Buffer upload...');
    const result1 = await uploadToImgBB(sampleBuffer, 'nexplay_test.png');
    console.log('✅ PASS: ImgBB Buffer upload successful!');
    console.log('   - Image URL :', result1.url);
    console.log('   - Thumb URL :', result1.thumbUrl);
    console.log('   - Delete URL:', result1.deleteUrl);

    console.log('\n2. Testing Base64 Data URI upload...');
    const result2 = await uploadBase64ToImgBB(`data:image/png;base64,${samplePngBase64}`);
    console.log('✅ PASS: ImgBB Base64 upload successful!');
    console.log('   - Image URL :', result2.url);

    console.log('\n========================================================================');
    console.log('🎉 IMGBB API KEY IS 100% VALID AND FULLY FUNCTIONAL! 🎉');
    console.log('========================================================================\n');
  } catch (error: any) {
    console.error('❌ ImgBB Upload Failed:', error.message);
    process.exit(1);
  }
}

testImgBBUpload();
