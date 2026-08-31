import { Router } from "express";
import { db, admin, authenticateToken, rateLimit } from "../shared.js";

const router = Router();

export type DiscordCategory = 
  | 'announcement'
  | 'registration'
  | 'group'
  | 'matchSchedule'
  | 'result'
  | 'champion';

export type DiscordAnnouncementType =
  // Tournaments
  | 'tournament_published'
  | 'tournament_registration'
  | 'group_published'
  | 'game_start'
  | 'game_time'
  | 'tournament_live'
  | 'tournament_result'
  | 'tournament_completed'
  | 'tournament_champion'
  // Scrims
  | 'scrim_published'
  | 'scrim_registration'
  | 'scrim_group'
  | 'scrim_game_start'
  | 'scrim_game_time'
  | 'scrim_live'
  | 'scrim_result'
  | 'scrim_completed'
  | 'scrim_champion';

const ANNOUNCEMENT_TYPES: readonly DiscordAnnouncementType[] = [
  'tournament_published', 'tournament_registration', 'group_published',
  'game_start', 'game_time', 'tournament_live', 'tournament_result',
  'tournament_completed', 'tournament_champion',
  'scrim_published', 'scrim_registration', 'scrim_group',
  'scrim_game_start', 'scrim_game_time', 'scrim_live', 'scrim_result',
  'scrim_completed', 'scrim_champion',
];

function getCategoryForType(type: DiscordAnnouncementType): DiscordCategory {
  switch (type) {
    case 'tournament_published':
    case 'scrim_published':
      return 'announcement';
    case 'tournament_registration':
    case 'scrim_registration':
      return 'registration';
    case 'group_published':
    case 'scrim_group':
      return 'group';
    case 'game_start':
    case 'game_time':
    case 'tournament_live':
    case 'scrim_game_start':
    case 'scrim_game_time':
    case 'scrim_live':
      return 'matchSchedule';
    case 'tournament_result':
    case 'scrim_result':
      return 'result';
    case 'tournament_completed':
    case 'tournament_champion':
    case 'scrim_completed':
    case 'scrim_champion':
      return 'champion';
    default:
      return 'announcement';
  }
}

