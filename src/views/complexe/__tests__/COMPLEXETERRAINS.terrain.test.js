import { TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ComplexeTerrain from '@/views/complexe/ComplexeTerrain';

import { televerserPhoto } from '@/services/complexe/complexeService';

import {
  lisibles,
  parRepere,
  pressable,
  terrainDeTemoin,
} from '@/testSupport/temoinComplexe';

// COMPLEXE-TERRAINS (10/11/2026) — retours du testeur, ligne Gérant 04 (M0859), fiche « Nouveau
// terrain » : le sport présélectionné quand le complexe n'en a qu'un (6, règle d'Adel), plusieurs
// photos à la fois et le libellé « Ajouter des photos de l'installation » (7).

const mockNavigate = jest.fn();
const mockReplace = jest.fn();
const mockGoBack = jest.fn();
const mockCanGoBack = jest.fn(() => true);
let mockParams = /** @type {any} */ ({ complexeId: 'cx-five' });
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    canGoBack: mockCanGoBack,
    goBack: mockGoBack,
    navigate: mockNavigate,
    replace: mockReplace,
    setOptions: jest.fn(),
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
  useComplexeGere: () => ({ data: mockComplexe }),
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

let mockComplexe = /** @type {any} */ ({});
const mockPickImage = jest.fn();
jest.mock('@/platform/media', () => ({
  __esModule: true,
  default: { pickImage: (/** @type {any} */ options) => mockPickImage(options) },
}));

jest.mock('@/components/molecules/input/Input', () => {
  const { TextInput: Saisie } = jest.requireActual('react-native');
  return function FausseSaisie(/** @type {any} */ { label, onChangeText, value }) {
    return <Saisie accessibilityLabel={label} onChangeText={onChangeText} value={value} />;
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
 * Écrit dans un champ, par son libellé.
 * @param {any} arbre - L'arbre.
 * @param {string} libelle - Le libellé du champ.
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

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { complexeId: 'cx-five' };
  mockTerrains = { data: [], isLoading: false };
  mockComplexe = { phoneNumber: '+33639981234', sports: [] };
  mockPickImage.mockResolvedValue(null);
  mockEnregistrer.mockResolvedValue({ data: { documentId: 't-neuf', name: 'Terrain 1' } });
});

/**
 * Remplit le nom et le lieu, puis enregistre (le sport n'est PAS touché).
 * @param {any} arbre - L'arbre.
 * @returns {Promise<void>} Fini.
 */
const enregistrerSansToucherAuSport = async (arbre) => {
  await ecrire(arbre, 'Nom', 'Terrain 1');
  await appuyer(arbre, 'Extérieur');
  await appuyer(arbre, 'Enregistrer');
};

describe('COMPLEXE-TERRAINS (6) — le sport du nouveau terrain', () => {
  it('le complexe n’a qu’un sport (Padel) : il est déjà choisi, ses 4 joueurs aussi', async () => {
    mockComplexe = { ...mockComplexe, sports: [{ documentId: 'a-padel', name: 'Padel' }] };
    const arbre = await monter();
    await enregistrerSansToucherAuSport(arbre);
    expect(mockEnregistrer).toHaveBeenCalledWith(expect.objectContaining({
      donnees: expect.objectContaining({ capacity: 4, sport: 'a-padel' }),
    }));
  });

  it('un seul sport hors des trois en tête (Squash) : choisi et montré', async () => {
    mockComplexe = { ...mockComplexe, sports: [{ documentId: 'a-squash', name: 'Squash' }] };
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('Squash');
    await enregistrerSansToucherAuSport(arbre);
    expect(mockEnregistrer).toHaveBeenCalledWith(expect.objectContaining({
      donnees: expect.objectContaining({ sport: 'a-squash' }),
    }));
  });

  it('plusieurs sports : rien n’est choisi, « Choisis le sport du terrain. »', async () => {
    mockComplexe = {
      ...mockComplexe,
      sports: [
        { documentId: 'a-five', name: 'Football à 5' },
        { documentId: 'a-padel', name: 'Padel' },
      ],
    };
    const arbre = await monter();
    await enregistrerSansToucherAuSport(arbre);
    expect(mockEnregistrer).not.toHaveBeenCalled();
    expect(lisibles(arbre)).toContain('Choisis le sport du terrain.');
  });

  it('en modification, le sport du terrain reste le sien', async () => {
    mockComplexe = { ...mockComplexe, sports: [{ documentId: 'a-padel', name: 'Padel' }] };
    mockParams = { complexeId: 'cx-five', terrainId: 't-1' };
    mockTerrains = { data: [terrainDeTemoin()], isLoading: false };
    const arbre = await monter();
    await appuyer(arbre, 'Enregistrer');
    expect(mockEnregistrer.mock.calls[0][0].donnees.sport).toBe(terrainDeTemoin().sport.documentId);
  });
});

describe('COMPLEXE-TERRAINS (7) — les photos de l’installation', () => {
  it('le libellé, et plusieurs photos choisies d’un coup se téléversent toutes', async () => {
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('Ajouter des photos de l’installation');
    mockPickImage.mockResolvedValue({
      assets: [
        { fileSize: 200000, uri: 'file:///a.jpg' },
        { fileSize: 200000, uri: 'file:///b.jpg' },
      ],
    });
    /** @type {any} */ (televerserPhoto)
      .mockResolvedValueOnce({ id: 41, url: 'https://exemple.test/a.jpg' })
      .mockResolvedValueOnce({ id: 42, url: 'https://exemple.test/b.jpg' });
    await appuyer(arbre, 'Ajouter des photos de l’installation');
    expect(mockPickImage).toHaveBeenCalledWith(expect.objectContaining({ selectionLimit: 5 }));
    expect(parRepere(arbre, 'complexe-terrain-photo-41')).not.toBeNull();
    expect(parRepere(arbre, 'complexe-terrain-photo-42')).not.toBeNull();
  });

  it('la limite suit les places ; une photo trop lourde n’arrête pas les autres', async () => {
    mockParams = { complexeId: 'cx-five', terrainId: 't-1' };
    mockTerrains = {
      data: [terrainDeTemoin({
        photos: [1, 2, 3].map((id) => ({ id, url: `https://exemple.test/${id}.jpg` })),
      })],
      isLoading: false,
    };
    const arbre = await monter();
    mockPickImage.mockResolvedValue({
      assets: [
        { fileSize: 12 * 1024 * 1024, uri: 'file:///lourde.jpg' },
        { fileSize: 200000, uri: 'file:///c.jpg' },
      ],
    });
    /** @type {any} */ (televerserPhoto)
      .mockResolvedValueOnce({ id: 43, url: 'https://exemple.test/c.jpg' });
    await appuyer(arbre, 'Ajouter des photos de l’installation');
    expect(mockPickImage).toHaveBeenCalledWith(expect.objectContaining({ selectionLimit: 2 }));
    expect(televerserPhoto).toHaveBeenCalledTimes(1);
    expect(parRepere(arbre, 'complexe-terrain-photo-43')).not.toBeNull();
    expect(lisibles(arbre)).toContain('Cette photo dépasse 10 Mo.');
  });
});
