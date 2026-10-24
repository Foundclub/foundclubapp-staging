/* eslint-disable no-unused-vars, max-len -- montage repris tel quel d un temoin voisin (BH07) */
// BH07 / P8-08 (24/10) — la proposition de la Ville est declinee, puis le deplacement echoue :
// le message doit dire que la proposition a ete declinee. Montage repris de DeplacerLaSeance.CRDEP.test.js.
/* eslint-disable max-len -- des phrases entieres de l ecran, comparees telles quelles */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Alert, Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import {
  decideRelocation, getRelocationOptions, proposeRelocation, updateEvent,
} from '@/services/event/eventService';

import DeplacerLaSeance from '../DeplacerLaSeance';

// 🚚 COLL-R-DEPLACER A8 (14/10/2026, COL-013, décision d'Adel « D9 = b ») — « DÉPLACER LA SÉANCE »,
// planches P5v4-deplacer-tel (écrans 2 à 6, 9 à 12) et P5v4-deplacer-ville-tel (écran 4 b).
// ROUGES avant le lot : le tunnel n'existait pas (l'étiquette « à déplacer » ouvrait la
// modification générale, où il fallait deviner une installation libre).

jest.setTimeout(30000);

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
    t: (/** @type {any[]} */ ...args) => jest.requireActual('i18next').t(...args),
  }),
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
      Images: {},
      Spaces: espaces,
    }),
  };
});
jest.mock('@/services/event/eventService', () => ({
  decideRelocation: jest.fn(),
  getRelocationOptions: jest.fn(),
  proposeRelocation: jest.fn(),
  updateEvent: jest.fn(),
}));
// Le gabarit du tunnel : son titre, son sous-titre, son contenu, et son bouton (actif ou non).
jest.mock('@/components/molecules/wizardStepLayout/WizardStepLayout', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN, View: VueRN } = jest.requireActual('react-native');
  return function WizardStepLayoutMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      VueRN,
      { testID: `etape-${props.stepIndex}` },
      reactActuel.createElement(TexteRN, { testID: 'titre' }, props.title),
      reactActuel.createElement(TexteRN, { testID: 'sous-titre' }, props.subtitle),
      props.children,
      reactActuel.createElement(
        PressableRN,
        { disabled: props.isNextDisabled, onPress: props.onNext, testID: 'suivant' },
        reactActuel.createElement(TexteRN, null, props.nextLabel || 'Suivant'),
      ),
    );
  };
});
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { disabled: props.disabled || props.isLoading, onPress: props.onPress },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});
jest.mock('@/components/molecules/datePickerInput/DatePickerInput', () => function DatePickerInputMock() {
  return null;
});
/** @type {Record<string, any>} */
const mockHeures = {};
jest.mock('@/components/molecules/timePickerInput/TimePickerInput', () => function TimePickerInputMock(/** @type {any} */ props) {
  mockHeures[props.testID] = props;
  return null;
});

const SEANCE = {
  club: { documentId: 'club-A', name: 'AS Ville A' },
  date: '2031-01-10',
  documentId: 'seance-1',
  endTime: '19:30',
  facility: { documentId: 'gym-ville', name: 'Gymnase des Tilleuls' },
  series: false,
  startTime: '18:00',
  team: { documentId: 'team-U15-A', name: 'U15' },
};
const FERMETURE = {
  documentId: 'fermeture-1', endDate: '2031-01-12', endTime: null, kind: 'closure', label: null, reason: 'vacances', startDate: '2031-01-10', startTime: null,
};
const PLACES = [
  {
    closure: null, current: false, documentId: 'stade-ville', inClubSlot: true, name: 'Stade municipal', reason: null, state: 'libre',
  },
  {
    closure: null, current: false, documentId: 'dojo-ville', inClubSlot: false, name: 'Dojo municipal', reason: null, state: 'villeDecidera',
  },
  {
    closure: null, current: false, documentId: 'college', inClubSlot: false, name: 'Gymnase du Collège', reason: 'facilityFull', state: 'complet',
  },
  {
    closure: FERMETURE, current: true, documentId: 'gym-ville', inClubSlot: false, name: 'Gymnase des Tilleuls', reason: null, state: 'ferme',
  },
];
const FENETRE = { date: '2031-01-10', end: '19:30', start: '18:00' };

