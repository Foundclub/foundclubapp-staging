import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ClubEdit from '../ClubEdit';

// R17-ADRESSE (REC17-008, 19/10) — « Modifier le club » : l'adresse était un TEXTE LIBRE
// (`ClubEdit.js:449` avant ce lot), envoyée seule (`addressDetails`). Côté serveur, une mise à
// jour qui porte un texte sans `address` REMPLACE l'adresse par `{ label }`
// (`admin/src/api/club/content-types/club/lifecycles.ts`, beforeUpdate) : le point du club
// partait à CHAQUE enregistrement, même sans toucher à l'adresse, et le club sortait de la
// recherche par distance (l'index lit `address.lat/lng`).
//
// Réglage du chef : « Modifier le club » passe par la même saisie que les autres lieux publics,
// et le point enregistré suit l'adresse. Ce filet fige ce que l'écran ENVOIE.

const mockMutate = jest.fn();
const mockChamp = [];

jest.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ isPending: false, mutate: mockMutate }),
}));

const TRADUCTIONS_SANS_REPLI = { 'common.actions.save': 'Enregistrer' };

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
      if (typeof repli === 'string') return repli;
      return TRADUCTIONS_SANS_REPLI[cle] || cle;
    },
  }),
}));

jest.mock('@/theme/strings', () => ({ Joi: jest.requireActual('joi') }));

jest.mock('@/theme/colors', () => ({
  withAlpha: () => 'couleur-transparente',
}));

jest.mock('@/theme/themeContext', () => {
  const feuilleDeStyle = {};
  const rampe = () => new Proxy({}, { get: () => feuilleDeStyle });
  return {
    __esModule: true,
    default: () => ({
      Alignments: rampe(),
      ApplicationStyle: new Proxy({}, { get: () => feuilleDeStyle }),
      Colors: new Proxy({}, { get: (_cible, cle) => `couleur-${String(cle)}` }),
      Fonts: rampe(),
      Spaces: new Proxy({}, { get: () => rampe() }),
    }),
  };
});

const mockGetClub = jest.fn();
jest.mock('@/services/club/clubQueries', () => ({
  useGetClub: (/** @type {any} */ ...args) => mockGetClub(...args),
}));

jest.mock('@/services/activity/activityQueries', () => ({
  useGetActivities: () => ({ data: [] }),
}));

jest.mock('@/services/club/clubService', () => ({
  updateClubInfo: jest.fn(),
}));

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) {
    return children;
  },
);

jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');

  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { disabled: props.disabled || props.isLoading, onPress: props.onPress },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});

jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() {
  return null;
});

jest.mock('@/components/molecules/input/Input', () => function InputMock() {
  return null;
});

jest.mock(
  '@/components/molecules/autocompleteSelect/AutocompleteSelect',
  () => function AutocompleteSelectMock() {
    return null;
  },
);

// Le champ d'adresse partagé : on garde ce qu'il reçoit (sa valeur, son réglage, son rappel).
jest.mock(
  '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput',
  () => function AutocompleteAddressInputMock(/** @type {any} */ props) {
    mockChamp.push(props);
    return null;
  },
);

jest.mock(
  '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet',
  () => function SubscriptionPaywallSheetMock() {
    return null;
  },
);

jest.mock(
  '@/components/molecules/selectAvatar/SelectAvatar',
  () => function SelectAvatarMock() {
    return null;
  },
);

const navigation = { goBack: jest.fn(), navigate: jest.fn() };

const CLUB = {
  activites: [],
  address: {
    city: 'Marseille', label: '12 Rue Saint-Ferréol 13001 Marseille', lat: 43.2953, lng: 5.3781,
  },
  addressDetails: '12 Rue Saint-Ferréol 13001 Marseille',
  cityName: 'Marseille',
  clubMembersPublicVisibility: true,
  documentId: 'club-1',
  email: 'contact@smuc.fr',
  membershipRequestManagementMode: 'COACH_ALLOWED_BY_TEAM',
  name: 'Stade Marseillais Université Club',
  phoneNumber: '0491000000',
};

