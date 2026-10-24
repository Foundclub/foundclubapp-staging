/* eslint-disable max-len -- des phrases entieres de l ecran, comparees telles quelles */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

import {
  closeFacility,
  modifyFacilityClosure,
  previewFacilityClosure,
} from '@/services/facilityClosure/facilityClosureService';
import { closeFacilityFromReport } from '@/services/facilityReport/facilityReportService';

import CollectiviteFermeture from '../CollectiviteFermeture';

// 🚩 R17-SIGNALER-1 (19/10/2026, REC17-011, Q4 A) — « Fermer l installation… » depuis un SIGNALEMENT :
// le formulaire de fermeture valide (COL-008), pre-rempli (planche P11-q4-exemple-tel, ecran 3),
// part par le signalement. Harnais repris tel quel de CollectiviteFermeture.CRFERM.test.js.
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
/** @type {any} */
let mockInstallations;
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
jest.mock('@/services/facilityReport/facilityReportService', () => ({ closeFacilityFromReport: jest.fn() }));
jest.mock('@/services/seasonSlot/seasonSlotService', () => ({}));
jest.mock('@/services/facility/facilityService', () => ({ getFacilityPlanning: jest.fn() }));
jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useCollectiviteInstallations: () => mockInstallations,
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

const TROIS = [
  {
    documentId: 'gym-tilleuls', maxSlots: 2, name: 'Gymnase des Tilleuls', type: 'Gymnase',
  },
  {
    documentId: 'dojo', maxSlots: 1, name: 'Dojo municipal', type: 'Dojo',
  },
  {
    documentId: 'stade', maxSlots: 2, name: 'Stade municipal', type: 'Terrain',
  },
];
const CARTE = {
  data: {
    clubs: [{ documentId: 'club-fc', name: 'Montrivage FC' }],
    clubsCount: 1,
    sessions: [{
      club: { documentId: 'club-fc', name: 'Montrivage FC' }, date: '2026-10-16', endTime: '19:30', startTime: '18:00', team: { name: 'Senior B' },
    }],
    sessionsCount: 1,
  },
};

const parTestID = (/** @type {any} */ arbre, /** @type {string} */ id) => arbre.root
  .findAll((/** @type {any} */ noeud) => noeud.props?.testID === id && typeof noeud.props?.onPress === 'function')[0];
const attendre = async () => {
  for (let tour = 0; tour < 2; tour += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
    });
  }
};
const appuyer = async (/** @type {any} */ noeud) => {
  if (!noeud) throw new Error('rien a toucher');
  await act(async () => {
    noeud.props.onPress();
  });
  await attendre();
};
const date = (/** @type {string} */ libelle) => mockDateProps.filter((props) => props.label === libelle).pop();
const changer = async (/** @type {any} */ props, /** @type {string} */ valeur) => {
  await act(async () => {
    (props.onChangeText || props.onChange)(valeur);
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
  mockNavigation = {
    goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn(), setOptions: jest.fn(),
  };
  /** @type {any} */ (closeFacilityFromReport).mockResolvedValue({ data: { closure: { documentId: 'fermeture-1' } } });
  mockParams = { collectiviteId: 'ville-montrivage', mode: 'fermer' };
  mockInstallations = {
    data: TROIS, isError: false, isLoading: false, refetch: jest.fn(),
  };
  /** @type {any} */ (previewFacilityClosure).mockResolvedValue(CARTE);
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

// BH13 P12-12 : pendant l envoi par le signalement, le bouton de confirmation se dit occupé
// (sinon un deuxième appui crée une deuxième fermeture et une deuxième actualité).
test('BH13/P12-12 fermer depuis un signalement : occupé pendant l envoi', async () => {
  /** @type {any} */ (closeFacilityFromReport).mockImplementation(() => new Promise(() => {}));
  mockParams = {
    collectiviteId: 'ville-montrivage',
    date: '2026-10-21',
    facilityId: 'gym-tilleuls',
    facilityName: 'Gymnase des Tilleuls',
    mode: 'fermer',
    motif: 'travaux',
    reportId: 'sig-1',
  };
  const arbre = await rendre();
  await changer(date('Au'), '23/10/2026');
  await appuyer(parTestID(arbre, 'fermeture-envoyer'));
  await appuyer(parTestID(arbre, 'fermeture-confirmer'));
  expect(closeFacilityFromReport).toHaveBeenCalledTimes(1);
  expect(parTestID(arbre, 'fermeture-confirmer').props.isLoading).toBe(true);
});

jest.mock(
  '@/components/atoms/skeletonLoader/SkeletonLoader',
  () => function SkeletonMock({ children }) { return children; },
);
jest.mock('@/context/AppFeedbackContext', () => ({
  useAppFeedback: () => ({ showBanner: jest.fn() }),
}));
