/* eslint-disable max-len -- donnees de test : les fixtures se lisent mieux sur une ligne */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { addDays, format } from 'date-fns';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import {
  getClubTeamsForSlot,
  listFacilitySeasonSlots,
  modifySeasonSlot,
  previewFacilitySeasonSlot,
} from '@/services/seasonSlot/seasonSlotService';

import SeasonSlotForm from '../SeasonSlotForm';

// 📐 COLL-C2B-BIS (03/10) — planche 23 : MODIFIER LA PÉRIODE d un créneau (design HY521H1,
// P4v2-creneaux ; contrat C2A §4.5, complété par le lot). Le vrai fr.js écrit les phrases ; le
// service HTTP est doublé, les requêtes react-query sont les vraies.
//
// Ce que ce témoin exige (ROUGE avant le lot : « Modifier » n avait aucun champ de période) :
//   - un créneau PAS ENCORE commencé : « Du » et « Au », et les deux partent au serveur ;
//   - un créneau COMMENCÉ : son début se dit (« Depuis le … »), il ne se choisit plus ; « Au » seul ;
//   - une période inchangée n envoie rien de neuf (la coupure « à partir du » reste celle d avant) ;
//   - la carte de place se lit sur la NOUVELLE période ;
//   - en répartition (le dirigeant), aucun champ de période : la mairie la garde.

const i18nextTemoin = require('i18next');

const frTemoin = require('@/theme/strings/translations/fr');

(i18nextTemoin.default || i18nextTemoin).init({
  compatibilityJSON: 'v4',
  fallbackLng: 'fr',
  lng: 'fr',
  resources: { fr: { translation: frTemoin.default } },
});

/** @type {any[]} */
const mockDateProps = [];

// Les phrases passent par le vrai i18next (interpolation comprise).
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
// FINITIONS13-COLL (04/10) : seasonSlotQueries lit « Chiffres » de la Ville (même client HTTP).
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
jest.mock('@/components/molecules/input/Input', () => function InputMock() { return null; });
jest.mock('@/components/molecules/datePickerInput/DatePickerInput', () => function DatePickerInputMock(/** @type {any} */ props) {
  mockDateProps.push(props);
  return null;
});
jest.mock('@/components/organisms/seasonSlot/RondsDePlaces', () => function RondsDePlacesMock() { return null; });

const iso = (/** @type {number} */ jours) => format(addDays(new Date(), jours), 'yyyy-MM-dd');
const saisie = (/** @type {number} */ jours) => format(addDays(new Date(), jours), 'dd/MM/yyyy');

// Un créneau commencé il y a un mois, et un créneau qui commence dans un mois.
const COMMENCE = {
  club: { documentId: 'as-montrivage', name: 'AS Montrivage' }, documentId: 'slot-1', endTime: '19:00', facility: { documentId: 'gym-tilleuls', name: 'Gymnase des Tilleuls' }, plateau: null, startTime: '17:30', team: null, validFrom: iso(-30), validUntil: iso(200), weekday: 2,
};
const A_VENIR = {
  ...COMMENCE, documentId: 'slot-2', validFrom: iso(30), validUntil: iso(200),
};

/** @type {any[]} */
const arbresMontes = [];
const aplatir = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
  return String(enfants);
};
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text).map((/** @type {any} */ n) => aplatir(n.props.children).trim());
const presser = (/** @type {any} */ arbre, /** @type {string} */ libelle) => {
  const [cible] = arbre.root.findAll((/** @type {any} */ n) => typeof n.props?.onPress === 'function'
    && n.findAllByType(Text).some((/** @type {any} */ t) => aplatir(t.props.children).trim() === libelle), { deep: false });
  return cible.props.onPress();
};
const tours = async () => {
  for (let tour = 0; tour < 3; tour += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await new Promise((fini) => { setTimeout(fini, 0); }); });
  }
};
const monter = async (/** @type {any} */ props) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <SeasonSlotForm onDone={props.onDone || jest.fn()} repartition={props.repartition} slot={props.slot} />
      </QueryClientProvider>,
    );
  });
  await tours();
  arbresMontes.push(arbre);
  return arbre;
};
const champ = (/** @type {string} */ libelle) => [...mockDateProps].reverse().find((props) => props.label === libelle);

