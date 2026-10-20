import { TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ComplexeCreneaux from '@/views/complexe/ComplexeCreneaux';

import { RouteNames } from '@/navigation/routeNames';

import {
  lisibles,
  parRepere,
  PLAN_OUVERT,
  pressable,
  terrainDeTemoin,
} from '@/testSupport/temoinComplexe';

// RESA-L5A1 (13/10/2026) — E-G09 « Créneaux et tarifs » (planches EG09 et RA4, qui remplace les
// états 1 et 2) : les plages (jours, ouverture, fermeture, durée à 5 minutes près), les tarifs
// (jour, ou jour et heure), « Les prix de la semaine », la période, les créneaux ponctuels,
// l'aperçu jugé par le serveur (`dryRun`), « Ouvrir ces créneaux » / « Enregistrer ».

let mockParams = /** @type {any} */ ({ complexeId: 'cx-five', terrainId: 't-1' });
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, setOptions: jest.fn() }),
  useRoute: () => ({ params: mockParams }),
}));

let mockTerrains = /** @type {any} */ ({});
const mockApercu = jest.fn();
const mockEnregistrer = jest.fn();
jest.mock('@/services/complexe/complexeQueries', () => ({
  useApercuCreneaux: () => ({ isPending: false, mutateAsync: mockApercu }),
  useEnregistrerCreneaux: () => ({ isPending: false, mutateAsync: mockEnregistrer }),
  useTerrains: () => mockTerrains,
}));

// Les sélecteurs d'heure et de date : des champs de texte qui gardent leur contrat
// (valeur, rappel).
jest.mock('@/components/molecules/timePickerInput/TimePickerInput', () => {
  const { TextInput: Saisie } = jest.requireActual('react-native');
  return function FausseHeure(/** @type {any} */ { label, onChange, value }) {
    return <Saisie accessibilityLabel={label} onChangeText={onChange} value={value} />;
  };
});
jest.mock('@/components/molecules/datePickerInput/DatePickerInput', () => {
  const { TextInput: Saisie } = jest.requireActual('react-native');
  return function FausseDate(/** @type {any} */ { label, onChange, value }) {
    return <Saisie accessibilityLabel={label} onChangeText={onChange} value={value} />;
  };
});
jest.mock('@/components/molecules/input/Input', () => {
  const { TextInput: Saisie } = jest.requireActual('react-native');
  return function FausseSaisie(/** @type {any} */ { label, onChangeText, value }) {
    return <Saisie accessibilityLabel={label} onChangeText={onChangeText} value={value} />;
  };
});
jest.mock('@/components/molecules/bottomModal/BottomModal', () => (
  function FausseFeuille(/** @type {any} */ { children, isVisible }) {
    return isVisible ? children : null;
  }
));
jest.mock('@/components/templates/ScreenContainer', () => (
  function FauxConteneur(/** @type {any} */ { children }) {
    return children;
  }
));
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('@/theme/themeContext', () => (
  jest.requireActual('@/testSupport/temoinComplexe').themeDeTemoin()
));

/**
 * Monte l'écran.
 * @returns {Promise<any>} L'arbre.
 */
const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<ComplexeCreneaux />);
  });
  return arbre;
};

/**
 * Appuie sur un élément par son libellé.
 * @param {any} arbre - L'arbre.
 * @param {string} libelle - Le libellé.
 * @returns {Promise<void>} Fini.
 */
const appuyer = async (arbre, libelle) => {
  await act(async () => {
    await pressable(arbre, libelle).props.onPress();
  });
};

/**
 * Appuie sur un élément par son repère.
 * @param {any} arbre - L'arbre.
 * @param {string} testID - Le repère.
 * @returns {Promise<void>} Fini.
 */
const toucher = async (arbre, testID) => {
  await act(async () => {
    await parRepere(arbre, testID).props.onPress();
  });
};

/**
 * Écrit dans un champ, par son libellé.
 * @param {any} arbre - L'arbre.
 * @param {string} libelle - Le libellé.
 * @param {string} texte - Le texte.
 * @returns {Promise<void>} Fini.
 */
const ecrire = async (arbre, libelle, texte) => {
  const [champ] = arbre.root.findAll((n) => n.type === TextInput
    && n.props.accessibilityLabel === libelle);
  await act(async () => {
    champ.props.onChangeText(texte);
  });
};

