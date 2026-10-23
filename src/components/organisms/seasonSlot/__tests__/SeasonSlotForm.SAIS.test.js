/* eslint-disable max-len -- donnees de test : les fixtures se lisent mieux sur une ligne */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

import { isoWeekdayOf } from '@/domains/seasonSlot/seasonSlotDisplay';

import {
  attributeSeasonSlot,
  getClubTeamsForSlot,
  listFacilitySeasonSlots,
  modifySeasonSlot,
  previewFacilitySeasonSlot,
} from '@/services/seasonSlot/seasonSlotService';

import SeasonSlotForm from '../SeasonSlotForm';

// 📅 SAIS (08/10/2026, tournée T20 lot 1) — « Attribuer un créneau » au téléphone s'ouvrait SANS
// jour choisi (capture T07b) quand le site en présélectionne un : le jour d'aujourd'hui l'est
// désormais, sauf si l'écran en apporte un (une case du planning) ou si l'on modifie un créneau.
// Banc : les doublures de SeasonSlotForm.VILLE-T18A.test.js, reprises telles quelles.

const i18nextTemoin = require('i18next');

const frTemoin = require('@/theme/strings/translations/fr');

(i18nextTemoin.default || i18nextTemoin).init({
  compatibilityJSON: 'v4',
  fallbackLng: 'fr',
  lng: 'fr',
  resources: { fr: { translation: frTemoin.default } },
});

/** @type {any[]} */
const mockHeureProps = [];

// COLL-R-A7 (COL-005) : le formulaire importe le gabarit des tunnels (son plein écran) ; le fond
// d'écran de ce gabarit (dégradé natif) reste hors de ce banc, comme dans les témoins d'écran.
jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {any[]} */ ...args) => jest.requireActual('i18next').t(...args),
  }),
}));
jest.mock('@/services/seasonSlot/seasonSlotService', () => ({
  attributeSeasonSlot: jest.fn(),
  getClubTeamsForSlot: jest.fn(),
  listFacilitySeasonSlots: jest.fn(),
  modifySeasonSlot: jest.fn(),
  previewFacilitySeasonSlot: jest.fn(),
}));
jest.mock('@/services/collectivite/collectiviteService', () => ({
  getCollectiviteChiffres: jest.fn(),
}));
jest.mock('@/services/facility/facilityService', () => ({ getFacilityPlanning: jest.fn() }));
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
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(PressableRN, { disabled: props.disabled, onPress: props.onPress }, reactActuel.createElement(TexteRN, null, props.title));
  };
});
// Les champs d heure, quel que soit leur composant : le point 3 exige le sélecteur d heure.
jest.mock('@/components/molecules/input/Input', () => function InputMock(/** @type {any} */ props) {
  mockHeureProps.push({ ...props, composant: 'Input' });
  return null;
});
jest.mock('@/components/molecules/timePickerInput/TimePickerInput', () => function TimePickerInputMock(/** @type {any} */ props) {
  mockHeureProps.push({ ...props, composant: 'TimePickerInput' });
  return null;
});
jest.mock('@/components/molecules/datePickerInput/DatePickerInput', () => function DatePickerInputMock() { return null; });
jest.mock('@/components/organisms/seasonSlot/RondsDePlaces', () => function RondsDePlacesMock() { return null; });

const SAISON = { validFrom: '2026-09-01', validUntil: '2027-06-30' };

/** @type {any[]} */
const arbresMontes = [];
const tours = async () => {
  for (let tour = 0; tour < 3; tour += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await new Promise((fini) => { setTimeout(fini, 0); }); });
  }
};
const monter = async (/** @type {any} */ props = {}) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <SeasonSlotForm
          clubs={[{ documentId: 'basket', name: 'Montrivage Basket' }]}
          facilityId="salle-t18"
          initial={props.initial}
          onCancel={jest.fn()}
          onDone={jest.fn()}
          slot={props.slot}
        />
      </QueryClientProvider>,
    );
  });
  await tours();
  arbresMontes.push(arbre);
  return arbre;
};
const jourChoisi = (/** @type {any} */ arbre) => arbre.root.findAll(
  (/** @type {any} */ n) => /^jour-\d$/.test(String(n.props?.testID || ''))
    && n.props?.accessibilityState?.checked === true,
  { deep: false },
).map((/** @type {any} */ n) => n.props.testID);

