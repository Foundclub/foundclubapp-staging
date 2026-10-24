/* eslint-disable max-len -- entrées du rapport BUGHUNT, gardées telles quelles */
import { getShortAddress } from '../location';

it('P3-17 : code postal + ville plutôt que l’adresse complète', () => {
  expect(getShortAddress({ address: '12 rue de la Paix, 13002 Marseille', city: 'Marseille', zipCode: '13002' })).toBe('13002 Marseille');
});
