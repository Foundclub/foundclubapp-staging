/* eslint-disable max-len -- donnees de test : les fixtures se lisent mieux sur une ligne */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import {
  getClubTeamsForSlot,
  listFacilitySeasonSlots,
  modifySeasonSlot,
  previewFacilitySeasonSlot,
} from '@/services/seasonSlot/seasonSlotService';

import SeasonSlotForm from '../SeasonSlotForm';

// 🏟️ COLL-C2C (02/10) — D32 : LE DIRIGEANT RÉPARTIT LES CRÉNEAUX DE SON CLUB ENTRE SES ÉQUIPES,
// « avec une interface comme celle de la mairie pour les clubs » : le panneau de C2B, en mode
// `repartition`. Le vrai fr.js écrit les phrases ; le service HTTP est doublé, les requêtes
// react-query sont les vraies.
//
// Ce que ce témoin exige (ROUGE avant le lot : en modification, le panneau ne proposait pas
// l équipe) :
//   - en répartition : les équipes du club (« Tout le club » compris), « À partir du », et RIEN
//     d autre (ni jour, ni heures, ni plateau, ni carte de place : la mairie les garde) ;
//   - « Enregistrer » envoie SEULEMENT l équipe et la date d effet (la règle du serveur) ;
//   - sans `repartition`, la modification de la mairie est celle d avant.

const i18nextTemoin = require('i18next');

const frTemoin = require('@/theme/strings/translations/fr');

(i18nextTemoin.default || i18nextTemoin).init({
  compatibilityJSON: 'v4',
  fallbackLng: 'fr',
  lng: 'fr',
  resources: { fr: { translation: frTemoin.default } },
});

/** @type {any[]} */
const mockInputProps = [];
/** @type {any[]} */
const mockDateProps = [];

// COLL-R-A7 (COL-005) : le formulaire importe le gabarit des tunnels (son plein écran) ; le fond
// d'écran de ce gabarit (dégradé natif) reste hors de ce banc, comme dans les témoins d'écran.
jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);
jest.mock('@/services/seasonSlot/seasonSlotService', () => ({
  attributeSeasonSlot: jest.fn(),
  getClubTeamsForSlot: jest.fn(),
  listFacilitySeasonSlots: jest.fn(),
  modifySeasonSlot: jest.fn(),
  previewFacilitySeasonSlot: jest.fn(),
}));
// FINITIONS13-COLL (04/10) : seasonSlotQueries lit « Chiffres » de la Ville (même client HTTP).
jest.mock('@/services/collectivite/collectiviteService', () => ({
  getCollectiviteChiffres: jest.fn(),
}));
// Les requetes des creneaux tirent le service des installations, qui tire le client HTTP.
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
jest.mock('@/components/molecules/input/Input', () => function InputMock(/** @type {any} */ props) {
  mockInputProps.push(props);
  return null;
});
// VILLE-T18A : Début et Fin sont des sélecteurs d heure (TimePickerInput) ; même relevé,
// leur `onChange` se lit comme le `onChangeText` d un champ.
jest.mock(
  '@/components/molecules/timePickerInput/TimePickerInput',
  () => function TimePickerInputMock(/** @type {any} */ props) {
    mockInputProps.push({ ...props, onChangeText: props.onChange });
    return null;
  },
);
jest.mock('@/components/molecules/datePickerInput/DatePickerInput', () => function DatePickerInputMock(/** @type {any} */ props) {
  mockDateProps.push(props);
  return null;
});
jest.mock('@/components/organisms/seasonSlot/RondsDePlaces', () => function RondsDePlacesMock() { return null; });

// Un creneau de la Ville, au club entier, tel que GET /clubs/:id/season-slots le rend.
const CRENEAU = {
  club: { documentId: 'as-montrivage', name: 'AS Montrivage' }, documentId: 'slot-1', endTime: '19:00', facility: { documentId: 'gym-tilleuls', name: 'Gymnase des Tilleuls' }, plateau: null, startTime: '17:30', team: null, validFrom: '2026-09-01', validUntil: '2027-06-30', weekday: 2,
};

