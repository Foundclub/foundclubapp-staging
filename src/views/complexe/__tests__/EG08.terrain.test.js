import { TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ComplexeTerrain from '@/views/complexe/ComplexeTerrain';

import { RouteNames } from '@/navigation/routeNames';

import { televerserPhoto } from '@/services/complexe/complexeService';

import {
  lisibles,
  parRepere,
  pressable,
  terrainDeTemoin,
} from '@/testSupport/temoinComplexe';

// RESA-L5A1 (13/10/2026) — E-G08 « La fiche d'un terrain » (planches EG08 et RA3) : le terrain
// (nom, sport Foot à 5 · Padel · Tennis · + de sports, intérieur / extérieur, joueurs, photos),
// « Comment on le réserve » (3 modes), le prix au créneau ou par joueur et « Ce que voient les
// joueurs », « Enregistrer ».

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
let mockDemandes = /** @type {any} */ ({ data: undefined });
jest.mock('@/services/complexe/complexeQueries', () => ({
  useApercuRetrait: () => ({
    isPending: false,
    mutateAsync: async () => ({ data: { dryRun: true, reservationsTouchees: 4 } }),
  }),
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
  mockChoisie = null;
  mockEnregistrer.mockResolvedValue({ data: { documentId: 't-neuf', name: 'Terrain 1' } });
});

describe('RESA-L5A1 E-G08 — créer un terrain (états 1 et 5)', () => {
  it('les blocs de la planche ; le sport pré-remplit les joueurs ; l’aperçu du prix', async () => {
    const arbre = await monter();
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Nouveau terrain',
      'LE TERRAIN',
      'Foot à 5',
      'Padel',
      'Tennis',
      'Intérieur',
      'Extérieur',
      'Nombre de joueurs',
      'Photos (jusqu’à 5)',
      'COMMENT ON LE RÉSERVE',
      'La réservation est confirmée tout de suite.',
      'Tu acceptes ou refuses chaque demande.',
      'Les joueurs t’appellent.',
      'PRIX',
      'Un prix pour le terrain entier, quel que soit le nombre de joueurs.',
      'Chaque joueur paie sa part sur place.',
      'Affiché « à régler sur place ». L’app n’encaisse rien.',
    ]));
    await ecrire(arbre, 'Nom', 'Terrain 1');
    await appuyer(arbre, 'Foot à 5');
    await appuyer(arbre, 'Extérieur');
    expect(parRepere(arbre, 'complexe-terrain-joueurs')?.props.children).toBe(10);
    await ecrire(arbre, 'Prix de base (facultatif)', '60');
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Ce que voient les joueurs',
      '60 € le créneau',
      'soit 6 € par joueur à 10',
    ]));
    await appuyer(arbre, 'Enregistrer');
    expect(mockEnregistrer).toHaveBeenCalledWith({
      complexeId: 'cx-five',
      donnees: {
        basePrice: 60,
        bookingMode: 'automatique',
        capacity: 10,
        name: 'Terrain 1',
        photos: [],
        priceUnit: 'creneau',
        setting: 'exterieur',
        sport: 'a-five',
      },
      terrainId: undefined,
    });
    expect(mockReplace).toHaveBeenCalledWith(RouteNames.ComplexeCreneaux, {
      complexeId: 'cx-five',
      terrainAjoute: 'Terrain 1',
      terrainId: 't-neuf',
    });
  });

  it('un champ manquant : l’erreur s’écrit sous le champ, rien ne part (état 4)', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'Enregistrer');
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Donne un nom au terrain.',
      'Choisis le sport du terrain.',
      'Intérieur ou extérieur ?',
    ]));
    expect(mockEnregistrer).not.toHaveBeenCalled();
  });

  it('« + de sports » : un sport de l’app rejoint les puces, 2 joueurs par défaut', async () => {
    const arbre = await monter();
    await appuyer(arbre, '+ de sports');
    await appuyer(arbre, 'choisir Squash');
    expect(lisibles(arbre)).toContain('Squash');
    expect(parRepere(arbre, 'complexe-terrain-joueurs')?.props.children).toBe(2);
  });
});

describe('RESA-L5A1 E-G08 — mode et prix (états 2 et 3 ; RA3 états 1 et 3)', () => {
  it('« Téléphone seulement » : le texte pré-rempli et le numéro du complexe', async () => {
    const arbre = await monter();
    await ecrire(arbre, 'Nom', 'Padel A');
    await appuyer(arbre, 'Padel');
    await appuyer(arbre, 'Extérieur');
    await appuyer(arbre, 'Téléphone seulement');
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Numéro : +33639981234',
      'Pré-rempli avec le téléphone du complexe.',
    ]));
    const [texte] = arbre.root.findAll((n) => n.type === TextInput
      && n.props.accessibilityLabel === 'Texte affiché');
    expect(texte.props.value).toBe('Ce terrain ne peut être réservé que par appel au');
    await appuyer(arbre, 'Enregistrer');
    expect(mockEnregistrer.mock.calls[0][0].donnees).toEqual(expect.objectContaining({
      bookingMode: 'telephone',
      bookingPhone: '+33639981234',
      bookingPhoneText: 'Ce terrain ne peut être réservé que par appel au',
      capacity: 4,
    }));
  });

  it('prix par joueur : « 6 € par joueur », « 24 € pour 4 joueurs »', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'Padel');
    await appuyer(arbre, 'Prix par joueur');
    await ecrire(arbre, 'Prix de base (facultatif)', '6');
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      '6 € par joueur',
      '24 € pour 4 joueurs',
    ]));
  });

  it('le nombre de joueurs se règle de 1 à 50', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'Tennis');
    await appuyer(arbre, 'Moins de joueurs');
    expect(parRepere(arbre, 'complexe-terrain-joueurs')?.props.children).toBe(3);
    await appuyer(arbre, 'Plus de joueurs');
    await appuyer(arbre, 'Plus de joueurs');
    expect(parRepere(arbre, 'complexe-terrain-joueurs')?.props.children).toBe(5);
  });
});

