// ORGANISATEUR-VISIBLE (19/11, D258 « 2- A ») — la carte dit qui propose l'événement
// (« Proposé par Prénom N. »).
// Doublures reprises de EventCardNew.EVTCLUB.toutLeClub.test.js.
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { buildCompactEventCardPopulate } from '@/services/event/eventService';

import EventCardNew from '../EventCardNew';

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
  createNavigationContainerRef: () => ({ current: null, isReady: () => false }),
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

// eventService tire le module natif de téléchargement : doublure vide, seul le constructeur
// de populate est lu.
jest.mock('react-native-blob-util', () => ({}));
jest.mock('@/services/client', () => ({ __esModule: true, default: {} }));
jest.mock('@/config/runtimeUrls', () => ({ getApiBaseUrl: () => 'http://api.test' }));

const SORTIE = {
  ...FETE,
  audienceScope: null,
  customName: 'Spéléo du soir',
  name: 'Spéléo du soir',
  organizer: {
    documentId: 'u-9', email: 'camille@example.org', firstname: 'Camille', lastname: 'Durand',
  },
  team: {
    activities: [{ name: 'Spéléologie' }],
    club: CLUB,
    documentId: 'speleo',
    name: 'Spéléo du soir',
  },
  tournamentScopeMode: 'team',
};

let arbre = null;
const rendre = (item) => {
  act(() => {
    arbre = renderer.create(<EventCardNew item={item} onPress={jest.fn()} />);
  });
  return arbre.root;
};
const ligne = (racine) => racine.findAll(
  (n) => n.props?.testID === 'event-card-proposed-by' && n.type === Text,
);

afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
});

describe('ORGANISATEUR-VISIBLE — la carte', () => {
  test('une sortie proposée : « Proposé par Camille D. », sans e-mail ni nom complet', () => {
    const racine = rendre(SORTIE);
    expect(ligne(racine)).toHaveLength(1);
    expect(ligne(racine)[0].props.children).toBe('Proposé par Camille D.');
    const texte = JSON.stringify(arbre.toJSON());
    expect(texte).not.toContain('camille@example.org');
    expect(texte).not.toContain('Durand');
  });

  test('sans prénom (identité masquée) ou sans organisateur : aucune ligne', () => {
    const masque = { ...SORTIE, organizer: { firstname: '', lastname: '' } };
    expect(ligne(rendre(masque))).toHaveLength(0);
    act(() => arbre.unmount());
    expect(ligne(rendre({ ...SORTIE, organizer: null }))).toHaveLength(0);
  });

  test('un tournoi : aucune ligne (il dit déjà « Organisé par » le complexe)', () => {
    const tournoi = { ...SORTIE, tournamentScopeMode: 'autonomous', type: { name: 'Tournoi' } };
    expect(ligne(rendre(tournoi))).toHaveLength(0);
  });

  test('la liste ne demande au serveur QUE le prénom et le nom de l organisateur', () => {
    expect(buildCompactEventCardPopulate('moi').organizer)
      .toEqual({ fields: ['documentId', 'firstname', 'lastname'] });
  });
});
