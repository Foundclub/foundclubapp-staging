/* eslint-disable max-len */
import { Switch, TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ComplexeTerrain from '@/views/complexe/ComplexeTerrain';

import {
  lisibles,
  parRepere,
  pressable,
  terrainDeTemoin,
} from '@/testSupport/temoinComplexe';

// RESA-OPTIONS (12/11/2026) — E-G08, bloc « Options » (D61, maquette section 4 bis) : les options du
// COMPLEXE sur la fiche d'un terrain, un interrupteur chacune ; « + Créer une option » (feuille :
// nom, prix, unité, obligatoire), enregistrée pour le complexe et activée ici ; toucher une option
// la modifie ou la retire ; « Enregistrer » envoie les options activées (`optionIds`).

const mockReplace = jest.fn();
let mockParams = /** @type {any} */ ({ complexeId: 'cx-five' });
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    canGoBack: () => true, goBack: jest.fn(), navigate: jest.fn(), replace: mockReplace, setOptions: jest.fn(),
  }),
  useRoute: () => ({ params: mockParams }),
}));

const CATALOGUE = [
  {
    id: 'o-chas', name: 'Location de chasubles', price: 5, required: false, unit: 'reservation',
  },
  {
    id: 'o-ball', name: 'Ballon de match', price: 3, required: false, unit: 'unite',
  },
  {
    id: 'o-bois', name: 'Boisson fraîche', price: 2, required: false, unit: 'unite',
  },
];
const mockEnregistrer = jest.fn();
const mockModifier = jest.fn();
let mockTerrains = /** @type {any} */ ({ data: [], isLoading: false });
let mockComplexe = /** @type {any} */ ({ data: { name: 'Le Five de Montrivage', options: CATALOGUE } });
jest.mock('@/services/complexe/complexeQueries', () => ({
  useApercuRetrait: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useComplexeChoisi: jest.requireActual('@/testSupport/temoinComplexe').complexeChoisiDeTemoin,
  useComplexeGere: () => mockComplexe,
  useEnregistrerTerrain: () => ({ isPending: false, mutateAsync: mockEnregistrer }),
  useModifierComplexe: () => ({ isPending: false, mutateAsync: mockModifier }),
  useReservationsDuComplexe: () => ({ data: undefined }),
  useRetirerTerrain: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useTerrains: () => mockTerrains,
}));
jest.mock('@/services/complexe/complexeService', () => ({ televerserPhoto: jest.fn() }));
jest.mock('@/services/activity/activityQueries', () => ({
  useGetActivities: () => ({ data: [{ documentId: 'a-five', name: 'Football à 5' }] }),
}));
jest.mock('@/platform/media', () => ({ __esModule: true, default: { pickImage: async () => null } }));
jest.mock('@/components/molecules/input/Input', () => {
  const { TextInput: Saisie } = jest.requireActual('react-native');
  return function FausseSaisie(/** @type {any} */ { label, onChangeText, value }) {
    return <Saisie accessibilityLabel={label} onChangeText={onChangeText} value={value} />;
  };
});
jest.mock('@/components/organisms/phoneInput/PhoneInput', () => () => null);
jest.mock('@/components/molecules/bottomModal/BottomModal', () => (
  function FausseFeuille(/** @type {any} */ { children, isVisible }) {
    return isVisible ? children : null;
  }
));
jest.mock('@/components/organisms/choixDuSport/ChoixDuSport', () => () => null);
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

const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<ComplexeTerrain />);
  });
  return arbre;
};
const appuyer = async (/** @type {any} */ arbre, /** @type {string} */ libelle) => {
  await act(async () => {
    await pressable(arbre, libelle).props.onPress();
  });
};
const ecrire = async (/** @type {any} */ arbre, /** @type {string} */ libelle, /** @type {string} */ texte) => {
  // Le DERNIER champ de ce libellé : celui de la feuille (la fiche du terrain a aussi un « Nom »).
  const champ = arbre.root.findAll((/** @type {any} */ n) => n.type === TextInput && n.props.accessibilityLabel === libelle).at(-1);
  await act(async () => {
    champ.props.onChangeText(texte);
  });
};
const interrupteur = (/** @type {any} */ arbre, /** @type {string} */ id) => (
  arbre.root.findAll((/** @type {any} */ n) => n.type === Switch && n.props.testID === `option-interrupteur-${id}`)[0]
);
const basculer = async (/** @type {any} */ arbre, /** @type {string} */ id, /** @type {boolean} */ valeur) => {
  await act(async () => {
    interrupteur(arbre, id).props.onValueChange(valeur);
  });
};
const optionIdsEnvoyes = () => mockEnregistrer.mock.calls.at(-1)?.[0]?.donnees?.optionIds;

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { complexeId: 'cx-five', terrainId: 't-1' };
  mockTerrains = { data: [terrainDeTemoin({ optionIds: ['o-chas', 'o-ball'] })], isLoading: false };
  mockComplexe = { data: { name: 'Le Five de Montrivage', options: CATALOGUE } };
  mockEnregistrer.mockResolvedValue({ data: { documentId: 't-1', name: 'Terrain 1' } });
});