function buildDiscordEmbed(type: DiscordAnnouncementType, data: Record<string, any>) {
  const colorMap: Record<DiscordAnnouncementType, number> = {
    tournament_published: 0x8b5cf6,
    tournament_registration: 0x3b82f6,
    group_published: 0xf59e0b,
    game_start: 0xec4899,
    game_time: 0x6366f1,
    tournament_live: 0xef4444,
    tournament_result: 0x10b981,
    tournament_completed: 0x10b981,
    tournament_champion: 0xfbbf24,

    scrim_published: 0x8b5cf6,
    scrim_registration: 0x3b82f6,
    scrim_group: 0xf59e0b,
    scrim_game_start: 0xec4899,
    scrim_game_time: 0x6366f1,
    scrim_live: 0xef4444,
    scrim_result: 0x10b981,
    scrim_completed: 0x10b981,
    scrim_champion: 0xfbbf24,
  };

  const tournyUrl = data.tournamentId ? `https://www.nexplayorg.app/tournaments/${data.tournamentId}` : 'https://www.nexplayorg.app';

  const embedMap: Record<DiscordAnnouncementType, object> = {
    // 1. Tournament Announcement
    tournament_published: {
      title: `🏆  New Tournament Announced — ${data.title}`,
      description: `A new official tournament is open on NexPlay!\n\n🎮  **Game:** ${data.game}\n👥  **Format:** ${data.teamType || 'Solo'}\n💰  **Prize Pool:** ${data.prizePool}\n🎫  **Entry Fee:** ${data.entryFee || 'FREE'}\n👤  **Total Slots:** ${data.slots}\n\n[🔗 View & Register Now](${tournyUrl})`,
      url: tournyUrl, color: colorMap.tournament_published,
      thumbnail: data.bannerUrl ? { url: data.bannerUrl } : undefined,
      footer: { text: 'NexPlay Esports • Tournament Announcement Channel' },
      timestamp: new Date().toISOString(),
    },
    // 2. Registration Announcement
    tournament_registration: {
      title: `📝  New Registration — ${data.title}`,
      description: `A team has registered for **${data.title}**!\n\n👤  **Team / Player:** ${data.teamName || data.username}\n📊  **Slots Occupied:** ${data.currentPlayers}/${data.slots}\n⏳  **Remaining Slots:** ${Math.max(0, (data.slots || 0) - (data.currentPlayers || 0))}`,
      url: tournyUrl, color: colorMap.tournament_registration,
      footer: { text: 'NexPlay Esports • Registration Updates' },
      timestamp: new Date().toISOString(),
    },
    // 3. Group Draw
    group_published: {
      title: `📋  Group Draw & Brackets Published — ${data.title}`,
      description: `The official groups and matches for **${data.title}** are ready!\n\n${Array.isArray(data.groups) ? data.groups.map((g: string) => `**${g}**`).join('\n') : 'Check full bracket online'}\n\n[🔗 View Groups & Lineups](${tournyUrl})`,
      url: tournyUrl, color: colorMap.group_published,
      footer: { text: 'NexPlay Esports • Group Stage Channel' },
      timestamp: new Date().toISOString(),
    },
    // 4. Match Schedule & Room Details
    game_time: {
      title: `⏰  Match Schedule Alert — ${data.title}`,
      description: `**${data.groupName || 'Upcoming Match'}** is scheduled to start soon!\n\n📅  **Start Time:** ${data.startTime || 'TBD'}\n⏳  **Time Remaining:** ${data.timeLeft || '30 minutes'}\n🗺️  **Map:** ${data.map || 'TBD'}`,
      url: tournyUrl, color: colorMap.game_time,
      footer: { text: 'NexPlay Esports • Match Schedule & Reminders' },
      timestamp: new Date().toISOString(),
    },
    game_start: {
      title: `⚔️  Match Starting Now — ${data.title}`,
      description: `**${data.groupName || 'Match'}** is starting now! Join room immediately.\n\n🗺️  **Map:** ${data.map || 'TBD'}\n🔑  **Room ID:** ${data.roomId || 'Check app credentials'}\n🔐  **Password:** ${data.roomPass || 'Check app credentials'}\n\n[🔗 Access Match Room](${tournyUrl})`,
      url: tournyUrl, color: colorMap.game_start,
      footer: { text: 'NexPlay Esports • Live Match Room Dispatch' },
      timestamp: new Date().toISOString(),
    },
    tournament_live: {
      title: `🔴  Tournament Live — ${data.title}`,
      description: `**${data.title}** is officially LIVE!\n\n🎮  **Game:** ${data.game}\n👥  **Participants:** ${data.currentPlayers}/${data.slots}\n\n[🔗 Follow Live Scoring](${tournyUrl})`,
      url: tournyUrl, color: colorMap.tournament_live,
      footer: { text: 'NexPlay Esports • Live Coverage' },
      timestamp: new Date().toISOString(),
    },
    // 5. Match Results
    tournament_result: {
      title: `📊  Match Results Updated — ${data.title}`,
      description: `Results have been submitted for **${data.groupName || 'Match'}**!\n\n${data.resultsSummary || 'Leaderboard standings updated.'}\n\n[🔗 Check Full Standings & Kills](${tournyUrl})`,
      url: tournyUrl, color: colorMap.tournament_result,
      footer: { text: 'NexPlay Esports • Results & Scoring Channel' },
      timestamp: new Date().toISOString(),
    },
    // 6. Champion Announcement
    tournament_completed: {
      title: `👑  GRAND CHAMPIONS CROWNED — ${data.title}`,
      description: `The tournament **${data.title}** has concluded!\n\n🏆  **Grand Champion:** **${data.winner || 'Team Winner'}**\n💰  **Total Prize Distributed:** ${data.prizePool || 'Rs. 0'}\n\nCongratulations to the winners! GG WP to all competitors. 🎮`,
      url: tournyUrl, color: colorMap.tournament_champion,
      thumbnail: data.bannerUrl ? { url: data.bannerUrl } : undefined,
      footer: { text: 'NexPlay Esports • Hall of Champions' },
      timestamp: new Date().toISOString(),
    },
    tournament_champion: {
      title: `👑  CHAMPION ANNOUNCEMENT — ${data.title}`,
      description: `🏆  **Congratulations to ${data.winner || 'Champion'}** for winning **${data.title}**!\n\n💰  **Prize Won:** ${data.prizeAmount || data.prizePool}\n\n[🔗 View Tournament Hall of Fame](${tournyUrl})`,
      url: tournyUrl, color: colorMap.tournament_champion,
      footer: { text: 'NexPlay Esports • Hall of Champions' },
      timestamp: new Date().toISOString(),
    },

    // ─── Scrims Formats ───
    scrim_published: {
      title: `🎯  New Scrim Open — ${data.title}`,
      description: `A new practice scrim lobby is open for booking!\n\n📅  **Time:** ${data.startTime || 'TBD'}\n🎮  **Game:** ${data.game}\n👥  **Format:** ${data.teamType || 'Open'}\n👤  **Slots Available:** ${data.slots} slots\n\n[🔗 Book Scrim Slot](${tournyUrl})`,
      url: tournyUrl, color: colorMap.scrim_published,
      footer: { text: 'NexPlay Esports • Scrims Announcement Channel' },
      timestamp: new Date().toISOString(),
    },
    scrim_registration: {
      title: `🎯  Scrim Slot Booked — ${data.title}`,
      description: `Slot booked for **${data.title}**!\n\n👥  **Team / Solo:** ${data.teamName || data.username}\n🔢  **Slot #:** ${data.slotNumber || 'Confirmed'}\n📊  **Lobby Status:** ${data.currentPlayers}/${data.slots} slots filled`,
      url: tournyUrl, color: colorMap.scrim_registration,
      footer: { text: 'NexPlay Esports • Scrim Registration Updates' },
      timestamp: new Date().toISOString(),
    },
    scrim_group: {
      title: `📋  Scrim Lobby Roster — ${data.title}`,
      description: `The slot allocation matrix for **${data.title}** is confirmed!\n\n${Array.isArray(data.slotsList) ? data.slotsList.join('\n') : 'Check lobby slot list'}\n\n[🔗 View Scrim Lobby](${tournyUrl})`,
      url: tournyUrl, color: colorMap.scrim_group,
      footer: { text: 'NexPlay Esports • Scrim Lobby & Groups' },
      timestamp: new Date().toISOString(),
    },
    scrim_game_start: {
      title: `⚔️  Scrim Starting Now — ${data.title}`,
      description: `Scrim match starting! Enter custom room:\n\n🔑  **Room ID:** ${data.roomId || 'Check app'}\n🔐  **Password:** ${data.roomPass || 'Check app'}\n🗺️  **Map:** ${data.map || 'Bermuda'}\n\n[🔗 Enter Scrim Room](${tournyUrl})`,
      url: tournyUrl, color: colorMap.scrim_game_start,
      footer: { text: 'NexPlay Esports • Scrim Match Schedule' },
      timestamp: new Date().toISOString(),
    },
    scrim_game_time: {
      title: `⏰  Scrim Match Reminder — ${data.title}`,
      description: `Scrim **${data.title}** starts in **${data.timeLeft || '15 minutes'}**!\n\n🗺️  **Map:** ${data.map || 'Bermuda'}\n📅  **Time:** ${data.startTime}`,
      url: tournyUrl, color: colorMap.scrim_game_time,
      footer: { text: 'NexPlay Esports • Scrim Match Schedule' },
      timestamp: new Date().toISOString(),
    },
    scrim_live: {
      title: `🔴  Scrim Match Live — ${data.title}`,
      description: `Scrim match **${data.title}** is now in progress!`,
      url: tournyUrl, color: colorMap.scrim_live,
      footer: { text: 'NexPlay Esports • Scrim Schedule & Live' },
      timestamp: new Date().toISOString(),
    },
    scrim_result: {
      title: `📊  Scrim Results — ${data.title}`,
      description: `Scrim results & per-kill stats uploaded for **${data.title}**!\n\n${data.resultsSummary || 'Leaderboard updated.'}\n\n[🔗 View Scrim Scorecard](${tournyUrl})`,
      url: tournyUrl, color: colorMap.scrim_result,
      footer: { text: 'NexPlay Esports • Scrim Results Channel' },
      timestamp: new Date().toISOString(),
    },
    scrim_completed: {
      title: `🏆  Scrim Concluded — ${data.title}`,
      description: `Scrim **${data.title}** ended!\n\n🥇  **Top Team / MVP:** **${data.winner || 'Top Performer'}**\n\nGG WP to all participating squads! 🎮`,
      url: tournyUrl, color: colorMap.scrim_champion,
      footer: { text: 'NexPlay Esports • Scrim Winners Channel' },
      timestamp: new Date().toISOString(),
    },
    scrim_champion: {
      title: `🏆  Scrim Champion Winner — ${data.title}`,
      description: `👑  Winner of **${data.title}**: **${data.winner || 'Top Performer'}**\n💰  **Reward:** ${data.prizeAmount || data.prizePool || 'MVP Reward'}`,
      url: tournyUrl, color: colorMap.scrim_champion,
      footer: { text: 'NexPlay Esports • Scrim Winners Channel' },
      timestamp: new Date().toISOString(),
    },
  };

  return embedMap[type] || null;
}

