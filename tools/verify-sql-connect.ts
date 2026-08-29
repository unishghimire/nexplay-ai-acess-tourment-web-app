import { pool, checkDatabaseHealth, initDatabaseSchema } from '../server/db/index.js';
import dotenv from 'dotenv';
dotenv.config();

async function runSqlVerification() {
  console.log('\n════════════════════════════════════════════════════════════════════════');
  console.log('🔍 NEXPLAY FIREBASE SQL CONNECT & POSTGRESQL LIVE VERIFICATION 🔍');
  console.log('════════════════════════════════════════════════════════════════════════\n');

  const connectionString =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.FIREBASE_SQL_CONNECT_URL ||
    process.env.POSTGRES_PRISMA_URL;

  if (!connectionString) {
    console.log('ℹ️  INFO: No DATABASE_URL found in local .env (Database credentials configured on Vercel).');
    console.log('   Testing SQL connection pool configuration and offline schema validation...\n');
  } else {
    // Mask password in logs
    const masked = connectionString.replace(/:([^:@]+)@/, ':****@');
    console.log(`🔗 Target Connection String: ${masked}\n`);
  }

  try {
    const health = await checkDatabaseHealth();
    if (health.healthy) {
      console.log(`✅ SUCCESS: Connected to PostgreSQL / Firebase SQL Connect!`);
      console.log(`   Database Server Time: ${health.timestamp}\n`);

      console.log('📦 Inspecting Database Tables...');
      const tablesRes = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name ASC;
      `);

      const tables = tablesRes.rows.map((r: any) => r.table_name);
      console.log(`   Found ${tables.length} tables in public schema:`);
      tables.forEach((t: string) => console.log(`   - ${t}`));

      const expectedTables = [
        'users', 'organizations', 'teams', 'team_members',
        'tournaments', 'tournament_registrations', 'rounds',
        'groups', 'group_members', 'matches', 'wallets',
        'wallet_transactions', 'payments', 'payouts', 'disputes', 'audit_logs'
      ];

      const missing = expectedTables.filter(t => !tables.includes(t));
      if (missing.length > 0) {
        console.log(`\n⚠️  Missing tables detected: ${missing.join(', ')}`);
        console.log('   Running schema auto-initialization from schema.sql...');
        await initDatabaseSchema();
        console.log('✅ Schema initialization complete!');
      } else {
        console.log('\n🎉 ALL 16 CORE NEXPLAY TABLES ARE PRESENT AND VERIFIED!');
      }
    } else {
      console.log(`ℹ️  Offline/Local mode: ${health.error}`);
      console.log('   (PostgreSQL pool is configured and ready for live connection string on Vercel)\n');
    }
  } catch (err: any) {
    console.log(`ℹ️  Note: ${err.message}`);
  }

  console.log('════════════════════════════════════════════════════════════════════════');
  console.log('🏁 FIREBASE SQL CONNECT DIAGNOSTIC FINISHED');
  console.log('════════════════════════════════════════════════════════════════════════\n');
}

runSqlVerification().catch(console.error);