describe('RESA-L5A1 E-G08 — photos', () => {
  it('une photo trop lourde est refusée ; une autre se téléverse et s’affiche', async () => {
    const arbre = await monter();
    mockChoisie = { assets: [{ fileSize: 12 * 1024 * 1024, uri: 'file:///lourde.jpg' }] };
    await appuyer(arbre, 'Ajouter une photo');
    expect(lisibles(arbre)).toContain('Cette photo dépasse 10 Mo.');
    expect(televerserPhoto).not.toHaveBeenCalled();
    mockChoisie = { assets: [{ fileSize: 200000, uri: 'file:///legere.jpg' }] };
    /** @type {any} */ (televerserPhoto)
      .mockResolvedValue({ id: 41, url: 'https://exemple.test/a.jpg' });
    await appuyer(arbre, 'Ajouter une photo');
    expect(parRepere(arbre, 'complexe-terrain-photo-41')).not.toBeNull();
    await appuyer(arbre, 'Retirer la photo 1');
    expect(parRepere(arbre, 'complexe-terrain-photo-41')).toBeNull();
  });
});

describe('RESA-L5A1 E-G08 — modifier un terrain (états 3 et 7)', () => {
  it('la fiche se remplit ; « Enregistrer » dit « Modifications enregistrées. »', async () => {
    mockParams = { complexeId: 'cx-five', terrainId: 't-1' };
    mockTerrains = {
      data: [terrainDeTemoin({
        basePrice: 6.5,
        photos: [{ id: 9, url: 'https://exemple.test/p.jpg' }],
      })],
      isLoading: false,
    };
    const arbre = await monter();
    const [prix] = arbre.root.findAll((n) => n.type === TextInput
      && n.props.accessibilityLabel === 'Prix de base (facultatif)');
    expect(prix.props.value).toBe('6,50');
    expect(lisibles(arbre)).toContain('Terrain 1');
    await appuyer(arbre, 'Enregistrer');
    expect(mockEnregistrer).toHaveBeenCalledWith(expect.objectContaining({
      complexeId: 'cx-five',
      terrainId: 't-1',
    }));
    expect(mockEnregistrer.mock.calls[0][0].donnees.photos).toEqual([9]);
    expect(lisibles(arbre)).toContain('Modifications enregistrées.');
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('un refus du serveur s’affiche au-dessus du bouton, la fiche reste remplie', async () => {
    mockEnregistrer.mockRejectedValueOnce({
      details: { code: 'COMPLEXE_TERRAIN_LIMIT' }, message: 'trop', status: 409,
    });
    const arbre = await monter();
    await ecrire(arbre, 'Nom', 'Terrain 31');
    await appuyer(arbre, 'Foot à 5');
    await appuyer(arbre, 'Intérieur');
    await appuyer(arbre, 'Enregistrer');
    expect(lisibles(arbre)).toContain('Un complexe compte 30 terrains au plus.');
  });
});

describe('RESA-L5A2 E-G08 — modifier un terrain qui a des réservations', () => {
  beforeEach(() => {
    mockParams = { complexeId: 'cx-five', terrainId: 't-1' };
    mockDemandes = {
      data: { pages: [{ items: [], pagination: { page: 1, pageSize: 20, total: 2 } }] },
    };
    mockRetirer.mockResolvedValue({ data: { reservationsAnnulees: 4, retired: true } });
  });

  it('quitter la validation manuelle : les demandes en attente restent à trancher', async () => {
    mockTerrains = { data: [terrainDeTemoin({ bookingMode: 'manuel' })], isLoading: false };
    const arbre = await monter();
    await appuyer(arbre, 'Automatique');
    await appuyer(arbre, 'Enregistrer');
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Modifications enregistrées.',
      '2 demandes attendent ta réponse : elles restent à trancher dans Demandes.',
    ]));
  });

  it('passer en « Téléphone seulement » : les réservations à venir sont gardées', async () => {
    mockTerrains = { data: [terrainDeTemoin()], isLoading: false };
    const arbre = await monter();
    await appuyer(arbre, 'Téléphone seulement');
    await appuyer(arbre, 'Enregistrer');
    expect(lisibles(arbre)).toContain('Les 4 réservations à venir sont gardées.');
  });

  it('« Voir le planning » et « Retirer ce terrain »', async () => {
    mockTerrains = { data: [terrainDeTemoin()], isLoading: false };
    const arbre = await monter();
    await appuyer(arbre, 'Voir le planning');
    expect(mockNavigate).toHaveBeenLastCalledWith(RouteNames.ComplexeEspace, {
      params: { complexeId: 'cx-five', terrainId: 't-1' },
      screen: RouteNames.ComplexePlanning,
    });
    await appuyer(arbre, 'Retirer ce terrain');
    expect(lisibles(arbre)).toContain('Retirer Terrain 1 ?');
    const confirmer = parRepere(arbre, 'retrait-confirmer')
      .findAll((/** @type {any} */ n) => typeof n.props?.onPress === 'function')[0];
    await act(async () => {
      await confirmer.props.onPress();
    });
    expect(mockRetirer).toHaveBeenCalledWith({ complexeId: 'cx-five', terrainId: 't-1' });
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });
});
