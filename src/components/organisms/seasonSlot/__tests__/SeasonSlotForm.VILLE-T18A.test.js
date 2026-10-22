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

// 📐 VILLE-T18A (07/10) — deux défauts de la tournée T18 sur « Attribuer un créneau » et
// « Modifier le créneau » (design HY521H1, planche 23, P4v2-creneaux-tel ; captures
// G29a, G30b, G30c, G32a de D:/App/fc/.recette/tournee18/captures).
//
//   POINT 2 — planche 23, état 3 « la capacité dépassée » : quand la carte de place dit
//   « complet » PENDANT la saisie, l écran offre les 3 gestes de la planche :
//   « Voir les heures libres du mardi », « Attribuer quand même », « Changer l’heure ».
//   Avant : seulement « Attribuer le créneau » / « Annuler » (les 3 gestes n arrivaient
//   qu APRÈS un refus 409 du serveur).
//
//   POINT 3 — les heures se CHOISISSENT avec le sélecteur d heure de la création
//   d événement (`TimePickerInput`, décision d Adel du 07/10 « réutiliser ce qu on a
//   déjà ») ; avant, elles se tapaient au clavier.

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
const aplatir = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
  return String(enfants);
};
// Les espaces insécables (parade Android 16 des textes gras) se lisent comme des espaces.
const lire = (/** @type {any} */ noeud) => aplatir(noeud.props.children).replace(/\u00a0/g, ' ').trim();
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text).map(lire);
const touchable = (/** @type {any} */ arbre, /** @type {string} */ libelle) => arbre.root.findAll((/** @type {any} */ n) => typeof n.props?.onPress === 'function'
  && n.findAllByType(Text).some((/** @type {any} */ t) => lire(t) === libelle), { deep: false })[0];
const tours = async () => {
  for (let tour = 0; tour < 3; tour += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await new Promise((fini) => { setTimeout(fini, 0); }); });
  }
};
const presser = async (/** @type {any} */ arbre, /** @type {string} */ libelle) => {
  const cible = touchable(arbre, libelle);
  if (!cible) throw new Error(`rien a toucher : ${libelle}`);
  await act(async () => { await cible.props.onPress(); });
  await tours();
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

describe('VILLE-T18A point 3 — les heures se choisissent au sélecteur d heure', () => {
  it('« Attribuer » : Début et Fin sont des sélecteurs d heure, et l heure choisie part', async () => {
    const arbre = await monter();
    expect(heure('Début')?.composant).toBe('TimePickerInput');
    expect(heure('Fin')?.composant).toBe('TimePickerInput');
    await choisirHeure('Début', '17:30');
    await choisirHeure('Fin', '19:00');
    expect(heure('Début').value).toBe('17:30');
    expect(heure('Fin').value).toBe('19:00');
    expect(dernierApercu()).toEqual(expect.objectContaining({ endTime: '19:00', startTime: '17:30', weekday: 2 }));
    await presser(arbre, 'Attribuer le créneau');
    expect(attributeSeasonSlot).toHaveBeenCalledWith('salle-t18', {
      club: 'basket', endTime: '19:00', startTime: '17:30', weekday: 2,
    });
  });

  it('« Modifier » : les heures du créneau sont pré-remplies dans les sélecteurs', async () => {
    const arbre = await monter({ slot: { ...MARDI[1], facility: { documentId: 'salle-t18', name: 'T18 Salle essai' } } });
    expect(heure('Début')?.composant).toBe('TimePickerInput');
    expect(heure('Début')?.value).toBe('18:00');
    expect(heure('Fin')?.value).toBe('19:30');
    await choisirHeure('Fin', '20:00');
    await presser(arbre, 'Enregistrer quand même');
    expect(modifySeasonSlot).toHaveBeenCalledWith('pt2i', expect.objectContaining({ confirmOverCapacity: true, endTime: '20:00', startTime: '18:00' }));
  });
});

describe('VILLE-T18A point 2 — planche 23 état 3 : la capacité dépassée, ses 3 gestes', () => {
  const remplirLeComplet = async () => {
    const arbre = await monter();
    await choisirHeure('Début', '18:00');
    await choisirHeure('Fin', '19:30');
    return arbre;
  };

  it('pendant la saisie, « complet » offre les 3 gestes de la planche (et plus « Attribuer le créneau »)', async () => {
    const arbre = await remplirLeComplet();
    const lus = textes(arbre);
    expect(lus).toContain('Mardi 18:00 – 19:30 : complet');
    expect(lus).toContain('Attribuer met 3 équipes pour 2 places, chaque mardi de la saison.');
    expect(touchable(arbre, 'Voir les heures libres du mardi')).toBeDefined();
    expect(touchable(arbre, 'Attribuer quand même')).toBeDefined();
    expect(touchable(arbre, 'Changer l’heure')).toBeDefined();
    expect(lus).not.toContain('Attribuer le créneau');
  });

  it('« Attribuer quand même » confirme d emblée (aucun aller-retour 409)', async () => {
    const arbre = await remplirLeComplet();
    await presser(arbre, 'Attribuer quand même');
    expect(attributeSeasonSlot).toHaveBeenCalledTimes(1);
    expect(attributeSeasonSlot).toHaveBeenCalledWith('salle-t18', {
      club: 'basket', confirmOverCapacity: true, endTime: '19:30', startTime: '18:00', weekday: 2,
    });
  });

  it('« Voir les heures libres du mardi » : les heures où il reste une place, un appui les pose', async () => {
    const arbre = await remplirLeComplet();
    await presser(arbre, 'Voir les heures libres du mardi');
    expect(textes(arbre)).toContain('Libre ce mardi :');
    expect(touchable(arbre, '08:00 – 18:00')).toBeDefined();
    expect(touchable(arbre, '19:30 – 22:00')).toBeDefined();
    await presser(arbre, '19:30 – 22:00');
    // La durée saisie (1 h 30) est gardée.
    expect(heure('Début').value).toBe('19:30');
    expect(heure('Fin').value).toBe('21:00');
    expect(dernierApercu()).toEqual(expect.objectContaining({ endTime: '21:00', startTime: '19:30' }));
    expect(textes(arbre)).toContain('Mardi 19:30 – 21:00 : place libre');
    expect(touchable(arbre, 'Attribuer le créneau')).toBeDefined();
  });

  it('« Changer l’heure » rend les heures à choisir et montre les heures libres', async () => {
    const arbre = await remplirLeComplet();
    await presser(arbre, 'Changer l’heure');
    expect(heure('Début').value).toBe('');
    expect(heure('Fin').value).toBe('');
    expect(textes(arbre)).toContain('Libre ce mardi :');
    expect(touchable(arbre, 'Attribuer quand même')).toBeUndefined();
    expect(attributeSeasonSlot).not.toHaveBeenCalled();
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
