/* eslint-disable max-len -- des phrases entieres de l ecran, comparees telles quelles */
import { QueryClientProvider } from '@tanstack/react-query';
import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import {
  closeFacility,
  modifyFacilityClosure,
  previewFacilityClosure,
} from '@/services/facilityClosure/facilityClosureService';

import CollectiviteFermeture from '../CollectiviteFermeture';

// Le VRAI client react-query de l app, avec son filet global d alertes.
const { createFoundClubQueryClient } = require('@/app/queryClient');

// 🐞 COLL-FIX-PLANNING (02/10/2026) — le defaut du point 5 (T9_C23_6), sur l ecran « Fermer /
// bloquer » de COLL-C4B : ses 3 gestes (fermer, modifier, rouvrir) disent LEUR refus dans l ecran,
// traduit (`closureErrorMessage`) ; le filet GLOBAL des erreurs de react-query (app/queryClient.js)
// posait EN PLUS une alerte « Erreur » au texte brut du serveur, par-dessus. Le temoin C4B montait
// l ecran avec un client react-query nu : le filet n y existait pas.
// Ce temoin monte l ecran avec le VRAI client de l app et une alerte espionne.
// ROUGE avant : l alerte globale part au refus.

// Les ecrans montes ici tournent en ~1 s ; sous la charge d une autre suite, 5 s ne suffisent pas.
jest.setTimeout(30000);

const i18nextTemoin = require('i18next');

const frTemoin = require('@/theme/strings/translations/fr');

(i18nextTemoin.default || i18nextTemoin).init({
  compatibilityJSON: 'v4',
  fallbackLng: 'fr',
  lng: 'fr',
  resources: { fr: { translation: frTemoin.default } },
});

/** @type {any} */
let mockNavigation;
/** @type {any} */
let mockParams;
/** @type {any[]} */
const mockInputProps = [];
/** @type {any[]} */
const mockDateProps = [];

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: mockParams }),
}));

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

jest.mock('@/services/facilityClosure/facilityClosureService', () => ({
  closeFacility: jest.fn(),
  listCollectiviteClosures: jest.fn(),
  listFacilityClosures: jest.fn(),
  modifyFacilityClosure: jest.fn(),
  previewFacilityClosure: jest.fn(),
  reopenFacilityClosure: jest.fn(),
}));
jest.mock('@/services/seasonSlot/seasonSlotService', () => ({}));
jest.mock('@/services/facility/facilityService', () => ({ getFacilityPlanning: jest.fn() }));
jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useCollectiviteInstallations: () => ({
    data: [
      { documentId: 'gym-tilleuls', maxSlots: 2, name: 'Gymnase des Tilleuls' },
      { documentId: 'dojo', maxSlots: 1, name: 'Dojo municipal' },
    ],
  }),
}));

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) {
    return children;
  },
);
jest.mock(
  '@/components/atoms/loader/Loader',
  () => function LoaderMock() {
    return null;
  },
);
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { disabled: props.disabled, onPress: props.onPress, testID: props.testID },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});
jest.mock(
  '@/components/molecules/input/Input',
  () => function InputMock(/** @type {any} */ props) {
    mockInputProps.push(props);
    return null;
  },
);
jest.mock(
  '@/components/molecules/datePickerInput/DatePickerInput',
  () => function DatePickerInputMock(/** @type {any} */ props) {
    mockDateProps.push(props);
    return null;
  },
);
jest.mock(
  '@/components/molecules/bottomModal/BottomModal',
  () => function BottomModalMock(/** @type {any} */ { children, isVisible }) {
    return isVisible ? children : null;
  },
);

