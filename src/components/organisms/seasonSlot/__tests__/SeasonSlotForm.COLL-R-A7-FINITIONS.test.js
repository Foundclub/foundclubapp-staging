/* eslint-disable max-len -- donnees de test : les fixtures se lisent mieux sur une ligne */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import SkeletonLoader from '@/components/atoms/skeletonLoader/SkeletonLoader';

import {
  attributeSeasonSlot,
  getClubTeamsForSlot,
  listFacilitySeasonSlots,
  modifySeasonSlot,
  previewFacilitySeasonSlot,
} from '@/services/seasonSlot/seasonSlotService';

import SeasonSlotForm from '../SeasonSlotForm';

// 📐 COLL-R-A7-FINITIONS (14/10/2026, COL-005) — ce qui manquait au tunnel « Attribuer un
// créneau » pour coller à la planche VALIDÉE par Adel (P4v4-attribuer-tel,
// P4v4-attribuer-entrees-tel, P4v4-attribuer-ordi ; décision du 13/10 ~02h22, « Ok je valide
// tout »). Un point par bloc, dans l'ordre du prompt ; chaque bloc était ROUGE avant son commit.
// Banc : les doublures de SeasonSlotForm.COLL-R-A7.pleinEcran.test.js ; le VRAI gabarit.

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
const mockShowBanner = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {any[]} */ ...args) => jest.requireActual('i18next').t(...args),
  }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 34, left: 0, right: 0, top: 47,
  }),
}));
jest.mock('@/context/AppFeedbackContext', () => ({
  useAppFeedback: () => ({ showBanner: mockShowBanner }),
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
    return reactActuel.createElement(PressableRN, { accessibilityRole: 'button', disabled: props.disabled, onPress: props.onPress }, reactActuel.createElement(TexteRN, null, props.title));
  };
});
jest.mock('@/components/atoms/SvgIcon/SvgIcon', () => ({ SvgIcon: function SvgIconMock() { return null; } }));
jest.mock('@/components/atoms/skeletonLoader/SkeletonLoader', () => function SkeletonMock({ children }) { return children; });
jest.mock('@/components/templates/ScreenContainer', () => function ScreenContainerMock({ children }) { return children; });
jest.mock('@/components/molecules/clubLogoMark/ClubLogoMark', () => function ClubLogoMarkMock() { return null; });
jest.mock('@/components/molecules/timePickerInput/TimePickerInput', () => function TimePickerInputMock(/** @type {any} */ props) {
  mockHeureProps.push(props);
  return null;
});
jest.mock('@/components/molecules/datePickerInput/DatePickerInput', () => function DatePickerInputMock() { return null; });
jest.mock('@/components/organisms/seasonSlot/RondsDePlaces', () => function RondsDePlacesMock() { return null; });

jest.setTimeout(30000);

const SAISON = { validFrom: '2026-09-01', validUntil: '2027-06-30' };
const SALLE = {
  documentId: 'salle-t18', maxSlots: 2, name: 'T18 Salle essai', type: 'gymnase',
};
const CLUBS = [{ documentId: 'basket', name: 'Montrivage Basket' }, { documentId: 'football', name: 'Montrivage FC' }];
const CRENEAU = {
  club: { documentId: 'basket', name: 'Montrivage Basket' },
  documentId: 'slot-1',
  endTime: '19:00',
  facility: { documentId: 'salle-t18' },
  startTime: '17:30',
  team: { documentId: 'u13', name: 'U13' },
  weekday: 2,
  ...SAISON,
};

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
          ajouterUnClub={props.ajouterUnClub}
          clubs={props.clubs || CLUBS}
          compact={props.compact}
          facilityId="salle-t18"
          guided
          initial={props.initial}
          lectureDesClubs={props.lectureDesClubs}
          onCancel={props.onCancel || jest.fn()}
          onDone={props.onDone || jest.fn()}
          pleinEcran={props.pleinEcran !== false}
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
  /** @type {any} */ (getClubTeamsForSlot).mockResolvedValue([{ documentId: 'u13', name: 'U13' }]);
  /** @type {any} */ (listFacilitySeasonSlots).mockResolvedValue({
    data: [],
    meta: { facility: { ...SALLE, plateaux: [] }, season: SAISON },
  });
  /** @type {any} */ (previewFacilitySeasonSlot).mockResolvedValue({ data: { capacity: 2, needsConfirmation: false, occupants: [] } });
  /** @type {any} */ (attributeSeasonSlot).mockResolvedValue({ data: { documentId: 'neuf' } });
  /** @type {any} */ (modifySeasonSlot).mockResolvedValue({ data: {} });
});
afterEach(() => {
  act(() => { arbresMontes.splice(0).forEach((arbre) => arbre.unmount()); });
});

