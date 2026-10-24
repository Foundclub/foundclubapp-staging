import { getShortAddress } from '../location';

it('P3-17 : code postal + ville plutôt que l’adresse complète', () => {
  expect(getShortAddress({ address: '12 rue de la Paix, 13002 Marseille', zipCode: '13002', city: 'Marseille' })).toBe('13002 Marseille');
});
