import renderer, { act } from 'react-test-renderer';

import PastilleEtat from '@/views/reserverTerrain/components/PastilleEtat';

import { lisibles, parRepere } from '@/testSupport/temoinComplexe';

// RESA-L6B-2 (20/10/2026) — les états neufs du serveur RESA-L3 en pastille (planche P00 bloc 4,
// resa.css `pe-collecte` / `pe-pale`) : « En collecte · 6/10 » (cyan, personnes), « Non aboutie »
// (pâle, pointillée) ; et « Annulée » pour un participant, qui ne sait pas qui a annulé.

jest.mock(
  'react-i18next',
  () => jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next,
);
jest.mock('@/theme/themeContext', () => (
  jest.requireActual('@/testSupport/temoinComplexe').themeDeTemoin()
));

/**
 * Monte la pastille.
 * @param {Record<string, any>} props - Ses propriétés.
 * @returns {any} L'arbre.
 */
const monter = (props) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<PastilleEtat compte={props.compte} etat={props.etat} />);
  });
  return arbre;
};

it('« En collecte », avec le compte quand on le sait', () => {
  expect(lisibles(monter({ compte: '6/10', etat: 'enCollecte' }))).toEqual(['En collecte · 6/10']);
  const sansCompte = monter({ etat: 'enCollecte' });
  expect(lisibles(sansCompte)).toEqual(['En collecte']);
  expect(parRepere(sansCompte, 'pastille-etat-enCollecte')).not.toBeNull();
});

it('« Non aboutie » : pâle et pointillée', () => {
  const arbre = monter({ etat: 'nonAboutie' });
  expect(lisibles(arbre)).toEqual(['Non aboutie']);
  const pastille = parRepere(arbre, 'pastille-etat-nonAboutie');
  const style = Object.assign({}, ...[pastille.props.style].flat());
  expect(style.borderStyle).toBe('dashed');
});

it('« Annulée » (un participant)', () => {
  expect(lisibles(monter({ etat: 'annulee' }))).toEqual(['Annulée']);
});
