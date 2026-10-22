/* eslint-disable max-len -- donnees de test : les fixtures se lisent mieux sur une ligne */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

import {
  attributeSeasonSlot,
  getClubTeamsForSlot,
  listFacilitySeasonSlots,
  modifySeasonSlot,
  previewFacilitySeasonSlot,
} from '@/services/seasonSlot/seasonSlotService';

import SeasonSlotForm from '../SeasonSlotForm';

// ⏰ A7-UX (20/10, constat d'Adel : « le défilement d'heure n'est pas UX/UI ») — LA FIN SE PROPOSE
// TOUTE SEULE. Choisir le Début pose la Fin à Début + 1 h 30 (la durée déjà utilisée par « Voir les
// heures libres », VILLE-T18A) ; changer le Début d'un créneau déjà lisible GARDE sa durée (la Fin
// suit, comme un agenda) ; une Fin déjà après le Début, sans durée connue, reste ; rien n'est
// proposé au-delà de 23:55. La Fin reçoit le Début (`apres`) : ses heures d'avant ne se choisissent
// pas. ROUGE avant le lot : la Fin restait vide, à choisir à part (8 gestes au lieu de 3).
// Banc et mocks : ceux de SeasonSlotForm.VILLE-T18A.test.js.

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

const PLEIN = {
  capacity: 2,
  needsConfirmation: true,
  occupants: [
    { club: { name: 'AS Montrivage' }, team: { name: 'U15' } },
    { club: { name: 'Montrivage FC' } },
  ],
  overCapacity: true,
  peak: 2,
  teamsAfter: 3,
};
const LIBRE = { capacity: 2, needsConfirmation: false, occupants: [] };
const SAISON = { validFrom: '2026-09-01', validUntil: '2027-06-30' };
// Le mardi de la salle : deux créneaux 18:00 – 19:30 pour 2 places (le « complet » de G30b).
const MARDI = [
  {
    club: { documentId: 'as', name: 'AS Montrivage' }, documentId: 'upk2', endTime: '19:30', startTime: '18:00', team: { name: 'U15' }, ...SAISON, weekday: 2,
  },
  {
    club: { documentId: 'fc', name: 'Montrivage FC' }, documentId: 'pt2i', endTime: '19:30', startTime: '18:00', team: null, ...SAISON, weekday: 2,
  },
];

/** @type {any[]} */
const arbresMontes = [];
const tours = async () => {
  for (let tour = 0; tour < 3; tour += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await new Promise((fini) => { setTimeout(fini, 0); }); });
  }
};
const heure = (/** @type {string} */ libelle) => [...mockHeureProps].reverse().find((props) => props.label === libelle);
const choisirHeure = async (/** @type {string} */ libelle, /** @type {string} */ valeur) => {
  const champ = heure(libelle);
  if (!champ) throw new Error(`aucun selecteur d heure « ${libelle} »`);
  await act(async () => { (champ.onChange || champ.onChangeText)(valeur); });
  await tours();
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
          initial={{ weekday: 2 }}
          onCancel={jest.fn()}
          onDone={props.onDone || jest.fn()}
          slot={props.slot}
        />
      </QueryClientProvider>,
    );
  });
  await tours();
  arbresMontes.push(arbre);
  return arbre;
};
const dernierApercu = () => /** @type {any} */ (previewFacilitySeasonSlot).mock.calls.at(-1)?.[1];

beforeEach(() => {
  jest.clearAllMocks();
  mockHeureProps.length = 0;
  /** @type {any} */ (getClubTeamsForSlot).mockResolvedValue([]);
  /** @type {any} */ (listFacilitySeasonSlots).mockResolvedValue({
    data: MARDI,
    meta: {
      facility: {
        documentId: 'salle-t18', maxSlots: 2, name: 'T18 Salle essai', plateaux: [],
      },
      season: SAISON,
    },
  });
  /** @type {any} */ (previewFacilitySeasonSlot).mockImplementation(
    (/** @type {string} */ _id, /** @type {any} */ params) => Promise.resolve({
      data: params.startTime === '18:00' ? PLEIN : LIBRE,
    }),
  );
  /** @type {any} */ (attributeSeasonSlot).mockResolvedValue({ data: { documentId: 'neuf' } });
  /** @type {any} */ (modifySeasonSlot).mockResolvedValue({ data: MARDI[1] });
});
afterEach(() => {
  act(() => { arbresMontes.splice(0).forEach((arbre) => arbre.unmount()); });
});

describe('A7-UX — la Fin se propose toute seule', () => {
  it('🔴 Début 17:30, Fin vide : la Fin devient 19:00 (+ 1 h 30)', async () => {
    await monter();
    await choisirHeure('Début', '17:30');
    expect(heure('Fin').value).toBe('19:00');
    expect(dernierApercu()).toEqual(expect.objectContaining({ endTime: '19:00', startTime: '17:30' }));
  });

  it('🔴 changer le Début d un créneau lisible garde sa durée : 17:30 – 18:30 puis 18:00 ⇒ 19:00', async () => {
    await monter();
    await choisirHeure('Début', '17:30');
    await choisirHeure('Fin', '18:30');
    await choisirHeure('Début', '18:00');
    expect(heure('Fin').value).toBe('19:00');
  });

  it('une Fin déjà après le nouveau Début, sans Début avant, reste telle quelle', async () => {
    await monter();
    await choisirHeure('Fin', '21:00');
    await choisirHeure('Début', '18:00');
    expect(heure('Fin').value).toBe('21:00');
  });

  it('🔴 une Fin AVANT le nouveau Début, sans durée lisible, est remplacée par Début + 1 h 30', async () => {
    await monter();
    await choisirHeure('Fin', '10:00');
    await choisirHeure('Début', '18:00');
    expect(heure('Fin').value).toBe('19:30');
  });

  it('rien n est proposé au-delà de 23:55 : la Fin reste à choisir', async () => {
    await monter();
    await choisirHeure('Début', '23:00');
    expect(heure('Fin').value).toBe('');
  });

  it('🔴 la Fin reçoit le Début : ses heures d avant ne se choisissent pas', async () => {
    await monter();
    expect(heure('Fin').apres).toBeFalsy();
    await choisirHeure('Début', '17:30');
    expect(heure('Fin').apres).toBe('17:30');
  });

  it('🔴 « Modifier » : changer le Début garde la durée du créneau (18:00 – 19:30 puis 18:30 ⇒ 20:00)', async () => {
    await monter({ slot: { ...MARDI[1], facility: { documentId: 'salle-t18', name: 'T18 Salle essai' } } });
    await choisirHeure('Début', '18:30');
    expect(heure('Fin').value).toBe('20:00');
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
