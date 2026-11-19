/* eslint-disable max-len -- titres de témoins en phrases */
import renderer, { act } from 'react-test-renderer';

import EventCardNew from '../EventCardNew';

// Filet L03 (E6) : la carte événement n'avait AUCUN test. Ces tests
// caractérisent les DONNÉES qu'elle affiche et les commandes qu'elle expose
// (mêmes données, mêmes handlers) — ils doivent rester verts après la refonte
// visuelle du handoff « Cartes Rechercher » (3b + 4a).

// Le mock officiel de reanimated est en ESM pur, non transformé par la config
// jest du projet — mock manuel minimal des primitives utilisées par la carte.
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

// Le marquee sponsors suspend son animation hors focus : hors navigateur
// (tests), l'écran est considéré comme focus.
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
}));

jest.mock('@/theme/themeContext', () => {
  // Jetons opaques : le contrat de thème interdit les littéraux hex, et un
  // mock n'a pas besoin de vraies couleurs. `couleur-<jeton>` rend chaque
  // usage assertable (ex. la couleur du chip par type d'événement).
  const styleLeaf = {};
  const makeRamp = () => new Proxy({}, { get: () => styleLeaf });
  return {
    __esModule: true,
    default: () => ({
      Alignments: makeRamp(),
      ApplicationStyle: new Proxy({}, { get: () => makeRamp() }),
      Colors: new Proxy({}, { get: (_target, key) => `couleur-${String(key)}` }),
      Fonts: makeRamp(),
      // `image-<clé>` : rend le fond illustré par type assertable.
      Images: new Proxy({}, { get: (_target, key) => `image-${String(key)}` }),
      Spaces: new Proxy({}, { get: () => makeRamp() }),
    }),
  };
});

jest.mock('react-i18next', () => ({
  // La chaîne d'import réelle passe par @/theme/strings qui initialise i18next.
  initReactI18next: { init: jest.fn(), type: '3rdParty' },
  useTranslation: () => ({
    t: (_key, fallback) => fallback || _key,
  }),
}));

const mockUserData = jest.fn();
// T-PAGES-4 : l'organisateur du tournoi (canManageEvent) garde la jauge du vrai nombre.
const mockCanManageEvent = jest.fn(() => false);
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ canManageEvent: mockCanManageEvent, userData: mockUserData() }),
}));

const mockHaveIAlreadyJoined = jest.fn();
jest.mock('@/domains/event/useEvent', () => ({
  __esModule: true,
  default: () => ({
    canEventBeJoined: () => true,
    haveIAlreadyAnsweredNo: () => false,
    haveIAlreadyJoined: (args) => mockHaveIAlreadyJoined(args),
  }),
}));

const collectTexts = (node, acc = []) => {
  if (node === null || node === undefined) return acc;
  if (typeof node === 'string') {
    acc.push(node);
    return acc;
  }
  if (Array.isArray(node)) {
    node.forEach((child) => collectTexts(child, acc));
    return acc;
  }
  collectTexts(node.children, acc);
  return acc;
};

const renderCard = (props) => {
  let tree;
  act(() => {
    // eslint-disable-next-line react/jsx-props-no-spreading -- fabrique de test
    tree = renderer.create(<EventCardNew {...props} />);
  });
  return tree;
};

const textsOf = (tree) => collectTexts(tree.toJSON()).join('\n');

// T-PAGES-4 (17/11, défauts 1 et 3 de la recette 44, iPhone, sans compte, Recherche › Événements,
// carte « TEST — FoundClub x AR Soccer ») :
//   1. la jauge disait « Places 0 / 24 équipes » à un visiteur, alors que 6 équipes étaient
//      inscrites : elle suit maintenant la règle de la fiche (« 4- A », seuil des 30 %) ;
//   3. « À partir de 16 ans · Mixte » était écrit deux fois sous le titre, et une 3ᵉ fois dans
//      l'encart : une seule fois.
const TOURNOI = (/** @type {any} */ autres = {}) => ({
  club: { name: 'AR Soccer' },
  date: '2099-12-19T18:00:00',
  documentId: 'tournoi-1912',
  name: 'TEST — FoundClub x AR Soccer',
  sessionStatus: 'open',
  startTime: '19:00:00',
  tournamentCategory: { name: 'Sénior' },
  tournamentConfig: { maxTeams: 24, minAge: 16 },
  tournamentSection: { name: 'Mixte' },
  tournamentTeamsSummary: { expectedCount: 24, registeredCount: 6 },
  type: { name: 'Tournoi' },
  ...autres,
});

