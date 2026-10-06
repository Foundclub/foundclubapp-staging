import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import EventAnswerButtons from '@/components/molecules/eventAnswerButtons/EventAnswerButtons';

import EventCardNew from '../EventCardNew';

// PARENT-PLANNING (06/10/2026) — LA CARTE D UN EVENEMENT DE L ENFANT, DANS LE PLANNING DU
// PARENT.
//
// Decision d Adel « parent planning oui » (registre des mineurs, ligne 21) : le planning d un
// parent montre les evenements a venir de son enfant, EN LECTURE SEULE, avec le PRENOM de
// l enfant sur chaque carte (un parent de deux enfants doit savoir lequel).
//   - `childLabel` : une pastille de plus dans la rangee du haut, a cote du type (memes
//     formes, Montserrat, palette du theme) ;
//   - `readOnly` : la rangee de reponse disparait (ni « Participer », ni « Present / Absent »).
// Sans ces deux props, la carte ne change pas (temoin PROTEGE).

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

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));

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

const CLUB = { documentId: 'club-1', name: 'AS Montrivage' };
const EVENEMENT = {
  date: new Date(Date.now() + (2 * 24 * 60 * 60 * 1000)).toISOString(),
  documentId: 'e1',
  missings: [],
  name: 'Entrainement U15',
  participationRequests: [],
  participations: [],
  sessionStatus: 'open',
  team: {
    activities: [{ name: 'Football' }], club: CLUB, documentId: 'u15', name: 'U15',
  },
  type: { name: 'Entraînement' },
  validationMode: 'auto',
};

/** @type {any} */
let arbre = null;

/**
 * Rend la carte d EVENEMENT avec ces props en plus.
 * @param {any} props - Les props ajoutees.
 * @returns {any} La racine du rendu.
 */
const rendre = (props) => {
  act(() => {
    // eslint-disable-next-line react/jsx-props-no-spreading -- fabrique de test
    arbre = renderer.create(<EventCardNew item={EVENEMENT} onPress={jest.fn()} {...props} />);
  });
  return arbre.root;
};
const textes = (/** @type {any} */ racine) => racine.findAllByType(Text)
  .map((/** @type {any} */ n) => n.props.children)
  .filter((/** @type {any} */ v) => typeof v === 'string');
const pastilles = (/** @type {any} */ racine) => racine.findAll(
  (/** @type {any} */ n) => n.props?.testID === 'event-card-child-label',
);

afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
});

describe('PARENT-PLANNING / 3 — la carte d un evenement de l enfant', () => {
  test('3-9 ROUGE-AVANT — `childLabel` : le prenom de l enfant est ecrit sur la carte', () => {
    const racine = rendre({ childLabel: 'Hugo' });
    expect(textes(racine)).toContain('Hugo');
    expect(pastilles(racine).length).toBeGreaterThan(0);
    expect(pastilles(racine)[0].props.accessibilityLabel).toBe('Événement de Hugo');
  });

  test('3-10 ROUGE-AVANT — `readOnly` : aucune rangee de reponse', () => {
    const racine = rendre({ childLabel: 'Hugo', readOnly: true });
    expect(racine.findAllByType(EventAnswerButtons)).toHaveLength(0);
  });

  test('3-11 PROTEGE — sans ces props : pas de pastille, la rangee de reponse est la', () => {
    const racine = rendre({});
    expect(pastilles(racine)).toHaveLength(0);
    expect(racine.findAllByType(EventAnswerButtons)).toHaveLength(1);
  });
});
