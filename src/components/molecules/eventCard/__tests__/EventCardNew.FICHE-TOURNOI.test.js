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
    // FICHE-TOURNOI : les pastilles portent des espaces insécables (piège Android 16).
    acc.push(node.replace(/\u00a0/g, ' '));
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

const parTestID = (/** @type {any} */ tree, /** @type {string} */ id) => tree.root.findAll(
  (/** @type {any} */ n) => n.props?.testID === id && typeof n.type === 'string',
);

// FICHE-TOURNOI (19/11/2026, liste de travail d'Adel, écrans 6a et 7a, décisions du 19/11) — la
// carte d'un tournoi dans les listes (Événements, Rechercher) :
//   · 6a : les pastilles « Inscriptions ouvertes » et « Dès 16 ans » sous le lieu (l'âge quitte
//     alors la ligne sous le titre : il n'est pas écrit deux fois) ; le nom en entier, sur deux
//     lignes s'il le faut ; « Terrain A » (étiquette interne) jamais montré au public ;
//   · 7a : « En attente du gestionnaire de l'installation » en pastille sur la carte d'un tournoi.
const TOURNOI = (/** @type {any} */ autres = {}) => ({
  club: { name: 'AR Soccer' },
  date: '2099-12-19T18:00:00',
  documentId: 'tournoi-1912',
  location: 'AR Soccer, 119 rue de la Rauze basse, 34070 Montpellier',
  name: 'TEST — FoundClub x AR Soccer',
  sessionStatus: 'open',
  startTime: '19:00:00',
  tournamentActivity: { name: 'Football à 5' },
  tournamentConfig: { competitionState: 'draft', maxTeams: 24, minAge: 16 },
  tournamentSection: { name: 'Mixte' },
  type: { name: 'Tournoi' },
  ...autres,
});

beforeEach(() => {
  mockUserData.mockReturnValue({ documentId: 'joueur-1' });
  mockCanManageEvent.mockReturnValue(false);
});

describe('FICHE-TOURNOI · 6a — les pastilles de la carte', () => {
  test('🔴 « Inscriptions ouvertes » et « Dès 16 ans » sous le lieu, l âge plus redit sous le titre', () => {
    const tree = renderCard({ item: TOURNOI() });
    const [rangee] = parTestID(tree, 'event-card-tournament-tags');
    expect(rangee).toBeDefined();
    expect(collectTexts(rangee.children)).toEqual(['Inscriptions ouvertes', 'Dès 16 ans']);
    expect(textsOf(tree)).not.toContain('À partir de 16 ans');
    expect(textsOf(tree)).toContain('Football à 5 • Mixte');
  });

  test('🔴 inscriptions fermées, tournoi clos ou compétition publiée : plus « Inscriptions ouvertes »', () => {
    [
      {
        competitionState: 'draft', maxTeams: 24, minAge: 16, registrationsClosed: true,
      },
      { competitionState: 'published', maxTeams: 24, minAge: 16 },
      {
        closedAt: '2099-12-20T10:00:00.000Z', competitionState: 'draft', maxTeams: 24, minAge: 16,
      },
    ].forEach((tournamentConfig) => {
      const tree = renderCard({ item: TOURNOI({ tournamentConfig }) });
      const [rangee] = parTestID(tree, 'event-card-tournament-tags');
      expect(collectTexts(rangee.children)).toEqual(['Dès 16 ans']);
    });
  });

  test('sans âge minimum : la pastille de l état seule, la catégorie reste sous le titre', () => {
    const tree = renderCard({ item: TOURNOI({ tournamentCategory: { name: 'Sénior' }, tournamentConfig: { competitionState: 'draft', maxTeams: 24 } }) });
    const [rangee] = parTestID(tree, 'event-card-tournament-tags');
    expect(collectTexts(rangee.children)).toEqual(['Inscriptions ouvertes']);
    expect(textsOf(tree)).toContain('Sénior');
  });

  test('un match n a pas ces pastilles', () => {
    const tree = renderCard({
      item: {
        club: { name: 'Foot Rauze' }, date: '2099-12-20T10:30:00', documentId: 'm1', type: { name: 'Match' },
      },
    });
    expect(parTestID(tree, 'event-card-tournament-tags')).toHaveLength(0);
  });
});

describe('FICHE-TOURNOI · 6a — le nom en entier', () => {
  test('🔴 le nom d un tournoi passe sur deux lignes (plus coupé sur une)', () => {
    const tree = renderCard({ item: TOURNOI() });
    const nom = tree.root.findAll((/** @type {any} */ n) => typeof n.type === 'string' && n.props?.children === 'TEST — FoundClub x AR Soccer');
    expect(nom.length).toBeGreaterThan(0);
    nom.forEach((/** @type {any} */ n) => expect(n.props.numberOfLines).toBe(2));
  });
});

describe('FICHE-TOURNOI · 6a — « Terrain A » n est pas montré au public', () => {
  test('🔴 sans adresse lisible, la carte ne se rabat plus sur le terrain (« Terrain A »)', () => {
    const texte = textsOf(renderCard({ item: TOURNOI({ facility: { name: 'Terrain A' }, location: '' }) }));
    expect(texte).not.toContain('Terrain A');
  });

  test('l organisateur du tournoi garde son terrain', () => {
    mockCanManageEvent.mockReturnValue(true);
    const texte = textsOf(renderCard({ item: TOURNOI({ facility: { name: 'Terrain A' }, location: '' }) }));
    expect(texte).toContain('Terrain A');
  });
});

describe('FICHE-TOURNOI · 7a — l attente du gestionnaire en pastille', () => {
  test('🔴 sur un tournoi : une pastille (bord arrondi, sur sa largeur), plus un grand encadré', () => {
    const tree = renderCard({ item: TOURNOI({ pendingDecider: 'proprietaire' }) });
    const [marque] = parTestID(tree, 'carte-seance-en-attente');
    expect(textsOf(tree)).toContain('En attente du gestionnaire de l’installation');
    const style = Object.assign({}, ...[].concat(marque.props.style).flat(Infinity).filter(Boolean));
    expect(style.alignSelf).toBe('flex-start');
    expect(style.borderRadius).toBeGreaterThanOrEqual(100);
  });

  test('ailleurs (MARQUE-MAIRIE validée par Adel) : l encadré reste tel quel', () => {
    const tree = renderCard({
      item: {
        club: { name: 'Foot Rauze' }, date: '2099-12-20T10:30:00', documentId: 'e1', pendingDecider: 'mairie', type: { name: 'Entraînement' },
      },
    });
    const [marque] = parTestID(tree, 'carte-seance-en-attente');
    const style = Object.assign({}, ...[].concat(marque.props.style).flat(Infinity).filter(Boolean));
    expect(style.alignSelf).toBeUndefined();
    expect(style.borderRadius).toBe(12);
  });
});
