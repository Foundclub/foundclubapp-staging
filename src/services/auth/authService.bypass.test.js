import { isFirebaseBypassEnabled } from './bypassPolicy';

describe('authService bypass gating', () => {
  const previousAppEnv = process.env.APP_ENV;
  const previousBypass = process.env.BYPASS_FIREBASE_AUTH;

  afterEach(() => {
    process.env.APP_ENV = previousAppEnv;
    process.env.BYPASS_FIREBASE_AUTH = previousBypass;
  });

  test('returns true only when APP_ENV=local and BYPASS_FIREBASE_AUTH=true', () => {
    process.env.APP_ENV = 'local';
    process.env.BYPASS_FIREBASE_AUTH = 'true';
    expect(isFirebaseBypassEnabled()).toBe(true);
  });

  test('returns false in non-local environment even if bypass flag is true', () => {
    process.env.APP_ENV = 'staging';
    process.env.BYPASS_FIREBASE_AUTH = 'true';
    expect(isFirebaseBypassEnabled()).toBe(false);
  });

  test('returns false in local when bypass flag is false', () => {
    process.env.APP_ENV = 'local';
    process.env.BYPASS_FIREBASE_AUTH = 'false';
    expect(isFirebaseBypassEnabled()).toBe(false);
  });
});