const tunnel = (/** @type {any} */ arbre) => arbre.root.findByType(WizardStepLayout).props;
const appeler = async (/** @type {() => any} */ geste) => {
  await act(async () => { await geste(); });
  await tours();
};
const avancer = (/** @type {any} */ arbre) => {
  expect(tunnel(arbre).isNextDisabled).not.toBe(true);
  return appeler(() => tunnel(arbre).onNext());
};
// Les puces du panneau posent des espaces insécables (VILLE-T18A) : lues comme des espaces.
const texte = (/** @type {any} */ n) => [].concat(n.props.children).join('').replace(/\u00a0/g, ' ');
const choix = (/** @type {any} */ arbre, /** @type {string} */ libelle) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props.accessibilityRole === 'radio' && typeof n.props.onPress === 'function'
    && n.findAllByType(Text).some((/** @type {any} */ x) => texte(x) === libelle),
)[0];
const choisir = async (/** @type {any} */ arbre, /** @type {string} */ libelle) => {
  const cible = choix(arbre, libelle);
  expect(cible).toBeDefined();
  await appeler(() => cible.props.onPress());
};
const bouton = (/** @type {any} */ arbre, /** @type {string} */ libelle) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props.accessibilityRole === 'button' && typeof n.props.onPress === 'function'
    && n.findAllByType(Text).some((/** @type {any} */ x) => texte(x) === libelle),
)[0];
const appuyerSur = async (/** @type {any} */ arbre, /** @type {string} */ libelle) => {
  const cible = bouton(arbre, libelle);
  expect(cible).toBeDefined();
  await appeler(() => cible.props.onPress());
};
// Depuis une heure libre du planning : 3 étapes (club, équipe, récapitulatif).
const jusquAuRecap = async (/** @type {any} */ arbre) => {
  await choisir(arbre, 'Montrivage Basket');
  await avancer(arbre);
  await avancer(arbre);
  expect(tunnel(arbre).title).toBe('Récapitulatif');
};
const DEPUIS_LE_PLANNING = { compact: true, initial: { endTime: '19:30', startTime: '18:00', weekday: 3 } };

describe('COLL-R-A7-FINITIONS 1 — la bulle de confirmation au retour sur l’écran d’origine', () => {
  // Planche P4v4-attribuer-entrees-tel, « Attribué : retour à l'installation » : le tunnel se ferme,
  // un message confirme (« Créneau attribué » · « AS Montrivage est prévenu. »). Le mécanisme
  // existe : la bannière de l'app (AppFeedbackContext, hôte AppBannerHost, monté au téléphone et
  // sur le site). ROUGE avant : rien ne confirmait, le tunnel se fermait en silence.
  test('« Attribuer le créneau » : « Créneau attribué · Montrivage Basket est prévenu. », puis le tunnel se ferme', async () => {
    const onDone = jest.fn();
    const arbre = await monter({ ...DEPUIS_LE_PLANNING, onDone });
    await jusquAuRecap(arbre);
    expect(mockShowBanner).not.toHaveBeenCalled();
    await appeler(() => tunnel(arbre).onNext());
    expect(mockShowBanner).toHaveBeenCalledTimes(1);
    expect(mockShowBanner).toHaveBeenCalledWith(expect.objectContaining({
      body: 'Montrivage Basket est prévenu.', title: 'Créneau attribué', tone: 'success',
    }));
    expect(onDone).toHaveBeenCalledWith({ documentId: 'neuf' });
  });

  test('« Modifier le créneau » : « Créneau modifié · Montrivage Basket est prévenu. »', async () => {
    const arbre = await monter({ slot: CRENEAU });
    await avancer(arbre);
    await avancer(arbre);
    await avancer(arbre);
    expect(tunnel(arbre).nextLabel).toBe('Enregistrer');
    await appeler(() => tunnel(arbre).onNext());
    expect(mockShowBanner).toHaveBeenCalledWith(expect.objectContaining({
      body: 'Montrivage Basket est prévenu.', title: 'Créneau modifié', tone: 'success',
    }));
  });

  test('un échec ne confirme rien : la bulle ne part qu’après un vrai enregistrement', async () => {
    /** @type {any} */ (attributeSeasonSlot).mockRejectedValue(Object.assign(new Error('x'), { response: { status: 500 } }));
    const arbre = await monter(DEPUIS_LE_PLANNING);
    await jusquAuRecap(arbre);
    await appeler(() => tunnel(arbre).onNext());
    expect(mockShowBanner).not.toHaveBeenCalled();
  });

  test('le panneau du site en grand écran ne change pas : pas de bulle', async () => {
    const arbre = await monter({ ...DEPUIS_LE_PLANNING, pleinEcran: false });
    await choisir(arbre, 'Montrivage Basket');
    await appuyerSur(arbre, 'Suivant');
    await appuyerSur(arbre, 'Suivant');
    await appuyerSur(arbre, 'Attribuer pour la saison');
    expect(attributeSeasonSlot).toHaveBeenCalledTimes(1);
    expect(mockShowBanner).not.toHaveBeenCalled();
  });
});

