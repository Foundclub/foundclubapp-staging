import { Platform } from 'react-native';

import { PRESIDENT_GUIDE } from '@/domains/tour/presidentGuide';
import { indexOfStep, matchSignal } from '@/domains/tour/tourGuideEngine';
import { RouteNames } from '@/navigation/routeNames';

// GUIDE-T12, M1182 (testeur, site, 13/11 puis 16/11) : à « Puis retourne sur la fiche du club :
// touche l'onglet entouré », l'onglet du club mène le dirigeant à « Mes équipes » (`TeamList`,
// /teams?clubId=…, web src/layout/AppShell.tsx getTeamTabDestination), ou au tableau du club
// omnisports (`CMDashboard`). L'étape n'attendait que `Club` : le guide restait figé.

const ctx = { created: {}, userData: { club: { documentId: 'club-1' } } };

const signalSur = (/** @type {string} */ os, /** @type {string} */ routeName) => {
  const avant = Platform.OS;
  Platform.OS = /** @type {any} */ (os);
  try {
    const index = indexOfStep(PRESIDENT_GUIDE, 'm1-fback');
    return matchSignal(PRESIDENT_GUIDE, index, { key: routeName, kind: 'route' }, ctx);
  } finally {
    Platform.OS = avant;
  }
};

test('M1182 : sur le site, l onglet du club (« Mes équipes ») fait avancer m1-fback', () => {
  const match = signalSur('web', RouteNames.TeamList);
  expect(match).not.toBeNull();
  expect(PRESIDENT_GUIDE.steps[/** @type {any} */ (match).index].id).toBe('m1-poster');
});

test('M1182 : sur le site, le tableau du club omnisports fait aussi avancer m1-fback', () => {
  expect(signalSur('web', RouteNames.CMDashboard)).not.toBeNull();
});

test('M1182 : la fiche du club fait toujours avancer ; sur le téléphone, les équipes non', () => {
  expect(signalSur('web', RouteNames.Club)).not.toBeNull();
  expect(signalSur('ios', RouteNames.Club)).not.toBeNull();
  expect(signalSur('ios', RouteNames.TeamList)).toBeNull();
});
