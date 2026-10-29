// ONBOARDDATE (29/10/2026) : la date de fin d'inscription gardee par le serveur doit survivre a la
// copie memoire du profil (sanitizeUser), sinon `getOnboardingViews` ne la voit jamais ; et son
// arrivee doit changer la signature, sinon le profil frais n'est pas repousse dans le store.
import { haveSameSanitizedUser, sanitizeUser } from './authSanitizer';

describe('authSanitizer - ONBOARDDATE, la date de fin d inscription', () => {
  const profil = { documentId: 'coach-sans-club', firstname: 'Julien' };
  const fini = { ...profil, onboardingCompletedAt: '2026-10-28T19:02:11.000Z' };

  test('la date survit a la copie', () => {
    expect(sanitizeUser(fini).onboardingCompletedAt).toBe('2026-10-28T19:02:11.000Z');
    expect(sanitizeUser(profil).onboardingCompletedAt).toBeNull();
  });

  test('l arrivee de la date change la signature', () => {
    expect(haveSameSanitizedUser(profil, fini)).toBe(false);
  });
});
