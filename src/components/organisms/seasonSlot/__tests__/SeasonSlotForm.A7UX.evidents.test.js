/* eslint-disable max-len -- donnees de test : les fixtures se lisent mieux sur une ligne */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TouchableOpacity, View } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import {
  attributeSeasonSlot,
  getClubTeamsForSlot,
  listFacilitySeasonSlots,
  modifySeasonSlot,
  previewFacilitySeasonSlot,
} from '@/services/seasonSlot/seasonSlotService';

import SeasonSlotForm, { PuceDeChoix } from '../SeasonSlotForm';

// 📏 A7-UX (20/10) — LES CORRECTIFS ÉVIDENTS du tunnel « Attribuer un créneau », mesurés au banc du
// site (panneau de droite, 1 360 px) : les puces faisaient 36 px de haut (cible minimale : 44) ; une
// puce suivie de « complet … » (« Quel jour ? ») étirait ses voisines en ovales ; « Voir les heures
// libres » se touchait sur 32 px ; « Retour » était gris (4,35:1 sur le fond du site), la planche
// P4v4 le dessine en cyan pâle (`btn-g` = primary200, 6,5:1). ROUGES avant le lot.
// Banc et doublures : ceux de SeasonSlotForm.VILLE-T18A.test.js.

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
// R17Q2B (22/10) : « Quand ? » ouvre « Voir les dates retirées » dans une FEUILLE DU BAS (BottomModal) ;
// sa vraie version charge @gorhom/bottom-sheet et le geste natif, illisibles ici : même doublure que R17Q2.vacances.
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

const aplatirStyle = (/** @type {any} */ style) => [style].flat(Infinity).filter(Boolean).reduce((tout, part) => ({ ...tout, ...part }), {});

describe('A7-UX — correctifs évidents du tunnel', () => {
  it('🔴 une puce à choisir fait 44 px de haut', async () => {
    /** @type {any} */
    let arbre;
    await act(async () => { arbre = renderer.create(<PuceDeChoix actif={false} libelle="Mer." onPress={jest.fn()} />); });
    arbresMontes.push(arbre);
    expect(aplatirStyle(arbre.root.findByType(TouchableOpacity).props.style).minHeight).toBe(44);
  });

  it('🔴 la rangée des jours garde chaque puce à sa hauteur (« complet … » n étire plus ses voisines)', async () => {
    const arbre = await monter();
    const rangee = arbre.root.findAll((/** @type {any} */ n) => n.type === View
      && n.findAll((/** @type {any} */ e) => e.props?.testID === 'jour-1', { deep: true }).length > 0
      && n.findAll((/** @type {any} */ e) => e.props?.testID === 'jour-7', { deep: true }).length > 0).pop();
    expect(aplatirStyle(rangee.props.style).alignItems).toBe('flex-start');
  });

  it('🔴 « Retour » du parcours est en cyan pâle (planche P4v4), plus en gris', async () => {
    await monter({ guided: true });
    const retour = [...mockBoutons].reverse().find((props) => props.title === 'Retour');
    expect(retour?.variant).toBe('Ghost');
    expect(aplatirStyle(retour?.textStyle).color).toBe(jest.requireActual('@/theme/colors').default().primary200);
    expect(retour?.iconColor).toBe(jest.requireActual('@/theme/colors').default().primary200);
  });

  it('🔴 « Voir les heures libres » se touche sur 44 px', async () => {
    const arbre = await monter();
    await choisirHeure('Début', '18:00');
    await choisirHeure('Fin', '19:30');
    const lien = arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === 'attribuer-voir-libres' && typeof n.props?.onPress === 'function')[0];
    expect(lien).toBeTruthy();
    expect(aplatirStyle(lien.props.style).minHeight).toBe(44);
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
