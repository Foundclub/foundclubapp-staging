import { TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ComplexeTerrain from '@/views/complexe/ComplexeTerrain';

import { parRepere } from '@/testSupport/temoinComplexe';

// CORR-RESA (85 A, 31/10/2026) — E-G08 « La fiche d'un terrain » : le nom est limité à 60 signes
// (la limite du serveur, admin terrain.ts NAME_MAX), dite avant l'envoi par un compteur.
// Doublures recopiées de EG08.terrain.test.js (la saisie garde ici `maxLength` et `testID`).

const mockNavigate = jest.fn();
const mockReplace = jest.fn();
const mockGoBack = jest.fn();
let mockParams = /** @type {any} */ ({ complexeId: 'cx-five' });
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    goBack: mockGoBack, navigate: mockNavigate, replace: mockReplace, setOptions: jest.fn(),
  }),
  useRoute: () => ({ params: mockParams }),
}));

const mockEnregistrer = jest.fn();
let mockTerrains = /** @type {any} */ ({ data: [], isLoading: false });
const mockRetirer = jest.fn();
const mockDemandes = /** @type {any} */ ({ data: undefined });
jest.mock('@/services/complexe/complexeQueries', () => ({
  useApercuRetrait: () => ({
    isPending: false,
    mutateAsync: async () => ({ data: { dryRun: true, reservationsTouchees: 4 } }),
  }),
  useComplexeChoisi: jest.requireActual('@/testSupport/temoinComplexe').complexeChoisiDeTemoin,
  useComplexeGere: () => ({ data: { phoneNumber: '+33639981234' } }),
  useEnregistrerTerrain: () => ({ isPending: false, mutateAsync: mockEnregistrer }),
  useReservationsDuComplexe: () => mockDemandes,
  useRetirerTerrain: () => ({ isPending: false, mutateAsync: mockRetirer }),
  useTerrains: () => mockTerrains,
}));
jest.mock('@/services/complexe/complexeService', () => ({ televerserPhoto: jest.fn() }));

jest.mock('@/services/activity/activityQueries', () => ({
  useGetActivities: () => ({
    data: [
      { documentId: 'a-five', name: 'Football à 5' },
      { documentId: 'a-padel', name: 'Padel' },
      { documentId: 'a-tennis', name: 'Tennis' },
      { documentId: 'a-squash', name: 'Squash' },
    ],
  }),
}));

let mockChoisie = /** @type {any} */ (null);
jest.mock('@/platform/media', () => ({
  __esModule: true,
  default: { pickImage: async () => mockChoisie },
}));

jest.mock('@/components/molecules/input/Input', () => {
  const { TextInput: Saisie } = jest.requireActual('react-native');
  return function FausseSaisie(/** @type {any} */ {
    label, maxLength, onChangeText, testID, value,
  }) {
    return (
      <Saisie
        accessibilityLabel={label}
        maxLength={maxLength}
        onChangeText={onChangeText}
        testID={testID}
        value={value}
      />
    );
  };
});
jest.mock('@/components/organisms/phoneInput/PhoneInput', () => {
  const { Text: Texte } = jest.requireActual('react-native');
  return function FauxTelephone(/** @type {any} */ { label, value }) {
    return <Texte>{`${label} : ${value || ''}`}</Texte>;
  };
});
jest.mock('@/components/molecules/bottomModal/BottomModal', () => (
  function FausseFeuille(/** @type {any} */ { children, isVisible }) {
    return isVisible ? children : null;
  }
));
jest.mock('@/components/organisms/choixDuSport/ChoixDuSport', () => {
  const { Text: Texte, TouchableOpacity: Touche } = jest.requireActual('react-native');
  return function FauxChoix(/** @type {any} */ { onChoisir, sports }) {
    return sports.map((/** @type {any} */ sport) => (
      <Touche
        accessibilityLabel={`choisir ${sport.name}`}
        key={sport.documentId}
        onPress={() => onChoisir(sport.documentId)}
      >
        <Texte>{sport.name}</Texte>
      </Touche>
    ));
  };
});
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
 * Monte la fiche.
 * @returns {Promise<any>} L'arbre.
 */
const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<ComplexeTerrain />);
  });
  return arbre;
};

/**
 * Le texte du compteur du nom.
 * @param {any} arbre - L'arbre.
 * @returns {string} Le texte.
 */
const compteur = (arbre) => {
  const noeud = parRepere(arbre, 'terrain-nom-compteur');
  return noeud ? [].concat(noeud.props.children).join('') : '';
};

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { complexeId: 'cx-five' };
  mockTerrains = { data: [], isLoading: false };
  mockChoisie = null;
});

describe('CORR-RESA (85 A) E-G08 — le nom du terrain, 60 signes au plus', () => {
  it('le champ « Nom » porte maxLength 60', async () => {
    const arbre = await monter();
    const champ = parRepere(arbre, 'terrain-nom');
    expect(champ).not.toBeNull();
    expect(champ.props.maxLength).toBe(60);
  });

  it('le compteur dit « 0 / 60 », puis « 7 / 60 » après « Terrain »', async () => {
    const arbre = await monter();
    expect(compteur(arbre)).toBe('0 / 60');
    const [champ] = arbre.root.findAll((/** @type {any} */ n) => n.type === TextInput
      && n.props.accessibilityLabel === 'Nom');
    await act(async () => {
      champ.props.onChangeText('Terrain');
    });
    expect(compteur(arbre)).toBe('7 / 60');
  });
});
