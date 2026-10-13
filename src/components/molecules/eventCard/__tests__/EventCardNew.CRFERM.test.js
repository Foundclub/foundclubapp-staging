/* eslint-disable max-len -- des phrases entieres de la carte, comparees telles quelles */
import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import EventAnswerButtons from '@/components/molecules/eventAnswerButtons/EventAnswerButtons';

import EventCardNew from '../EventCardNew';

// 🚧 CRFERM (13/10/2026) — COL-010, décision d'Adel « D8 B » (12/10), planche P8v4-fermee-tel.
// Recette du 11/10 (capture S13) : le Gymnase Cosec est fermé, et la carte de la séance n'en dit
// RIEN. Le serveur pose désormais la marque `facilityClosure` sur la liste (admin CRFERM S2-1).
//
// Ce que ce fichier exige (ROUGE avant le lot) :
//   1. joueur et parent : « Gymnase fermé ce jour-là », une phrase SANS geste ; la carte garde ses
//      réponses ;
//   2. qui peut modifier la séance : « Gymnase fermé · à déplacer », un BOUTON qui ouvre l'écran de
//      modification (stage : la fiche) ;
//   3. les mots s'accordent au type ; un blocage dit « Bloqué par la Ville » ;
//   4. un serveur d'AVANT (pas de marque) : rien ne change, aucun plantage.

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

let mockPeutModifier = false;
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

const CLUB = { documentId: 'club-1', name: 'AS Montrivage' };
const FERMETURE = {
  documentId: 'ferm-1', endDate: '2026-10-15', endTime: null, facilityType: 'Gymnase', kind: 'closure', label: null, reason: 'vacances', startDate: '2026-10-11', startTime: null,
};
const SEANCE = {
  date: new Date(Date.now() + (2 * 24 * 60 * 60 * 1000)).toISOString(),
  documentId: 'e1',
  facility: { documentId: 'gym-cosec', name: 'Gymnase Cosec', planningColor: '#FF4D4D' },
  missings: [],
  name: 'Entrainement U20',
  participationRequests: [],
  participations: [],
  sessionStatus: 'open',
  team: {
    activities: [{ name: 'Basket' }], club: CLUB, documentId: 'u20', name: 'U20 1',
  },
  type: { name: 'Entraînement' },
  validationMode: 'auto',
};

/** @type {any} */
let arbre = null;
const rendre = (/** @type {any} */ item, onPress = jest.fn()) => {
  act(() => {
    arbre = renderer.create(<EventCardNew item={item} onPress={onPress} />);
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
const etiquette = (/** @type {any} */ racine) => racine.findAll((/** @type {any} */ n) => n.props?.testID === 'carte-fermeture')[0];

beforeEach(() => {
  mockNavigate.mockClear();
  mockPeutModifier = false;
});
afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
});

test('CRFERM-5/1 joueur : « Gymnase fermé ce jour-là », une phrase sans geste ; la carte garde ses réponses', () => {
  const racine = rendre({ ...SEANCE, facilityClosure: FERMETURE });
  expect(textes(racine)).toContain('Gymnase fermé ce jour-là');
  expect(racine.findAllByType(TouchableOpacity).filter((n) => n.props.testID === 'carte-fermeture')).toHaveLength(0);
  expect(racine.findAllByType(EventAnswerButtons)).toHaveLength(1);
});

test('CRFERM-5/2 qui peut modifier : « Gymnase fermé · à déplacer », un bouton qui ouvre la modification', () => {
  mockPeutModifier = true;
  const racine = rendre({ ...SEANCE, facilityClosure: FERMETURE });
  expect(textes(racine)).toContain('Gymnase fermé · à déplacer');
  const bouton = racine.findAllByType(TouchableOpacity).find((n) => n.props.testID === 'carte-fermeture');
  expect(bouton.props.accessibilityRole).toBe('button');
  expect(bouton.props.accessibilityLabel).toBe('Gymnase fermé · à déplacer');
  act(() => { bouton.props.onPress(); });
  expect(mockNavigate).toHaveBeenCalledWith('EventStack', { params: { eventId: 'e1' }, screen: 'EventEdit' });
});

test('CRFERM-5/3 un stage ne se modifie pas par cet écran : le bouton ouvre la fiche', () => {
  mockPeutModifier = true;
  const ouvrir = jest.fn();
  const stage = { ...SEANCE, eventFormat: 'stage_day', facilityClosure: FERMETURE };
  const racine = rendre(stage, ouvrir);
  act(() => { racine.findAllByType(TouchableOpacity).find((n) => n.props.testID === 'carte-fermeture').props.onPress(); });
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(ouvrir).toHaveBeenCalledWith(stage);
});

test('CRFERM-5/4 les mots s accordent au type ; un blocage dit « Bloqué par la Ville » ; une plage, « à cette heure »', () => {
  let racine = rendre({ ...SEANCE, facilityClosure: { ...FERMETURE, facilityType: 'Piscine' } });
  expect(textes(racine)).toContain('Piscine fermée ce jour-là');
  act(() => arbre.unmount());
  racine = rendre({ ...SEANCE, facilityClosure: { ...FERMETURE, facilityType: null } });
  expect(textes(racine)).toContain('Installation fermée ce jour-là');
  act(() => arbre.unmount());
  racine = rendre({
    ...SEANCE,
    facilityClosure: {
      ...FERMETURE, endTime: '13:00', kind: 'block', label: 'Forum', startTime: '09:00',
    },
  });
  expect(textes(racine)).toContain('Bloqué par la Ville à cette heure');
  act(() => arbre.unmount());
  racine = rendre({ ...SEANCE, facilityClosure: { ...FERMETURE, startTime: '14:00' } });
  expect(textes(racine)).toContain('Gymnase fermé à cette heure');
});

test('CRFERM-5/5 un serveur d AVANT (pas de marque) : rien ne change', () => {
  const racine = rendre(SEANCE);
  expect(etiquette(racine)).toBeUndefined();
  expect(textes(racine).join('|')).not.toMatch(/fermé|fermée|Bloqué/);
});
