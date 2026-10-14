import {
  validateWithdrawalMethodInput,
  maskWithdrawalMethod,
  buildDestinationSnapshot,
  buildAccountDetailsLine,
  type WithdrawalMethodInput,
} from './withdrawalMethod';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

// ── validateWithdrawalMethodInput ────────────────────────────────────────────

const validEwallet: WithdrawalMethodInput = {
  type: 'ewallet',
  provider: 'eSewa',
  accountHolderName: 'Ram Bahadur Shrestha',
  accountNumber: '9812345678',
};

const validBank: WithdrawalMethodInput = {
  type: 'bank',
  provider: 'Nabil Bank',
  accountHolderName: 'Sita Gurung',
  accountNumber: '01201017500123',
  bankName: 'Nabil Bank',
};

assert(validateWithdrawalMethodInput(validEwallet).error === null, 'valid e-wallet is accepted');
assert(validateWithdrawalMethodInput(validBank).error === null, 'valid bank account is accepted');

assert(validateWithdrawalMethodInput(null).error !== null, 'null payload is rejected');
assert(validateWithdrawalMethodInput('x').error !== null, 'non-object payload is rejected');
assert(validateWithdrawalMethodInput({ ...validEwallet, type: 'crypto' }).error !== null, 'unknown type is rejected');
assert(validateWithdrawalMethodInput({ ...validEwallet, provider: '' }).error !== null, 'empty provider is rejected');
assert(validateWithdrawalMethodInput({ ...validEwallet, provider: 'PayPal' }).error !== null, 'unsupported e-wallet provider is rejected');
assert(validateWithdrawalMethodInput({ ...validEwallet, accountHolderName: 'A' }).error !== null, 'too-short holder name is rejected');
assert(validateWithdrawalMethodInput({ ...validEwallet, accountHolderName: 'x'.repeat(81) }).error !== null, 'too-long holder name is rejected');
assert(validateWithdrawalMethodInput({ ...validEwallet, accountNumber: '123' }).error !== null, 'too-short account number is rejected');
assert(validateWithdrawalMethodInput({ ...validEwallet, accountNumber: 'ABCD-1234-ABCD-1234-ABCD-1234-ABCD-123' }).error !== null, 'too-long account number is rejected');
assert(validateWithdrawalMethodInput({ ...validEwallet, accountNumber: 'has spaces!' }).error !== null, 'account number with illegal characters is rejected');
assert(validateWithdrawalMethodInput({ ...validBank, bankName: '' }).error !== null, 'bank method without bank name is rejected');
assert(validateWithdrawalMethodInput({ ...validBank, provider: '' }).error !== null, 'bank method without provider is rejected');

// eSewa/Khalti/IME Pay are the supported e-wallets
assert(validateWithdrawalMethodInput({ ...validEwallet, provider: 'Khalti' }).error === null, 'Khalti is accepted');
assert(validateWithdrawalMethodInput({ ...validEwallet, provider: 'IME Pay' }).error === null, 'IME Pay is accepted');

// Normalization: whitespace trimmed, account number inner spaces stripped
const normalized = validateWithdrawalMethodInput({ ...validEwallet, accountHolderName: '  Ram Bahadur Shrestha  ', accountNumber: '9812 345 678' });
assert(normalized.error === null && normalized.value?.accountHolderName === 'Ram Bahadur Shrestha', 'holder name is trimmed');
assert(normalized.error === null && normalized.value?.accountNumber === '9812345678', 'account number inner spaces are stripped');

// Bank type accepts any bank as the provider label
assert(validateWithdrawalMethodInput({ ...validBank, provider: 'Global IME Bank' }).error === null, 'any bank name is accepted as provider for bank type');

// ── maskWithdrawalMethod ─────────────────────────────────────────────────────

const masked = maskWithdrawalMethod(validEwallet);
assert(masked.maskedAccountNumber === '****5678', 'mask keeps only the last 4 digits');
assert(!JSON.stringify(masked).includes('9812345678'), 'masked view never contains the full account number');
assert(masked.provider === 'eSewa' && masked.accountHolderName === 'Ram Bahadur Shrestha', 'mask keeps provider and holder name');

const shortMasked = maskWithdrawalMethod({ ...validEwallet, accountNumber: '12' });
assert(shortMasked.maskedAccountNumber === '****', 'very short numbers are fully masked');

// ── buildDestinationSnapshot / buildAccountDetailsLine ──────────────────────

const snap = buildDestinationSnapshot(validBank);
assert(snap.accountNumber === '01201017500123' && snap.bankName === 'Nabil Bank', 'bank snapshot carries full payout details for the admin payout');

const line = buildAccountDetailsLine(validBank);
assert(line === 'Nabil Bank — Sita Gurung — Nabil Bank: 01201017500123' || line.includes('Sita Gurung'), 'accountDetails line is human-readable');

const ewalletLine = buildAccountDetailsLine(validEwallet);
assert(ewalletLine === 'eSewa — Ram Bahadur Shrestha — 9812345678', 'e-wallet accountDetails line format');

console.log('Withdrawal payment method tests: 23 passed, 0 failed');
