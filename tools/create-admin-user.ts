import { admin, db } from '../server/shared.js';

async function createAdminUser() {
  const email = process.env.ADMIN_EMAIL || 'admin@nexplay.gg';
  const password = process.env.ADMIN_PASSWORD;

  if (!password) {
    console.error('❌ ADMIN_PASSWORD environment variable is required to create/update the admin user.');
    process.exit(1);
  }

  const username = process.env.ADMIN_USERNAME || 'AdminNexPlay';
  const inGameName = 'NexAdmin';
  const inGameId = '999888777';
  const phone = '9800000000';

  console.log(`Setting up Admin user: ${email}...`);

  let userRecord;
  try {
    userRecord = await admin.auth().getUserByEmail(email);
    console.log(`User already exists in Firebase Auth with UID: ${userRecord.uid}. Updating password & claims...`);
    await admin.auth().updateUser(userRecord.uid, {
      password,
      displayName: username,
    });
  } catch (err: any) {
    if (err.code === 'auth/user-not-found') {
      console.log(`Creating new user in Firebase Auth...`);
      userRecord = await admin.auth().createUser({
        email,
        password,
        displayName: username,
        emailVerified: true,
      });
      console.log(`Created user with UID: ${userRecord.uid}`);
    } else {
      throw err;
    }
  }

  const uid = userRecord.uid;

  // Set Custom Claims for Admin Role
  await admin.auth().setCustomUserClaims(uid, { role: 'admin' });
  console.log(`Set custom claim: role='admin' for UID: ${uid}`);

  // Create or Update /users document with clean zero balance
  const userDocRef = db.collection('users').doc(uid);
  await userDocRef.set({
    uid,
    email,
    username,
    inGameName,
    inGameId,
    phone,
    role: 'admin',
    balance: 0,
    orgWalletBalance: 0,
    reservedBalance: 0,
    status: 'online',
    isBanned: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }, { merge: true });

  // Create or Update /users_public document
  const userPublicDocRef = db.collection('users_public').doc(uid);
  await userPublicDocRef.set({
    uid,
    username,
    inGameName,
    inGameId,
    role: 'admin',
  }, { merge: true });

  console.log(`\n========================================`);
  console.log(`ADMIN USER CONFIGURED SECURELY:`);
  console.log(`Email: ${email}`);
  console.log(`Role: admin`);
  console.log(`UID: ${uid}`);
  console.log(`========================================\n`);
}

createAdminUser()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error creating admin user:', err);
    process.exit(1);
  });