/** @type {any[]} */
const arbresMontes = [];
const aplatir = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
  // VILLE-T18A : les puces écrivent leurs espaces en insécables ; on les lit en espaces.
  return String(enfants).replace(/\u00a0/g, ' ');
};
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text).map((/** @type {any} */ n) => aplatir(n.props.children).trim());
const presser = (/** @type {any} */ arbre, /** @type {string} */ libelle) => {
  const [cible] = arbre.root.findAll((/** @type {any} */ n) => typeof n.props?.onPress === 'function'
    && n.findAllByType(Text).some((/** @type {any} */ t) => aplatir(t.props.children).trim() === libelle), { deep: false });
  return cible.props.onPress();
};
const monter = async (/** @type {any} */ props) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <SeasonSlotForm onDone={props.onDone || jest.fn()} repartition={props.repartition} slot={CRENEAU} />
      </QueryClientProvider>,
    );
  });
  // Les requetes react-query (vraies) se resolvent : quelques tours de boucle.
  for (let tour = 0; tour < 3; tour += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await new Promise((fini) => { setTimeout(fini, 0); }); });
  }
  arbresMontes.push(arbre);
  return arbre;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockInputProps.length = 0;
  mockDateProps.length = 0;
  /** @type {any} */ (getClubTeamsForSlot).mockResolvedValue([{ documentId: 'team-U13', name: 'U13' }, { documentId: 'team-U15', name: 'U15' }]);
  /** @type {any} */ (listFacilitySeasonSlots).mockResolvedValue({
    data: [],
    meta: {
      facility: {
        documentId: 'gym-tilleuls', maxSlots: 2, name: 'Gymnase des Tilleuls', plateaux: ['A', 'B'],
      },
    },
  });
  /** @type {any} */ (previewFacilitySeasonSlot).mockResolvedValue({ data: { capacity: 2, needsConfirmation: false, occupants: [] } });
  /** @type {any} */ (modifySeasonSlot).mockResolvedValue({ data: { ...CRENEAU, documentId: 'slot-2', team: { documentId: 'team-U15', name: 'U15' } } });
});
afterEach(() => {
  act(() => { arbresMontes.splice(0).forEach((arbre) => arbre.unmount()); });
});

describe('COLL-C2C — D32 : le panneau de C2B, en répartition', () => {
  it('les équipes du club et « À partir du » ; ni jour, ni heures, ni plateau, ni carte de place', async () => {
    const arbre = await monter({ repartition: true });
    const lus = textes(arbre);
    expect(lus).toEqual(expect.arrayContaining(['Tout le club', 'U13', 'U15']));
    expect(getClubTeamsForSlot).toHaveBeenCalledWith('as-montrivage');
    expect(mockInputProps).toHaveLength(0);
    expect(mockDateProps.at(-1)?.label).toBe('À partir du');
    expect(lus).not.toContain('Plateau');
    expect(lus).not.toContain('Jour');
    expect(previewFacilitySeasonSlot).not.toHaveBeenCalled();
    expect(lus).toContain('Les entraîneurs de l’équipe choisie sont prévenus.');
  });

  it('« Enregistrer » envoie SEULEMENT l équipe et la date d effet', async () => {
    const onDone = jest.fn();
    const arbre = await monter({ onDone, repartition: true });
    act(() => { presser(arbre, 'U15'); });
    await act(async () => { await presser(arbre, 'Enregistrer'); });
    expect(modifySeasonSlot).toHaveBeenCalledTimes(1);
    const [slotId, corps] = /** @type {any} */ (modifySeasonSlot).mock.calls[0];
    expect(slotId).toBe('slot-1');
    expect(Object.keys(corps).sort()).toEqual(['effectiveFrom', 'team']);
    expect(corps.team).toBe('team-U15');
    expect(corps.effectiveFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(onDone).toHaveBeenCalled();
  });

  it('« Tout le club » rend le créneau au club entier (team: null)', async () => {
    const arbre = await monter({ repartition: true });
    act(() => { presser(arbre, 'U15'); });
    act(() => { presser(arbre, 'Tout le club'); });
    await act(async () => { await presser(arbre, 'Enregistrer'); });
    expect(/** @type {any} */ (modifySeasonSlot).mock.calls[0][1].team).toBeNull();
  });

  it('sans répartition, la modification de la mairie est celle d avant (heures, sans équipe)', async () => {
    const arbre = await monter({ repartition: false });
    const lus = textes(arbre);
    expect(mockInputProps.map((props) => props.label)).toEqual(expect.arrayContaining(['Début', 'Fin']));
    expect(lus).not.toContain('U15');
    expect(getClubTeamsForSlot).not.toHaveBeenCalled();
  });
});

jest.mock(
  '@/components/atoms/skeletonLoader/SkeletonLoader',
  () => function SkeletonMock({ children }) { return children; },
);
jest.mock('@/context/AppFeedbackContext', () => ({
  useAppFeedback: () => ({ showBanner: jest.fn() }),
}));
