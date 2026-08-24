import { requireAdmin, requireOrganizer } from './authz';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function runAdminMiddleware(role?: string) {
  let statusCode: number | undefined;
  let body: unknown;
  let nextCalled = false;

  requireAdmin(
    { user: role ? { role } : undefined } as any,
    {
      status: (code: number) => {
        statusCode = code;
        return { json: (response: any) => { body = response; } };
      },
    } as any,
    () => { nextCalled = true; },
  );

  return { statusCode, body, nextCalled };
}

function runOrganizerMiddleware(role?: string) {
  let statusCode: number | undefined;
  let body: unknown;
  let nextCalled = false;

  requireOrganizer(
    { user: role ? { role } : undefined } as any,
    {
      status: (code: number) => {
        statusCode = code;
        return { json: (response: any) => { body = response; } };
      },
    } as any,
    () => { nextCalled = true; },
  );

  return { statusCode, body, nextCalled };
}

// Admin Middleware Checks
const anonymous = runAdminMiddleware();
assert(anonymous.statusCode === 403, 'missing user is rejected by requireAdmin');
assert(!anonymous.nextCalled, 'missing user cannot reach the admin handler');

const organizer = runAdminMiddleware('organizer');
assert(organizer.statusCode === 403, 'organizer is rejected by requireAdmin');
assert(!organizer.nextCalled, 'organizer cannot reach the admin handler');

const admin = runAdminMiddleware('admin');
assert(admin.statusCode === undefined, 'admin is not rejected by requireAdmin');
assert(admin.nextCalled, 'admin reaches the admin handler');

// Organizer Middleware Checks
const playerForOrg = runOrganizerMiddleware('player');
assert(playerForOrg.statusCode === 403, 'player is rejected by requireOrganizer');
assert(!playerForOrg.nextCalled, 'player cannot reach the organizer handler');

const orgForOrg = runOrganizerMiddleware('organizer');
assert(orgForOrg.statusCode === undefined, 'organizer is accepted by requireOrganizer');
assert(orgForOrg.nextCalled, 'organizer reaches the organizer handler');

const adminForOrg = runOrganizerMiddleware('admin');
assert(adminForOrg.statusCode === undefined, 'admin is accepted by requireOrganizer');
assert(adminForOrg.nextCalled, 'admin reaches the organizer handler');

console.log('Authorization middleware tests (Admin & Organizer): 12 passed, 0 failed');
