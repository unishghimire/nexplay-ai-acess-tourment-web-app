/**
 * Centralized financial constants for NexPlay.
 * All revenue splits, fees, and limits live here — never hardcode percentages elsewhere.
 */
export const REVENUE_SPLIT = {
  ORGANIZER_SHARE: 0.85,
  PLATFORM_SHARE: 0.15,
} as const;

export const WALLET_LIMITS = {
  MIN_WITHDRAWAL: 100,       // Rs. 100
  MAX_DEPOSIT: 100000,       // Rs. 100,000
  MAX_WITHDRAWAL: 50000,     // Rs. 50,000
  MAX_SCREENSHOT_SIZE: 5 * 1024 * 1024, // 5MB
} as const;

export const RATE_LIMITS = {
  DEPOSIT: { windowMs: 15 * 60 * 1000, max: 5 },
  WITHDRAW: { windowMs: 15 * 60 * 1000, max: 3 },
  TX_HISTORY: { windowMs: 15 * 60 * 1000, max: 30 },
} as const;

export const TX_PAGE_SIZE = 10;

/** Calculate org and platform shares from profit. Returns integer paisa-free amounts. */
export function calculateRevenueSplit(profit: number) {
  if (profit <= 0) return { orgShare: 0, nexplayShare: 0 };
  return {
    orgShare: Math.round(profit * REVENUE_SPLIT.ORGANIZER_SHARE),
    nexplayShare: Math.round(profit * REVENUE_SPLIT.PLATFORM_SHARE),
  };
}
