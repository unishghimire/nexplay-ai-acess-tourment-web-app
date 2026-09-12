import { db } from '../server/shared.js';

async function runSegregation() {
  console.log('=== STARTING FIRESTORE DATA SEGREGATION AUDIT & CLEANUP (ADMIN SDK) ===');

  const tSnap = await db.collection('tournaments').get();
  const sSnap = await db.collection('scrims').get();

  console.log(`Initial: ${tSnap.size} tournament docs, ${sSnap.size} scrim docs.`);

  // 1. Audit tournaments collection for scrim docs that need to be removed from tournaments
  for (const tDoc of tSnap.docs) {
    const data = tDoc.data();
    const isScrim = data.matchType === 'scrims' || data.isScrim === true;
    if (isScrim) {
      console.log(`[Tournaments -> Clean] Found scrim document in tournaments collection: ${tDoc.id} ("${data.title}")`);
      const existsInScrims = sSnap.docs.some(d => d.id === tDoc.id);
      if (existsInScrims) {
        console.log(`Document ${tDoc.id} exists in scrims collection. Deleting duplicate from tournaments collection...`);
        await db.collection('tournaments').doc(tDoc.id).delete();
        console.log(`✓ Removed duplicate ${tDoc.id} from tournaments.`);
      } else {
        console.warn(`Document ${tDoc.id} not in scrims! Please check manually before deleting.`);
      }
    }
  }

  // 2. Audit scrims collection for tournament docs that need to be removed from scrims
  for (const sDoc of sSnap.docs) {
    const data = sDoc.data();
    const isTournament = data.matchType === 'tournament' || data.isTournament === true || data.isScrim === false;
    if (isTournament) {
      console.log(`[Scrims -> Clean] Found tournament document in scrims collection: ${sDoc.id} ("${data.title}")`);
      const existsInTournaments = tSnap.docs.some(d => d.id === sDoc.id);
      if (existsInTournaments) {
        console.log(`Document ${sDoc.id} exists in tournaments collection. Deleting duplicate from scrims collection...`);
        await db.collection('scrims').doc(sDoc.id).delete();
        console.log(`✓ Removed duplicate ${sDoc.id} from scrims.`);
      } else {
        console.warn(`Document ${sDoc.id} not in tournaments! Please check manually before deleting.`);
      }
    }
  }

  // Final verification
  const finalTSnap = await db.collection('tournaments').get();
  const finalSSnap = await db.collection('scrims').get();

  console.log('\n=== FINAL SEGREGATION SUMMARY ===');
  console.log(`Tournaments collection count: ${finalTSnap.size}`);
  finalTSnap.docs.forEach(d => console.log(`  [Tournament] ${d.id}: "${d.data().title}" (matchType: ${d.data().matchType})`));

  console.log(`Scrims collection count: ${finalSSnap.size}`);
  finalSSnap.docs.forEach(d => console.log(`  [Scrim] ${d.id}: "${d.data().title}" (matchType: ${d.data().matchType})`));

  console.log('\n✓ Segregation cleanup completed successfully.');
}

runSegregation().then(() => process.exit(0)).catch(err => {
  console.error('Segregation error:', err);
  process.exit(1);
});
