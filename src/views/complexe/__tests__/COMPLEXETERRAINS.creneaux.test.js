import { TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ComplexeCreneaux from '@/views/complexe/ComplexeCreneaux';

import {
  lisibles,
  parRepere,
  PLAN_OUVERT,
  pressable,
  terrainDeTemoin,
} from '@/testSupport/temoinComplexe';

// COMPLEXE-TERRAINS (10/11/2026) — retours du testeur, ligne Gérant 04 (M0859), écran
// « Créneaux et tarifs » : le tarif relu après « Enregistrer » (1), le tarif posé sur des jours
// sans plage (2), la 2ᵉ plage (3), « Fermer des jours » caché à la création (8).

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
  useComplexeChoisi: jest.requireActual('@/testSupport/temoinComplexe').complexeChoisiDeTemoin,
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

jest.setTimeout(30000);

const PLAGE_SEMAINE = {
  days: [1, 2, 4, 5], durationMinutes: 60, from: '17:00', to: '23:00',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { complexeId: 'cx-five', terrainAjoute: 'Terrain 1', terrainId: 't-1' };
  mockTerrains = { data: [terrainDeTemoin()], isLoading: false };
  // L'aperçu rend le modèle tel qu'on le lui propose (le serveur le normalise, ici à l'identique).
  mockApercu.mockImplementation(async ({ plan }) => ({
    data: {
      creneaux: {
        openSlots: null, ranges: [], slotsPerWeek: 24, status: 'ouvert',
      },
      dryRun: true,
      slotPlan: plan,
    },
  }));
  mockEnregistrer.mockResolvedValue({
    data: {
      creneaux: {
        openSlots: null, ranges: [], slotsPerWeek: 24, status: 'ouvert',
      },
    },
  });
});

/**
 * Ajoute une plage par la feuille « Nouvelle plage ».
 * @param {any} arbre - L'arbre.
 * @param {number[]} jours - Les jours à cocher.
 * @returns {Promise<void>} Fini.
 */
const ajouterUnePlage = async (arbre, jours) => {
  await appuyer(arbre, 'Ajouter une plage');
  await jours.reduce(async (precedent, jour) => {
    await precedent;
    await toucher(arbre, `complexe-creneaux-jour-${jour}`);
  }, Promise.resolve());
  await ecrire(arbre, 'Ouverture', '17:00');
  await ecrire(arbre, 'Fermeture', '23:00');
  await appuyer(arbre, 'Ajouter la plage');
};

/**
 * Ajoute un tarif sam-dim 17 h - 23 h, 16 €.
 * @param {any} arbre - L'arbre.
 * @returns {Promise<void>} Fini.
 */
const ajouterLeTarifDuWeekEnd = async (arbre) => {
  await appuyer(arbre, 'Ajouter un tarif');
  await toucher(arbre, 'complexe-creneaux-tarif-jour-6');
  await toucher(arbre, 'complexe-creneaux-tarif-jour-7');
  await appuyer(arbre, 'De … à …');
  await ecrire(arbre, 'De', '17:00');
  await ecrire(arbre, 'À', '23:00');
  await ecrire(arbre, 'Prix', '16');
  await appuyer(arbre, 'Ajouter le tarif');
};

const coche = (/** @type {any} */ arbre, /** @type {string} */ testID) => (
  parRepere(arbre, testID).props.accessibilityState.checked
);

describe('COMPLEXE-TERRAINS (1) — le tarif ajouté part avec « Enregistrer » et se relit', () => {
  it('le PUT porte le tarif, et l’écran rouvert sur le modèle enregistré le montre', async () => {
    const arbre = await monter();
    await ajouterUnePlage(arbre, [1, 2, 4, 5]);
    await ajouterLeTarifDuWeekEnd(arbre);
    const tarif = {
      days: [6, 7], from: '17:00', price: 16, to: '23:00',
    };
    expect(lisibles(arbre)).toContain('Sam. · dim.');
    await appuyer(arbre, 'Ouvrir ces créneaux');
    expect(mockEnregistrer).toHaveBeenCalledWith(expect.objectContaining({
      plan: expect.objectContaining({ ranges: [PLAGE_SEMAINE], rates: [tarif] }),
    }));
    const envoye = mockEnregistrer.mock.calls[0][0].plan;

    // « revenir sur l'installation » : un écran neuf, sur le terrain relu du serveur.
    mockParams = { complexeId: 'cx-five', terrainId: 't-1' };
    mockTerrains = {
      data: [terrainDeTemoin({
        creneaux: {
          openSlots: null, ranges: [], slotsPerWeek: 24, status: 'ouvert',
        },
        slotPlan: envoye,
      })],
      isLoading: false,
    };
    const rouvert = await monter();
    expect(lisibles(rouvert)).toEqual(expect.arrayContaining([
      'Sam. · dim.', 'de 17 h à 23 h',
    ]));
  });
});

