import {
  formatRecruitmentAdExpiryDate,
  getRecruitmentAdExpiry,
} from '../recruitmentAdRenewal';

// ANNONCE-RENOUVELER (decision d'Adel « renouveler A », 05/10) — point 2 : QUAND.
//
// Une annonce de recrutement vit 30 jours (admin : recruitment-ad/lifecycles.ts:228-231),
// puis sort SANS BRUIT des alertes (search-alert/services/matcher.ts:61) et des cartes
// d'equipe (domains/playerCard/teamCardModel.js:69). L'auteur voit « Renouveler 30 jours »
// quand l'echeance tombe dans 7 jours ou moins, ou est deja passee.
//
// 🕰️ LE FUSEAU (memoire piege-fuseau-serveur-utc-invisible-en-local) : la date affichee est
// la date du CALENDRIER DE L'APPAREIL. Un serveur range l'echeance en UTC ; 23 h 30 UTC, c'est
// deja le lendemain a Paris. Jest ne relit pas `process.env.TZ` en cours de route (mesure le
// 05/10 : la meme date sous trois TZ affectees dans un temoin rendait trois fois le meme jour) :
// ce fichier se lance donc DEUX fois, et chaque passe verifie SON fuseau :
//   TZ=UTC          npx jest src/utils/__tests__/recruitmentAdRenewal.test.js
//   TZ=Europe/Paris npx jest src/utils/__tests__/recruitmentAdRenewal.test.js
// (la CI GitHub tourne en UTC, le poste d'Adel a Paris : les deux passes ont lieu d'elles-memes).

const NOW = new Date('2026-10-05T10:00:00.000Z');
const OUVERTE_RENOUVELABLE = { isExpired: false, isRenewable: true };
const EXPIREE = { isExpired: true, isRenewable: true };
const DAY = 24 * 60 * 60 * 1000;

/**
 * L'echeance d'une annonce qui expire `offset` millisecondes apres NOW.
 * @param {number} offset Le decalage.
 * @returns {any} Le resultat de getRecruitmentAdExpiry.
 */
const expiryIn = (offset) => getRecruitmentAdExpiry(
  { expirationDate: new Date(NOW.getTime() + offset).toISOString() },
  NOW,
);

/**
 * Le libelle de date affiche pour cet instant.
 * @param {string} iso L'instant, tel que le serveur le range.
 * @returns {string} Le libelle.
 */
const labelOf = (iso) => formatRecruitmentAdExpiryDate(new Date(iso), NOW);

const FUSEAU = Intl.DateTimeFormat().resolvedOptions().timeZone;
const EN_UTC = FUSEAU === 'UTC' || FUSEAU === 'Etc/UTC';

/**
 * Le jour attendu, selon le fuseau de CETTE passe.
 * @param {{ utc: string, paris: string }} attendu Les deux libelles.
 * @returns {string} Celui du fuseau courant.
 */
const selonLeFuseau = (attendu) => (EN_UTC ? attendu.utc : attendu.paris);

