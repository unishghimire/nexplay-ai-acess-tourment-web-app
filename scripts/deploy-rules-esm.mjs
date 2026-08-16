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
    const rulesSource = readFileSync(rulesPath, 'utf8');

    console.log(`Deploying firestore.rules to project: ${serviceAccount.project_id}...`);

    const securityRules = admin.securityRules();
    
    // createRulesetFromSource expects a RulesFile object directly
    const ruleset = await securityRules.createRulesetFromSource(rulesSource);

    console.log(`Created ruleset: ${ruleset.name}`);
    await securityRules.releaseFirestoreRuleset(ruleset.name);
    console.log(`✅ Successfully deployed Firestore rules to ${serviceAccount.project_id}!`);
  } catch (error) {
    console.error('❌ ERROR:', error.message || error);
    process.exit(1);
  }
}

deploy();
