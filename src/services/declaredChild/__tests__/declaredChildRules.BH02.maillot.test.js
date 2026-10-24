// BH02 (BUGHUNT 24/10) — P2-09 et P2-10 : le numéro de maillot d'un enfant.
import { buildChildCardPayload, buildChildPayload } from '../declaredChildRules';

it('P2-09 : une saisie invalide n\'efface pas le numéro affiché', () => {
  expect(buildChildCardPayload({ number: 'abc' }, { number: 7 })).toEqual({});
  expect(buildChildCardPayload({ number: '' }, { number: 7 })).toEqual({ number: null });
});

it('P2-10 : un numéro fait d\'espaces ne devient pas 0', () => {
  expect(buildChildPayload({ number: '   ' })).toEqual({});
});