describe('ANNONCE-RENOUVELER 2 — getRecruitmentAdExpiry : la fenetre des 7 jours', () => {
  it('echeance dans 3 jours : renouvelable, pas encore expiree', () => {
    expect(expiryIn(3 * DAY)).toEqual(expect.objectContaining(OUVERTE_RENOUVELABLE));
  });

  it('echeance dans 7 jours pile : renouvelable ; 7 jours et une minute : non', () => {
    expect(expiryIn(7 * DAY).isRenewable).toBe(true);
    expect(expiryIn(7 * DAY + 60000).isRenewable).toBe(false);
  });

  it('echeance dans 20 jours : pas de bouton', () => {
    expect(expiryIn(20 * DAY))
      .toEqual(expect.objectContaining({ isExpired: false, isRenewable: false }));
  });

  it('expiree depuis 2 jours ou depuis un an : renouvelable ET expiree', () => {
    expect(expiryIn(-2 * DAY)).toEqual(expect.objectContaining(EXPIREE));
    expect(expiryIn(-365 * DAY)).toEqual(expect.objectContaining(EXPIREE));
  });

  it('meme borne que le serveur (matcher.ts:61, `expiresAt < now`) : a l instant pile, non', () => {
    expect(expiryIn(0).isExpired).toBe(false);
    expect(expiryIn(-1).isExpired).toBe(true);
  });

  it('sans echeance lisible : rien (ni ligne ni bouton)', () => {
    expect(getRecruitmentAdExpiry({ expirationDate: null }, NOW)).toBeNull();
    expect(getRecruitmentAdExpiry({}, NOW)).toBeNull();
    expect(getRecruitmentAdExpiry({ expirationDate: 'pas une date' }, NOW)).toBeNull();
    expect(getRecruitmentAdExpiry(null, NOW)).toBeNull();
  });

  it('rend l instant de l echeance tel que le serveur l a range', () => {
    const expiry = getRecruitmentAdExpiry({ expirationDate: '2026-11-12T23:30:00.000Z' }, NOW);
    expect(expiry?.expiresAt.toISOString()).toBe('2026-11-12T23:30:00.000Z');
  });

  // ANNONCE-RAPPEL, point 8 (choix du chef « A », 05/10) — les postes d'une detection naissent
  // avec « +30 jours » par defaut (admin event.ts, createDetectionRecruitmentAdsForEvent), sans
  // lien avec la date de l'evenement : c'est l'EVENEMENT qui les ferme. Meme exclusion que le
  // serveur (apply, rappel).
  it('liee a un EVENEMENT : pas d echeance propre (ni badge, ni ligne, ni bouton)', () => {
    const event = { date: '2026-10-15T08:00:00.000Z', documentId: 'ev-detection' };
    const passee = '2026-10-01T10:00:00.000Z';
    expect(getRecruitmentAdExpiry({ event, expirationDate: passee }, NOW)).toBeNull();
    expect(getRecruitmentAdExpiry({ event, expirationDate: '2026-10-08T10:00:00.000Z' }, NOW))
      .toBeNull();
    // JUMEAU : sans evenement (`event: null`, comme le serveur la rend), l'echeance compte.
    expect(getRecruitmentAdExpiry({ event: null, expirationDate: passee }, NOW)?.isExpired)
      .toBe(true);
  });
});

describe(`ANNONCE-RENOUVELER 2 — la date affichee est celle de l appareil (${FUSEAU})`, () => {
  it('cette passe tourne en UTC ou a Paris (sinon le temoin ne prouve rien)', () => {
    expect(['UTC', 'Etc/UTC', 'Europe/Paris']).toContain(FUSEAU);
  });

  it('hiver : 12 novembre 23 h 30 UTC = 13 novembre a Paris', () => {
    expect(labelOf('2026-11-12T23:30:00.000Z'))
      .toBe(selonLeFuseau({ paris: '13 novembre', utc: '12 novembre' }));
  });

  it('ete : 14 juillet 22 h 30 UTC = 15 juillet a Paris (UTC+2)', () => {
    expect(labelOf('2026-07-14T22:30:00.000Z'))
      .toBe(selonLeFuseau({ paris: '15 juillet', utc: '14 juillet' }));
  });

  it('jour du changement d heure (25 octobre 2026) : avant et apres le passage', () => {
    // 24/10 22 h 30 UTC = 25/10 0 h 30 (heure d'ete) ;
    // 25/10 23 h 30 UTC = 26/10 0 h 30 (heure d'hiver).
    expect(labelOf('2026-10-24T22:30:00.000Z'))
      .toBe(selonLeFuseau({ paris: '25 octobre', utc: '24 octobre' }));
    expect(labelOf('2026-10-25T23:30:00.000Z'))
      .toBe(selonLeFuseau({ paris: '26 octobre', utc: '25 octobre' }));
  });

  it('une autre annee que celle du jour : l annee s ecrit', () => {
    expect(labelOf('2027-01-03T12:00:00.000Z')).toBe('3 janvier 2027');
    expect(labelOf('2025-10-03T12:00:00.000Z')).toBe('3 octobre 2025');
  });

  it('le 31 decembre au soir a Paris : l annee est celle de l APPAREIL, pas celle d UTC', () => {
    // 31/12/2026 23 h 30 UTC = 1er janvier 2027 0 h 30 a Paris.
    expect(labelOf('2026-12-31T23:30:00.000Z'))
      .toBe(selonLeFuseau({ paris: '1 janvier 2027', utc: '31 décembre' }));
  });
});
