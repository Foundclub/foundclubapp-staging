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
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: mockUserData() }),
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

const fois = (/** @type {string} */ texte, /** @type {string} */ extrait) => texte
  .split(extrait).length - 1;

describe('EventCardNew — T-PAGES-4, la carte d un tournoi (recette 44)', () => {
  test('🔴 1 — sous le seuil (6 sur 24) : « 24 équipes attendues », aucun nombre inscrit', () => {
    const texte = textsOf(renderCard({ item: TOURNOI() }));
    expect(texte).toContain('24 équipes attendues');
    expect(texte).not.toContain('/ 24');
  });

  test('🔴 1 — sans résumé ni équipes (visiteur) : jamais « 0 / 24 »', () => {
    const texte = textsOf(renderCard({
      item: TOURNOI({ tournamentTeams: undefined, tournamentTeamsSummary: undefined }),
    }));
    expect(texte).not.toContain('0 / 24');
    expect(texte).toContain('24 équipes attendues');
  });

  test('🔴 1 — au seuil (8 sur 24) : la jauge dit le vrai nombre du serveur', () => {
    const texte = textsOf(renderCard({
      item: TOURNOI({ tournamentTeamsSummary: { expectedCount: 24, registeredCount: 8 } }),
    }));
    expect(texte).toContain('8 / 24 équipes');
  });

  test('🔴 3 — « À partir de 16 ans » et « Mixte » ne s écrivent qu une fois', () => {
    const texte = textsOf(renderCard({ item: TOURNOI() }));
    // 2 = la ligne sous le titre + la sonde de mesure invisible de MarqueeText (même texte,
    // hors flux). Avant : 4 (sous-titre, sa sonde, la ligne de catégorie, l'encart).
    expect(fois(texte, 'À partir de 16 ans')).toBe(2);
    expect(fois(texte, 'Mixte')).toBe(2);
  });
});
