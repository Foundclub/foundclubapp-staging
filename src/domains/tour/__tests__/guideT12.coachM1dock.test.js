import { Platform } from 'react-native';

import { getTourProfile } from '@/domains/tour/tourCatalog';
import { indexOfStep, matchSignal } from '@/domains/tour/tourGuideEngine';

import { RouteNames } from '@/navigation/routeNames';

// GUIDE-T12, point 2 du chef (16/11) : même piège que M1182 pour l'entraîneur SANS équipe sur le
// site. « Ouvre l'onglet entouré » (m1-dock) attendait `MyTeamList`, mais l'onglet du site mène
// le coach à `TeamList` (/teams, web src/layout/AppShell.tsx getTeamTabDestination).

const ctx = { created: {}, flags: {}, userData: { club: { documentId: 'club-1' } } };

const signalSur = (/** @type {string} */ os, /** @type {string} */ routeName) => {
  const avant = Platform.OS;
  Platform.OS = /** @type {any} */ (os);
  try {
    const coach = getTourProfile('coach');
    const index = indexOfStep(coach, 'm1-dock');
    const match = matchSignal(coach, index, { key: routeName, kind: 'route' }, ctx);
    return match && /** @type {any} */ (coach).steps[match.index]?.id;
  } finally {
    Platform.OS = avant;
  }
};

test('site : l onglet entouré (« Mes équipes », TeamList) fait avancer m1-dock', () => {
  expect(signalSur('web', RouteNames.TeamList)).toBe('m1-new');
});

test('MyTeamList fait toujours avancer ; sur le téléphone, TeamList non', () => {
  expect(signalSur('web', RouteNames.MyTeamList)).toBe('m1-new');
  expect(signalSur('ios', RouteNames.MyTeamList)).toBe('m1-new');
  expect(signalSur('ios', RouteNames.TeamList)).toBeNull();
});
