import i18next from 'i18next';

import fr from '@/theme/strings/translations/fr';

import { resolveClubAffiliationRefusal } from '@/services/requests/clubAffiliationRefusal';

// TRIO / POINT 1 bis — QUAND LE SERVEUR DIT POURQUOI, L'APP RACONTAIT AUTRE CHOSE.
//
// Le refus d'adhesion a un club SANS DIRIGEANT sort de `ctx.forbidden(message,
// { code })` (admin, club-membership-request.ts). L'app lit ce code, cherche
// `APIerrors.<CODE>` dans `fr.js`, et — s'il n'y est pas — TOMBE SUR LE STATUT :
// 403 => « Ton compte n'a pas encore de role. Termine ton inscription… »
//
// 🧨 C'est un MENSONGE mesure le 2026-09-01 : les deux codes du club orphelin
// etaient absents de `fr.js`. Un dirigeant parfaitement inscrit se voyait
// renvoye vers une inscription deja finie, pendant que le vrai motif (« ce club
// n'a plus de dirigeant », « tu es deja dans un club ») restait invisible.
//
// ⛔ Ce temoin charge le VRAI `fr.js` dans i18next : il ne peut pas passer au
// vert sur une doublure. Si une clef disparait, il redevient rouge.

/** La phrase de repli, mot pour mot (clubAffiliationRefusal.js, situation `noRole`). */
const REPLI_MENSONGER = 'Ton compte n’a pas encore de rôle. '
  + 'Termine ton inscription pour pouvoir dire qu’un club est le tien.';

/**
 * L'erreur telle que l'intercepteur la rejette : il propage
 * `response.data.error`, donc `status` et `details.code` sont a la racine.
 * @param {string} code - Le code envoye par le serveur.
 * @param {string} message - Le message brut du serveur.
 * @returns {any} L'erreur, dans sa forme reelle.
 */
const refusDuServeur = (code, message) => ({
  details: { code },
  message,
  name: 'ForbiddenError',
  status: 403,
});

/**
 * La traduction, dans sa forme reelle : clef d'abord, repli ensuite.
 * @param {string} key - La clef i18n.
 * @param {string} [repli] - Le texte de repli.
 * @returns {string} La phrase.
 */
const t = (key, repli) => repli || key;

beforeAll(async () => {
  await i18next.init({
    lng: 'fr',
    resources: { fr: { translation: fr } },
  });
});

describe('« c\'est mon club » refuse — chaque code du serveur a sa phrase', () => {
  // Les trois codes que le controleur peut poser sur ce refus, lus dans
  // `resolveOrphanClubJoinRefusal` (admin, club-membership-request.ts).
  const CODES = [
    'CLUB_WITHOUT_MANAGER_IS_PARTNER',
    'CLUB_WITHOUT_MANAGER_NOT_CLAIMABLE',
    'TRAINER_ALREADY_IN_CLUB',
  ];

  test.each(CODES)('%s : la phrase vient du CODE, pas du statut 403', (code) => {
    const { message, situation } = resolveClubAffiliationRefusal(
      refusDuServeur(code, 'Forbidden'),
      t,
    );

    expect(situation).toBe(`serverCode:${code}`);
    expect(message).not.toBe(REPLI_MENSONGER);
    expect(message.length).toBeGreaterThan(20);
  });

  test('« ce club utilise FoundClub mais n\'a plus de dirigeant » dit quoi faire', () => {
    const { message } = resolveClubAffiliationRefusal(
      refusDuServeur('CLUB_WITHOUT_MANAGER_IS_PARTNER', 'Forbidden'),
      t,
    );

    expect(message).toContain('dirigeant');
    expect(message).toContain('Contacte-nous');
  });

  test('« aucun dirigeant pour valider » nomme les deux roles qui le peuvent', () => {
    const { message } = resolveClubAffiliationRefusal(
      refusDuServeur('CLUB_WITHOUT_MANAGER_NOT_CLAIMABLE', 'Forbidden'),
      t,
    );

    expect(message).toContain('entraîneur');
    expect(message).toContain('dirigeant');
  });

  test('« tu es deja dans un club » dit par ou sortir, sans nommer un role', () => {
    const { message } = resolveClubAffiliationRefusal(
      refusDuServeur('TRAINER_ALREADY_IN_CLUB', 'Forbidden'),
      t,
    );

    expect(message).toContain('Quitte');
    // ⛔ Le serveur pose ce meme code pour un DIRIGEANT deja affilie
    // (admin, trainer-management.ts, « Manager is already associated with a
    // club ») : la phrase ne doit donc appeler personne « entraineur ».
    expect(message).not.toContain('entraîneur');
  });

  test('un 403 NU garde son repli — ce lot ne retire pas le filet', () => {
    const { message, situation } = resolveClubAffiliationRefusal(
      { message: 'Forbidden', status: 403 },
      t,
    );

    expect(situation).toBe('noRole');
    expect(message).toBe(REPLI_MENSONGER);
  });
});
