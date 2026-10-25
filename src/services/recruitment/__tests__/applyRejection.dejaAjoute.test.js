/* eslint-disable max-len */
import { isExpectedApplyRejection } from '../applyRejection';

// BH12 P2-21 : « déjà été ajouté » est un refus métier (ALREADY_ACCEPTED le connaît), pas une panne.
test('« Tu as déjà été ajouté » est un refus attendu', () => {
  expect(isExpectedApplyRejection('Tu as déjà été ajouté à cette équipe.')).toBe(true);
});
