/* eslint-disable max-len -- des phrases entieres de la carte, comparees telles quelles */
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { normalizePlanningItems } from '@/utils/planning/planningSlots';

import EventCardNew from '../EventCardNew';

// 🕒 MARQUE-MAIRIE (14/10/2026) — COL-003, décision d'Adel « D3- B » (12/10) puis « 3- ok go »
// (14/10 vers 00 h 30) : la séance qui attend la mairie est marquée PARTOUT où elle apparaît.
// COLL-R-A4 ne l'avait posée que dans la grille du planning (`PlanningWeekTimelineViewV2`). Le
// serveur pose désormais `pendingDecider` sur la liste `GET /events` (admin MARQUE-MAIRIE).
//
// Ce que ce fichier exige (ROUGE avant le lot) :
//   1. la carte de « Mes événements » dit qui décide, avec les mots de la fiche et de la grille :
//      « En attente de la mairie », « … de ton dirigeant », « … du gestionnaire de l’installation » ;
//   2. la carte de la liste omnisport (un créneau de planning normalisé : la marque sous `raw`) aussi ;
//   3. un serveur d'AVANT (pas de marque), une valeur inconnue, le mode partage : rien ne change.

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
jest.mock('@/utils/imageUrl', () => ({ getImageUrl: (url) => url }));
jest.mock('react-native-linear-gradient', () => 'LinearGradient');

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();
  return {
    __esModule: true,
    default: () => ({
      Alignments: alignements,
      ApplicationStyle: genererStyles(couleurs),
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Images: new Proxy({}, { get: (_target, key) => `image-${String(key)}` }),
      Spaces: espaces,
    }),
  };
});

const i18nextTemoin = require('i18next');

const frTemoin = require('@/theme/strings/translations/fr');

(i18nextTemoin.default || i18nextTemoin).init({
  compatibilityJSON: 'v4',
  fallbackLng: 'fr',
  lng: 'fr',
  resources: { fr: { translation: frTemoin.default } },
});
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'fr' },
    t: (/** @type {any[]} */ ...args) => jest.requireActual('i18next').t(...args),
  }),
}));

const mockPeutModifier = false;
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    canManageEvent: () => mockPeutModifier,
    userData: { documentId: 'zoe', role: { name: 'Joueur', type: 'joueur' } },
  }),
}));
jest.mock('@/domains/event/useEvent', () => ({
  __esModule: true,
  default: () => ({
    canEventBeJoined: () => true,
    haveIAlreadyAnsweredNo: () => false,
    haveIAlreadyJoined: () => false,
  }),
}));

const SEANCE = {
  date: new Date(Date.now() + (2 * 24 * 60 * 60 * 1000)).toISOString(),
  documentId: 'e1',
  facility: { documentId: 'gym-tilleuls', name: 'Gymnase des Tilleuls' },
  missings: [],
  name: 'Entrainement U13',
  participationRequests: [],
  participations: [],
  sessionStatus: 'open',
  team: {
    activities: [{ name: 'Basket' }], club: { documentId: 'club-1', name: 'AS Montrivage' }, documentId: 'u13', name: 'U13',
  },
  type: { name: 'Entraînement' },
  validationMode: 'auto',
};

/** @type {any} */
let arbre = null;
const rendre = (/** @type {any} */ item, /** @type {any} */ autres = {}) => {
  act(() => {
    // eslint-disable-next-line react/jsx-props-no-spreading -- fabrique de test
    arbre = renderer.create(<EventCardNew item={item} onPress={jest.fn()} {...autres} />);
  });
  return arbre.root;
};
const aplatir = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
  return String(enfants);
};
const textes = (/** @type {any} */ racine) => racine.findAllByType(Text).map((n) => aplatir(n.props.children));
const marques = (/** @type {any} */ racine) => racine.findAll((/** @type {any} */ n) => n.props?.testID === 'carte-seance-en-attente' && typeof n.type === 'string');

afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
});

test('MARQUE-1 la carte de la séance qui attend la mairie le dit, avec les mots de la fiche', () => {
  const racine = rendre({ ...SEANCE, pendingDecider: 'mairie' });
  expect(textes(racine)).toContain('En attente de la mairie');
  expect(marques(racine).length).toBeGreaterThan(0);
});

test('MARQUE-2 les deux autres décideurs : le dirigeant, le gestionnaire de l installation', () => {
  let racine = rendre({ ...SEANCE, pendingDecider: 'dirigeant' });
  expect(textes(racine)).toContain('En attente de ton dirigeant');
  act(() => arbre.unmount());
  racine = rendre({ ...SEANCE, pendingDecider: 'proprietaire' });
  expect(textes(racine)).toContain('En attente du gestionnaire de l’installation');
});

test('MARQUE-3 la liste omnisport passe un créneau de planning normalisé : la marque est lue sous `raw`', () => {
  const [creneau] = normalizePlanningItems([{
    documentId: 'e9', pendingDecider: 'mairie', startAt: SEANCE.date, title: 'Entrainement U13',
  }]);
  expect(creneau.raw.pendingDecider).toBe('mairie');
  const racine = rendre(creneau);
  expect(textes(racine)).toContain('En attente de la mairie');
});

test('MARQUE-4 un serveur d AVANT, une valeur inconnue, le mode partage : rien', () => {
  let racine = rendre(SEANCE);
  expect(marques(racine)).toHaveLength(0);
  expect(textes(racine).join('|')).not.toMatch(/En attente de|En attente du/);
  act(() => arbre.unmount());
  racine = rendre({ ...SEANCE, pendingDecider: 'quelquun' });
  expect(marques(racine)).toHaveLength(0);
  act(() => arbre.unmount());
  racine = rendre({ ...SEANCE, pendingDecider: 'mairie' }, { mode: 'share' });
  expect(marques(racine)).toHaveLength(0);
});