const SECRETS = ['Jeanne', 'SECRET-NOM', 'jeanne.secret@exemple.fr'];
const PERSONNE = { email: SECRETS[2], firstname: SECRETS[0], lastname: SECRETS[1] };
const CARTE_VENDREDI = {
  data: {
    clubs: [
      { documentId: 'club-fc', name: 'Montrivage FC', president: PERSONNE },
      { documentId: 'club-basket', name: 'Montrivage Basket' },
    ],
    clubsCount: 2,
    sessions: [
      {
        club: { documentId: 'club-fc', name: 'Montrivage FC' },
        date: '2026-10-02',
        endTime: '19:30',
        startTime: '18:00',
        team: { name: 'Senior B' },
      },
      {
        club: { documentId: 'club-basket', name: 'Montrivage Basket' },
        date: '2026-10-02',
        endTime: '21:00',
        startTime: '19:30',
        team: { name: 'Seniors Basket' },
      },
    ],
    sessionsCount: 2,
  },
};

const aplatir = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
  return String(enfants);
};
const textes = (/** @type {any} */ arbre) => arbre.root
  .findAllByType(Text)
  .map((/** @type {any} */ noeud) => aplatir(noeud.props.children).trim());
const parTestID = (/** @type {any} */ arbre, /** @type {string} */ id) => arbre.root
  .findAllByType(TouchableOpacity)
  .find((/** @type {any} */ noeud) => noeud.props.testID === id);
const attendre = async () => {
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  });
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  });
};
const appuyer = async (/** @type {any} */ noeud) => {
  if (!noeud) throw new Error('rien a toucher');
  await act(async () => {
    noeud.props.onPress();
  });
  await attendre();
};
const date = (/** @type {string} */ libelle) => mockDateProps.filter((props) => props.label === libelle).pop();
const choisirDate = async (/** @type {string} */ libelle, /** @type {string} */ valeur) => {
  await act(async () => {
    date(libelle).onChange(valeur);
  });
  await attendre();
};

/** @type {any[]} */
const montes = [];
const mockAlerte = jest.fn();
const rendre = async () => {
  const client = createFoundClubQueryClient({
    onMutationError: (/** @type {any[]} */ ...args) => mockAlerte(...args),
  });
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <CollectiviteFermeture />
      </QueryClientProvider>,
    );
  });
  await attendre();
  montes.push({ arbre, client });
  return arbre;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockInputProps.length = 0;
  mockDateProps.length = 0;
  mockNavigation = { goBack: jest.fn(), navigate: jest.fn(), setOptions: jest.fn() };
  mockParams = { collectiviteId: 'ville-montrivage', facilityId: 'gym-tilleuls', mode: 'fermer' };
  /** @type {any} */ (previewFacilityClosure).mockResolvedValue(CARTE_VENDREDI);
  /** @type {any} */ (closeFacility).mockResolvedValue({ data: { documentId: 'fermeture-1' } });
  /** @type {any} */ (modifyFacilityClosure).mockResolvedValue({ data: { documentId: 'fermeture-1' } });
});

afterEach(() => {
  act(() => {
    montes.splice(0).forEach(({ arbre, client }) => {
      arbre.unmount();
      client.clear();
    });
  });
});

test('COLL-FIX-PLANNING — un refus du serveur se dit DANS l ecran, sans alerte « Erreur » dessus', async () => {
  mockParams = { collectiviteId: 'ville-montrivage', mode: 'fermer' };
  /** @type {any} */ (closeFacility).mockRejectedValue({
    response: {
      data: { error: { details: { code: 'FACILITY_CLOSURE_MANAGER_REQUIRED' }, status: 403 } },
      status: 403,
    },
  });
  const arbre = await rendre();
  await appuyer(parTestID(arbre, 'fermeture-installation-dojo'));
  await choisirDate('Du', '02/10/2026');
  await appuyer(parTestID(arbre, 'fermeture-envoyer'));
  await appuyer(parTestID(arbre, 'fermeture-confirmer'));
  expect(closeFacility).toHaveBeenCalled();
  expect(textes(arbre)).toContain('Seule la Ville ferme ou bloque ses installations.');
  expect(mockAlerte).not.toHaveBeenCalled();
});
