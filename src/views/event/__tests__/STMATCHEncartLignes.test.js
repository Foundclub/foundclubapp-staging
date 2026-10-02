/* eslint-disable max-len -- titres et attendus en francais, lus tels quels (ST-MATCH) */
import { buildMatchEncartLines, buildScorersLine } from '../matchEncartLines';

// ==========================================================================
// 🆚 ST-MATCH (écran 1, design des statistiques validé le 02/10) — L'ENCART
// DU SCORE, ÉTAT PAR ÉTAT, ET CE QUE CHAQUE LECTEUR A LE DROIT D'Y LIRE.
//
// Les 7 états de la planche « L'encart du score » (P1-encart-tel) :
//   1 avant le match · 2 fini sans score, entraîneur · 3 fini sans score, joueur
//   · 4 score saisi · 5 feuille publiée · 6 score officiel attendu · 7 visiteur.
// 🔒 La règle qui compte : l'auteur du score et les buteurs ne sortent JAMAIS
// pour un visiteur (des mineurs jouent en U15).
// ==========================================================================

/**
 * Le `t` des témoins : rend le repli, interpolé, et sait les pluriels de i18next.
 * @param {string} key - La clé.
 * @param {any} a - Le repli, ou les options.
 * @param {any} b - Les options, quand un repli est donné.
 * @returns {string} Le texte rendu.
 */
const t = (/** @type {string} */ key, /** @type {any} */ a, /** @type {any} */ b) => {
  const options = typeof a === 'string' ? b : a;
  let modele = typeof a === 'string' ? a : key;
  if (options && typeof options.count === 'number') {
    modele = options.count === 1 ? options.defaultValue_one : options.defaultValue_other;
  }
  return String(modele).replace(/\{\{(\w+)\}\}/g, (_tout, nom) => String(options?.[nom] ?? ''));
};

const SAISI_LE = '2026-10-01T20:35:00.000Z';
const KARIM = { documentId: 'karim', firstname: 'Karim' };
const HUGO_ID = 'hugo';

// Ce que l'écran passe, pour un JOUEUR de l'équipe, match U15 du 05/09.
const base = {
  available: false,
  canManage: false,
  canSeeDetails: true,
  coachFirstname: 'Karim',
  isFinished: true,
  locale: 'fr-FR',
  publishedLines: null,
  recordedAt: null,
  recordedBy: null,
  scoreAgainst: null,
  scoreFor: null,
  source: null,
  startTimeLabel: '19:00',
  t,
  viewerDocumentId: HUGO_ID,
  waitingOfficial: false,
};
const scoreSaisi = {
  ...base,
  available: true,
  recordedAt: SAISI_LE,
  recordedBy: KARIM,
  scoreAgainst: 1,
  scoreFor: 2,
  source: 'manual',
};
const date = new Date(SAISI_LE).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
const heure = new Date(SAISI_LE).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

describe('ST-MATCH · écran 1 — ce que dit l\'encart du score', () => {
  test('état 1 — avant le match : « VS » et l\'heure, rien à saisir ni à attendre', () => {
    const lignes = buildMatchEncartLines({ ...base, isFinished: false });
    expect(lignes).toEqual({
      authorLine: null,
      centerLabel: '19:00',
      isScoreShown: false,
      scorersLine: null,
      statusLine: null,
      value: 'VS',
    });
  });

  test('état 2 — fini sans score, ENTRAÎNEUR : « Score en attente », aucune phrase (il a le bouton)', () => {
    const lignes = buildMatchEncartLines({ ...base, canManage: true });
    expect(lignes.value).toBe('– –');
    expect(lignes.centerLabel).toBe('Score en attente');
    expect(lignes.statusLine).toBeNull();
  });

  test('état 3 — fini sans score, JOUEUR : « Karim n\'a pas encore saisi le score. »', () => {
    const lignes = buildMatchEncartLines(base);
    expect(lignes.statusLine).toEqual({ text: 'Karim n\'a pas encore saisi le score.', tone: 'neutral' });
    // Sans prénom connu, la phrase reste vraie.
    expect(buildMatchEncartLines({ ...base, coachFirstname: null }).statusLine?.text)
      .toBe('L\'entraîneur n\'a pas encore saisi le score.');
  });

  test('état 4 — score saisi : « 2 - 1 », « Score saisi », et QUI l\'a saisi, QUAND', () => {
    const lignes = buildMatchEncartLines(scoreSaisi);
    expect(lignes.value).toBe('2 - 1');
    expect(lignes.isScoreShown).toBe(true);
    expect(lignes.centerLabel).toBe('Score saisi');
    expect(lignes.authorLine).toBe(`Saisi par Karim le ${date} à ${heure}`);
    // Le mot « manuel » a disparu.
    expect(JSON.stringify(lignes)).not.toMatch(/manuel/i);
    // L'auteur lui-même lit « toi ».
    expect(buildMatchEncartLines({ ...scoreSaisi, viewerDocumentId: 'karim' }).authorLine)
      .toBe(`Saisi par toi le ${date} à ${heure}`);
  });

  test('état 5 — feuille publiée : les buteurs, et le but que la feuille ne nomme pas', () => {
    const lignes = buildMatchEncartLines({
      ...scoreSaisi,
      publishedLines: [
        { sportPayload: { assists: 0, goals: 1 }, user: { firstname: 'Hugo', lastname: 'Lemaire' } },
        { sportPayload: { goals: 0 }, user: { firstname: 'Léa', lastname: 'Martin' } },
      ],
    });
    expect(lignes.scorersLine).toBe('Hugo L. · 1 but sans buteur');
    expect(buildScorersLine([
      { manualPlayerName: 'Sami', sportPayload: { goals: 2 } },
    ], 2, t)).toBe('Sami ×2');
    expect(buildScorersLine([], 3, t)).toBe('3 buts sans buteur');
    expect(buildScorersLine([], 0, t)).toBeNull();
  });

  test('état 6 — score officiel attendu : en ORANGE (warning), plus en or', () => {
    const lignes = buildMatchEncartLines({ ...base, canManage: true, waitingOfficial: true });
    expect(lignes.centerLabel).toBe('Score officiel');
    expect(lignes.statusLine).toEqual({
      text: 'La fédération n\'a pas encore publié le score.',
      tone: 'warning',
    });
  });

  test('état 6 bis — score officiel connu : « Score officiel », et aucun auteur', () => {
    const lignes = buildMatchEncartLines({ ...scoreSaisi, source: 'external_sync' });
    expect(lignes.centerLabel).toBe('Score officiel');
    expect(lignes.authorLine).toBeNull();
  });

  test('🔒 état 7 — VISITEUR : le score et le résultat, ni l\'auteur, ni les buteurs, ni l\'attente', () => {
    const visiteur = { ...scoreSaisi, canSeeDetails: false, viewerDocumentId: null };
    const lignes = buildMatchEncartLines({
      ...visiteur,
      publishedLines: [{ sportPayload: { goals: 2 }, user: { firstname: 'Hugo', lastname: 'Lemaire' } }],
    });
    expect(lignes.value).toBe('2 - 1');
    expect(lignes.authorLine).toBeNull();
    expect(lignes.scorersLine).toBeNull();
    expect(JSON.stringify(lignes)).not.toMatch(/Karim|Hugo/);
    expect(buildMatchEncartLines({ ...base, canSeeDetails: false }).statusLine).toBeNull();
    expect(buildMatchEncartLines({ ...base, canSeeDetails: false, waitingOfficial: true }).statusLine)
      .toBeNull();
  });
});
