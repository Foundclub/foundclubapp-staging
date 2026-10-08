import renderer, { act } from 'react-test-renderer';

import CompositionMessageBubble from '../CompositionMessageBubble';

// CONVOC-RDV (decision d'Adel du 08/10, `rdv lot`) — LA CARTE « COMPOSITION PUBLIEE » DIT LE RDV.
//
// Le rendez-vous partait en message texte apres la carte. Le serveur le range desormais dans la
// convocation (`rendezVous: { time, place }`) et le pose sur la carte du fil : elle l'affiche
// « RDV 13:30 · Au club ». Une carte postee AVANT n'a pas la cle : rien ne change pour elle.

jest.mock('../CompositionAnswerBar', () => ({ __esModule: true, default: () => null }));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('@/components/tactical/RenderedTacticalField', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: ({ children }) => <View>{children}</View> };
});
jest.mock('@/theme/themeContext', () => {
  const colors = jest.requireActual('@/theme/colors').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  return {
    __esModule: true,
    default: () => ({
      Colors: colors(),
      Fonts: jest.requireActual('@/theme/fonts').default(colors()),
      Spaces,
    }),
  };
});

const COMPO = {
  eventAddress: 'Stade Georges Ricard, 13710 Fuveau',
  eventDate: '2026-10-11T13:00:00.000Z',
  eventId: 'evt-1',
  eventName: 'US Fuveau - AS Gardanne',
  placements: [],
  publishedVersion: 1,
  schemaVersion: 3,
  teamName: 'Seniors',
  teams: [{ id: 't1', name: 'Seniors', placements: [] }],
  type: 'lineup_share',
};

const rendre = (composition) => {
  let arbre;
  act(() => {
    arbre = renderer.create(<CompositionMessageBubble composition={composition} />);
  });
  return arbre;
};

const texteDe = (enfants) => [].concat(enfants)
  .map((e) => (typeof e === 'string' ? e : ''))
  .join('');

const ligneRdv = (arbre) => arbre.root.findAll(
  (noeud) => noeud.props.testID === 'composition-rendez-vous' && typeof noeud.type === 'string',
);

describe('CRDV — la carte du fil affiche le rendez-vous', () => {
  test('« RDV 13:30 · Au club », et le lecteur d ecran l entend', () => {
    const arbre = rendre({ ...COMPO, rendezVous: { place: 'Au club', time: '13:30' } });
    const [ligne] = ligneRdv(arbre);
    expect(ligne).toBeDefined();
    expect(texteDe(ligne.props.children)).toBe('RDV 13:30 · Au club');

    const carte = arbre.root.find((noeud) => noeud.props.accessibilityRole === 'button'
      && String(noeud.props.accessibilityLabel || '').includes('Composition publiée'));
    expect(carte.props.accessibilityLabel).toContain('RDV 13:30 · Au club');
  });

  test('l heure seule : « RDV 13:30 »', () => {
    const arbre = rendre({ ...COMPO, rendezVous: { place: null, time: '13:30' } });
    expect(texteDe(ligneRdv(arbre)[0].props.children)).toBe('RDV 13:30');
  });

  test('une carte d AVANT (sans la cle), un `null` ou une valeur abimee : aucune ligne', () => {
    expect(ligneRdv(rendre(COMPO))).toHaveLength(0);
    expect(ligneRdv(rendre({ ...COMPO, rendezVous: null }))).toHaveLength(0);
    const abimee = { ...COMPO, rendezVous: { place: { x: 1 }, time: '13h30' } };
    expect(ligneRdv(rendre(abimee))).toHaveLength(0);
  });
});