// IMPL-1-FICHE (18/11/2026, pack T-DESIGN-TOURNOI, écrans 6a et 7a, option A retenue par Adel
// « 6- A ») — la carte d'un tournoi dans les listes (Événements, Rechercher) :
//   · le lieu dit « AR Soccer · Montpellier » (le complexe et la ville), jamais le terrain
//     (« Terrain A ») ; il prend toute la ligne ;
//   · la pastille TOURNOI passe en bleu (plus de rose) ;
//   · un bouton « Voir le tournoi » : toute la carte mène à la fiche, le mot dit vrai.
// M1323 (testeur, 2.6.908) : la jauge sous 30 % et l'appui d'un visiteur sont déjà tenus par
// EventCardNew.T-PAGES-4.tournoi.test.js et EventListContent.T-PAGES-4.visiteurOuvreLaFiche.test.js.
const LIEU = 'AR Soccer, 119 rue de la Rauze basse, 34070 Montpellier';

const parTestID = (/** @type {any} */ tree, /** @type {string} */ id) => tree.root.findAll(
  (/** @type {any} */ n) => n.props?.testID === id && typeof n.type === 'string',
);

describe('IMPL-1 · 6a / 7a — la carte d un tournoi', () => {
  test('🔴 « AR Soccer · Montpellier » à la place de « Terrain A »', () => {
    const texte = textsOf(renderCard({ item: TOURNOI({ facility: { name: 'Terrain A' }, location: LIEU }) }));
    expect(texte).toContain('AR Soccer · Montpellier');
    expect(texte).not.toContain('Terrain A');
  });

  test('🔴 la pastille TOURNOI en bleu primaire, plus en rose', () => {
    const json = JSON.stringify(renderCard({ item: TOURNOI({ location: LIEU }) }).toJSON());
    expect(json).toContain('couleur-primary500');
    expect(json).not.toContain('couleur-rose500');
  });

  test('🔴 un bouton « Voir le tournoi » qui ouvre la fiche, comme toute la carte', () => {
    const ouvrir = jest.fn();
    const tree = renderCard({ item: TOURNOI({ location: LIEU }), onPress: ouvrir });
    const [bouton] = parTestID(tree, 'event-card-see-tournament');
    expect(bouton).toBeDefined();
    expect(textsOf(tree)).toContain('Voir le tournoi');
    act(() => { (bouton.props.onClick || bouton.props.onPress)(); });
    expect(ouvrir).toHaveBeenCalledTimes(1);
  });

  test('l organisateur qui valide garde ses deux boutons, sans « Voir le tournoi »', () => {
    const tree = renderCard({
      item: TOURNOI({ location: LIEU }), onPress: jest.fn(), onRefuse: jest.fn(), onValidate: jest.fn(),
    });
    expect(parTestID(tree, 'event-card-see-tournament')).toHaveLength(0);
  });

  test('un match garde son lieu et n a pas de « Voir le tournoi »', () => {
    const tree = renderCard({
      item: {
        club: { name: 'Foot Rauze' }, date: '2099-12-20T10:30:00', documentId: 'm1', facility: { name: 'Stade de Lattes' }, type: { name: 'Match' },
      },
      onPress: jest.fn(),
    });
    expect(textsOf(tree)).toContain('Stade de Lattes');
    expect(parTestID(tree, 'event-card-see-tournament')).toHaveLength(0);
  });
});
