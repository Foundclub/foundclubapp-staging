/* eslint-disable max-len -- des phrases entieres de l ecran, comparees telles quelles */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import {
  closeFacility,
  modifyFacilityClosure,
  previewFacilityClosure,
} from '@/services/facilityClosure/facilityClosureService';

import CollectiviteFermeture from '../CollectiviteFermeture';

// 🚧 COLL-C4B (02/10/2026), planche 1 du design HY521H1 page 4 : « P4v3-fermer-tel » ecrans 1, 2
// et 3 — FERMER UNE INSTALLATION, BLOQUER UN CRENEAU, branche sur le contrat C2A §13 (admin).
// Le vrai fr.js ecrit les phrases ; le service HTTP est double, les requetes react-query sont les vraies.
//
// Les temoins (ROUGES avant : l ecran n existait pas) :
//   1. pendant la saisie, la carte nomme les seances touchees et les clubs prevenus ;
//   2. « Publier aussi une actualite Fermeture » est COCHEE par defaut, et se decoche ;
//   3. la confirmation redit le lieu, le jour et les clubs, avec deux boutons ;
//   4. « Fermer » envoie le bon corps ; D16 : l ecran DIT que rien n est annule ;
//   5. BLOQUER : un jour, deux heures, pour quoi ; aucune actualite ;
//   6. MODIFIER : le meme ecran, rempli, sans confirmation ni case ;
//   7. un refus du serveur se dit ; aucun nom de personne n est affiche.

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
    // FINITIONS11-COLL (03/10) : le serveur rend le type (`INSTALLATION_FIELDS` de collectivite).
    data: [
      {
        documentId: 'gym-tilleuls', maxSlots: 2, name: 'Gymnase des Tilleuls', type: 'Gymnase',
      },
      {
        documentId: 'dojo', maxSlots: 1, name: 'Dojo municipal', type: 'Dojo',
      },
      {
        documentId: 'piscine', maxSlots: 1, name: 'Piscine Jean Taris', type: 'Piscine',
      },
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
// SITE-VILLE-FINITIONS (T19) : « De » et « À » d un blocage sont des selecteurs d heure ; meme
// releve, leur `onChange` se lit comme le `onChangeText` d un champ.
jest.mock(
  '@/components/molecules/timePickerInput/TimePickerInput',
  () => function TimePickerInputMock(/** @type {any} */ props) {
    mockInputProps.push({ ...props, composant: 'TimePickerInput', onChangeText: props.onChange });
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
const rendre = async () => {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0, retry: false } } });
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

test('IPH09 FC-005 : titre aéré et actions alignées à largeur égale, action destructive', async () => {
  const arbre = await rendre();
  await choisirDate('Du', '02/10/2026');
  await appuyer(parTestID(arbre, 'fermeture-envoyer'));
  expect(textes(arbre)).toContain('Fermer « Gymnase des Tilleuls » le vendredi 2 octobre ?');
  const confirmation = arbre.root.findAll((n) => n.props.testID === 'fermeture-confirmation')[0];
  expect(StyleSheet.flatten(confirmation.props.style).paddingTop).toBeGreaterThanOrEqual(12);
  const actions = confirmation.findAll((n) => typeof n.props.onPress === 'function' && n.props.title);
  expect(actions).toHaveLength(2);
  expect(actions[0].props.variant).toBe('Secondary');
  expect(actions[1].props.variant).toBe('DangerFilled');
  expect(StyleSheet.flatten(actions[0].props.style).flex).toBe(1);
  expect(StyleSheet.flatten(actions[1].props.style).flex).toBe(1);
  expect(closeFacility).not.toHaveBeenCalled();
  await act(async () => actions[0].props.onPress());
  expect(closeFacility).not.toHaveBeenCalled();
});

jest.mock(
  '@/components/atoms/skeletonLoader/SkeletonLoader',
  () => function SkeletonMock({ children }) { return children; },
);
jest.mock('@/context/AppFeedbackContext', () => ({
  useAppFeedback: () => ({ showBanner: jest.fn() }),
}));
