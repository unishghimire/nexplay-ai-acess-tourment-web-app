import { db } from '../server/shared.js';

async function inspectUsers() {
  console.log('--- Inspecting Firestore Users Collection ---');
  const allUsersSnap = await db.collection('users').get();
  console.log(`Total users in /users collection: ${allUsersSnap.size}`);
  
  allUsersSnap.docs.forEach((doc, idx) => {
    const data = doc.data();
    console.log(`[User ${idx + 1}] ID: ${doc.id}`);
    console.log(`  username: ${data.username}`);
    console.log(`  email: ${data.email}`);
    console.log(`  role: ${data.role}`);
    console.log(`  createdAt: ${data.createdAt}`);
    console.log(`  joinedAt: ${data.joinedAt}`);
  });

  const queryWithOrderBy = await db.collection('users').orderBy('createdAt', 'desc').limit(50).get().catch(e => {
    console.error('Error with orderBy(createdAt):', e.message);
    return null;
  });

  if (queryWithOrderBy) {
    console.log(`Query with orderBy(createdAt) returned: ${queryWithOrderBy.size} users`);
  }
}

inspectUsers().catch(console.error);
