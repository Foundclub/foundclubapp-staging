/* eslint-disable max-len -- des phrases entieres de l ecran, comparees telles quelles */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  ScrollView, Switch, Text, TouchableOpacity,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import {
  closeFacility,
  listFacilityClosures,
  modifyFacilityClosure,
  previewFacilityClosure,
} from '@/services/facilityClosure/facilityClosureService';

import CollectiviteFermeture from '../CollectiviteFermeture';

// 🚧 CRFERM (13/10/2026) — COL-008, décision d'Adel « D7 B » et « heures : plage » (13/10 ~02 h 22,
// « Ok je valide tout ») : la planche P4v4-fermer-tel (plaquette HY521H1, page 9).
// Recette du 11/10 (capture S11) : 9 zones avant un bouton COUPÉ en bas de l'écran ; « Choisissez
// l'installation » écrit deux fois ; « Changer » alors que rien n'est choisi.
//
// Ce que ce fichier exige (ROUGE avant le lot) :
//   1. depuis l'accueil, un premier écran « Quelle installation fermez-vous ? » : une carte par
//      installation (type · capacité) ; une Ville à une seule installation passe au formulaire ;
//      chargement, erreur (« Réessayer ») et liste vide se disent ;
//   2. « Changer » seulement après un choix fait sur ce premier écran ; il y ramène ;
//   3. le bouton est FIXE, hors de ce qui défile ; ce qui manque est dit UNE fois, juste au-dessus ;
//      « Choisissez l'installation » n'est plus écrit nulle part ;
//   4. le nom et le mot sont repliés derrière « Ajouter un nom ou un mot pour les clubs », en boîte ;
//   5. « Toute la journée », activé par défaut ; désactivé, une heure au premier et au dernier jour,
//      qui partent au serveur, et la confirmation les dit ;
//   6. les dates attendent « Choisir » (court, sur une ligne).

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

const aplatir = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
  return String(enfants);
};
const textes = (/** @type {any} */ noeud) => noeud
  .findAllByType(Text)
  .map((/** @type {any} */ texte) => aplatir(texte.props.children).trim());
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
const champ = (/** @type {string} */ libelle) => mockInputProps.filter((props) => props.label === libelle).pop();
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
  mockNavigation = { goBack: jest.fn(), navigate: jest.fn(), setOptions: jest.fn() };
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

test('CRFERM-4/1 depuis l accueil : « Quelle installation fermez-vous ? », une carte par installation, pas encore de formulaire', async () => {
  const arbre = await rendre();
  const lu = textes(arbre.root);
  expect(lu).toContain('Quelle installation fermez-vous ?');
  expect(lu).toContain('Gymnase · 2 équipes à la fois');
  expect(lu).toContain('Dojo · 1 équipe à la fois');
  expect(lu).toContain('Terrain · 2 équipes à la fois');
  expect(parTestID(arbre, 'fermeture-installation-dojo').props.accessibilityRole).toBe('button');
  expect(parTestID(arbre, 'fermeture-envoyer')).toBeUndefined();
  expect(parTestID(arbre, 'fermeture-changer')).toBeUndefined();
  expect(lu.join('|')).not.toMatch(/Choisissez l’installation/);
  expect(date('Du')).toBeUndefined();
});

test('CRFERM-4/2 un choix ouvre le formulaire, l installation en boîte avec « Changer », qui ramène à la question', async () => {
  const arbre = await rendre();
  await appuyer(parTestID(arbre, 'fermeture-installation-gym-tilleuls'));
  let lu = textes(arbre.root);
  expect(lu).toContain('Gymnase des Tilleuls');
  expect(lu).not.toContain('Quelle installation fermez-vous ?');
  expect(date('Du')).toBeDefined();
  await appuyer(parTestID(arbre, 'fermeture-changer'));
  lu = textes(arbre.root);
  expect(lu).toContain('Quelle installation fermez-vous ?');
});

test('CRFERM-4/3 depuis la fiche de l installation, ou une Ville à UNE installation : le formulaire tout de suite, sans « Changer »', async () => {
  mockParams = { collectiviteId: 'ville-montrivage', facilityId: 'gym-tilleuls', mode: 'fermer' };
  let arbre = await rendre();
  expect(textes(arbre.root)).toContain('Gymnase des Tilleuls');
  expect(parTestID(arbre, 'fermeture-changer')).toBeUndefined();
  expect(date('Du')).toBeDefined();

  mockParams = { collectiviteId: 'ville-montrivage', mode: 'fermer' };
  mockInstallations = { ...mockInstallations, data: [TROIS[1]] };
  arbre = await rendre();
  expect(textes(arbre.root)).toContain('Dojo municipal');
  expect(textes(arbre.root)).not.toContain('Quelle installation fermez-vous ?');
  expect(parTestID(arbre, 'fermeture-changer')).toBeUndefined();
});

