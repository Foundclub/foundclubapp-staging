import {
  DEFAULT_MATCH_DURATION_MINUTES,
  resolveEventEndedAt,
  resolveIsMatchFinished,
} from './eventMatchClock';

// AC10 — VAGUE 0, « reparer ce qui ment ».
//
// `EventDetails` decidait qu'un match etait fini en lisant l'horloge du
// TELEPHONE. Un telephone en avance ouvrait les statistiques d'apres-match avant
// le coup d'envoi ; un telephone en retard les cachait a quelqu'un dont le match
// etait fini. Ces temoins figent la regle : c'est l'horloge du SERVEUR qui
// tranche, et sans elle on ne tranche pas.
//
// ⚠️ `Date.now` est deliberement pilote dans ce fichier : c'est la seule facon
// de prouver que la fonction NE le lit PAS.

const MATCH_FINI_A = Date.parse('2026-08-20T18:00:00.000Z');
const TROIS_HEURES = 3 * 60 * 60 * 1000;

describe('AC10 — quelle horloge dit qu un match est fini', () => {
  /** @type {jest.SpyInstance | null} */
  let horlogeDuTelephone = null;

  const reglerLeTelephoneSur = (/** @type {number} */ instant) => {
    horlogeDuTelephone = jest.spyOn(Date, 'now').mockReturnValue(instant);
  };

  afterEach(() => {
    if (horlogeDuTelephone) horlogeDuTelephone.mockRestore();
    horlogeDuTelephone = null;
  });

  // 🥇 LE TEMOIN DE L'AUDIT.
  test('un telephone en AVANCE de 3 h n ouvre pas les statistiques', () => {
    const finDuMatch = new Date(MATCH_FINI_A);
    // Le serveur, lui, dit qu il reste 1 h de match.
    const serveur = MATCH_FINI_A - (60 * 60 * 1000);
    // Le telephone, lui, se croit deja 2 h APRES la fin.
    reglerLeTelephoneSur(MATCH_FINI_A + TROIS_HEURES);

    expect(resolveIsMatchFinished({ eventEndedAt: finDuMatch, serverNowMs: serveur }))
      .toBe(false);
  });

  test('un telephone en RETARD de 3 h les ouvre si le serveur dit fini', () => {
    const finDuMatch = new Date(MATCH_FINI_A);
    // Le serveur dit : fini depuis 1 minute.
    const serveur = MATCH_FINI_A + 60000;
    // Le telephone se croit encore 3 h AVANT la fin.
    reglerLeTelephoneSur(MATCH_FINI_A - TROIS_HEURES);

    expect(resolveIsMatchFinished({ eventEndedAt: finDuMatch, serverNowMs: serveur }))
      .toBe(true);
  });

  // 🔒 LE REPLI SUR : ouvrir trop tot est pire que trop tard.
  test('sans horloge serveur, le match est considere comme NON fini', () => {
    const finDuMatch = new Date(MATCH_FINI_A);
    // Le telephone jure que c est fini depuis 3 h. On ne le croit pas.
    reglerLeTelephoneSur(MATCH_FINI_A + TROIS_HEURES);

    [null, undefined, NaN, 'maintenant'].forEach((horlogeAbsente) => {
      expect(resolveIsMatchFinished({
        eventEndedAt: finDuMatch,
        serverNowMs: /** @type {any} */ (horlogeAbsente),
      })).toBe(false);
    });
  });

  test('un evenement sans heure de fin connue n est jamais declare fini', () => {
    expect(resolveIsMatchFinished({ eventEndedAt: null, serverNowMs: MATCH_FINI_A }))
      .toBe(false);
  });
});

describe('AC10 — la duree par defaut recopie celle du serveur', () => {
  // Le serveur applique 90 min dans `getEventEndedAt`
  // (admin/src/api/match-stats-report/services/match-stats-report.ts).
  // C est lui qui accepte ou refuse les stats : une autre valeur ici
  // desynchroniserait l app de la machine qui les produit.
  test('un match sans heure de fin utilise la duree par defaut de 90 minutes', () => {
    expect(DEFAULT_MATCH_DURATION_MINUTES).toBe(90);

    const debut = new Date('2026-08-20T18:00:00.000Z');
    const fin = resolveEventEndedAt(null, debut);

    expect(fin?.toISOString()).toBe('2026-08-20T19:30:00.000Z');
  });

  test('une heure de fin declaree l emporte toujours sur la duree par defaut', () => {
    const debut = new Date('2026-08-20T18:00:00.000Z');
    const fin = resolveEventEndedAt('2026-08-20T19:15:00.000Z', debut);

    expect(fin?.toISOString()).toBe('2026-08-20T19:15:00.000Z');
  });

  test('une heure de fin illisible retombe sur la duree par defaut', () => {
    const debut = new Date('2026-08-20T18:00:00.000Z');
    const fin = resolveEventEndedAt('pas-une-date', debut);

    expect(fin?.toISOString()).toBe('2026-08-20T19:30:00.000Z');
  });

  test('sans debut connu, il n y a pas d heure de fin — et donc aucune decision', () => {
    expect(resolveEventEndedAt(null, null)).toBeNull();
  });
});

// STATS-FIX2 · POINT 8 (tournee T10, ecran 4) — « fin à 19:30 » pour une seance de 18 h a 19 h.
// L app enregistre l heure de fin dans `endTime` (jamais `endDate`, reservee aux stages) : sans
// la lire, la fin tombait a debut + 90 min. Meme regle que le serveur (`getEventEndedAt` ->
// `resolveEventEndAt`) : `endDate`, sinon `endTime` le jour du debut A PARIS, sinon 90 min.
describe('STATS-FIX2 · point 8 — l heure de fin SAISIE decide', () => {
  // Sam. 5 sept. 2026, 18:00 a Paris (UTC+2).
  const DEBUT = new Date('2026-09-05T16:00:00.000Z');

  test('🔴 18:00 – 19:00 : la fin est 19:00 a Paris, pas 19:30', () => {
    expect(resolveEventEndedAt(null, DEBUT, '19:00:00.000')?.toISOString())
      .toBe('2026-09-05T17:00:00.000Z');
  });

  test('une fin apres minuit tombe le lendemain', () => {
    const debutTardif = new Date('2026-09-05T20:30:00.000Z'); // 22:30 a Paris
    expect(resolveEventEndedAt(null, debutTardif, '00:30')?.toISOString())
      .toBe('2026-09-05T22:30:00.000Z');
  });

  test('une `endDate` explicite l emporte encore ; une heure illisible retombe sur 90 min', () => {
    expect(resolveEventEndedAt('2026-09-05T17:15:00.000Z', DEBUT, '19:00')?.toISOString())
      .toBe('2026-09-05T17:15:00.000Z');
    expect(resolveEventEndedAt(null, DEBUT, 'bientot')?.toISOString())
      .toBe('2026-09-05T17:30:00.000Z');
  });
});