beforeEach(() => {
  jest.clearAllMocks();
  mockHeureProps.length = 0;
  /** @type {any} */ (getClubTeamsForSlot).mockResolvedValue([]);
  /** @type {any} */ (listFacilitySeasonSlots).mockResolvedValue({
    data: [],
    meta: {
      facility: {
        documentId: 'salle-t18', maxSlots: 2, name: 'T18 Salle essai', plateaux: [],
      },
      season: SAISON,
    },
  });
  /** @type {any} */ (previewFacilitySeasonSlot).mockResolvedValue({ data: { capacity: 2, needsConfirmation: false, occupants: [] } });
  /** @type {any} */ (attributeSeasonSlot).mockResolvedValue({ data: { documentId: 'neuf' } });
  /** @type {any} */ (modifySeasonSlot).mockResolvedValue({ data: {} });
});
afterEach(() => {
  act(() => { arbresMontes.splice(0).forEach((arbre) => arbre.unmount()); });
});

describe('SAIS lot 1 — « Attribuer un créneau » : un jour présélectionné, comme le site', () => {
  // INVERSÉ PAR DATESDABORD (23/10, point 9 d'Adel) — motif : à la création, le jour se choisit
  // par une DATE (le bloc « Date & horaire » de l'événement) ; elle s'ouvre sur ce jour-là.
  const dateDuModele = (/** @type {any} */ arbre) => arbre.root.findAll(
    (/** @type {any} */ n) => typeof n.props?.onRepetition === 'function',
  )[0]?.props.date;
  test('ouvert sans jour : celui d’aujourd’hui est choisi', async () => {
    const arbre = await monter();
    expect(dateDuModele(arbre).toDateString()).toBe(new Date().toDateString());
  });

  test('ouvert sur un jour (une case du planning) : ce jour-là', async () => {
    const aujourdhui = isoWeekdayOf(new Date());
    const autre = (aujourdhui % 7) + 1;
    const arbre = await monter({ initial: { weekday: autre } });
    expect(isoWeekdayOf(dateDuModele(arbre))).toBe(autre);
    // Le 1er à venir : demain.
    expect(dateDuModele(arbre).getTime() - Date.now()).toBeLessThan(2 * 86400000);
  });

  test('« Modifier » garde le jour du créneau', async () => {
    const aujourdhui = isoWeekdayOf(new Date());
    const autre = (aujourdhui % 7) + 1;
    const arbre = await monter({
      slot: {
        club: { documentId: 'basket', name: 'Montrivage Basket' }, documentId: 'c1', endTime: '19:30', startTime: '18:00', ...SAISON, weekday: autre,
      },
    });
    expect(jourChoisi(arbre)).toEqual([`jour-${autre}`]);
  });
});

jest.mock(
  '@/components/atoms/skeletonLoader/SkeletonLoader',
  () => function SkeletonMock({ children }) { return children; },
);
jest.mock('@/context/AppFeedbackContext', () => ({
  useAppFeedback: () => ({ showBanner: jest.fn() }),
}));
// R17-QUAND-2-BIS — l'étape « Quand ? » ouvre ses dates retirées dans une feuille du bas.
jest.mock('@/components/molecules/bottomModal/BottomModal', () => function BottomModalMock(
  /** @type {any} */ { children, footerComponent, isVisible },
) {
  return isVisible ? (
    <>
      {children}
      {footerComponent}
    </>
  ) : null;
});
