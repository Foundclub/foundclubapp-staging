import { isFirebaseBypassEnabled } from './bypassPolicy';

// L'environnement est injecté explicitement, jamais muté via `process.env` :
// babel-plugin-inline-dotenv réécrit chaque lecture littérale `process.env.X`
// en `process.env.X || "<valeur du fichier .env>"`, et neutralise
// `delete process.env.X` (le `delete` porte alors sur une expression, plus sur
// une référence : il ne supprime rien). Un test qui muterait `process.env`
// dépendrait donc de la présence de `.env.local` — vert sur un poste de dev,
// rouge en CI où le fichier est absent.
describe('authService bypass gating', () => {
  test('returns true only when APP_ENV=local and BYPASS_FIREBASE_AUTH=true', () => {
    const env = { APP_ENV: 'local', BYPASS_FIREBASE_AUTH: 'true' };

    expect(isFirebaseBypassEnabled(env)).toBe(true);
  });

  test('returns false in non-local environment even if bypass flag is true', () => {
    const stagingEnv = { APP_ENV: 'staging', BYPASS_FIREBASE_AUTH: 'true' };
    const productionEnv = { APP_ENV: 'production', BYPASS_FIREBASE_AUTH: 'true' };

    expect(isFirebaseBypassEnabled(stagingEnv)).toBe(false);
    expect(isFirebaseBypassEnabled(productionEnv)).toBe(false);
  });

  test('returns false in local when bypass flag is false', () => {
    const env = { APP_ENV: 'local', BYPASS_FIREBASE_AUTH: 'false' };

    expect(isFirebaseBypassEnabled(env)).toBe(false);
  });

  test('defaults to bypass enabled in local when the flag is missing', () => {
    expect(isFirebaseBypassEnabled({ APP_ENV: 'local' })).toBe(true);
  });
});