async function sendDiscordWebhook(webhookUrl: string, embed: object, content?: string): Promise<boolean> {
  try {
    const body: Record<string, any> = { embeds: [embed] };
    if (content) body.content = content;
    const response = await fetch(webhookUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      const text = await response.text();
      console.warn(`[Discord Webhook] Failed (${response.status}):`, text);
      return false;
    }
    return true;
  } catch (err: any) {
    console.warn('[Discord Webhook] Network error:', err.message);
    return false;
  }
}

async function resolveDiscordWebhook(
  channel: 'tournaments' | 'scrims',
  category: DiscordCategory
): Promise<{ url: string | null; enabled: boolean; category: DiscordCategory }> {
  try {
    const settingsSnap = await db.collection('settings').doc('site').get();
    if (settingsSnap.exists) {
      const data = settingsSnap.data();

      // Check master auto-announce toggle
      const autoAnnounceConfig = data?.discordWebhooks?.autoAnnounce;
      if (autoAnnounceConfig?.[channel] === false || data?.autoDiscordTournamentAnnouncements === false) {
        return { url: null, enabled: false, category };
      }

      // Check category-specific webhook
      const channelWebhooks = data?.discordWebhooks?.[channel];
      const categoryUrl = channelWebhooks?.[category]?.trim();
      if (categoryUrl && (categoryUrl.startsWith('https://discord.com/api/webhooks/') || categoryUrl.startsWith('https://discordapp.com/api/webhooks/'))) {
        return { url: categoryUrl, enabled: true, category };
      }

      // Fallback to channel announcement webhook
      const channelAnnounceUrl = channelWebhooks?.announcement?.trim();
      if (channelAnnounceUrl && (channelAnnounceUrl.startsWith('https://discord.com/api/webhooks/') || channelAnnounceUrl.startsWith('https://discordapp.com/api/webhooks/'))) {
        return { url: channelAnnounceUrl, enabled: true, category };
      }

      // Fallback to legacy single webhook field
      const legacyUrl = channel === 'tournaments' ? data?.discordWebhookTournaments?.trim() : data?.discordWebhookScrims?.trim();
      if (legacyUrl && (legacyUrl.startsWith('https://discord.com/api/webhooks/') || legacyUrl.startsWith('https://discordapp.com/api/webhooks/'))) {
        return { url: legacyUrl, enabled: true, category };
      }
    }
  } catch (err) {
    console.warn('[Discord Webhook] Failed to fetch settings/site:', err);
  }

  // Fallback to env variables
  const envUrl = channel === 'scrims' 
    ? (process.env.DISCORD_WEBHOOK_SCRIMS || process.env.DISCORD_WEBHOOK_TOURNAMENTS) 
    : process.env.DISCORD_WEBHOOK_TOURNAMENTS;

  return { url: envUrl || null, enabled: true, category };
}

