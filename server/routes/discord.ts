import { Router } from "express";
import { db, admin, authenticateToken, rateLimit } from "../shared.js";

const router = Router();
const ANNOUNCEMENT_TYPES: readonly DiscordAnnouncementType[] = [
  'tournament_published', 'tournament_live', 'tournament_completed',
  'group_published', 'game_start', 'game_time',
  'scrim_published', 'scrim_live', 'scrim_completed',
];

type DiscordAnnouncementType =
  | 'tournament_published' | 'tournament_live' | 'tournament_completed'
  | 'group_published' | 'game_start' | 'game_time'
  | 'scrim_published' | 'scrim_live' | 'scrim_completed';

function buildDiscordEmbed(type: DiscordAnnouncementType, data: Record<string, any>) {
  const colorMap: Record<DiscordAnnouncementType, number> = {
    tournament_published: 0x8b5cf6, tournament_live: 0xef4444, tournament_completed: 0x10b981,
    group_published: 0x3b82f6, game_start: 0xf59e0b, game_time: 0x6366f1,
    scrim_published: 0x8b5cf6, scrim_live: 0xef4444, scrim_completed: 0x10b981,
  };

  const tournyUrl = data.tournamentId ? `https://www.nexplayorg.app/details/${data.tournamentId}` : 'https://www.nexplayorg.app';

  const embedMap: Record<DiscordAnnouncementType, object> = {
    tournament_published: {
      title: `🏆  New Tournament — ${data.title}`,
      description: `A new tournament has been published!\n\n🎮  **Game:** ${data.game}\n👥  **Type:** ${data.teamType || 'Solo'}\n💰  **Prize Pool:** ${data.prizePool}\n🎫  **Entry Fee:** ${data.entryFee}\n👤  **Slots:** ${data.currentPlayers}/${data.slots}\n\n[Register Now](${tournyUrl})`,
      url: tournyUrl, color: colorMap.tournament_published,
      thumbnail: data.bannerUrl ? { url: data.bannerUrl } : undefined,
      footer: { text: 'Nexplay Esports • Register before slots fill up!' },
      timestamp: new Date().toISOString(),
    },
    tournament_live: {
      title: `🔴  LIVE — ${data.title}`,
      description: `The tournament is **now live**!\n\n🥇  **Total Participants:** ${data.currentPlayers}/${data.slots}`,
      url: tournyUrl, color: colorMap.tournament_live,
      footer: { text: 'Nexplay Esports • Tournament is in progress' },
      timestamp: new Date().toISOString(),
    },
    tournament_completed: {
      title: `✅  COMPLETED — ${data.title}`,
      description: `The tournament has ended!\n\n🥇  **Winner:** ${data.winner || 'To be announced'}\n💰  **Prize Pool Distributed:** ${data.prizePool}`,
      url: tournyUrl, color: colorMap.tournament_completed,
      footer: { text: 'Nexplay Esports • GG WP to all participants!' },
      timestamp: new Date().toISOString(),
    },
    group_published: {
      title: `📋  Group Draw — ${data.title}`,
      description: `The group draw for **${data.title}** has been published!\n\n${(data.groups as string[]).map((g, i) => `**${g}**`).join('\n')}\n\nCheck the full bracket on the Nexplay website.`,
      url: tournyUrl, color: colorMap.group_published,
      footer: { text: 'Nexplay Esports • Check your group and prepare!' },
      timestamp: new Date().toISOString(),
    },
    game_start: {
      title: `⚔️  Match Starting — ${data.title}`,
      description: `**${data.groupName || 'Match'}** is starting now!\n\n🗺️  **Map:** ${data.map || 'TBD'}\n🔑  **Room ID:** ${data.roomId || 'Check the app'}\n🔐  **Password:** ${data.roomPass || 'Check the app'}\n\nGood luck to all participants! 🎮`,
      url: tournyUrl, color: colorMap.game_start,
      footer: { text: 'Nexplay Esports • Join the room NOW!' },
      timestamp: new Date().toISOString(),
    },
    game_time: {
      title: `⏰  Match Reminder — ${data.title}`,
      description: `**${data.groupName || 'Your match'}** starts in **${data.timeLeft || '30 minutes'}**!\n\n🗺️  **Map:** ${data.map || 'TBD'}\n📅  **Scheduled:** ${data.startTime}`,
      url: tournyUrl, color: colorMap.game_time,
      footer: { text: 'Nexplay Esports • Be ready on time!' },
      timestamp: new Date().toISOString(),
    },
    scrim_published: {
      title: `🎯  New Scrim — ${data.title}`,
      description: `A new scrim is open for registration!\n\n📅  **Time:** ${data.startTime}\n🎮  **Game:** ${data.game}\n👥  **Type:** ${data.teamType || 'Open'}\n\n💰  **Prize Pool:** ${data.prizePool}\n🎫  **Entry Fee:** ${data.entryFee}\n👤  **Slots:** ${data.currentPlayers}/${data.slots}`,
      url: tournyUrl, color: colorMap.scrim_published,
      thumbnail: data.bannerUrl ? { url: data.bannerUrl } : undefined,
      footer: { text: 'Nexplay Esports • Practice match — Join now!' },
      timestamp: new Date().toISOString(),
    },
    scrim_live: {
      title: `🔴  LIVE Scrim — ${data.title}`,
      description: `The scrim is **now live**!\n\n🏅  **Players:** ${data.currentPlayers}/${data.slots}`,
      url: tournyUrl, color: colorMap.scrim_live,
      footer: { text: 'Nexplay Esports • Scrim in progress' },
      timestamp: new Date().toISOString(),
    },
    scrim_completed: {
      title: `✅  Scrim Ended — ${data.title}`,
      description: `The scrim **${data.title}** has ended. GG WP! 🎮`,
      url: tournyUrl, color: colorMap.scrim_completed,
      footer: { text: 'Nexplay Esports' },
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

async function getTournamentWebhookUrl(channel: 'tournaments' | 'scrims' = 'tournaments'): Promise<{ url: string | null; enabled: boolean }> {
  try {
    const settingsSnap = await db.collection('settings').doc('site').get();
    if (settingsSnap.exists) {
      const data = settingsSnap.data();
      if (data?.autoDiscordTournamentAnnouncements === false) {
        return { url: null, enabled: false };
      }
      const url = data?.discordWebhookTournaments?.trim() || data?.discordWebhookUrl?.trim();
      if (url && (url.startsWith('https://discord.com/api/webhooks/') || url.startsWith('https://discordapp.com/api/webhooks/'))) {
        return { url, enabled: true };
      }
    }
  } catch (err) {
    console.warn('[Discord Webhook] Failed to fetch settings/site:', err);
  }
  const envUrl = channel === 'scrims' ? (process.env.DISCORD_WEBHOOK_SCRIMS || process.env.DISCORD_WEBHOOK_TOURNAMENTS) : process.env.DISCORD_WEBHOOK_TOURNAMENTS;
  return { url: envUrl || null, enabled: true };
}

// POST /api/discord/test — Platform Admin webhook test verification
router.post('/api/discord/test', authenticateToken, rateLimit(5, 5 * 60 * 1000), async (req: any, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required.' });
  }
  const { webhookUrl } = req.body || {};
  const config = await getTournamentWebhookUrl();
  const targetUrl = webhookUrl?.trim() || config.url;

  if (!targetUrl) {
    return res.status(400).json({ success: false, message: 'No Discord webhook URL provided or configured in settings.' });
  }

  const testEmbed = {
    title: '🎮  NexPlay Discord Integration Connected',
    description: 'This is a test notification confirming that the **Main Discord Tournament Webhook** is configured and operational on NexPlay Esports!',
    color: 0x5865f2,
    footer: { text: 'NexPlay Esports Platform • Automatic Announcements Ready' },
    timestamp: new Date().toISOString(),
  };

  const sent = await sendDiscordWebhook(targetUrl, testEmbed);
  if (sent) {
    return res.json({ success: true, message: 'Test message sent successfully to your Discord server!' });
  }
  return res.status(502).json({ success: false, message: 'Discord webhook delivery failed. Please check the Webhook URL permissions in Discord.' });
});

router.post('/api/discord/announce', authenticateToken, rateLimit(15, 15 * 60 * 1000), async (req: any, res) => {
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
    if (type === 'group_published' &&
        (!Array.isArray(data.groups) || data.groups.length === 0 ||
         !data.groups.every((g: unknown) => typeof g === 'string'))) {
      return res.status(400).json({ success: false, message: 'data.groups must be a non-empty array of group names for group_published announcements.' });
    }

    const tournament = await db.collection('tournaments').doc(data.tournamentId).get();
    if (!tournament.exists) return res.status(404).json({ success: false, message: 'Tournament not found.' });
    if (req.user.role !== 'admin' && tournament.data()?.hostUid !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'You can only announce your own tournaments.' });
    }

    const webhookConfig = await getTournamentWebhookUrl(channel);
    if (!webhookConfig.enabled) {
      return res.json({ success: true, message: 'Discord announcements are currently disabled in Admin Site Settings.' });
    }

    const webhookUrl = webhookConfig.url;
    if (!webhookUrl) {
      return res.status(503).json({ success: false, message: 'Main Discord tournament webhook is not configured. Please set it in Admin Panel -> Settings.' });
    }

    const embed = buildDiscordEmbed(type, data);
    if (!embed) return res.status(400).json({ success: false, message: `Unknown announcement type: ${type}` });

    const sent = await sendDiscordWebhook(webhookUrl, embed);
    if (sent) {
      try {
        await db.collection('discordLogs').add({
          type, channel, tournamentId: data.tournamentId || null,
          sentBy: req.user.userId, sentAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (logErr) { console.warn('[Discord Log] Firestore log failed:', logErr); }
      return res.json({ success: true, message: 'Tournament update broadcast to main Discord server' });
    }
    return res.status(502).json({ success: false, message: 'Discord webhook delivery failed. Check webhook URL and Discord server settings.' });
  } catch (error: any) {
    console.error('[Discord Announce] Unhandled error:', error);
    return res.status(500).json({ success: false, message: 'Failed to send Discord announcement.' });
  }
});

export default router;
