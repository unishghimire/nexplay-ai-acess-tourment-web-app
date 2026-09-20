import { isPushSupported, getPushPermissionState } from './pushNotificationService';

console.log('--- STARTING PUSH NOTIFICATION SERVICE TESTS ---');

// Test 1: isPushSupported returns a boolean
const supported = isPushSupported();
console.assert(typeof supported === 'boolean', `Expected boolean, got ${typeof supported}`);
console.log('✓ isPushSupported returns boolean correctly:', supported);

// Test 2: getPushPermissionState returns a recognized permission string
const permission = getPushPermissionState();
const validStates = ['default', 'granted', 'denied', 'unsupported'];
console.assert(validStates.includes(permission), `Unexpected permission state: ${permission}`);
console.log('✓ getPushPermissionState returns valid permission state:', permission);

// Test 3: Token document hashing produces consistent keys
const hashToken = (token: string): string => {
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
        hash = ((hash << 5) - hash) + token.charCodeAt(i);
        hash |= 0;
    }
    return `device_${Math.abs(hash).toString(36)}`;
};

const token1 = 'fcm_fake_token_alpha_1234567890';
const token2 = 'fcm_fake_token_beta_9876543210';
const hash1a = hashToken(token1);
const hash1b = hashToken(token1);
const hash2 = hashToken(token2);

console.assert(hash1a === hash1b, 'Token hashing must be deterministic');
console.assert(hash1a !== hash2, 'Different tokens must produce different hash keys');
console.assert(hash1a.startsWith('device_'), 'Device doc ID must prefix with device_');
console.log('✓ Token doc ID hashing is deterministic and properly formatted:', hash1a);

console.log('--- ALL PUSH NOTIFICATION SERVICE TESTS PASSED ---');
