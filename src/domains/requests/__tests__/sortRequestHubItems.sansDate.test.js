import { sortRequestHubItems } from '../requestMappers';

// BH12 P2-22 : deux demandes sans date ⇒ -Infinity - -Infinity = NaN ; l'ordre doit rester stable.
test('sans date des deux côtés, on départage par type et id', () => {
  const items = [{ id: 'b', type: 'team' }, { id: 'a', type: 'team' }, { id: 'c', type: 'club' }];
  expect(sortRequestHubItems(items).map((item) => item.id)).toEqual(['c', 'a', 'b']);
});
