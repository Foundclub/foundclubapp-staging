import i18n from '@/theme/strings';

// STATS-FIX2 · POINT 8 (tournee T10) — LES TEXTES DES STATISTIQUES, RENDUS PAR LE VRAI i18next
// DE L APP (francais), comme le telephone les affiche.
//
// 8-7 · ecran 7 : « 0 sur 2 a répondu ». En francais, zero prend le SINGULIER (regle CLDR :
// 0 et 1 sont « one ») : la phrase de 1 servait aussi a 0. Une forme « zero » le dit
// autrement, sans accord a forcer : « Aucune réponse sur 2 ». Trois phrases soeurs avaient
// la meme faute : la carte « Après le match », la feuille de match, la feuille du score.

describe('STATS-FIX2 · 8-7 — « 0 sur 2 a répondu »', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('fr');
  });

  test.each([
    [
      'stMatch.carte.responsesCount',
      ['Aucune réponse sur 2', '1 sur 2 a répondu', '2 sur 2 ont répondu'],
    ],
    [
      'stMatch.feuille.responsesSentence',
      ['Aucune réponse sur 2.', '1 sur 2 a répondu.', '2 sur 2 ont répondu.'],
    ],
    [
      'stMatch.score.responses',
      ['Aucune réponse sur 2', '1 sur 2 a déjà répondu', '2 sur 2 ont déjà répondu'],
    ],
  ])('🔴 %s : zero, un, deux', (cle, attendus) => {
    expect([0, 1, 2].map((count) => i18n.t(cle, { count, total: 2 }))).toEqual(attendus);
  });
});
