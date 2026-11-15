import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import EventAnswerButtons from '@/components/molecules/eventAnswerButtons/EventAnswerButtons';

import EventCardNew from '../EventCardNew';

// EVT-CLUB-ECRANS (14/11/2026, D121) — ecran 3 de la maquette v2 : dans le planning, la carte d'un
// evenement « tout le club » porte une pastille « Tout le club » a cote du type, et garde ses
// boutons Present / Absent. Un evenement « tout le club » hors Match / Tournoi n'a PAS d'equipe
// (`team: null`) : la carte doit le lire sans planter. Doublures reprises de
// EventCardNewParentPlanning.test.js.

jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: { View },
    Easing: { linear: jest.fn() },
    useAnimatedStyle: (factory) => (typeof factory === 'function' ? factory() : {}),
    useSharedValue: (value) => ({ value }),
    withTiming: (value) => value,
  };
});

jest.mock('@/utils/imageUrl', () => ({
  getImageUrl: (url) => url,
}));

jest.mock('react-native-linear-gradient', () => 'LinearGradient');

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
}));

jest.mock('@/theme/themeContext', () => {
  const styleLeaf = {};
  const makeRamp = () => new Proxy({}, { get: () => styleLeaf });
  return {
    __esModule: true,
    default: () => ({
      Alignments: makeRamp(),
      ApplicationStyle: new Proxy({}, { get: () => makeRamp() }),
      Colors: new Proxy({}, { get: (_target, key) => `couleur-${String(key)}` }),
      Fonts: makeRamp(),
      Images: new Proxy({}, { get: (_target, key) => `image-${String(key)}` }),
      Spaces: new Proxy({}, { get: () => makeRamp() }),
    }),
  };
});

jest.mock(
  'react-i18next',
  () => jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next,
);

// Un JOUEUR : sans `readOnly`, une seance ouverte lui propose une reponse.
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: { documentId: 'zoe', role: { name: 'Joueur', type: 'joueur' } } }),
}));

jest.mock('@/domains/event/useEvent', () => ({
  __esModule: true,
  default: () => ({
    canEventBeJoined: () => true,
    haveIAlreadyAnsweredNo: () => false,
    haveIAlreadyJoined: () => false,
  }),
}));

const CLUB = { documentId: 'club-1', name: 'AS Les Bruyeres' };
const FETE = {
  audienceScope: 'club',
  club: CLUB,
  customName: 'Fete de fin d annee',
  date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
  documentId: 'e-club',
  missings: [],
  name: 'Fete de fin d annee',
  participationRequests: [],
  participations: [],
  sessionStatus: 'closed',
  team: null,
  type: { name: 'Autre' },
  validationMode: 'auto',
};

let arbre = null;
const rendre = (item) => {
  act(() => {
    arbre = renderer.create(<EventCardNew item={item} onPress={jest.fn()} />);
  });
  return arbre.root;
};
const pastille = (racine) => racine.findAll((n) => n.props?.testID === 'event-card-club-audience');
const textes = (racine) => racine
  .findAllByType(Text)
  .map((n) => n.props.children)
  .filter((v) => typeof v === 'string');

afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
});

describe('EVT-CLUB — ecran 3 : la carte du planning', () => {
  test('« tout le club » sans equipe : la pastille, et les boutons de reponse', () => {
    const racine = rendre(FETE);
    expect(pastille(racine).length).toBeGreaterThan(0);
    expect(textes(racine)).toContain('Tout le club');
    expect(racine.findAllByType(EventAnswerButtons)).toHaveLength(1);
  });

  test('un evenement ordinaire n a pas la pastille (rien ne change)', () => {
    const racine = rendre({
      ...FETE,
      audienceScope: null,
      team: {
        activities: [{ name: 'Football' }],
        club: CLUB,
        documentId: 'u15',
        name: 'U15',
      },
    });
    expect(pastille(racine)).toHaveLength(0);
    expect(textes(racine)).not.toContain('Tout le club');
  });
});