/**
 * Le serveur de recette : la liste des places, un lieu sur plusieurs jours, ou une fenêtre précise.
 * @param {{ facilities?: any[], seance?: any, viewer?: string }} [options] - Ce qu'il rend.
 */
const servir = ({ facilities = PLACES, seance = SEANCE, viewer = 'club' } = {}) => {
  getRelocationOptions.mockImplementation(async (_eventId, params = {}) => {
    const base = {
      closure: FERMETURE, event: seance, viewer, window: { date: params.date || FENETRE.date, end: params.end || FENETRE.end, start: params.start || FENETRE.start },
    };
    if (!params.facility) return { ...base, facilities };
    const lieu = facilities.find((place) => place.documentId === params.facility);
    const jours = Number(params.days) || 1;
    const days = Array.from({ length: jours }, (_, rang) => {
      const date = `2031-01-${String(Number((params.date || FENETRE.date).slice(8, 10)) + rang).padStart(2, '0')}`;
      const state = rang === 0 ? lieu.state : 'villeDecidera';
      return {
        closure: null, date, endAt: null, inClubSlot: rang === 0 && lieu.inClubSlot, reason: null, startAt: `${date}T17:00:00.000Z`, state,
      };
    });
    return { ...base, days, facility: { documentId: lieu.documentId, name: lieu.name } };
  });
};

const aplatir = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
  return String(enfants);
};
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text).map((noeud) => aplatir(noeud.props.children));
const appuyer = async (/** @type {any} */ arbre, /** @type {string} */ repere) => {
  const bouton = arbre.root.findAll((noeud) => noeud.type === TouchableOpacity
    && (noeud.props.testID === repere || aplatir(noeud.props.children) === repere))[0];
  if (!bouton) throw new Error(`bouton introuvable : ${repere}`);
  expect(bouton.props.disabled).toBeFalsy();
  await act(async () => { bouton.props.onPress(); });
};
const attendre = async () => {
  for (let tour = 0; tour < 6; tour += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await new Promise((resoudre) => { setTimeout(resoudre, 0); }); });
  }
};

/** @type {any} */
let navigation;
const monter = async (/** @type {any} */ props = {}) => {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <DeplacerLaSeance
          eventId="seance-1"
          navigation={navigation}
          onIndisponible={props.onIndisponible}
          proposalId={props.proposalId}
          viewer={props.viewer}
        />
      </QueryClientProvider>,
    );
  });
  await attendre();
  return arbre;
};

beforeEach(() => {
  jest.clearAllMocks();
  navigation = { goBack: jest.fn() };
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

it('P8-08 — proposition declinee puis deplacement refuse : le message le dit', async () => {
  servir();
  const arbre = await monter({ proposalId: 'prop-1' });
  await appuyer(arbre, 'deplacer-lieu-stade-ville');
  await appuyer(arbre, 'suivant');
  await attendre();
  await appuyer(arbre, 'deplacer-jour-2031-01-10');
  await appuyer(arbre, 'suivant');
  await attendre();
  await appuyer(arbre, 'suivant');
  decideRelocation.mockResolvedValue({ data: {} });
  updateEvent.mockRejectedValue(Object.assign(new Error('prise'), { status: 409 }));
  await appuyer(arbre, 'suivant');
  await attendre();
  expect(Alert.alert).toHaveBeenCalledTimes(1);
  expect(Alert.alert.mock.calls[0][1]).toContain('La proposition de la Ville a été déclinée');
});
