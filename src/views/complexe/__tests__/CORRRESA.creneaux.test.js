import { Alert, TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ComplexeCreneaux from '@/views/complexe/ComplexeCreneaux';

import {
  parRepere,
  PLAN_OUVERT,
  pressable,
  terrainDeTemoin,
} from '@/testSupport/temoinComplexe';

// CORR-RESA (81 A, 31/10/2026) — E-G09 « Créneaux et tarifs » : une plage ajoutée n'est qu'un
// aperçu tant qu'on n'a pas enregistré ; quitter l'écran avant demande « Quitter sans
// enregistrer ? »
// (`useGardeDeSortie`, événement `beforeRemove`). Doublures recopiées de EG09.creneaux.test.js.

/** @type {Record<string, Function[]>} */
const mockEcouteurs = {};
const mockNavigation = {
  addListener: (/** @type {string} */ nom, /** @type {Function} */ rappel) => {
    mockEcouteurs[nom] = [...(mockEcouteurs[nom] || []), rappel];
    return () => {
      mockEcouteurs[nom] = (mockEcouteurs[nom] || []).filter((r) => r !== rappel);
    };
  },
  dispatch: jest.fn(),
  navigate: jest.fn(),
  setOptions: jest.fn(),
};
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: { complexeId: 'cx-five', terrainId: 't-1' } }),
}));

let mockTerrains = /** @type {any} */ ({});
const mockApercu = jest.fn();
const mockEnregistrer = jest.fn();
jest.mock('@/services/complexe/complexeQueries', () => ({
  useApercuCreneaux: () => ({ isPending: false, mutateAsync: mockApercu }),
  useComplexeChoisi: jest.requireActual('@/testSupport/temoinComplexe').complexeChoisiDeTemoin,
  useEnregistrerCreneaux: () => ({ isPending: false, mutateAsync: mockEnregistrer }),
  useTerrains: () => mockTerrains,
}));

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

const appuyer = async (/** @type {any} */ arbre, /** @type {string} */ libelle) => {
  await act(async () => {
    await pressable(arbre, libelle).props.onPress();
  });
};

const toucher = async (/** @type {any} */ arbre, /** @type {string} */ testID) => {
  await act(async () => {
    await parRepere(arbre, testID).props.onPress();
  });
};

const ecrire = async (
  /** @type {any} */ arbre,
  /** @type {string} */ libelle,
  /** @type {string} */ texte,
) => {
  const [champ] = arbre.root.findAll((/** @type {any} */ n) => n.type === TextInput
    && n.props.accessibilityLabel === libelle);
  await act(async () => {
    champ.props.onChangeText(texte);
  });
};

/**
 * Ajoute la plage lun. · mar., 17 h – 23 h (l'aperçu du serveur l'accepte).
 * @param {any} arbre - L'arbre.
 * @returns {Promise<void>} Fini.
 */
const ajouterUnePlage = async (arbre) => {
  await appuyer(arbre, 'Ajouter une plage');
  await toucher(arbre, 'complexe-creneaux-jour-1');
  await toucher(arbre, 'complexe-creneaux-jour-2');
  await ecrire(arbre, 'Ouverture', '17:00');
  await ecrire(arbre, 'Fermeture', '23:00');
  await appuyer(arbre, 'Ajouter la plage');
};

/**
 * Émet un `beforeRemove` (le Retour) et rend l'événement.
 * @returns {{ data: any, preventDefault: jest.Mock }} L'événement.
 */
const quitter = () => {
  const evenement = { data: { action: { type: 'GO_BACK' } }, preventDefault: jest.fn() };
  (mockEcouteurs.beforeRemove || []).forEach((rappel) => rappel(evenement));
  return evenement;
};

beforeEach(() => {
  jest.clearAllMocks();
  Object.keys(mockEcouteurs).forEach((nom) => delete mockEcouteurs[nom]);
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockTerrains = {
    data: [terrainDeTemoin({
      creneaux: {
        openSlots: null, ranges: [], slotsPerWeek: 46, status: 'ouvert',
      },
      slotPlan: PLAN_OUVERT,
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

afterEach(() => {
  jest.restoreAllMocks();
});

describe('CORR-RESA (81 A) E-G09 — quitter sans enregistrer', () => {
  it('une plage ajoutée, puis Retour : la sortie est retenue et la question posée', async () => {
    const arbre = await monter();
    await ajouterUnePlage(arbre);
    expect(mockApercu).toHaveBeenCalledTimes(1);
    expect((mockEcouteurs.beforeRemove || []).length).toBeGreaterThan(0);
    const evenement = quitter();
    expect(evenement.preventDefault).toHaveBeenCalledTimes(1);
    expect(Alert.alert).toHaveBeenCalledWith(
      'Quitter sans enregistrer ?',
      'Tu as des changements non enregistrés : ils seront perdus.',
      [
        { style: 'cancel', text: 'Rester' },
        expect.objectContaining({ style: 'destructive', text: 'Quitter' }),
      ],
    );
  });

  it('« Quitter » rejoue la sortie', async () => {
    const arbre = await monter();
    await ajouterUnePlage(arbre);
    const evenement = quitter();
    const boutons = /** @type {any} */ (Alert.alert).mock.calls[0][2];
    boutons[1].onPress();
    expect(mockNavigation.dispatch).toHaveBeenCalledWith(evenement.data.action);
  });

  it('sans changement : Retour sort sans question', async () => {
    await monter();
    const evenement = quitter();
    expect(evenement.preventDefault).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('une plage ajoutée puis enregistrée : Retour sort sans question', async () => {
    const arbre = await monter();
    await ajouterUnePlage(arbre);
    await appuyer(arbre, 'Enregistrer');
    expect(mockEnregistrer).toHaveBeenCalledTimes(1);
    const evenement = quitter();
    expect(evenement.preventDefault).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });
});