const AVEC_TARIFS = {
  ...PLAN_OUVERT,
  rates: [
    { days: [6, 7], price: 70 },
    {
      days: [1, 2, 3, 4, 5], from: '18:00', price: 80, to: '22:00',
    },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { complexeId: 'cx-five', terrainId: 't-1' };
  mockTerrains = {
    data: [terrainDeTemoin({
      creneaux: {
        openSlots: null, ranges: [], slotsPerWeek: 46, status: 'ouvert',
      },
      slotPlan: AVEC_TARIFS,
    })],
    isLoading: false,
  };
  mockApercu.mockResolvedValue({
    data: {
      creneaux: {
        openSlots: 640, ranges: [], slotsPerWeek: 50, status: 'ouvert',
      },
      dryRun: true,
    },
  });
  mockEnregistrer.mockResolvedValue({
    data: {
      creneaux: {
        openSlots: 612, ranges: [], slotsPerWeek: 46, status: 'ouvert',
      },
    },
  });
});

describe('RESA-L5A1 E-G09 — un terrain ouvert (RA4 état 1)', () => {
  it('les plages, les tarifs, les prix de la semaine, la période, « Enregistrer »', async () => {
    const arbre = await monter();
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'TERRAIN 1',
      'CRÉNEAUX ET TARIFS',
      'TES PLAGES',
      'Lun. au ven.',
      '17 h – 23 h · créneaux de 1 h · 6 créneaux',
      'Sam. · dim.',
      '9 h – 22 h · créneaux de 1 h 30 · 8 créneaux',
      'De 21 h à 22 h, il reste 1 h sans créneau.',
      'TARIFS',
      'Prix de base',
      '60 € le créneau',
      'toute la journée',
      'de 18 h à 22 h',
      'LES PRIX DE LA SEMAINE',
      'PÉRIODE',
      'Sans date de fin',
      'EXCEPTIONS',
      '46 créneaux par semaine',
    ]));
    expect(parRepere(arbre, 'complexe-creneaux-semaine')).not.toBeNull();
    await appuyer(arbre, 'Enregistrer');
    expect(mockEnregistrer).toHaveBeenCalledWith({
      complexeId: 'cx-five',
      plan: AVEC_TARIFS,
      terrainId: 't-1',
    });
    expect(lisibles(arbre)).toContain('612 créneaux ouverts.');
  });

  it('un terrain « téléphone seulement » le dit (RA4 état 6)', async () => {
    mockTerrains.data[0].bookingMode = 'telephone';
    const arbre = await monter();
    expect(lisibles(arbre)).toContain(
      // eslint-disable-next-line max-len
      'Ce terrain se réserve par téléphone : tes créneaux s’affichent, et un joueur qui en touche un t’appelle.',
    );
  });
});

describe('RESA-L5A1 E-G09 — un terrain tout neuf (états 5 et 8 de EG09)', () => {
  beforeEach(() => {
    mockParams = { complexeId: 'cx-five', terrainAjoute: 'Terrain 1', terrainId: 't-1' };
    mockTerrains = { data: [terrainDeTemoin()], isLoading: false };
  });

  it('« … est ajouté », « pas encore d’horaires », « Ouvrir ces créneaux »', async () => {
    const arbre = await monter();
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Terrain 1 est ajouté. Ouvre maintenant ses créneaux.',
      'Ce terrain n’a pas encore d’horaires.',
      'Ouvrir ces créneaux',
    ]));
  });

  it('« Nouvelle plage » : jours, heures, durée « Autre » à 5 min près, le reste', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'Ajouter une plage');
    await toucher(arbre, 'complexe-creneaux-jour-1');
    await toucher(arbre, 'complexe-creneaux-jour-2');
    await ecrire(arbre, 'Ouverture', '17:00');
    await ecrire(arbre, 'Fermeture', '23:00');
    await appuyer(arbre, 'Autre');
    await appuyer(arbre, 'Ajouter 5 minutes');
    await appuyer(arbre, 'Ajouter 5 minutes');
    await appuyer(arbre, 'Ajouter 5 minutes');
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      '4 créneaux de 1 h 15',
      'De 22 h à 23 h, il reste 1 h sans créneau.',
    ]));
    await appuyer(arbre, 'Ajouter la plage');
    const range = {
      days: [1, 2], durationMinutes: 75, from: '17:00', to: '23:00',
    };
    expect(mockApercu).toHaveBeenCalledWith({
      complexeId: 'cx-five',
      plan: expect.objectContaining({ extraSlots: [], ranges: [range], rates: [] }),
      terrainId: 't-1',
    });
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Lun. · mar.',
      '17 h – 23 h · créneaux de 1 h 15 · 4 créneaux',
      '640 créneaux ouverts sur la période',
    ]));
  });

  it('un refus du serveur reste dans la feuille, rien n’est ajouté', async () => {
    mockApercu.mockRejectedValueOnce({
      details: { code: 'COMPLEXE_CRENEAUX_INVALID' },
      message: 'La plage est plus courte qu\'un créneau.',
      status: 400,
    });
    const arbre = await monter();
    await appuyer(arbre, 'Ajouter une plage');
    await toucher(arbre, 'complexe-creneaux-jour-3');
    await ecrire(arbre, 'Ouverture', '17:00');
    await ecrire(arbre, 'Fermeture', '17:30');
    await appuyer(arbre, 'Ajouter la plage');
    expect(lisibles(arbre)).toContain('La plage est plus courte qu\'un créneau.');
    expect(lisibles(arbre)).toContain('Ce terrain n’a pas encore d’horaires.');
  });
});

