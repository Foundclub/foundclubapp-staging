/* eslint-disable max-len -- donnees de test : les fixtures se lisent mieux sur une ligne */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import {
  attributeSeasonSlot,
  getClubTeamsForSlot,
  listFacilitySeasonSlots,
  modifySeasonSlot,
  previewFacilitySeasonSlot,
} from '@/services/seasonSlot/seasonSlotService';

import SeasonSlotForm from '../SeasonSlotForm';

// ⏰ A7-UX-2 (22/10, réponses d'Adel « P2 oui », « P4 + P6 oui », relayées par le chef) — LE
// PARCOURS GUIDÉ « Attribuer un créneau », panneau du site :
//   P2 — le club et l'équipe se choisissent sur UNE SEULE étape (« Pour qui ? ») : 6 → 5 étapes ;
//   P6 — le panneau pose la question de l'étape en titre, comme le téléphone ;
//   P4 — « Libre ce mardi : … » s'écrit aussi au panneau, et le Début reçoit les heures pleines
//        du jour (la grille du site les marque).
// ROUGES avant le lot. Banc et doublures : ceux de SeasonSlotForm.VILLE-T18A.test.js.

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
/** @type {any[]} */
const mockBoutons = [];

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
    mockBoutons.push(props);
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
          guided={props.guided}
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

beforeEach(() => {
  jest.clearAllMocks();
  mockHeureProps.length = 0;
  mockBoutons.length = 0;
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

const aplatir = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
  return String(enfants);
};
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text).map((/** @type {any} */ n) => aplatir(n.props.children).replace(/\u00a0/g, ' ').trim());
const suivant = async () => {
  const bouton = [...mockBoutons].reverse().find((props) => props.title === 'Suivant');
  await act(async () => { bouton.onPress(); });
  await tours();
};

describe('A7-UX-2 — le parcours guidé du panneau', () => {
  it('🔴 P2 : club et équipe sur la même étape, cinq étapes au lieu de six', async () => {
    const arbre = await monter({ guided: true });
    const lus = textes(arbre);
    expect(lus).toContain('Étape 1/5');
    expect(lus).toContain('Montrivage Basket');
    expect(lus).toContain('Tout le club');
  });

  it('🔴 P6 : le panneau pose la question de l étape en titre (« Pour qui ? », puis « Quel jour ? »)', async () => {
    const arbre = await monter({ guided: true });
    expect(textes(arbre)).toContain('Pour qui ?');
    await suivant();
    expect(textes(arbre)).toContain('Quel jour ?');
  });
});
jest.mock(
  '@/components/atoms/skeletonLoader/SkeletonLoader',
  () => function SkeletonMock({ children }) { return children; },
);
jest.mock('@/context/AppFeedbackContext', () => ({
  useAppFeedback: () => ({ showBanner: jest.fn() }),
}));