beforeEach(() => {
  jest.clearAllMocks();
  mockDateProps.length = 0;
  /** @type {any} */ (getClubTeamsForSlot).mockResolvedValue([]);
  /** @type {any} */ (listFacilitySeasonSlots).mockResolvedValue({
    data: [],
    meta: {
      facility: {
        documentId: 'gym-tilleuls', maxSlots: 2, name: 'Gymnase des Tilleuls', plateaux: [],
      },
    },
  });
  /** @type {any} */ (previewFacilitySeasonSlot).mockResolvedValue({ data: { capacity: 2, needsConfirmation: false, occupants: [] } });
  /** @type {any} */ (modifySeasonSlot).mockResolvedValue({ data: COMMENCE });
});
afterEach(() => {
  act(() => { arbresMontes.splice(0).forEach((arbre) => arbre.unmount()); });
});

describe('COLL-C2B-BIS — planche 23 : la période d un créneau se modifie', () => {
  it('un créneau à venir : « Du » et « Au », et les deux partent au serveur', async () => {
    const arbre = await monter({ slot: A_VENIR });
    expect(champ('Du')?.value).toBe(saisie(30));
    expect(champ('Au')?.value).toBe(saisie(200));
    act(() => { champ('Du').onChange(saisie(40)); });
    act(() => { champ('Au').onChange(saisie(120)); });
    await tours();
    // La carte de place se lit sur la nouvelle période.
    const dernierApercu = /** @type {any} */ (previewFacilitySeasonSlot).mock.calls.at(-1)[1];
    expect(dernierApercu).toEqual(expect.objectContaining({ validFrom: iso(40), validUntil: iso(120) }));
    await act(async () => { await presser(arbre, 'Enregistrer'); });
    const [slotId, corps] = /** @type {any} */ (modifySeasonSlot).mock.calls[0];
    expect(slotId).toBe('slot-2');
    expect(corps).toEqual(expect.objectContaining({ validFrom: iso(40), validUntil: iso(120) }));
  });

  it('un créneau commencé : son début se dit et ne se choisit plus ; « Au » seul part', async () => {
    const arbre = await monter({ slot: COMMENCE });
    expect(champ('Du')).toBeUndefined();
    expect(textes(arbre).some((texte) => texte.startsWith('Depuis le '))).toBe(true);
    act(() => { champ('Au').onChange(saisie(90)); });
    await tours();
    // Le passé ne se rejuge pas : la carte part d aujourd hui.
    const dernierApercu = /** @type {any} */ (previewFacilitySeasonSlot).mock.calls.at(-1)[1];
    expect(dernierApercu).toEqual(expect.objectContaining({ validFrom: iso(0), validUntil: iso(90) }));
    await act(async () => { await presser(arbre, 'Enregistrer'); });
    const corps = /** @type {any} */ (modifySeasonSlot).mock.calls[0][1];
    expect(corps.validUntil).toBe(iso(90));
    expect(corps).not.toHaveProperty('validFrom');
  });

  it('une période inchangée n envoie rien de neuf', async () => {
    const arbre = await monter({ slot: COMMENCE });
    await act(async () => { await presser(arbre, 'Enregistrer'); });
    const corps = /** @type {any} */ (modifySeasonSlot).mock.calls[0][1];
    expect(corps).not.toHaveProperty('validFrom');
    expect(corps).not.toHaveProperty('validUntil');
  });

  it('une fin avant le début se dit, et « Enregistrer » attend', async () => {
    const arbre = await monter({ slot: A_VENIR });
    act(() => { champ('Au').onChange(saisie(10)); });
    await tours();
    // R17-QUAND-1 (planche P10-quand-tel, état 8, validée le 19/10) : les mots de la planche.
    expect(textes(arbre)).toContain('« Au » doit venir après « Du ».');
    await act(async () => { await presser(arbre, 'Enregistrer'); });
    expect(modifySeasonSlot).not.toHaveBeenCalled();
  });

  it('en répartition (le dirigeant), aucun champ de période', async () => {
    await monter({ repartition: true, slot: COMMENCE });
    expect(champ('Du')).toBeUndefined();
    expect(champ('Au')).toBeUndefined();
  });
});

jest.mock(
  '@/components/atoms/skeletonLoader/SkeletonLoader',
  () => function SkeletonMock({ children }) { return children; },
);
jest.mock('@/context/AppFeedbackContext', () => ({
  useAppFeedback: () => ({ showBanner: jest.fn() }),
}));
