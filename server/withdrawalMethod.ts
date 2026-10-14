/**
 * Saved Withdrawal Payment Method — validation, masking and snapshot helpers.
 *
 * One active withdrawal method per user, stored at withdrawal_methods/{uid}
 * (server/Admin-SDK access only — the collection is default-deny in
 * firestore.rules and never touched by the client SDK).
 *
 * Pure functions only so the rules are unit-testable without Firestore.
 */

export type WithdrawalMethodType = 'ewallet' | 'bank';

export const EWALLET_PROVIDERS = ['eSewa', 'Khalti', 'IME Pay'] as const;

export interface WithdrawalMethodInput {
  type: WithdrawalMethodType;
  provider: string;
  accountHolderName: string;
  accountNumber: string;
  bankName?: string;
}

export interface StoredWithdrawalMethod extends WithdrawalMethodInput {
  uid: string;
  createdAt: unknown; // Firestore Timestamp (server writes via Admin SDK)
  updatedAt: unknown;
}

export interface ValidateOutcome {
  error: string | null;
  value: WithdrawalMethodInput | null;
}

const fail = (error: string): ValidateOutcome => ({ error, value: null });

const safeString = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/**
 * Server-side validation for a saved withdrawal method. Mirrors the client
 * form but is the authority — the client copy exists only for UX.
 * Convention matches validatePrizeWinners: error string or null.
 */
export function validateWithdrawalMethodInput(input: unknown): ValidateOutcome {
  if (typeof input !== 'object' || input === null) {
    return fail('Invalid payment method payload');
  }
  const raw = input as Record<string, unknown>;

  const type = safeString(raw.type);
  if (type !== 'ewallet' && type !== 'bank') {
    return fail('Invalid method type');
  }

  const provider = safeString(raw.provider);
  if (!provider || provider.length > 40) {
    return fail('Invalid payment provider');
  }
  if (type === 'ewallet' && !(EWALLET_PROVIDERS as readonly string[]).includes(provider)) {
    return fail('Unsupported e-wallet provider');
  }

  const accountHolderName = safeString(raw.accountHolderName);
  if (accountHolderName.length < 2 || accountHolderName.length > 80) {
    return fail('Account holder name must be 2-80 characters');
  }

  const accountNumber = safeString(raw.accountNumber).replace(/\s+/g, '');
  if (!/^[A-Za-z0-9-]{5,32}$/.test(accountNumber)) {
    return fail('Account number must be 5-32 letters, digits or dashes');
  }

  let bankName: string | undefined;
  if (type === 'bank') {
    bankName = safeString(raw.bankName);
    if (bankName.length < 2 || bankName.length > 80) {
      return fail('Bank name must be 2-80 characters');
    }
  }

  return {
    error: null,
    value: {
      type,
      provider,
      accountHolderName,
      accountNumber,
      ...(type === 'bank' ? { bankName } : {}),
    },
  };
}

/**
 * UI-safe view of a stored method — the account number is masked so screens
 * that merely display the method never render the full number.
 */
export function maskWithdrawalMethod(m: WithdrawalMethodInput): {
  type: WithdrawalMethodType;
  provider: string;
  accountHolderName: string;
  maskedAccountNumber: string;
  bankName?: string;
} {
  const num = m.accountNumber;
  const maskedAccountNumber = num.length <= 4 ? '****' : `${'****'}${num.slice(-4)}`;
  return {
    type: m.type,
    provider: m.provider,
    accountHolderName: m.accountHolderName,
    maskedAccountNumber,
    ...(m.bankName ? { bankName: m.bankName } : {}),
  };
}

/**
 * Immutable payout-destination snapshot embedded in each withdrawal
 * transaction, so historical records keep the exact destination that was
 * current at submission time even if the user later replaces the method.
 */
export function buildDestinationSnapshot(m: WithdrawalMethodInput): {
  type: WithdrawalMethodType;
  provider: string;
  accountHolderName: string;
  accountNumber: string;
  bankName?: string;
} {
  return {
    type: m.type,
    provider: m.provider,
    accountHolderName: m.accountHolderName,
    accountNumber: m.accountNumber,
    ...(m.bankName ? { bankName: m.bankName } : {}),
  };
}

/** Human-readable one-line destination for the transaction `accountDetails` field (backward compatible with admin tooling). */
export function buildAccountDetailsLine(m: WithdrawalMethodInput): string {
  const target = m.type === 'bank' ? `${m.bankName} — ` : '';
  return `${m.provider} — ${m.accountHolderName} — ${target}${m.accountNumber}`;
}
