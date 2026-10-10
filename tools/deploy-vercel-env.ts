import fs from 'fs';
import path from 'path';

const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const PROJECT_ID = process.env.VERCEL_PROJECT_ID || 'prj_ufG1YSkYxGPFF3ObFCXkpe3fOjmY';
// SSRF guard: this ops tool only ever talks to the Vercel API — every request
// is built against this fixed base URL via the Vercel API helper below.
const VERCEL_API_BASE = 'https://api.vercel.com';

interface VercelResponse { status: number; data: any }

function vercelApi(pathname: string, method: string, body?: string): Promise<VercelResponse> {
  const url = new URL(pathname, VERCEL_API_BASE);
  if (url.origin !== VERCEL_API_BASE) {
    return Promise.reject(new Error('Blocked non-Vercel API URL: ' + url.origin));
  }
  return fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${VERCEL_TOKEN}`,
      ...(body ? { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(body)) } : {}),
    },
    body,
  }).then(async (res) => {
    const raw = await res.text();
    let data: any = raw;
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      // non-JSON body — return as-is
    }
    return { status: res.status, data } as VercelResponse;
  });
}

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
  const existingRes = await vercelApi(`/v9/projects/${PROJECT_ID}/env`, 'GET');

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
      await vercelApi(`/v9/projects/${PROJECT_ID}/env/${match.id}`, 'DELETE');
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

    const res = await vercelApi(`/v10/projects/${PROJECT_ID}/env`, 'POST', body);

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
