import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

import { format } from 'date-fns';
import { fr as localeFr } from 'date-fns/locale';

import i18n from '@/theme/strings';

// FINITIONS4 — D5 (recette emulateur, tournee 6, 29/09) : LES TEXTES.
//
//   · « Voir le detail » (4 clefs + 4 textes de secours) ;
//   · « 0/1 slots occupes • 1 restant(s) » (choix de l installation, ecrit EN
//     DUR) et son frere « slots occupes » du fil des demandes ;
//   · « Cette installation à encore de la capacité » (+ « jusqu'a », « autorise »
//     dans la meme carte) ;
//   · « dont 1 renforts » (pied de la convocation) ;
//   · « Sam.. 15h00 » (en-tete de la convocation).
//
// Chaque clef corrigee est RENDUE par le vrai i18next de l app, en francais ET en
// anglais — y compris zero, qui prend le SINGULIER en francais (piege du
// 08/09 : le moteur du telephone appliquait la regle anglaise).
// Ecrits ROUGES contre app `12692738`.

const RACINE_SRC = join(__dirname, '..', '..', '..');

/**
 * Tous les fichiers .js de l app, hors temoins.
 * @param {string} dossier - Le dossier a parcourir.
 * @returns {string[]} Les chemins.
 */
const sources = (dossier) => readdirSync(dossier).flatMap((nom) => {
  const chemin = join(dossier, nom);
  if (statSync(chemin).isDirectory()) {
    return nom === '__tests__' ? [] : sources(chemin);
  }
  return /\.js$/.test(nom) && !/\.test\.js$/.test(nom) ? [chemin] : [];
});

const fautifs = (/** @type {RegExp} */ motif) => sources(RACINE_SRC)
  .filter((chemin) => motif.test(readFileSync(chemin, 'utf8')))
  .map((chemin) => relative(RACINE_SRC, chemin).replace(/\\/g, '/'));

const VOIR_LE_DETAIL = [
  'common.actions.seeMore',
  'conversationPublicEventPicker.web.viewDetails',
  'matchRecapSheet.viewDetails',
  'missingPlayersView.web.card.details',
];

afterAll(async () => {
  await i18n.changeLanguage('fr');
});

describe('FINITIONS4 D5 — en francais', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('fr');
  });

  test.each(VOIR_LE_DETAIL)('🚨 %s : « Voir le détail »', (clef) => {
    expect(i18n.t(clef)).toBe('Voir le détail');
  });

  test('🚨 la carte de l installation : « a encore », « jusqu’à », « autorisé »', () => {
    expect(i18n.t('eventWizard.steps.location.capacityAvailable'))
      .toBe('Cette installation a encore de la capacité pour ce créneau.');
    expect(i18n.t('eventWizard.steps.location.pendingValidationConflict'))
      .toContain("jusqu'à validation");
    expect(i18n.t('eventWizard.steps.location.allowAndNotifyConflict'))
      .toContain('restera autorisé et');
  });

  test('🚨 « 0/1 place occupée · 1 restante » — zero et un au singulier', () => {
    const occupation = (/** @type {number} */ occupees, /** @type {number} */ total) => i18n.t(
      'eventWizard.steps.location.occupancy',
      { count: occupees, max: total, occupied: occupees },
    );
    expect(occupation(0, 1)).toBe('0/1 place occupée');
    expect(occupation(1, 2)).toBe('1/2 place occupée');
    expect(occupation(2, 3)).toBe('2/3 places occupées');
    expect(i18n.t('eventWizard.steps.location.remaining', { count: 0 })).toBe('0 restante');
    expect(i18n.t('eventWizard.steps.location.remaining', { count: 1 })).toBe('1 restante');
    expect(i18n.t('eventWizard.steps.location.remaining', { count: 3 })).toBe('3 restantes');
  });

  test('🚨 le fil des demandes : plus de « slots occupes »', () => {
    expect(i18n.t('requestFeedItem.occupancy', { count: 0, max: 1, occupied: 0 }))
      .toBe('0/1 place occupée');
    expect(i18n.t('requestFeedItem.occupancy', { count: 2, max: 2, occupied: 2 }))
      .toBe('2/2 places occupées');
  });

  test('🚨 le pied de la convocation : « dont 1 renfort », accorde a part', () => {
    const renforts = (/** @type {number} */ nombre) => i18n.t(
      'matchCallUp.selection.footer.reinforcementsCount',
      { count: nombre },
    );
    expect(renforts(1)).toBe('1 renfort');
    expect(renforts(2)).toBe('2 renforts');
    expect(i18n.t('matchCallUp.selection.footer.offAppCount', { count: 1 })).toBe('1 hors app');
    expect(i18n.t('matchCallUp.selection.footer.extras', { details: renforts(1) }))
      .toBe('dont 1 renfort');
  });
});

describe('FINITIONS4 D5 — en anglais (les memes clefs, les memes jetons)', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('en');
  });

  test.each(VOIR_LE_DETAIL)('%s reste « See/View details »', (clef) => {
    expect(i18n.t(clef)).toMatch(/^(See|View) details$/);
  });

  test('🚨 occupation et restant, accordes', () => {
    expect(i18n.t('eventWizard.steps.location.occupancy', { count: 1, max: 2, occupied: 1 }))
      .toBe('1/2 slot taken');
    expect(i18n.t('eventWizard.steps.location.occupancy', { count: 0, max: 1, occupied: 0 }))
      .toBe('0/1 slots taken');
    expect(i18n.t('eventWizard.steps.location.remaining', { count: 1 })).toBe('1 left');
    expect(i18n.t('requestFeedItem.occupancy', { count: 1, max: 1, occupied: 1 }))
      .toBe('1/1 slot taken');
  });

  test('🚨 « including 1 reinforcement », jamais « 1 reinforcements »', () => {
    const detail = i18n.t('matchCallUp.selection.footer.reinforcementsCount', { count: 1 });
    expect(detail).toBe('1 reinforcement');
    expect(i18n.t('matchCallUp.selection.footer.extras', { details: detail }))
      .toBe('including 1 reinforcement');
    expect(i18n.t('matchCallUp.selection.footer.offAppCount', { count: 2 })).toBe('2 off app');
  });
});

describe('FINITIONS4 D5 — le code de l app', () => {
  test('🚨 aucun texte de secours « Voir le detail »', () => {
    expect(fautifs(/Voir le detail\b/)).toEqual([]);
  });

  test('🚨 plus de « slots occupes » ni de « restant(s) » ecrits en dur', () => {
    expect(fautifs(/slots occupes|restant\(s\)/)).toEqual([]);
  });

  test('🚨 « Sam.. 15h00 » : l en-tete de la convocation n ajoute plus de point', () => {
    const chemin = join(RACINE_SRC, 'views', 'matchCallUp', 'MatchCallUpSelection.js');
    const source = readFileSync(chemin, 'utf8');
    expect(source).not.toContain('"EEE. ');
    expect(source).toContain('"EEE HH\'h\'mm"');
    // Le motif rend, avec la vraie langue francaise de date-fns, UN seul point.
    expect(format(new Date(2026, 9, 3, 15, 0), "EEE HH'h'mm", { locale: localeFr }))
      .toBe('sam. 15h00');
  });
});
