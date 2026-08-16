const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const saPath = path.join(__dirname, '..', 'service-account.json');
const serviceAccount = JSON.parse(fs.readFileSync(saPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
});

async function deploy() {
  try {
    const rulesPath = path.join(__dirname, '..', 'firestore.rules');
    const rulesSource = fs.readFileSync(rulesPath, 'utf8');
    
    console.log(`Deploying firestore.rules to project: ${serviceAccount.project_id}...`);
    
    const securityRules = admin.securityRules();
    const ruleset = await securityRules.createRuleset({
      source: {
        files: [
          {
            name: 'firestore.rules',
            content: rulesSource
          }
        ]
      }
    });

    console.log(`Created ruleset: ${ruleset.name}`);
    await securityRules.releaseFirestoreRuleset(ruleset.name, serviceAccount.project_id);
    console.log(`✅ Successfully released security rules to project ${serviceAccount.project_id}!`);
  } catch (error) {
    console.error('ERROR_SUMMARY:', error.message);
    if (error.status) console.error('STATUS:', error.status);
    if (error.errorInfo) console.error('INFO:', error.errorInfo);
    process.exit(1);
  }
}

deploy();
