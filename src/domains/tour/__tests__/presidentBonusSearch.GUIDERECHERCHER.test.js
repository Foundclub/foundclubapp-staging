import { PRESIDENT_GUIDE } from '@/domains/tour/presidentGuide';
import {
  indexOfStep,
  isStepAvailable,
  matchSignal,
} from '@/domains/tour/tourGuideEngine';

import { RouteNames } from '@/navigation/routeNames';

// GUIDE-RECHERCHER (M1101, TestFlight 2.6.98, 10/11 ; « 216- A », liste validée par le chef) :
// « si le dirigeant veut regarder la partie rechercher qu'on lui explique comment ça fonctionne,
// rapidement, mais lui montrer les filtres, les dates… ; tous les onglets sauf Réservation ».
// Chaque page ouverte par sa case enchaîne des bulles courtes, une zone désignée par bulle ;
// la flèche (retour à l'accueil) mène toujours à la case suivante ; Réservations ne change pas.

const profile = PRESIDENT_GUIDE;
const ctx = { created: {}, flags: {} };
const at = (id) => indexOfStep(profile, id);
const step = (id) => profile.steps[at(id)];
const idAt = (index) => profile.steps[index]?.id;
const HOME = { key: RouteNames.SearchHome, kind: 'route' };

// Page → bulles dans l'ordre, avec la zone désignée, et la case qui suit le retour à l'accueil.
const PAGES = [
  ['b5-ev', [
    ['b5-ev-page', 'search.events.dates'],
    ['b5-ev-filters', 'search.filters'],
  ], 'b5-cl'],
  ['b5-cl', [
    ['b5-cl-page', 'search.clubs.chips'],
    ['b5-cl-filters', 'search.filters'],
  ], 'b5-re'],
  ['b5-pr', [
    ['b5-pr-page', 'search.recruitment.tabs'],
    ['b5-pr-filters', 'search.filters'],
  ], 'b5-fr'],
  ['b5-fr', [
    ['b5-fr-page', 'friendly.tabs'],
    ['b5-fr-filters', 'search.filters'],
    ['b5-fr-create', 'friendly.create'],
  ], null],
];

describe('GUIDE-RECHERCHER : chaque page de Rechercher s’explique en quelques bulles', () => {
  it.each(PAGES)('%s : une zone désignée par bulle, dans l’ordre validé', (card, bubbles) => {
    bubbles.forEach(([id, target]) => {
      expect(step(id)).toBeDefined();
      expect(step(id).targets).toEqual([target]);
      expect(step(id).missionId).toBe('president_b5');
      expect(typeof step(id).text).toBe('string');
      // Bulles courtes : deux lignes de téléphone, trois au plus.
      expect(step(id).text.length).toBeLessThanOrEqual(150);
    });
    // La case aiguille toujours vers la première bulle de sa page.
    const opened = matchSignal(profile, at(card), { key: RouteNames.SearchHub, kind: 'route' }, ctx);
    expect(idAt(opened.index)).toBe(bubbles[0][0]);
  });

  it.each(PAGES)('%s : « Suivant » passe à la bulle suivante de la même page', (_card, bubbles) => {
    bubbles.slice(0, -1).forEach(([id], index) => {
      expect(step(id).nextGoto).toBe(bubbles[index + 1][0]);
      expect(step(id).nextLabel).toBeTruthy();
    });
  });

  it.each(PAGES)('%s : à chaque bulle, la flèche mène à la case suivante', (_card, bubbles, next) => {
    bubbles.forEach(([id]) => {
      const back = matchSignal(profile, at(id), HOME, ctx);
      expect(back).not.toBeNull();
      if (next === null) {
        // Dernière page : le retour à l'accueil finit le bonus, à toute bulle.
        expect(back.completes).toBe(true);
      } else {
        expect(idAt(back.index)).toBe(next);
      }
    });
  });

  it.each(PAGES)('%s : « Reprendre » rouvre la page, à chaque bulle', (_card, bubbles) => {
    const page = step(bubbles[0][0]).navTarget;
    bubbles.forEach(([id]) => {
      expect(step(id).navTarget).toEqual(page);
      expect(step(id).navTarget.routeName).toBe(RouteNames.HomeTab);
      expect(isStepAvailable(step(id), ctx)).toBe(false);
    });
  });

  it('Amicaux : la dernière bulle finit le bonus au bouton « Compris »', () => {
    expect(step('b5-fr-create').completesMission).toBe(true);
    expect(step('b5-fr-create').nextGoto).toBeUndefined();
    expect(step('b5-fr-create').nextLabel).toBeTruthy();
  });

  it('Réservations ne change pas : une bulle, sur la flèche', () => {
    expect(step('b5-re-page').targets).toEqual(['header.back']);
    expect(step('b5-re-page').nextGoto).toBeUndefined();
    expect(step('b5-re-page').text).toMatch(/créneaux de terrains libres/);
  });

  it('le parcours des cases par « Suivant » ne change pas', () => {
    const played = profile.steps
      .filter((one) => one.missionId === 'president_b5' && isStepAvailable(one, ctx))
      .map((one) => one.id);
    expect(played).toEqual(['b5-back', 'b5-ev', 'b5-cl', 'b5-re', 'b5-pr', 'b5-fr']);
  });
});
