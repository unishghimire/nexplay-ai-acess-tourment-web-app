// FILE_ID: tools/cleanup-legacy-data.ts
// MODULE: Database Sanitation & Production Compliance
// PURPOSE: Automated cleanup of legacy/demo test data, migration of old scrims to dedicated collection, and orphan data purge

import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp,
  getCountFromServer
} from 'firebase/firestore';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from '../src/shared/config/firebase';

interface CleanupReport {
  legacyScrimsMigrated: number;
  legacyScrimsRemovedFromTournaments: number;
  demoDocumentsDeleted: number;
  orphanParticipantsDeleted: number;
  orphanCredentialsDeleted: number;
  errors: string[];
}

export async function runProductionCleanup(execute = false): Promise<CleanupReport> {
  const report: CleanupReport = {
    legacyScrimsMigrated: 0,
    legacyScrimsRemovedFromTournaments: 0,
    demoDocumentsDeleted: 0,
    orphanParticipantsDeleted: 0,
    orphanCredentialsDeleted: 0,
    errors: [],
  };

  console.log(`\n======================================================`);
  console.log(`🚀 Starting Database Sanitation [Mode: ${execute ? 'EXECUTE (DESTRUCTIVE)' : 'DRY RUN (SAFE)'}]`);
  console.log(`======================================================\n`);

  // Optional authentication if ADMIN_EMAIL & ADMIN_PASSWORD set
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    try {
      console.log(`🔐 Authenticating as admin (${process.env.ADMIN_EMAIL})...`);
      await signInWithEmailAndPassword(auth, process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD);
      console.log(`✅ Admin authenticated successfully.`);
    } catch (authErr: any) {
      console.warn(`⚠️ Admin auth failed: ${authErr.message}`);
    }
  }

  try {
    // 1. Scan and Migrate Legacy Scrims from 'tournaments' to 'scrims'
    console.log(`🔍 [1/4] Scanning 'tournaments' for legacy scrim records...`);
    const tournamentsSnap = await getDocs(collection(db, 'tournaments'));
    const existingTournamentsIds = new Set<string>();

    for (const d of tournamentsSnap.docs) {
      const data = d.data();
      existingTournamentsIds.add(d.id);

      const isScrim =
        data.matchType === 'scrims' ||
        data.isScrim === true ||
        data.type === 'scrim' ||
        data.type === 'scrims' ||
        (data.title && typeof data.title === 'string' && data.title.toLowerCase().includes('scrim') && !data.isFeatured);

      if (isScrim) {
        report.legacyScrimsMigrated++;
        console.log(`  Found legacy scrim in tournaments: "${data.title || d.id}" (${d.id})`);

        if (execute) {
          // Copy to dedicated 'scrims' collection
          const scrimRef = doc(db, 'scrims', d.id);
          await setDoc(
            scrimRef,
            {
              ...data,
              id: d.id,
              matchType: 'scrims',
              isScrim: true,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );

          // Remove from 'tournaments' to ensure strict segregation
          await deleteDoc(doc(db, 'tournaments', d.id));
          report.legacyScrimsRemovedFromTournaments++;
        }
      }
    }

    // 2. Scan and Delete Demo / Test Data
    console.log(`\n🔍 [2/4] Scanning for demo/test entities (demo-*)...`);
    const collectionsToAudit = ['tournaments', 'scrims', 'slides', 'users', 'teams', 'disputes'];

    for (const colName of collectionsToAudit) {
      try {
        const snap = await getDocs(collection(db, colName));
        for (const d of snap.docs) {
          if (d.id.startsWith('demo-') || d.id.startsWith('test-')) {
            report.demoDocumentsDeleted++;
            console.log(`  Found demo entity in '${colName}': ${d.id}`);
            if (execute) {
              await deleteDoc(doc(db, colName, d.id));
            }
          }
        }
      } catch (colErr) {
        console.warn(`  Could not scan '${colName}' (may be empty or not yet indexed)`);
      }
    }

    // 3. Scan and Clean Orphan Participants
    console.log(`\n🔍 [3/4] Scanning for orphan participants...`);
    try {
      const participantsSnap = await getDocs(collection(db, 'participants'));
      for (const pDoc of participantsSnap.docs) {
        const pData = pDoc.data();
        if (!pData.tournamentId || !existingTournamentsIds.has(pData.tournamentId)) {
          report.orphanParticipantsDeleted++;
          console.log(`  Found orphan participant: ${pDoc.id} (Tournament ${pData.tournamentId || 'none'})`);
          if (execute) {
            await deleteDoc(doc(db, 'participants', pDoc.id));
          }
        }
      }
    } catch {
      console.warn(`  Could not scan 'participants' collection`);
    }

    // 4. Summarize Database State
    console.log(`\n📊 [4/4] Production Database Summary:`);
    const [finalTours, finalScrims, finalGames, finalUsers, finalTeams] = await Promise.all([
      getCountFromServer(collection(db, 'tournaments')).catch(() => ({ data: () => ({ count: 'N/A' }) })),
      getCountFromServer(collection(db, 'scrims')).catch(() => ({ data: () => ({ count: 'N/A' }) })),
      getCountFromServer(collection(db, 'games')).catch(() => ({ data: () => ({ count: 'N/A' }) })),
      getCountFromServer(collection(db, 'users')).catch(() => ({ data: () => ({ count: 'N/A' }) })),
      getCountFromServer(collection(db, 'teams')).catch(() => ({ data: () => ({ count: 'N/A' }) })),
    ]);

    console.log(`  - Tournaments (Clean): ${finalTours.data().count}`);
    console.log(`  - Scrims (Dedicated):  ${finalScrims.data().count}`);
    console.log(`  - Published Games:     ${finalGames.data().count}`);
    console.log(`  - Users:               ${finalUsers.data().count}`);
    console.log(`  - Teams:               ${finalTeams.data().count}`);

  } catch (err: any) {
    console.error(`❌ Cleanup audit encountered error:`, err);
    report.errors.push(err?.message || String(err));
  }

  console.log(`\n======================================================`);
  console.log(`📋 Cleanup Report Summary:`);
  console.log(`  - Legacy Scrims Migrated:         ${report.legacyScrimsMigrated}`);
  console.log(`  - Legacy Scrims Purged from Tour: ${report.legacyScrimsRemovedFromTournaments}`);
  console.log(`  - Demo / Test Entities Found:     ${report.demoDocumentsDeleted}`);
  console.log(`  - Orphan Participants Found:      ${report.orphanParticipantsDeleted}`);
  console.log(`  - Errors:                         ${report.errors.length}`);
  console.log(`======================================================\n`);

  return report;
}

// Allow CLI invocation
const isExecute = process.argv.includes('--execute') || process.argv.includes('--clean');
runProductionCleanup(isExecute)
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
