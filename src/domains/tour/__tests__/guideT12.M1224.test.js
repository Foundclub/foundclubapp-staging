import { PRESIDENT_GUIDE } from '@/domains/tour/presidentGuide';
import { isStepAvailable } from '@/domains/tour/tourGuideEngine';

// GUIDE-T12, M1224 (testeur, iPhone, 13/11 21:30 puis 2.6.903) : à la mission 2, le « + » du Staff
// n'est pas touchable, seul « Compris » l'est, et le guide passe à la mission 3. C'est la visite
// de la décision 1 A (sans offre Club, M2 est montré, pas joué) : le club CR-T5 du compte 444
// n'avait qu'un essai Club de 7 jours, posé le 06/11 17:32, « jusqu'au 13/11 ».

const etapesDeM2 = (/** @type {string} */ niveau) => {
  const flags = PRESIDENT_GUIDE.buildFlags({ subscriptionAccessLevel: niveau, userData: {} });
  return PRESIDENT_GUIDE.steps
    .filter((/** @type {any} */ s) => s.missionId === 'president_m2')
    .filter((/** @type {any} */ s) => isStepAvailable(s, { created: {}, flags }))
    .map((/** @type {any} */ s) => s.id);
};

test('M1224 : club sans offre Club, M2 se regarde (« + » non touchable, « Compris », M3)', () => {
  expect(etapesDeM2('FREE')).toEqual(['m2-visit', 'm2-visit-add']);
  const plus = PRESIDENT_GUIDE.steps.find((/** @type {any} */ s) => s.id === 'm2-visit-add');
  expect(plus).toMatchObject({ completesMission: true, lookOnly: true, targets: ['staff-add-coach'] });
});

test('M1224 : club avec l offre Club, même non certifié, le « + » se touche pour de vrai', () => {
  for (const niveau of ['CLUB', 'CLUB_UNVERIFIED']) {
    const ids = etapesDeM2(niveau);
    expect(ids.slice(0, 2)).toEqual(['m2-staff', 'm2-add']);
    expect(ids).not.toContain('m2-visit-add');
  }
});