// Ce que le champ rend pour un lieu posé sur la carte (même forme qu'une adresse de la liste).
const NOUVELLE_ADRESSE = {
  city: 'Marseille',
  label: 'Stade de Luminy (13009 Marseille)',
  lat: 43.2289,
  lng: 5.4371,
  postcode: '13009',
  provider: 'ban',
  providerId: 'lieu:abc',
  value: '5.4371|43.2289',
};

const aplatirTexte = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};

const texteDe = (/** @type {any} */ noeud) => noeud
  .findAllByType(Text)
  .map((/** @type {any} */ texte) => aplatirTexte(texte.props.children))
  .join(' ');

const monter = async (club = CLUB) => {
  mockGetClub.mockReturnValue({
    data: club, error: null, isLoading: false, refetch: jest.fn(),
  });
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <ClubEdit
        navigation={/** @type {any} */ (navigation)}
        route={/** @type {any} */ ({ params: { clubId: 'club-1' } })}
      />,
    );
  });
  return arbre;
};

const enregistrer = async (/** @type {any} */ arbre) => {
  const bouton = arbre.root
    .findAll((/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function')
    .find((/** @type {any} */ noeud) => texteDe(noeud).trim() === 'Enregistrer');
  if (!bouton) throw new Error('« Enregistrer » absent');
  await act(async () => {
    bouton.props.onPress();
  });
};

const dernierChamp = () => mockChamp[mockChamp.length - 1];

beforeEach(() => {
  jest.clearAllMocks();
  mockChamp.length = 0;
});

describe('R17-ADRESSE — « Modifier le club » : le point suit l adresse', () => {
  it('d1 l adresse passe par la saisie des lieux publics (carte permise, ville du club)', async () => {
    await monter();

    expect(mockChamp.length).toBeGreaterThan(0);
    expect(dernierChamp().permettreLieuSurCarte).toBe(true);
    expect(dernierChamp().villeConnue).toBe('Marseille');
    // L'adresse enregistrée arrive AVEC son point : le champ ne la dit pas « sans point ».
    expect(dernierChamp().address).toEqual(expect.objectContaining({
      label: '12 Rue Saint-Ferréol 13001 Marseille', lat: 43.2953, lng: 5.3781,
    }));
  });

  it('d2 une nouvelle adresse part AVEC son point (le point du club se déplace)', async () => {
    const arbre = await monter();
    await act(async () => {
      dernierChamp().setAddress(NOUVELLE_ADRESSE);
    });
    await enregistrer(arbre);

    expect(mockMutate).toHaveBeenCalledTimes(1);
    const envoi = mockMutate.mock.calls[0][0];
    expect(envoi.address).toEqual({
      city: 'Marseille',
      label: 'Stade de Luminy (13009 Marseille)',
      lat: 43.2289,
      lng: 5.4371,
      postcode: '13009',
    });
    expect(envoi.addressDetails).toBe(JSON.stringify({ address: 'Stade de Luminy (13009 Marseille)' }));
  });

  it('d3 enregistrer SANS toucher l adresse n envoie aucune adresse (le point reste)', async () => {
    const arbre = await monter();
    await enregistrer(arbre);

    expect(mockMutate).toHaveBeenCalledTimes(1);
    const envoi = mockMutate.mock.calls[0][0];
    expect(envoi).not.toHaveProperty('addressDetails');
    expect(envoi).not.toHaveProperty('address');
    expect(envoi).toMatchObject({ documentId: 'club-1', name: 'Stade Marseillais Université Club' });
  });

  it('d4 un club au texte seul (point déjà perdu) : le champ reçoit l adresse SANS point', async () => {
    await monter({ ...CLUB, address: { label: '12 Rue Saint-Ferréol 13001 Marseille' } });

    expect(dernierChamp().address).toEqual(expect.objectContaining({
      label: '12 Rue Saint-Ferréol 13001 Marseille',
    }));
    expect(Number.isFinite(dernierChamp().address?.lat)).toBe(false);
  });
});
