// CARTECODE (26/10) : témoin du « 52 au lieu de 9 ». Le compte d'Adel a `jersey_number` = 9 en
// base ; la copie mémoire du profil (sanitizeUser) perdait le numéro et la nationalité, puis la
// carte en fabriquait un à partir de l'identifiant.
import { buildPlayerCardModel } from '@/domains/playerCard/cardModel';

import { haveSameSanitizedUser, sanitizeUser } from './authSanitizer';

describe('authSanitizer - CARTECODE, la copie mémoire garde ce que lit la carte', () => {
  const profil = {
    documentId: 'u162',
    firstname: 'Adel',
    isProfileVisible: false,
    jerseyNumber: 9,
    lastname: 'Ferchichi',
    nationality: 'France',
  };

  test('le numéro, la nationalité et le compte privé survivent à la copie', () => {
    const copie = sanitizeUser(profil);
    expect(copie.jerseyNumber).toBe(9);
    expect(copie.nationality).toBe('France');
    expect(copie.isProfileVisible).toBe(false);
  });

  test('la carte lue sur la copie porte le 9', () => {
    expect(buildPlayerCardModel({ user: sanitizeUser(profil) }).number).toBe(9);
  });

  test('un numéro ou une nationalité changé change la signature', () => {
    expect(haveSameSanitizedUser(profil, { ...profil, jerseyNumber: 10 })).toBe(false);
    expect(haveSameSanitizedUser(profil, { ...profil, nationality: 'Algérie' })).toBe(false);
    expect(haveSameSanitizedUser(profil, { ...profil, isProfileVisible: true })).toBe(false);
  });
});
