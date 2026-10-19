import { USER_ROLES } from '@/domains/auth/authUseCases';

import { resolveParticipationOffer } from './participationFlow';

test('REC17-003 : en mode Parent, un joueur repond pour ses enfants, pas pour lui', () => {
  expect(resolveParticipationOffer({
    isConvenedMember: true,
    isParentMode: true,
    user: { role: { name: USER_ROLES.player } },
  })).toBe('children');
});

test('REC17-003 : le role Parent ne devient pas repondant personnel par une affiliation', () => {
  expect(resolveParticipationOffer({
    isConvenedMember: true,
    user: { role: { name: USER_ROLES.parent } },
  })).toBe('children');
});

test('REC17-003 : le joueur dans son mode habituel conserve sa reponse', () => {
  expect(resolveParticipationOffer({
    isConvenedMember: true,
    isParentMode: false,
    user: { role: { name: USER_ROLES.player } },
  })).toBe('answer');
});
