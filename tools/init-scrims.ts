// FILE_ID: tools/init-scrims.ts
// PURPOSE: Initializes the 'scrims' collection in Firebase Firestore so it appears in the console

import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../src/shared/config/firebase';

async function initScrims() {
  console.log('Initializing "scrims" collection in Firestore...');
  
  const sampleScrim = {
    title: 'Free Fire Daily Practice Scrim #1',
    game: 'Free Fire',
    hostUid: 'nexplay-official',
    hostName: 'NexPlay Esports',
    format: 'Battle Royale',
    map: 'Bermuda',
    matchTime: Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000)),
    status: 'open',
    totalSlots: 12,
    filledSlots: 0,
    slots: Array.from({ length: 12 }, (_, i) => ({
      slotNumber: i + 1,
      teamName: null,
      teamId: null,
      status: 'open',
      reservedBy: null,
    })),
    requirements: {
      minTier: 'Bronze',
      discordRequired: false,
      entryFee: 0,
      teamSize: 4,
      platform: 'mobile',
    },
    prizePool: 1000,
    bannerUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    const docRef = await addDoc(collection(db, 'scrims'), sampleScrim);
    console.log(`✅ Success! Created first document in "scrims" collection with ID: ${docRef.id}`);
    console.log('👉 Refresh your Firebase Console: the "scrims" collection will now be visible!');
  } catch (err: any) {
    console.error('❌ Error writing to scrims collection:', err.message);
  }
}

initScrims()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
