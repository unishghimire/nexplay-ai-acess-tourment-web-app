import fs from 'fs';
import path from 'path';

function exportVercelEnv() {
  const saPath = path.join(process.cwd(), 'service-account.json');
  let singleLineJson = '';
  let base64Json = '';

  if (fs.existsSync(saPath)) {
    const raw = fs.readFileSync(saPath, 'utf8');
    const parsed = JSON.parse(raw);
    singleLineJson = JSON.stringify(parsed);
    base64Json = Buffer.from(singleLineJson).toString('base64');
  }

  const envLines = [
    `# =======================================================`,
    `# VERCEL PRODUCTION ENVIRONMENT VARIABLES`,
    `# Project: nexplay-ai-acess-tourment-web-app`,
    `# Domain: https://www.nexplayorg.app`,
    `# =======================================================`,
    ``,
    `NODE_ENV=production`,
    `FRONTEND_URL=https://www.nexplayorg.app`,
    `FIREBASE_PROJECT_ID=nexplayorg-app`,
    `FIREBASE_STORAGE_BUCKET=nexplayorg-app.firebasestorage.app`,
    `IMGBB_API_KEY=0d2e0f9e1bb3f4d0e32ff75d14c11d48`,
    `VITE_IMGBB_API_KEY=0d2e0f9e1bb3f4d0e32ff75d14c11d48`,
    `SEED_GAME_KEY=nexplay-seed-2026-secure`,
    `ADMIN_BOOTSTRAP_KEY=nexplay-admin-bootstrap-2026`,
    ``,
    `# Option 1: Base64 Service Account (Recommended for Vercel)`,
    `FIREBASE_SERVICE_ACCOUNT=${base64Json}`,
  ];

  const envContent = envLines.join('\n');
  fs.writeFileSync('.env.production', envContent);
  console.log('✅ Generated .env.production with all production credentials!');
  console.log('\n--- VERCEL ENVIRONMENT VARIABLES LIST ---');
  console.log('1. FIREBASE_PROJECT_ID=nexplayorg-app');
  console.log('2. FIREBASE_STORAGE_BUCKET=nexplayorg-app.firebasestorage.app');
  console.log('3. FIREBASE_SERVICE_ACCOUNT=(Base64 string from .env.production)');
  console.log('4. IMGBB_API_KEY=0d2e0f9e1bb3f4d0e32ff75d14c11d48');
  console.log('5. VITE_IMGBB_API_KEY=0d2e0f9e1bb3f4d0e32ff75d14c11d48');
  console.log('6. FRONTEND_URL=https://www.nexplayorg.app');
  console.log('7. NODE_ENV=production');
  console.log('8. SEED_GAME_KEY=nexplay-seed-2026-secure');
  console.log('9. ADMIN_BOOTSTRAP_KEY=nexplay-admin-bootstrap-2026');
}

exportVercelEnv();