// POST /api/discord/test — Platform Admin granular webhook test verification
router.post('/api/discord/test', authenticateToken, rateLimit(10, 5 * 60 * 1000), async (req: any, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required.' });
  }

  const { webhookUrl, channel = 'tournaments', category = 'announcement' } = req.body || {};
  const resolved = await resolveDiscordWebhook(channel, category);
  const targetUrl = webhookUrl?.trim() || resolved.url;

  if (!targetUrl) {
    return res.status(400).json({ 
      success: false, 
      message: `No Discord webhook URL configured for ${channel} [${category}].` 
    });
  }

  const categoryNames: Record<DiscordCategory, string> = {
    announcement: 'Tournament Announcement',
    registration: 'Registration Announcement',
    group: 'Group Draw & Brackets',
    matchSchedule: 'Match Schedule & Room Credentials',
    result: 'Match Results & Scorecards',
    champion: 'Grand Champion & Winner Announcement'
  };

  const testEmbed = {
    title: `🎮  NexPlay Discord Integration Connected — [${channel.toUpperCase()}]`,
    description: `This test message confirms that the **${categoryNames[category as DiscordCategory] || category}** webhook is successfully verified and active on NexPlay Esports!`,
    color: channel === 'tournaments' ? 0x8b5cf6 : 0xec4899,
    fields: [
      { name: 'Channel Scope', value: channel.toUpperCase(), inline: true },
      { name: 'Category Target', value: categoryNames[category as DiscordCategory] || category, inline: true },
      { name: 'Timestamp', value: new Date().toLocaleTimeString(), inline: true },
    ],
    footer: { text: 'NexPlay Esports Platform • Multi-Webhook Dispatch Active' },
    timestamp: new Date().toISOString(),
  };

  const sent = await sendDiscordWebhook(targetUrl, testEmbed);
  if (sent) {
    return res.json({ 
      success: true, 
      message: `Test ping delivered to Discord for ${categoryNames[category as DiscordCategory] || category}!` 
    });
  }
  return res.status(502).json({ 
    success: false, 
    message: `Delivery failed for ${categoryNames[category as DiscordCategory] || category}. Check webhook URL and permissions.` 
  });
});