describe('RESA-L5A1 E-G09 — tarifs et créneaux ponctuels (RA4 états 3 et 4)', () => {
  it('« Nouveau tarif » de 18 h à 22 h, du lundi au vendredi, 80 €', async () => {
    mockTerrains.data[0].slotPlan = PLAN_OUVERT;
    const arbre = await monter();
    await appuyer(arbre, 'Ajouter un tarif');
    await toucher(arbre, 'complexe-creneaux-tarif-jour-1');
    await toucher(arbre, 'complexe-creneaux-tarif-jour-2');
    await appuyer(arbre, 'De … à …');
    await ecrire(arbre, 'De', '18:00');
    await ecrire(arbre, 'À', '22:00');
    await ecrire(arbre, 'Prix', '80');
    expect(lisibles(arbre)).toContain('Soit 8 € par joueur à 10.');
    await appuyer(arbre, 'Ajouter le tarif');
    expect(mockApercu.mock.calls[0][0].plan.rates).toEqual([
      {
        days: [1, 2], from: '18:00', price: 80, to: '22:00',
      },
    ]);
  });

  it('« Ajouter un créneau ponctuel » : une date et une plage', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'Ajouter un créneau ponctuel');
    // 24/10/2026 est un samedi (la planche écrit « samedi 25/10 », qui est un dimanche).
    await ecrire(arbre, 'Date', '24/10/2026');
    await ecrire(arbre, 'De', '07:00');
    await ecrire(arbre, 'À', '09:00');
    await appuyer(arbre, 'Ajouter le créneau ponctuel');
    expect(mockApercu.mock.calls[0][0].plan.extraSlots).toEqual([
      { date: '2026-10-24', from: '07:00', to: '09:00' },
    ]);
    expect(lisibles(arbre)).toContain('Samedi 24/10 : 7 h – 9 h ajouté');
  });
});

describe('RESA-L5B-1 B3 E-G09 — un horaire réduit avec des réservations (RESA-L2C)', () => {
  /**
   * Fait juger un tarif par l'aperçu du serveur (un geste qui passe par `dryRun`).
   * @param {any} arbre - L'arbre.
   * @returns {Promise<void>} Fini.
   */
  const jugerUnTarif = async (arbre) => {
    await appuyer(arbre, 'Ajouter un tarif');
    await toucher(arbre, 'complexe-creneaux-tarif-jour-1');
    await appuyer(arbre, 'De … à …');
    await ecrire(arbre, 'De', '18:00');
    await ecrire(arbre, 'À', '22:00');
    await ecrire(arbre, 'Prix', '80');
    await appuyer(arbre, 'Ajouter le tarif');
  };

  it('« 3 réservations tombent hors de tes nouveaux horaires. Elles sont gardées. »', async () => {
    mockTerrains.data[0].slotPlan = PLAN_OUVERT;
    mockApercu.mockResolvedValueOnce({
      data: {
        creneaux: {
          openSlots: 600, ranges: [], slotsPerWeek: 40, status: 'ouvert',
        },
        dryRun: true,
        reservationsHorsHoraires: 3,
      },
    });
    const arbre = await monter();
    await jugerUnTarif(arbre);
    expect(lisibles(arbre)).toContain(
      '3 réservations tombent hors de tes nouveaux horaires. Elles sont gardées.',
    );
  });

  it('aucune réservation dehors : rien', async () => {
    mockTerrains.data[0].slotPlan = PLAN_OUVERT;
    const arbre = await monter();
    await jugerUnTarif(arbre);
    expect(lisibles(arbre).some((texte) => texte.includes('hors de tes nouveaux horaires')))
      .toBe(false);
  });
});

describe('RESA-L5A2 E-G09 — vers les fermetures et le planning', () => {
  it('« Fermer des jours » (E-G10) et « Voir le planning » (E-G03), pour ce terrain', async () => {
    const arbre = await monter();
    await act(async () => {
      pressable(arbre, 'Fermer des jours').props.onPress();
    });
    expect(mockNavigate).toHaveBeenLastCalledWith(RouteNames.ComplexeFermetures, {
      complexeId: 'cx-five', terrainId: 't-1',
    });
    await act(async () => {
      pressable(arbre, 'Voir le planning').props.onPress();
    });
    expect(mockNavigate).toHaveBeenLastCalledWith(RouteNames.ComplexeEspace, {
      params: { complexeId: 'cx-five', terrainId: 't-1' },
      screen: RouteNames.ComplexePlanning,
    });
  });
});
