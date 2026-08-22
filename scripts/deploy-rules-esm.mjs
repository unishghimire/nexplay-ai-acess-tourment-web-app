import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const require = createRequire(import.meta.url);
const admin = require('firebase-admin');

const saPath = join(__dirname, '..', 'service-account.json');
const serviceAccount = JSON.parse(readFileSync(saPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
});

async function deploy() {
  try {
    const rulesPath = join(__dirname, '..', 'firestore.rules');
    // Normalize line endings to LF (Firebase REST API is picky about CRLF)
    const rulesSource = readFileSync(rulesPath, 'utf8').replace(/\r\n/g, '\n');

    console.log(`Deploying firestore.rules (${rulesSource.length} bytes) to: ${serviceAccount.project_id}...`);

    const securityRules = admin.securityRules();

    // Correct API: createRuleset takes a single RulesFile object {name, content}
    const ruleset = await securityRules.createRuleset({
      name: 'firestore.rules',
      content: rulesSource
    });

    console.log(`Created ruleset: ${ruleset.name}`);

    // Release the ruleset to Firestore
    await securityRules.releaseFirestoreRuleset(ruleset);
    console.log(`✅ Successfully deployed Firestore rules to ${serviceAccount.project_id}!`);
  } catch (error) {
    console.error('❌ ERROR:', error.message || error);
    if (error.errorInfo) console.error('Firebase error info:', JSON.stringify(error.errorInfo));
    process.exit(1);
  }
}

deploy();
