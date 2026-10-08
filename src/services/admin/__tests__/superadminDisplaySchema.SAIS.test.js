import { getEntryDetailViewModel } from '../superadminDisplaySchema';

// 🗓️ SAIS (08/10/2026, tournée T20, hors lots) — CONSOLE « Gestion de contenu » : la fiche d une
// fermeture affichait sa date SEULE en « 08/10/2026 02:00 » (capture SITE_S08a).
// Cause : « 2026-10-08 »
// passe par `new Date()`, qui la lit comme minuit UTC, soit 02:00 à Paris. Une date seule se dit
// sans heure ; une heure seule (« 18:30:00.000 ») se dit « 18:30 » ; un instant (ISO complet)
// garde sa date et son heure (caractérisé : inchangé).
// Le fichier n avait AUCUN témoin (E6) : le 3e cas fige l existant.

const fiche = (/** @type {Record<string, any>} */ champs) => getEntryDetailViewModel({
  attributes: [],
  entry: { documentId: 'fermeture-1', ...champs },
  uid: 'api::facility-closure.facility-closure',
});
const valeur = (/** @type {any} */ modele, /** @type {string} */ cle) => modele.keyFields
  .find((/** @type {any} */ champ) => champ.key === cle)?.value;

describe('SAIS — les dates de la console « Gestion de contenu »', () => {
  test('une date SEULE se dit sans heure (plus de « 02:00 »)', () => {
    expect(valeur(fiche({ startDate: '2026-10-08' }), 'startDate')).toBe('08/10/2026');
  });

  test('une heure SEULE se dit HH:mm', () => {
    expect(valeur(fiche({ startTime: '18:30:00.000' }), 'startTime')).toBe('18:30');
  });

  test('un instant ISO garde sa date et son heure (caractérisé, inchangé)', () => {
    const modele = fiche({ updatedAt: '2026-10-08T10:30:00.000Z' });
    expect(modele.updatedAt).toMatch(/^08\/10\/2026.*\d{2}:\d{2}$/);
  });
});
