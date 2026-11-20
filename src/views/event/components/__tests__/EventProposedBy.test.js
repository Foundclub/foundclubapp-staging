// ORGANISATEUR-VISIBLE (19/11, D258 « 2- A ») — la fiche du TÉLÉPHONE dit qui propose l'événement.
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import EventProposedBy from '../EventProposedBy';

jest.mock('@/theme/themeContext', () => {
  const styleLeaf = {};
  const makeRamp = () => new Proxy({}, { get: () => styleLeaf });
  return {
    __esModule: true,
    default: () => ({ Fonts: makeRamp(), Spaces: new Proxy({}, { get: () => makeRamp() }) }),
  };
});
jest.mock(
  'react-i18next',
  () => jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next,
);

const SORTIE = {
  organizer: {
    documentId: 'u-9', email: 'camille@example.org', firstname: 'Camille', lastname: 'Durand',
  },
  tournamentScopeMode: 'team',
  type: { name: 'Autre' },
};

/** @type {any} */
let arbre = null;
const rendre = (/** @type {any} */ event) => {
  act(() => { arbre = renderer.create(<EventProposedBy event={event} />); });
  return arbre;
};
afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
});

test('une sortie proposée : « Proposé par Camille D. », sans e-mail ni nom complet', () => {
  const lignes = rendre(SORTIE).root.findAll((/** @type {any} */ n) => n.type === Text
    && n.props.testID === 'event-details-proposed-by');
  expect(lignes).toHaveLength(1);
  expect(lignes[0].props.children).toBe('Proposé par Camille D.');
  const texte = JSON.stringify(arbre.toJSON());
  expect(texte).not.toContain('camille@example.org');
  expect(texte).not.toContain('Durand');
});

test('sans prénom, sans organisateur ou sur un tournoi : rien', () => {
  expect(rendre({ ...SORTIE, organizer: { firstname: '' } }).toJSON()).toBeNull();
  act(() => arbre.unmount());
  expect(rendre({ ...SORTIE, organizer: null }).toJSON()).toBeNull();
  act(() => arbre.unmount());
  expect(rendre({ ...SORTIE, type: { name: 'Tournoi' } }).toJSON()).toBeNull();
});