test('CRFERM-4/4 la liste se charge, n a pu être lue (« Réessayer »), ou est vide : l écran le dit', async () => {
  mockInstallations = {
    data: undefined, isError: false, isLoading: true, refetch: jest.fn(),
  };
  let arbre = await rendre();
  expect(textes(arbre.root)).toContain('Quelle installation fermez-vous ?');
  expect(arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === 'fermeture-installation-squelette').length).toBeGreaterThan(0);

  mockInstallations = {
    data: undefined, isError: true, isLoading: false, refetch: jest.fn(),
  };
  arbre = await rendre();
  expect(textes(arbre.root)).toContain('Les installations n’ont pas pu être lues.');
  await appuyer(parTestID(arbre, 'fermeture-installations-reessayer'));
  expect(mockInstallations.refetch).toHaveBeenCalled();

  mockInstallations = {
    data: [], isError: false, isLoading: false, refetch: jest.fn(),
  };
  arbre = await rendre();
  expect(textes(arbre.root)).toContain('Aucune installation à fermer');
});

test('CRFERM-4/5 le bouton est FIXE hors de ce qui défile ; ce qui manque est dit UNE fois, juste au-dessus', async () => {
  mockParams = { collectiviteId: 'ville-montrivage', facilityId: 'gym-tilleuls', mode: 'fermer' };
  const arbre = await rendre();
  const [defilement] = arbre.root.findAllByType(ScrollView);
  expect(defilement.findAll((/** @type {any} */ n) => n.props?.testID === 'fermeture-envoyer')).toHaveLength(0);
  expect(parTestID(arbre, 'fermeture-envoyer')).toBeDefined();
  expect(textes(defilement)).not.toContain('Choisissez les dates.');
  expect(textes(arbre.root).filter((ligne) => ligne === 'Choisissez les dates.')).toHaveLength(1);
  expect(date('Du').placeholder).toBe('Choisir');
  expect(date('Au').placeholder).toBe('Choisir');
});

test('CRFERM-4/6 le nom et le mot sont repliés derrière un lien, puis en boîte', async () => {
  mockParams = { collectiviteId: 'ville-montrivage', facilityId: 'gym-tilleuls', mode: 'fermer' };
  const arbre = await rendre();
  expect(champ('Nom (facultatif)')).toBeUndefined();
  expect(champ('Un mot pour les clubs (facultatif)')).toBeUndefined();
  const deplier = parTestID(arbre, 'fermeture-deplier');
  expect(textes(deplier)).toContain('Ajouter un nom ou un mot pour les clubs');
  expect(deplier.props.accessibilityState).toEqual({ expanded: false });
  await appuyer(deplier);
  expect(champ('Nom (facultatif)').density).not.toBe('compact');
  expect(champ('Un mot pour les clubs (facultatif)').density).not.toBe('compact');
  expect(parTestID(arbre, 'fermeture-deplier')).toBeUndefined();
});

test('CRFERM-4/7 « Toute la journée » par défaut ; désactivé, une heure au premier et au dernier jour, jusqu au serveur', async () => {
  mockParams = { collectiviteId: 'ville-montrivage', facilityId: 'gym-tilleuls', mode: 'fermer' };
  const arbre = await rendre();
  const [interrupteur] = arbre.root.findAllByType(Switch);
  expect(interrupteur.props.value).toBe(true);
  expect(interrupteur.props.accessibilityLabel).toBe('Toute la journée');
  expect(champ('Heure de début')).toBeUndefined();
  await changer(date('Du'), '16/10/2026');
  await changer(date('Au'), '19/10/2026');
  expect(previewFacilityClosure).toHaveBeenLastCalledWith('gym-tilleuls', {
    endDate: '2026-10-19', kind: 'closure', startDate: '2026-10-16',
  });

  await act(async () => { interrupteur.props.onValueChange(false); });
  await attendre();
  expect(champ('Heure de début').composant).toBe('TimePickerInput');
  expect(textes(arbre.root)).toContain('Choisissez les heures.');
  await changer(champ('Heure de début'), '14:00');
  await changer(champ('Heure de fin'), '12:00');
  expect(previewFacilityClosure).toHaveBeenLastCalledWith('gym-tilleuls', {
    endDate: '2026-10-19', endTime: '12:00', kind: 'closure', startDate: '2026-10-16', startTime: '14:00',
  });
  expect(textes(arbre.root)).toContain('Fermer le gymnase');
  await appuyer(parTestID(arbre, 'fermeture-envoyer'));
  expect(textes(arbre.root)).toContain('Fermer le Gymnase des Tilleuls du vendredi 16 octobre à 14:00 au lundi 19 octobre à 12:00 ?');
  await appuyer(parTestID(arbre, 'fermeture-confirmer'));
  expect(closeFacility).toHaveBeenCalledWith('gym-tilleuls', {
    endDate: '2026-10-19',
    endTime: '12:00',
    kind: 'closure',
    label: null,
    message: null,
    publishActualite: false,
    reason: 'travaux',
    startDate: '2026-10-16',
    startTime: '14:00',
  });
});

