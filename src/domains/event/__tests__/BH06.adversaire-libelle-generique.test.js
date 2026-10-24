import { resolveEventOpponentName } from '../eventDisplayName';

// 🐞 BUGHUNT P1-16 (BH06) — un premier invité au libellé générique (« Adversaire »)
// était retenu puis vidé par la normalisation : l'adversaire réel, deuxième, disparaissait.

describe('BH06 P1-16 — adversaire après un libellé générique', () => {
  test('[Adversaire, FC Lyon] ⇒ FC Lyon', () => {
    expect(resolveEventOpponentName({
      invitedTeams: [{ name: 'Adversaire' }, { name: 'FC Lyon' }],
    })).toBe('FC Lyon');
  });
});
