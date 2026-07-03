import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const configPath = path.join(rootDir, 'firebase-applet-config.json');
if (!fs.existsSync(configPath)) {
  throw new Error(`firebase-applet-config.json not found at ${configPath}`);
}

const rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as {
  projectId: string;
  storageBucket?: string;
  firestoreDatabaseId?: string;
};

const app = admin.apps.length
  ? admin.app()
  : admin.initializeApp({
      projectId: rawConfig.projectId,
      storageBucket: rawConfig.storageBucket,
    });

const db = getFirestore(app, rawConfig.firestoreDatabaseId);

const now = new Date();
const daysFromNow = (days: number) => admin.firestore.Timestamp.fromDate(new Date(now.getTime() + days * 24 * 60 * 60 * 1000));
const daysAgo = (days: number) => admin.firestore.Timestamp.fromDate(new Date(now.getTime() - days * 24 * 60 * 60 * 1000));

async function seedDemoData() {
  const hostUid = 'demo-organizer-001';

  const writes: Array<Promise<unknown>> = [];

  writes.push(
    db.collection('users').doc(hostUid).set(
      {
        uid: hostUid,
        username: 'Nexplay Demo Organizer',
        email: 'demo-organizer@nexplay.local',
        role: 'organizer',
        isOrganizer: true,
        isPowerOrganizer: true,
        balance: 0,
        totalEarnings: 0,
        xp: 2500,
        level: 6,
        inGameId: 'NP-DEMO-01',
        teamName: 'Nexplay Core',
        phone: '',
        isBanned: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
  );

  writes.push(
    db.collection('games').doc('free-fire').set(
      {
        name: 'Free Fire',
        logoUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=1200&auto=format&fit=crop',
        modes: ['Battle Royale', 'Clash Squad', 'Lone Wolf'],
        isPublished: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
  );

  writes.push(
    db.collection('games').doc('pubg-mobile').set(
      {
        name: 'PUBG Mobile',
        logoUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1200&auto=format&fit=crop',
        modes: ['Battle Royale', 'Team Deathmatch'],
        isPublished: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
  );

  writes.push(
    db.collection('slides').doc('demo-slide-1').set(
      {
        imageUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1600&auto=format&fit=crop',
        title: 'NexPlay Pro Circuit',
        description: 'Weekly organizer-hosted tournaments with automated group progression.',
        link: '/tournaments',
        buttonText: 'Join Now',
        isActive: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
  );

  writes.push(
    db.collection('tournaments').doc('demo-tournament-upcoming').set(
      {
        title: 'Demo Clash Open #1',
        game: 'Free Fire',
        bannerUrl: 'https://images.unsplash.com/photo-1534423861386-85a16f5d13fd?q=80&w=1600&auto=format&fit=crop',
        isFeatured: true,
        prizePool: 25000,
        currency: 'Rs.',
        entryFee: 0,
        slots: 64,
        currentPlayers: 12,
        type: 'Battle Royale',
        teamSize: 4,
        teamType: 'squad',
        map: 'Bermuda',
        startTime: daysFromNow(7),
        status: 'upcoming',
        stage: 'registration',
        format: 'single_elimination',
        hostUid,
        hostName: 'Nexplay Demo Organizer',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        roadmap: [
          {
            roundNumber: 1,
            stageName: 'Registration',
            status: 'current',
            description: 'Open slots for all teams',
            numGroups: 1,
            qualificationRule: 16,
            maps: ['Bermuda'],
            date: daysFromNow(1),
          },
          {
            roundNumber: 2,
            stageName: 'Qualifier',
            status: 'upcoming',
            description: 'Top teams qualify for finals',
            numGroups: 4,
            qualificationRule: 4,
            maps: ['Bermuda', 'Purgatory'],
            date: daysFromNow(6),
          },
          {
            roundNumber: 3,
            stageName: 'Finals',
            status: 'upcoming',
            description: 'Grand final showdown',
            numGroups: 1,
            qualificationRule: 1,
            maps: ['Kalahari'],
            date: daysFromNow(7),
          },
        ],
      },
      { merge: true }
    )
  );

  writes.push(
    db.collection('tournaments').doc('demo-tournament-completed').set(
      {
        title: 'Demo Masters Cup',
        game: 'PUBG Mobile',
        bannerUrl: 'https://images.unsplash.com/photo-1511884642898-4c92249e20b6?q=80&w=1600&auto=format&fit=crop',
        isFeatured: false,
        prizePool: 50000,
        currency: 'Rs.',
        entryFee: 500,
        slots: 32,
        currentPlayers: 32,
        type: 'Battle Royale',
        teamSize: 4,
        teamType: 'squad',
        map: 'Erangel',
        startTime: daysAgo(5),
        status: 'completed',
        stage: 'completed',
        format: 'single_elimination',
        hostUid,
        hostName: 'Nexplay Demo Organizer',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        winners: [
          { uid: 'winner-001', amount: 25000, rank: 1, username: 'Phoenix Squad' },
          { uid: 'winner-002', amount: 15000, rank: 2, username: 'Storm Unit' },
          { uid: 'winner-003', amount: 10000, rank: 3, username: 'Rogue Esports' },
        ],
        manualResults: [
          { id: 'mr-1', team: 'Phoenix Squad', rank: 1, score: 126, status: 'Winner', kills: 42 },
          { id: 'mr-2', team: 'Storm Unit', rank: 2, score: 111, status: 'Runner-up', kills: 37 },
          { id: 'mr-3', team: 'Rogue Esports', rank: 3, score: 98, status: 'Qualified', kills: 34 },
        ],
      },
      { merge: true }
    )
  );

  await Promise.all(writes);

  console.log('Demo seed completed. Collections updated: users, games, slides, tournaments');
  console.log('Seed IDs: free-fire, pubg-mobile, demo-slide-1, demo-tournament-upcoming, demo-tournament-completed');
}

seedDemoData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Demo seed failed:', error);
    process.exit(1);
  });