test('CRFERM-4/8 le même jour, la fin suit le début ; « Modifier » une plage revient à toute la journée', async () => {
  mockParams = { collectiviteId: 'ville-montrivage', facilityId: 'gym-tilleuls', mode: 'fermer' };
  const arbre = await rendre();
  await changer(date('Du'), '04/10/2026');
  await act(async () => { arbre.root.findAllByType(Switch)[0].props.onValueChange(false); });
  await attendre();
  await changer(champ('Heure de début'), '20:00');
  await changer(champ('Heure de fin'), '07:00');
  expect(textes(arbre.root)).toContain('La fin doit suivre le début.');
  expect(parTestID(arbre, 'fermeture-envoyer').props.disabled).toBe(true);

  mockInputProps.length = 0;
  mockParams = { closureId: 'fermeture-1', collectiviteId: 'ville-montrivage', facilityId: 'gym-tilleuls' };
  /** @type {any} */ (listFacilityClosures).mockResolvedValue({
    data: [{
      collectivite: { documentId: 'ville-montrivage' },
      documentId: 'fermeture-1',
      endDate: '2026-10-19',
      endTime: '12:00',
      facility: { documentId: 'gym-tilleuls', name: 'Gymnase des Tilleuls' },
      kind: 'closure',
      reason: 'travaux',
      startDate: '2026-10-16',
      startTime: '14:00',
    }],
    meta: { canManage: true },
  });
  const modifier = await rendre();
  const [interrupteur] = modifier.root.findAllByType(Switch);
  expect(interrupteur.props.value).toBe(false);
  expect(champ('Heure de début').value).toBe('14:00');
  await act(async () => { interrupteur.props.onValueChange(true); });
  await attendre();
  await appuyer(parTestID(modifier, 'fermeture-envoyer'));
  expect(modifyFacilityClosure).toHaveBeenCalledWith('fermeture-1', expect.objectContaining({
    endTime: null, startTime: null,
  }));
});

test('CRFERM-4/9 rien de touché sans geste : la touche « Changer » n est jamais là sans choix, et aucune zone de toucher sous 44 px', async () => {
  const arbre = await rendre();
  const cartes = arbre.root.findAllByType(TouchableOpacity).filter((/** @type {any} */ n) => String(n.props.testID || '')
    .startsWith('fermeture-installation-'));
  expect(cartes).toHaveLength(3);
  cartes.forEach((/** @type {any} */ carte) => {
    const style = [carte.props.style].flat(Infinity).reduce((tout, part) => ({ ...tout, ...part }), {});
    expect(style.minHeight).toBeGreaterThanOrEqual(44);
  });
  expect(arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === 'fermeture-changer')).toHaveLength(0);
});

// 🎚️ CRFIN (14/10, COLL-R-FINITIONS-FERMETURES, point 3) — l écart à la planche P4v4 (téléphone,
// état 3 bis ; ordinateur, état D) : « Toute la journée » allumé reste SOUS les dates ; éteint, il
// MONTE AU-DESSUS, et chaque jour porte son heure à côté (Du : jour | heure ; Au : jour | heure).
// ROUGE avant : il restait sous les dates dans les deux états.
test('CRFIN-3/1 « Toute la journée » : sous les dates allumé, AU-DESSUS éteint (planche P4v4, état 3 bis)', async () => {
  mockParams = { collectiviteId: 'ville-montrivage', facilityId: 'gym-tilleuls', mode: 'fermer' };
  const arbre = await rendre();
  // L ordre de l écran, de haut en bas : l interrupteur et les champs de jour et d heure.
  const ordre = () => arbre.root
    .findAll((/** @type {any} */ n) => n.type === Switch
      || (typeof n.type === 'function' && /^(DatePickerInput|TimePickerInput)Mock$/.test(n.type.name)))
    .map((/** @type {any} */ n) => (n.type === Switch ? n.props.accessibilityLabel : n.props.label));
  expect(ordre()).toEqual(['Du', 'Au', 'Toute la journée']);
  await act(async () => { arbre.root.findAllByType(Switch)[0].props.onValueChange(false); });
  await attendre();
  expect(ordre()).toEqual(['Toute la journée', 'Du', 'Heure de début', 'Au', 'Heure de fin']);
  await act(async () => { arbre.root.findAllByType(Switch)[0].props.onValueChange(true); });
  await attendre();
  expect(ordre()).toEqual(['Du', 'Au', 'Toute la journée']);
});
