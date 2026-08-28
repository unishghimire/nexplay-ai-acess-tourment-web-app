/**
 * VERCEL BACKEND API LIVE PRODUCTION VERIFICATION
 * Target: https://www.nexplayorg.app
 */

const BASE = 'https://www.nexplayorg.app';

interface ApiCheck {
  name: string;
  endpoint: string;
  method: 'GET' | 'POST';
  expectedStatus: number[];
  body?: any;
}

const CHECKS: ApiCheck[] = [
  {
    name: 'Vercel API Gateway Engine',
    endpoint: '/api',
    method: 'GET',
    expectedStatus: [200],
  },
  {
    name: 'Backend System & Configuration Health Check',
    endpoint: '/api/health',
    method: 'GET',
    expectedStatus: [200, 503],
  },
  {
    name: 'Dynamic SEO Sitemap Generation',
    endpoint: '/sitemap.xml',
    method: 'GET',
    expectedStatus: [200],
  },
  {
    name: 'Public Scrims Query API',
    endpoint: '/api/scrims',
    method: 'GET',
    expectedStatus: [200],
  },
  {
    name: 'Public Teams Query API',
    endpoint: '/api/teams',
    method: 'GET',
    expectedStatus: [200],
  },
  {
    name: 'Auth Guard: Tournament Group Generation API',
    endpoint: '/api/tournaments/test_tourney/groups/generate',
    method: 'POST',
    body: { teamsPerGroup: 12 },
    expectedStatus: [401, 403],
  },
  {
    name: 'Auth Guard: Tournament Activation API',
    endpoint: '/api/tournaments/test_tourney/activate',
    method: 'POST',
    expectedStatus: [401, 403],
  },
  {
    name: 'Auth Guard: Tournament Funding API',
    endpoint: '/api/tournaments/test_tourney/fund',
    method: 'POST',
    expectedStatus: [401, 403],
  },
  {
    name: 'Auth Guard: Tournament Deletion API',
    endpoint: '/api/tournaments/test_tourney',
    method: 'POST', // Note: using POST/GET against delete or test method
    expectedStatus: [401, 403, 404, 405],
  },
  {
    name: 'Auth Guard: Tournament Join Registration API',
    endpoint: '/api/wallet/join-tournament',
    method: 'POST',
    body: { tournamentId: 'test_id', teamId: 'test_team' },
    expectedStatus: [401, 403],
  },
  {
    name: 'Auth Guard: Tournament Prize Distribution API',
    endpoint: '/api/wallet/distribute-prizes',
    method: 'POST',
    body: { tournamentId: 'test_id' },
    expectedStatus: [401, 403],
  },
  {
    name: 'Auth Guard: Scrim Creation API',
    endpoint: '/api/scrims',
    method: 'POST',
    body: { title: 'Test Scrim' },
    expectedStatus: [401, 403],
  },
  {
    name: 'Auth Guard: Scrim Slot Reservation API',
    endpoint: '/api/scrims/test_scrim/join',
    method: 'POST',
    body: { slotNumber: 1 },
    expectedStatus: [401, 403],
  },
  {
    name: 'Auth Guard: Dispute Filing API',
    endpoint: '/api/disputes',
    method: 'POST',
    body: { tournamentId: 'test_id', reason: 'Unfair match play' },
    expectedStatus: [401, 403],
  },
  {
    name: 'Auth Guard: Wallet Deposit Request API',
    endpoint: '/api/wallet/deposit',
    method: 'POST',
    body: { amount: 100 },
    expectedStatus: [401, 403],
  },
  {
    name: 'Auth Guard: Admin Transaction Approval API',
    endpoint: '/api/admin/transactions/approve',
    method: 'POST',
    body: { transactionId: 'test_tx' },
    expectedStatus: [401, 403],
  },
  {
    name: 'Auth Guard: Admin Balance Adjustment API',
    endpoint: '/api/admin/balance/adjust',
    method: 'POST',
    body: { userId: 'test_user', amount: 50, type: 'add' },
    expectedStatus: [401, 403],
  },
  {
    name: 'Auth Guard: Media Image Upload API',
    endpoint: '/api/upload-image',
    method: 'POST',
    expectedStatus: [401, 403],
  },
  {
    name: 'Auth Guard: AI Banner Generator API',
    endpoint: '/api/generate-banner',
    method: 'POST',
    body: { prompt: 'Epic Free Fire tournament banner' },
    expectedStatus: [401, 403],
  },
  {
    name: 'Security Guard: IndexNow SEO API (Admin Only)',
    endpoint: '/api/indexnow',
    method: 'POST',
    body: { url: 'https://nexplayorg.app' },
    expectedStatus: [401, 403],
  },
  {
    name: 'Security Guard: Admin Bootstrap Endpoint',
    endpoint: '/api/admin/bootstrap',
    method: 'POST',
    body: { email: 'test@example.com', key: 'invalid' },
    expectedStatus: [403, 503],
  },
  {
    name: 'Security Guard: Seed Game Endpoint',
    endpoint: '/api/admin/seed-game',
    method: 'POST',
    body: { name: 'Free Fire', secretKey: 'invalid' },
    expectedStatus: [403, 503],
  },
];

async function runLiveBackendCheck() {
  console.log('========================================================================');
  console.log('🌐 VERCEL PRODUCTION BACKEND & SERVERLESS API VERIFICATION 🌐');
  console.log(`Target: ${BASE}`);
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  for (const check of CHECKS) {
    try {
      const url = `${BASE}${check.endpoint}`;
      const options: RequestInit = {
        method: check.method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'NexPlay-Backend-Audit-Bot/1.0',
        },
      };

      if (check.body) {
        options.body = JSON.stringify(check.body);
      }

      const res = await fetch(url, options);
      const isExpected = check.expectedStatus.includes(res.status);

      let data: any = null;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        try {
          data = await res.json();
        } catch {}
      } else {
        try {
          const text = await res.text();
          data = text.slice(0, 150);
        } catch {}
      }

      if (isExpected) {
        console.log(`✅ PASS: [${check.method}] ${check.endpoint}`);
        console.log(`   -> Name: ${check.name}`);
        console.log(`   -> HTTP Status: ${res.status}`);
        if (data) console.log(`   -> Response:`, typeof data === 'object' ? JSON.stringify(data) : data.slice(0, 80));
        passed++;
      } else {
        console.error(`❌ FAIL: [${check.method}] ${check.endpoint}`);
        console.error(`   -> Name: ${check.name}`);
        console.error(`   -> Expected status ${check.expectedStatus.join('/')}, got ${res.status}`);
        if (data) console.error(`   -> Response:`, data);
        failed++;
      }
    } catch (e: any) {
      console.error(`❌ ERROR: [${check.method}] ${check.endpoint} failed with network error:`, e.message);
      failed++;
    }
    console.log('────────────────────────────────────────────────────────────────────────');
  }

  console.log(`\n========================================================================`);
  console.log(`📊 BACKEND VERIFICATION COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runLiveBackendCheck();