describe('COLL-R-A7-FINITIONS 2 — aucun club rattaché', () => {
  test('dit pourquoi et permet de rejoindre le rattachement existant', async () => {
    const ajouterUnClub = jest.fn();
    const arbre = await monter({ clubs: [], ajouterUnClub });
    expect(arbre.root.findAllByType(Text).some((n) => texte(n).includes('Aucun club'))).toBe(true);
    expect(tunnel(arbre).isNextDisabled).toBe(true);
    await appuyerSur(arbre, 'Ajouter un club');
    expect(ajouterUnClub).toHaveBeenCalledTimes(1);
  });
});

describe('COLL-R-A7-FINITIONS 3 — les lectures ont un squelette', () => {
  test('clubs : attente explicite, sans faux état vide', async () => {
    const arbre = await monter({ clubs: [], lectureDesClubs: { isLoading: true } });
    expect(arbre.root.findByType(SkeletonLoader).props).toMatchObject({
      backgroundColor: expect.any(String), highlightColor: expect.any(String), isActive: true,
    });
    expect(arbre.root.findAllByType(Text).some((n) => texte(n).includes('Aucun club'))).toBe(false);
    expect(tunnel(arbre).isNextDisabled).toBe(true);
  });

  test('équipes : Suivant attend la lecture puis retrouve les choix', async () => {
    let finir;
    /** @type {any} */ (getClubTeamsForSlot).mockReturnValue(new Promise((resolve) => { finir = resolve; }));
    const arbre = await monter(DEPUIS_LE_PLANNING);
    await choisir(arbre, 'Montrivage Basket');
    await avancer(arbre);
    expect(arbre.root.findAllByType(SkeletonLoader)).toHaveLength(1);
    expect(tunnel(arbre).isNextDisabled).toBe(true);
    await appeler(() => finir([{ documentId: 'u13', name: 'U13' }]));
    expect(arbre.root.findAllByType(SkeletonLoader)).toHaveLength(0);
    expect(choix(arbre, 'U13')).toBeDefined();
    expect(tunnel(arbre).isNextDisabled).toBe(false);
  });

  test('disponibilités : le récapitulatif attend la place avant de pouvoir attribuer', async () => {
    let finir;
    /** @type {any} */ (previewFacilitySeasonSlot).mockReturnValue(new Promise((resolve) => { finir = resolve; }));
    const arbre = await monter(DEPUIS_LE_PLANNING);
    await jusquAuRecap(arbre);
    expect(arbre.root.findAllByType(SkeletonLoader)).toHaveLength(1);
    expect(tunnel(arbre).isNextDisabled).toBe(true);
    await appeler(() => finir({ data: { capacity: 2, needsConfirmation: false, occupants: [] } }));
    expect(arbre.root.findAllByType(SkeletonLoader)).toHaveLength(0);
    expect(tunnel(arbre).isNextDisabled).toBe(false);
  });
});