describe('RESA-OPTIONS — E-G08, le bloc « Options » du terrain', () => {
  it('liste les options du complexe, « 2 actives sur 3 » ; un interrupteur change ce que le terrain enregistre', async () => {
    const arbre = await monter();
    expect(parRepere(arbre, 'complexe-terrain-options')).toBeTruthy();
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'OPTIONS', '2 actives sur 3', 'Les options de ton complexe. Active celles que ce terrain propose.',
      'Location de chasubles', '5 € par réservation', 'Ballon de match', '3 € par unité', 'Boisson fraîche',
      '+ Créer une option',
    ]));
    expect([interrupteur(arbre, 'o-chas').props.value, interrupteur(arbre, 'o-bois').props.value]).toEqual([true, false]);
    await basculer(arbre, 'o-chas', false);
    await basculer(arbre, 'o-bois', true);
    expect(lisibles(arbre)).toContain('2 actives sur 3');
    await appuyer(arbre, 'Enregistrer');
    expect(optionIdsEnvoyes()).toEqual(['o-ball', 'o-bois']);
  });

  it('« + Créer une option » : la feuille (nom, prix, unité), enregistrée pour le complexe ENTIER, puis activée sur ce terrain', async () => {
    const neuve = {
      id: 'o-arb', name: 'Arbitre', price: 20, required: true, unit: 'reservation',
    };
    mockModifier.mockResolvedValue({ data: { options: [...CATALOGUE, neuve] } });
    const arbre = await monter();
    await appuyer(arbre, '+ Créer une option');
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Nouvelle option', 'Le prix compte', 'Par unité', 'Par réservation',
      'Enregistrée pour tout Le Five de Montrivage : tu pourras l’activer sur tes autres terrains d’un geste.',
    ]));
    // Sans nom : refusé avant l'envoi.
    await appuyer(arbre, 'Créer l’option');
    expect(mockModifier).not.toHaveBeenCalled();
    expect(lisibles(arbre)).toContain('Donne un nom à l’option (2 caractères au moins).');
    await ecrire(arbre, 'Nom', 'Arbitre');
    await ecrire(arbre, 'Prix (€)', '20');
    await act(async () => {
      arbre.root.findAll((/** @type {any} */ n) => n.type === Switch && n.props.testID === 'option-obligatoire')[0]
        .props.onValueChange(true);
    });
    await appuyer(arbre, 'Créer l’option');
    expect(mockModifier).toHaveBeenCalledWith({
      complexeId: 'cx-five',
      donnees: {
        options: [...CATALOGUE, {
          name: 'Arbitre', price: 20, required: true, unit: 'reservation',
        }],
      },
    });
    expect(lisibles(arbre)).toEqual(expect.arrayContaining(['Arbitre', '20 € par réservation · obligatoire', '3 actives sur 4']));
    await appuyer(arbre, 'Enregistrer');
    expect(optionIdsEnvoyes()).toEqual(['o-chas', 'o-ball', 'o-arb']);
  });

  it('toucher une option : la feuille préremplie la modifie (prix, « Par unité ») ou la retire de tous les terrains', async () => {
    mockModifier.mockImplementation(async ({ donnees }) => ({ data: { options: donnees.options } }));
    const arbre = await monter();
    await appuyer(arbre, 'Location de chasubles');
    expect(lisibles(arbre)).toEqual(expect.arrayContaining(['Modifier l’option', 'Retirer l’option']));
    expect(arbre.root.findAll((/** @type {any} */ n) => n.type === TextInput && n.props.accessibilityLabel === 'Prix (€)')[0].props.value).toBe('5');
    await ecrire(arbre, 'Prix (€)', '6');
    await appuyer(arbre, 'Enregistrer l’option');
    expect(mockModifier.mock.calls[0][0].donnees.options[0]).toEqual({
      id: 'o-chas', name: 'Location de chasubles', price: 6, required: false, unit: 'reservation',
    });
    expect(lisibles(arbre)).toContain('6 € par réservation');

    await appuyer(arbre, 'Ballon de match');
    await appuyer(arbre, 'Retirer l’option');
    expect(mockModifier.mock.calls[1][0].donnees.options.map((/** @type {any} */ o) => o.id)).toEqual(['o-chas', 'o-bois']);
    expect(lisibles(arbre)).not.toContain('Ballon de match');
    await appuyer(arbre, 'Enregistrer');
    expect(optionIdsEnvoyes()).toEqual(['o-chas']);
  });

  it('un NOUVEAU terrain : les options du complexe sont là, éteintes (« 0 active sur 3 ») ; un complexe sans option n’envoie rien de plus', async () => {
    mockParams = { complexeId: 'cx-five' };
    mockTerrains = { data: [], isLoading: false };
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('0 active sur 3');
    expect(CATALOGUE.map((o) => interrupteur(arbre, o.id).props.value)).toEqual([false, false, false]);

    mockParams = { complexeId: 'cx-five', terrainId: 't-1' };
    mockTerrains = { data: [terrainDeTemoin()], isLoading: false };
    mockComplexe = { data: { name: 'Le Five de Montrivage' } };
    const sansOption = await monter();
    expect(lisibles(sansOption)).toContain('Chasubles, ballon, arbitre… : crée une option, elle servira aussi à tes autres terrains.');
    await appuyer(sansOption, 'Enregistrer');
    expect(Object.keys(mockEnregistrer.mock.calls.at(-1)[0].donnees)).not.toContain('optionIds');
  });
});
