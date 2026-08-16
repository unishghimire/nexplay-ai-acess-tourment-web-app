const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const saPath = path.join(__dirname, '..', 'service-account.json');
if (!fs.existsSync(saPath)) {
  console.error('❌ service-account.json not found');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(saPath, 'utf8'));

// Helper to base64url encode
function base64url(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

// Generate Google Access Token from Service Account
async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signInput = `${encodedHeader}.${encodedPayload}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signInput);
  const signature = signer.sign(serviceAccount.private_key, 'base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const jwt = `${signInput}.${signature}`;

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const data = await resp.json();
  if (!data.access_token) {
    throw new Error(`Failed to get OAuth token: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

async function deployIndexes() {
  try {
    const indexPath = path.join(__dirname, '..', 'firestore.indexes.json');
    const indexData = JSON.parse(fs.readFileSync(indexPath, 'utf8'));

    console.log(`🔑 Authenticating with Google Cloud for project: ${serviceAccount.project_id}...`);
    const token = await getAccessToken();

    const indexes = indexData.indexes || [];
    console.log(`📋 Found ${indexes.length} index definition(s) in firestore.indexes.json`);

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const idx of indexes) {
      const collectionId = idx.collectionGroup;
      const url = `https://firestore.googleapis.com/v1/projects/${serviceAccount.project_id}/databases/(default)/collectionGroups/${collectionId}/indexes`;

      const payload = {
        queryScope: idx.queryScope || 'COLLECTION',
        fields: idx.fields.map(f => ({
          fieldPath: f.fieldPath,
          order: f.order || 'ASCENDING',
        })),
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();

      if (res.ok) {
        created++;
        console.log(`✅ [${created}/${indexes.length}] Index created for collection '${collectionId}':`, idx.fields.map(f => `${f.fieldPath}:${f.order}`).join(', '));
      } else if (resData.error && resData.error.status === 'ALREADY_EXISTS') {
        skipped++;
        console.log(`ℹ️ [Skipped] Index already exists for '${collectionId}':`, idx.fields.map(f => `${f.fieldPath}:${f.order}`).join(', '));
      } else {
        errors++;
        console.warn(`⚠️ [Error] Failed to create index for '${collectionId}':`, resData.error?.message || JSON.stringify(resData));
      }
    }

    console.log(`\n🎉 Index deployment summary: ${created} created, ${skipped} already existed, ${errors} failed out of ${indexes.length} total.`);
  } catch (err) {
    console.error('❌ Deployment error:', err.message);
    process.exit(1);
  }
}

deployIndexes();
