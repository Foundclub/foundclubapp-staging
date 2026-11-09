import { PRESIDENT_GUIDE } from '@/domains/tour/presidentGuide';
import {
  indexOfStep,
  isStepAvailable,
  matchSignal,
} from '@/domains/tour/tourGuideEngine';

import { RouteNames } from '@/navigation/routeNames';

// GUIDE-D-CORR-3, M1083 (TestFlight 2.6.97, 09/11) : au bonus 5, toucher « Événement » ouvrait la
// page des événements et la bulle disait « Tu as quitté le guide ici ». Toucher la case visée
// fait avancer le guide : il présente la page ouverte, puis ramène à l'accueil pour la suivante.

const profile = PRESIDENT_GUIDE;
const ctx = { created: {}, flags: {} };
const at = (id) => indexOfStep(profile, id);
const step = (id) => profile.steps[at(id)];
const idAt = (index) => profile.steps[index]?.id;

const CARDS = [
  ['b5-ev', RouteNames.SearchEvents, 'b5-cl'],
  ['b5-cl', RouteNames.SearchClubs, 'b5-re'],
  ['b5-re', RouteNames.SearchReservations, 'b5-pr'],
  ['b5-pr', RouteNames.SearchRecruitment, 'b5-fr'],
  ['b5-fr', RouteNames.SearchHub, null],
];

describe('B5 : toucher la case visée fait avancer, ce n est pas une sortie', () => {
  it.each(CARDS)('%s : la page ouverte par la case est présentée', (id, route) => {
    const match = matchSignal(profile, at(id), { key: route, kind: 'route' }, ctx);
    expect(match).not.toBeNull();
    expect(idAt(match.index)).toBe(`${id}-page`);
    const page = step(`${id}-page`);
    expect(page.missionId).toBe('president_b5');
    expect(page.navTarget.routeName).toBe(route);
    expect(typeof page.text).toBe('string');
    expect(page.text).not.toMatch(/undefined/);
  });

  it.each(CARDS)('%s : la flèche (retour à l accueil) mène à la case suivante', (id, _r, next) => {
    const home = { key: RouteNames.SearchHome, kind: 'route' };
    const back = matchSignal(profile, at(`${id}-page`), home, ctx);
    expect(back).not.toBeNull();
    if (next === null) {
      expect(back.completes).toBe(true);
      expect(step(`${id}-page`).nextLabel).toBeTruthy();
      return;
    }
    expect(idAt(back.index)).toBe(next);
    expect(step(`${id}-page`).targets).toEqual(['header.back']);
  });

  it.each(CARDS)('%s : l alias se remplace par SearchHub, ce qui compte aussi', (id) => {
    const match = matchSignal(profile, at(id), { key: RouteNames.SearchHub, kind: 'route' }, ctx);
    expect(idAt(match?.index)).toBe(`${id}-page`);
  });

  it('le parcours par « Suivant » ne change pas : une bulle par case', () => {
    const played = profile.steps
      .filter((one) => one.missionId === 'president_b5' && isStepAvailable(one, ctx))
      .map((one) => one.id);
    expect(played).toEqual(['b5-back', 'b5-ev', 'b5-cl', 'b5-re', 'b5-pr', 'b5-fr']);
  });
});