// POST /api/discord/announce — Multi-channel / multi-category announcement dispatcher
router.post('/api/discord/announce', authenticateToken, rateLimit(30, 15 * 60 * 1000), async (req: any, res) => {
  try {
    const { type, data, channel = 'tournaments' } = req.body as {
      type: DiscordAnnouncementType;
      data: Record<string, any>;
      channel?: 'tournaments' | 'scrims';
    };

    if (req.user.role !== 'organizer' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only organizers and admins can send Discord announcements.' });
    }
    if (!type || !data) {
      return res.status(400).json({ success: false, message: 'type and data are required.' });
    }
    if (!ANNOUNCEMENT_TYPES.includes(type) ||
        typeof data !== 'object' || Array.isArray(data) || typeof data.tournamentId !== 'string' || data.tournamentId.length > 128) {
      return res.status(400).json({ success: false, message: 'Invalid announcement payload.' });
    }
    if (typeof data.title !== 'string' || data.title.length === 0 || data.title.length > 200) {
      return res.status(400).json({ success: false, message: 'data.title is required and must be a string (max 200 chars).' });
    }

    const tournament = await db.collection('tournaments').doc(data.tournamentId).get();
    if (!tournament.exists) return res.status(404).json({ success: false, message: 'Tournament or scrim not found.' });
    if (req.user.role !== 'admin' && tournament.data()?.hostUid !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'You can only announce your own tournaments.' });
    }

    const category = getCategoryForType(type);
    const resolvedWebhook = await resolveDiscordWebhook(channel, category);

    if (!resolvedWebhook.enabled) {
      return res.json({ success: true, message: 'Discord announcements are currently disabled in Admin Site Settings.' });
    }

    const webhookUrl = resolvedWebhook.url;
    if (!webhookUrl) {
      return res.status(503).json({ 
        success: false, 
        message: `Discord webhook for [${channel}] -> [${category}] is not configured. Add it in Admin Panel -> Settings.` 
      });
    }

    const embed = buildDiscordEmbed(type, data);
    if (!embed) return res.status(400).json({ success: false, message: `Unknown announcement type: ${type}` });

    const sent = await sendDiscordWebhook(webhookUrl, embed);
    if (sent) {
      try {
        await db.collection('discordLogs').add({
          type, 
          channel, 
          category,
          tournamentId: data.tournamentId || null,
          sentBy: req.user.userId, 
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (logErr) { console.warn('[Discord Log] Firestore log failed:', logErr); }
      return res.json({ success: true, message: `Announcement broadcasted to Discord [${category}]` });
    }
    return res.status(502).json({ success: false, message: 'Discord webhook delivery failed. Check webhook URL and permissions.' });
  } catch (error: any) {
    console.error('[Discord Announce] Unhandled error:', error);
    return res.status(500).json({ success: false, message: 'Failed to send Discord announcement.' });
  }
});

export default router;
