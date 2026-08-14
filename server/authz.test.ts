import { requireAdmin } from './authz';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function runMiddleware(role?: string) {
  let statusCode: number | undefined;
  let body: unknown;
  let nextCalled = false;

  requireAdmin(
    { user: role ? { role } : undefined } as any,
    {
      status: (code) => {
        statusCode = code;
        return { json: (response) => { body = response; } };
      },
    } as any,
    () => { nextCalled = true; },
  );

  return { statusCode, body, nextCalled };
}

const anonymous = runMiddleware();
assert(anonymous.statusCode === 403, 'missing user is rejected');
assert(!anonymous.nextCalled, 'missing user cannot reach the handler');

const organizer = runMiddleware('organizer');
assert(organizer.statusCode === 403, 'non-admin user is rejected');
assert(!organizer.nextCalled, 'non-admin cannot reach the handler');

const admin = runMiddleware('admin');
assert(admin.statusCode === undefined, 'admin is not rejected');
assert(admin.nextCalled, 'admin reaches the handler');

console.log('Admin authorization middleware tests: 5 passed, 0 failed');