describe('COMPLEXE-TERRAINS (3) — la 2ᵉ plage', () => {
  it('la feuille « Nouvelle plage » repart sans les jours de la plage précédente', async () => {
    const arbre = await monter();
    await ajouterUnePlage(arbre, [1, 2, 4, 5]);
    await appuyer(arbre, 'Ajouter une plage');
    [1, 2, 3, 4, 5, 6, 7].forEach((jour) => {
      expect(coche(arbre, `complexe-creneaux-jour-${jour}`)).toBe(false);
    });
  });

  it('une 2ᵉ plage sam-dim s’ajoute à côté de la 1ʳᵉ', async () => {
    const arbre = await monter();
    await ajouterUnePlage(arbre, [1, 2, 4, 5]);
    await ajouterUnePlage(arbre, [6, 7]);
    expect(mockApercu).toHaveBeenLastCalledWith(expect.objectContaining({
      plan: expect.objectContaining({
        ranges: [PLAGE_SEMAINE, { ...PLAGE_SEMAINE, days: [6, 7] }],
      }),
    }));
  });
});

describe('COMPLEXE-TERRAINS (2) — un tarif sur des jours sans plage le dit', () => {
  it('sam-dim sans plage : « aucune plage ouverte » sous le tarif', async () => {
    const arbre = await monter();
    await ajouterUnePlage(arbre, [1, 2, 4, 5]);
    await ajouterLeTarifDuWeekEnd(arbre);
    expect(lisibles(arbre)).toContain(
      'Aucune plage ouverte sam. · dim. : ce tarif ne s’applique pas encore.',
    );
  });

  it('avec une plage sam-dim, la phrase disparaît et la semaine montre 16 €', async () => {
    const arbre = await monter();
    await ajouterUnePlage(arbre, [1, 2, 4, 5]);
    await ajouterUnePlage(arbre, [6, 7]);
    await ajouterLeTarifDuWeekEnd(arbre);
    expect(lisibles(arbre).join(' ')).not.toContain('Aucune plage ouverte');
    expect(lisibles(arbre)).toContain('16 €');
  });
});

describe('COMPLEXE-TERRAINS (8) — « Fermer des jours » pendant la création', () => {
  it('terrain tout juste ajouté, pas encore ouvert : le lien est absent', async () => {
    const arbre = await monter();
    expect(lisibles(arbre)).not.toContain('Fermer des jours');
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Ajouter un créneau ponctuel', 'Voir le planning',
    ]));
  });

  it('terrain déjà ouvert, en modification : le lien est là', async () => {
    mockParams = { complexeId: 'cx-five', terrainId: 't-1' };
    mockTerrains = {
      data: [terrainDeTemoin({
        creneaux: {
          openSlots: null, ranges: [], slotsPerWeek: 24, status: 'ouvert',
        },
        slotPlan: { ...PLAN_OUVERT, ranges: [PLAGE_SEMAINE] },
      })],
      isLoading: false,
    };
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('Fermer des jours');
  });
});

describe('COMPLEXE-TERRAINS (4, 5) — après minuit', () => {
  it('une plage 17:00 → 01:00 part au serveur, sans refus « La fin… »', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'Ajouter une plage');
    await toucher(arbre, 'complexe-creneaux-jour-6');
    await ecrire(arbre, 'Ouverture', '17:00');
    await ecrire(arbre, 'Fermeture', '01:00');
    expect(lisibles(arbre)).toContain('8 créneaux de 1 h');
    await appuyer(arbre, 'Ajouter la plage');
    expect(lisibles(arbre)).not.toContain('La fin doit être après le début.');
    expect(mockApercu).toHaveBeenLastCalledWith(expect.objectContaining({
      plan: expect.objectContaining({
        ranges: [{
          days: [6], durationMinutes: 60, from: '17:00', to: '01:00',
        }],
      }),
    }));
    expect(lisibles(arbre)).toContain('17 h – 1 h · créneaux de 1 h · 8 créneaux');
  });

  it('une ouverture égale à la fermeture reste refusée', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'Ajouter une plage');
    await toucher(arbre, 'complexe-creneaux-jour-6');
    await ecrire(arbre, 'Ouverture', '17:00');
    await ecrire(arbre, 'Fermeture', '17:00');
    await appuyer(arbre, 'Ajouter la plage');
    expect(lisibles(arbre)).toContain('La fin doit être après le début.');
    expect(mockApercu).not.toHaveBeenCalled();
  });

  it('un tarif 17:00 → 00:00 part au serveur (capture 7)', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'Ajouter un tarif');
    await toucher(arbre, 'complexe-creneaux-tarif-jour-6');
    await appuyer(arbre, 'De … à …');
    await ecrire(arbre, 'De', '17:00');
    await ecrire(arbre, 'À', '00:00');
    await ecrire(arbre, 'Prix', '16');
    await appuyer(arbre, 'Ajouter le tarif');
    expect(mockApercu).toHaveBeenLastCalledWith(expect.objectContaining({
      plan: expect.objectContaining({
        rates: [{
          days: [6], from: '17:00', price: 16, to: '00:00',
        }],
      }),
    }));
  });
});

describe('COMPLEXE-TERRAINS (1) — tant que rien n’est enregistré, l’écran le dit', () => {
  it('« Pas encore enregistré » après l’ajout, plus après « Ouvrir ces créneaux »', async () => {
    const arbre = await monter();
    expect(lisibles(arbre).join(' ')).not.toContain('Pas encore enregistré');
    await ajouterUnePlage(arbre, [1, 2, 4, 5]);
    expect(lisibles(arbre)).toContain(
      'Pas encore enregistré : appuie sur « Ouvrir ces créneaux » en bas de la page.',
    );
    await appuyer(arbre, 'Ouvrir ces créneaux');
    expect(lisibles(arbre).join(' ')).not.toContain('Pas encore enregistré');
  });
});
