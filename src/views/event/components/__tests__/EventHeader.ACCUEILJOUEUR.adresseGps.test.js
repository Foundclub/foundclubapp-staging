import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import EventHeader from '../EventHeader';

// ACCUEIL-JOUEUR (09/11/2026, points 3 et 4, mots d'Adel relayés par le chef vers 18:00) — LA
// FICHE D'UN MATCH. 3 : le lieu en adresse précise (rue, ville), plus « Lyon (69001) » seul.
// 4 : toucher l'adresse ouvrait déjà le GPS, mais rien ne le montrait : une ligne d'action
// visible, « Ouvrir dans le GPS », bleue avec son icône, rôle bouton, qui réutilise la même
// ouverture (`openExternalMap` ; sur le site, la carte dans un nouvel onglet).
// Écrit ROUGE.

jest.mock('@/components/molecules/clubLogoMark/ClubLogoMark', () => () => null);

const mockOpenExternalMap = jest.fn();
jest.mock('@/platform/maps/externalMap', () => ({
  openExternalMap: (/** @type {any} */ options) => mockOpenExternalMap(options),
}));

jest.mock('@/theme/themeContext', () => {
  const styleLeaf = {};
  const makeRamp = () => new Proxy({}, { get: () => styleLeaf });
  return {
    __esModule: true,
    default: () => ({
      Alignments: makeRamp(),
      ApplicationStyle: new Proxy({}, { get: () => makeRamp() }),
      Colors: new Proxy({}, { get: (_cible, cle) => `couleur-${String(cle)}` }),
      Fonts: new Proxy({}, { get: () => styleLeaf }),
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: new Proxy({}, { get: () => makeRamp() }),
    }),
  };
});

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next
));

const ADRESSE = '12 rue de la République, 69001 Lyon';
const MATCH = {
  date: '2026-09-05T12:00:00.000Z',
  documentId: 'evt-1',
  locationDetails: JSON.stringify({
    address: { city: 'Lyon', label: ADRESSE, postcode: '69001' },
  }),
  name: 'Match',
  team: { club: { documentId: 'club-1', name: 'AS Montrivage' }, documentId: 't-1', name: 'U15' },
  type: { documentId: 'type-1', name: 'Match' },
};
const ENCART = {
  centerLabel: '19:00', isScoreShown: false, opponentName: 'Test-COMPO', value: 'VS',
};

/** @type {any[]} */
const montes = [];
const monter = (/** @type {any} */ event) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<EventHeader event={event} matchScoreSummary={ENCART} />);
  });
  montes.push(arbre);
  return arbre;
};
afterEach(() => {
  act(() => montes.splice(0).forEach((arbre) => arbre.unmount()));
  jest.clearAllMocks();
});

const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ n) => [].concat(n.props.children).join('').replace(/\u00a0/g, ' '));

describe('ACCUEIL-JOUEUR — la fiche d un match : adresse précise et GPS visible', () => {
  test('point 3 : l adresse précise, plus la ville seule', () => {
    const lus = textes(monter(MATCH));
    expect(lus).toContain(ADRESSE);
    expect(lus).not.toContain('Lyon (69001)');
  });

  test('point 3 : sans adresse précise, ce qui existe aujourd hui', () => {
    const sansAdresse = { ...MATCH, location: { city: 'Lyon' }, locationDetails: undefined };
    const lus = textes(monter(sansAdresse));
    expect(lus).toContain('Lyon');
  });

  test('point 4 : « Ouvrir dans le GPS » se voit, et c est un bouton qui ouvre le lieu', () => {
    const arbre = monter(MATCH);
    expect(textes(arbre)).toContain('Ouvrir dans le GPS');
    const actions = arbre.root.findAll((/** @type {any} */ n) => typeof n.type === 'string'
      && n.props.testID === 'event-header-ouvrir-gps');
    expect(actions).toHaveLength(1);
    expect(actions[0].props.accessibilityRole ?? actions[0].props.role).toBe('button');
    expect(actions[0].props.accessibilityLabel ?? actions[0].props['aria-label'])
      .toBe('Ouvrir dans le GPS');
    act(() => actions[0].props.onClick());
    expect(mockOpenExternalMap).toHaveBeenCalledWith(expect.objectContaining({ label: ADRESSE }));
  });
});
