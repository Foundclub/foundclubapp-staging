import { getSectionSortScore } from '../teamSort';

// BH12 P3-15 : les sections s'appellent « Masculin » / « Féminin », pas « masculine » / « feminine ».
test('Masculin, puis Féminin, puis Mixte', () => {
  expect(getSectionSortScore('Masculin')).toBe(0);
  expect(getSectionSortScore('Féminin')).toBe(1);
  expect(getSectionSortScore('Mixte')).toBe(2);
});
