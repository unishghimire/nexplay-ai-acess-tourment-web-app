import fs from 'fs';
import path from 'path';
import https from 'https';

const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const PROJECT_ID = process.env.VERCEL_PROJECT_ID || 'prj_ufG1YSkYxGPFF3ObFCXkpe3fOjmY';

if (!VERCEL_TOKEN) {
  console.error('❌ VERCEL_TOKEN environment variable is required.');
  process.exit(1);
}

interface EnvVar {
  key: string;
  value: string;
  type: 'encrypted' | 'plain';
  target: ('production' | 'preview' | 'development')[];
}

function httpsRequest(options: https.RequestOptions, body?: string): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => (raw += chunk));
      res.on('end', () => {
        try {
          const parsed = raw ? JSON.parse(raw) : {};
          resolve({ status: res.statusCode || 0, data: parsed });
        } catch {
          resolve({ status: res.statusCode || 0, data: raw });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  console.log(`🚀 Starting Vercel Environment Variables Push for Project: ${PROJECT_ID}...`);

  // 1. Read Service Account
  const saPath = path.join(process.cwd(), 'service-account.json');
  if (!fs.existsSync(saPath)) {
    throw new Error('service-account.json not found in root directory!');
  }
  const saRaw = fs.readFileSync(saPath, 'utf8');
  const saSingleLine = JSON.stringify(JSON.parse(saRaw));
  const saBase64 = Buffer.from(saSingleLine).toString('base64');

  // 2. Fetch existing env vars to delete/overwrite cleanly
  const existingRes = await httpsRequest({
    hostname: 'api.vercel.com',
    path: `/v9/projects/${PROJECT_ID}/env`,
    method: 'GET',
    headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
  });

  const existingEnvs: any[] = existingRes.data?.envs || [];
  console.log(`📋 Found ${existingEnvs.length} existing environment variables.`);

  // 3. Define target variables
  const targetEnvs: EnvVar[] = [
    {
      key: 'NODE_ENV',
      value: 'production',
      type: 'plain',
      target: ['production', 'preview'],
    },
    {
      key: 'FRONTEND_URL',
      value: 'https://www.nexplayorg.app',
      type: 'plain',
      target: ['production', 'preview'],
    },
    {
      key: 'FIREBASE_PROJECT_ID',
      value: 'nexplayorg-app',
      type: 'plain',
      target: ['production', 'preview', 'development'],
    },
    {
      key: 'FIREBASE_STORAGE_BUCKET',
      value: 'nexplayorg-app.firebasestorage.app',
      type: 'plain',
      target: ['production', 'preview', 'development'],
    },
    {
      key: 'IMGBB_API_KEY',
      value: '0d2e0f9e1bb3f4d0e32ff75d14c11d48',
      type: 'encrypted',
      target: ['production', 'preview', 'development'],
    },
    {
      key: 'VITE_IMGBB_API_KEY',
      value: '0d2e0f9e1bb3f4d0e32ff75d14c11d48',
      type: 'encrypted',
      target: ['production', 'preview', 'development'],
    },
    {
      key: 'SEED_GAME_KEY',
      value: 'nexplay-seed-2026-secure',
      type: 'encrypted',
      target: ['production', 'preview'],
    },
    {
      key: 'ADMIN_BOOTSTRAP_KEY',
      value: 'nexplay-admin-bootstrap-2026',
      type: 'encrypted',
      target: ['production', 'preview'],
    },
    {
      key: 'FIREBASE_SERVICE_ACCOUNT',
      value: saBase64,
      type: 'encrypted',
      target: ['production', 'preview'],
    },
  ];

  // 4. Delete existing duplicates first to ensure fresh targets
  for (const env of targetEnvs) {
    const matches = existingEnvs.filter((e) => e.key === env.key);
    for (const match of matches) {
      console.log(`  🗑️ Removing old entry for ${match.key} (ID: ${match.id})...`);
      await httpsRequest({
        hostname: 'api.vercel.com',
        path: `/v9/projects/${PROJECT_ID}/env/${match.id}`,
        method: 'DELETE',
        headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
      });
    }
  }

  // 5. Create new environment variables
  console.log(`\n📦 Pushing ${targetEnvs.length} environment variables to Vercel...`);
  for (const env of targetEnvs) {
    const body = JSON.stringify({
      key: env.key,
      value: env.value,
      type: env.type,
      target: env.target,
    });

    const res = await httpsRequest(
      {
        hostname: 'api.vercel.com',
        path: `/v10/projects/${PROJECT_ID}/env`,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${VERCEL_TOKEN}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      body
    );

    if (res.status === 200 || res.status === 201) {
      console.log(`  ✅ Successfully set: ${env.key} -> [${env.target.join(', ')}]`);
    } else {
      console.error(`  ❌ Failed to set ${env.key} (Status ${res.status}):`, res.data);
    }
  }

  console.log('\n======================================================');
  console.log('🎉 ALL PRODUCTION CREDENTIALS PUSHED TO VERCEL!');
  console.log('======================================================\n');
}

main().catch(console.error);
