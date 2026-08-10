/**
 * Migration script: Set Firebase Auth custom claims for all existing users.
 *
 * Reads the `users` collection from Firestore, maps each user's `role` field
 * to a custom claim via admin.auth().setCustomUserClaims(), and reports results.
 *
 * Usage:
 *   node scripts/migrate-custom-claims.js
 *
 * Requirements:
 *   - GOOGLE_APPLICATION_CREDENTIALS env var pointing to a service account JSON
 *   - Or run inside a environment with admin SDK already initialized
 */
import admin from "firebase-admin";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.join(process.cwd(), "firebase-applet-config.json");
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));

admin.initializeApp({
  projectId: firebaseConfig.projectId,
  storageBucket: firebaseConfig.storageBucket,
});

const db = admin.firestore();

async function migrate() {
  console.log("Starting custom claims migration...\n");

  const usersSnap = await db.collection("users").get();
  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (const doc of usersSnap.docs) {
    const userData = doc.data();
    const uid = userData.uid || doc.id;
    const role = userData.role || "player";

    // Validate role
    if (!["player", "organizer", "admin"].includes(role)) {
      console.log(`  SKIP ${uid}: invalid role "${role}"`);
      skipped++;
      continue;
    }

    try {
      await admin.auth().setCustomUserClaims(uid, { role });
      console.log(`  OK   ${uid}: role=${role}`);
      success++;
    } catch (err) {
      console.error(`  FAIL ${uid}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nMigration complete: ${success} ok, ${skipped} skipped, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

migrate().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
