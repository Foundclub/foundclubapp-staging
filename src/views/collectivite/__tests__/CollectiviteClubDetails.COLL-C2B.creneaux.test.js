import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import {
  attributeSeasonSlot,
  getClubTeamsForSlot,
  listFacilitySeasonSlots,
  previewFacilitySeasonSlot,
} from '@/services/seasonSlot/seasonSlotService';

import CollectiviteClubDetails from '../CollectiviteClubDetails';

// 📐 COLL-C2B (02/10/2026), point 6 du lot — LA FICHE D UN CLUB, COTE MAIRIE : « Ses creneaux
// de la Ville » (design HY521H1 page 7, « P7v2-fiche-tel » et « P7v2-fiche-ordi »). Le bloc
// etait vide et nomme « A BRANCHER SUR C2a » ; le serveur rend desormais `seasonSlots` sur la
// fiche (temoin admin COLL-C2B-fiche-club-creneaux).
//
// Ce que ce temoin fige (ROUGE avant : le bloc ne lisait rien et n avait aucun bouton) :
//   1. les creneaux du club, jour, heures, installation, equipe ou « Tout le club », plateau ;
//      toucher une ligne ouvre l installation (son onglet Creneaux, ou on le gere) ;
//   2. aucun creneau : on le dit ;
//   3. « Attribuer un creneau a ce club » ouvre le formulaire d attribution, le club DEJA
//      choisi : on choisit l installation, l equipe, le jour, les heures, et le bon corps part ;
//      la fiche se relit ensuite ;
//   4. une Ville sans installation : on le dit, pas de formulaire qui ne mene nulle part ;
//   5. hors de ses collectivites : aucun bouton d ecriture ;
//   6. aucun nom de personne ne s affiche (secrets semes).

const i18nextTemoin = require('i18next');

const frTemoin = require('@/theme/strings/translations/fr');

(i18nextTemoin.default || i18nextTemoin).init({
  compatibilityJSON: 'v4',
  fallbackLng: 'fr',
  lng: 'fr',
  resources: { fr: { translation: frTemoin.default } },
});

/** @type {any} */
let mockFiche;
/** @type {any} */
let mockMine;
/** @type {any} */
let mockInstallations;
const mockNavigate = jest.fn();
/** @type {any[]} */
const mockInputProps = [];

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({ params: { clubId: 'as-montrivage', collectiviteId: 'ville-de-recette' } }),
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

jest.mock('@/responsive', () => ({ useIsDesktop: () => false }));

jest.mock('@/services/seasonSlot/seasonSlotService', () => ({
  attributeSeasonSlot: jest.fn(),
  getClubTeamsForSlot: jest.fn(),
  getSeasonSlot: jest.fn(),
  listFacilitySeasonSlots: jest.fn(),
  modifySeasonSlot: jest.fn(),
  previewFacilitySeasonSlot: jest.fn(),
  restoreSeasonSlot: jest.fn(),
  withdrawSeasonSlot: jest.fn(),
}));
jest.mock('@/services/facility/facilityService', () => ({ getFacilityPlanning: jest.fn() }));

jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useCollectiviteClub: () => mockFiche,
  useCollectiviteInstallations: () => mockInstallations,
  useMyCollectivites: () => mockMine,
}));

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);
jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() { return null; });
jest.mock(
  '@/components/molecules/clubLogoMark/ClubLogoMark',
  () => function ClubLogoMarkMock() { return null; },
);
jest.mock(
  '@/components/atoms/sponsorLogoTile/SponsorLogoTile',
  () => function SponsorLogoTileMock() { return null; },
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
jest.mock('@/components/molecules/input/Input', () => function InputMock(/** @type {any} */ props) {
  mockInputProps.push(props);
  return null;
});
jest.mock(
  '@/components/molecules/datePickerInput/DatePickerInput',
  () => function DatePickerInputMock() { return null; },
);
jest.mock('@/components/molecules/bottomModal/BottomModal', () => function BottomModalMock(
  /** @type {any} */ { children, isVisible },
) {
  return isVisible ? children : null;
});

// Des secrets SEMES la ou le serveur ne doit rien mettre : s ils s affichent, la mairie lirait
// une personne (le serveur ne les rend pas ; l ecran ne doit de toute facon rien en afficher).
const SECRETS = ['Jeanne', 'SECRET-NOM', 'jeanne.secret@exemple.fr', '0611223344'];
const PERSONNE = {
  email: SECRETS[2], firstname: SECRETS[0], lastname: SECRETS[1], phone: SECRETS[3],
};
const CRENEAUX = [
  {
    attributedBy: PERSONNE,
    documentId: 'lun-u15',
    endTime: '19:30',
    facility: { documentId: 'gym-tilleuls', name: 'Gymnase des Tilleuls' },
    plateau: null,
    source: 'attribution',
    startTime: '18:00',
    team: { name: 'U15', trainers: [PERSONNE] },
    validFrom: '2026-09-01',
    validUntil: '2027-06-30',
    weekday: 1,
  },
  {
    documentId: 'mer-club',
    endTime: '18:00',
    facility: { documentId: 'dojo', name: 'Dojo municipal' },
    plateau: { name: 'Tatami sud', number: 2 },
    source: 'request',
    startTime: '17:00',
    team: null,
    validFrom: '2026-09-01',
    validUntil: '2027-06-30',
    weekday: 3,
  },
];
const AS_MONTRIVAGE = {
  address: null,
  documentId: 'as-montrivage',
  email: null,
  leaders: [{ name: 'Karim Benali' }],
  logo: null,
  membersCount: 2,
  name: 'AS Montrivage',
  offer: { kind: 'collectivite', since: '2026-09-15T08:00:00.000Z' },
  phoneNumber: null,
  requests: {
    accepted: 0, pending: [], pendingCount: 0, refused: 0,
  },
  seasonSlots: CRENEAUX,
  sessionsThisWeek: { count: 0, facilities: [] },
  sponsors: [],
  teams: [{ name: 'U13' }, { name: 'U15' }],
  teamsCount: 2,
  websiteUrl: null,
};
const INSTALLATIONS = [
  {
    closingTime: '22:00:00.000',
    documentId: 'gym-tilleuls',
    maxSlots: 2,
    name: 'Gymnase des Tilleuls',
    openingTime: '08:00:00.000',
    type: 'Gymnase',
  },
  {
    documentId: 'dojo', maxSlots: 1, name: 'Dojo municipal', type: 'Dojo',
  },
];

const aplatir = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
  return String(enfants);
};
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ noeud) => aplatir(noeud.props.children).trim());
const parTexte = (/** @type {any} */ arbre, /** @type {string} */ libelle) => arbre.root
  .findAllByType(TouchableOpacity)
  .filter((/** @type {any} */ noeud) => noeud.findAllByType(Text)
    .some((/** @type {any} */ texte) => aplatir(texte.props.children).trim() === libelle))
  .pop();
const parTestID = (/** @type {any} */ arbre, /** @type {string} */ id) => arbre.root
  .findAllByType(TouchableOpacity).find((/** @type {any} */ noeud) => noeud.props.testID === id);
const attendre = async () => {
  await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 0); }); });
  await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 0); }); });
};
const appuyer = async (/** @type {any} */ noeud) => {
  if (!noeud) throw new Error('rien a toucher');
  await act(async () => { noeud.props.onPress(); });
  await attendre();
};
const saisir = async (/** @type {string} */ libelle, /** @type {string} */ valeur) => {
  const champ = mockInputProps.filter((props) => props.label === libelle).pop();
  await act(async () => { champ.onChangeText(valeur); });
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
        <CollectiviteClubDetails />
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
  mockFiche = {
    data: AS_MONTRIVAGE, error: null, isLoading: false, refetch: jest.fn(),
  };
  mockMine = {
    data: [{ documentId: 'ville-de-recette', name: 'Ville de Montrivage' }],
    isLoading: false,
  };
  mockInstallations = { data: INSTALLATIONS, error: null, isLoading: false };
  /** @type {any} */ (listFacilitySeasonSlots).mockResolvedValue({
    data: [],
    meta: {
      canManage: true,
      facility: {
        documentId: 'gym-tilleuls', maxSlots: 2, name: 'Gymnase des Tilleuls', plateaux: [],
      },
      season: { validFrom: '2026-09-01', validUntil: '2027-06-30' },
    },
  });
  /** @type {any} */ (getClubTeamsForSlot).mockResolvedValue([
    { documentId: 'team-u13', name: 'U13' }, { documentId: 'team-u15', name: 'U15' },
  ]);
  /** @type {any} */ (previewFacilitySeasonSlot).mockResolvedValue({
    data: {
      capacity: 2,
      needsConfirmation: false,
      next: null,
      occupants: [],
      overCapacity: false,
      peak: 0,
      plateau: null,
      remaining: 2,
      teamsAfter: 1,
    },
  });
  /** @type {any} */ (attributeSeasonSlot).mockResolvedValue({ data: { documentId: 'neuf' } });
});

afterEach(() => {
  act(() => {
    montes.splice(0).forEach(({ arbre, client }) => {
      arbre.unmount();
      client.clear();
    });
  });
});

describe('COLL-C2B point 6 — « Ses creneaux de la Ville » sur la fiche d un club', () => {
  it('1. les creneaux du club ; toucher une ligne ouvre l installation', async () => {
    const arbre = await rendre();
    const lus = textes(arbre);
    expect(lus).toEqual(expect.arrayContaining([
      'Lundi 18:00 – 19:30',
      'Gymnase des Tilleuls · U15',
      'Mercredi 17:00 – 18:00',
      'Dojo municipal · Tout le club · Tatami sud',
    ]));
    expect(lus).not.toContain('Les créneaux que la Ville attribue à ce club s’afficheront ici.');
    await appuyer(parTestID(arbre, 'fiche-club-creneau-lun-u15'));
    expect(mockNavigate).toHaveBeenCalledWith('CollectiviteInstallation', {
      collectiviteId: 'ville-de-recette', facilityId: 'gym-tilleuls',
    });
  });

  it('2. aucun creneau : on le dit', async () => {
    mockFiche = {
      data: { ...AS_MONTRIVAGE, seasonSlots: [] },
      error: null,
      isLoading: false,
      refetch: jest.fn(),
    };
    expect(textes(await rendre())).toContain('Aucun créneau de la Ville pour ce club.');
  });

  it('3. « Attribuer » : le club deja choisi, le bon corps part, la fiche se relit', async () => {
    const arbre = await rendre();
    expect(parTexte(arbre, 'AS Montrivage')).toBeUndefined();
    await appuyer(parTexte(arbre, 'Attribuer un créneau à ce club'));
    expect(textes(arbre)).toContain('Attribuer un créneau à AS Montrivage');
    // Le club est fixe : une seule puce, la sienne ; l installation se choisit.
    expect(parTexte(arbre, 'AS Montrivage')).toBeDefined();
    await appuyer(parTexte(arbre, 'Gymnase des Tilleuls'));
    await appuyer(parTexte(arbre, 'U13'));
    await appuyer(parTestID(arbre, 'jour-3'));
    await saisir('Début', '17:30');
    await saisir('Fin', '19:00');
    const attendu = expect.objectContaining({ endTime: '19:00', startTime: '17:30', weekday: 3 });
    expect(previewFacilitySeasonSlot).toHaveBeenLastCalledWith('gym-tilleuls', attendu);
    await appuyer(parTexte(arbre, 'Attribuer le créneau'));
    expect(attributeSeasonSlot).toHaveBeenCalledWith('gym-tilleuls', {
      club: 'as-montrivage', endTime: '19:00', startTime: '17:30', team: 'team-u13', weekday: 3,
    });
    expect(mockFiche.refetch).toHaveBeenCalled();
    expect(textes(arbre)).not.toContain('Attribuer un créneau à AS Montrivage');
  });

  it('4. une Ville sans installation : on le dit, aucun formulaire', async () => {
    mockInstallations = { data: [], error: null, isLoading: false };
    const arbre = await rendre();
    await appuyer(parTexte(arbre, 'Attribuer un créneau à ce club'));
    expect(textes(arbre)).toContain(
      'La Ville n’a encore aucune installation : ajoutez-en une, puis attribuez-y un créneau.',
    );
    expect(mockInputProps).toHaveLength(0);
  });

  it('5. hors de ses collectivites : aucun bouton d ecriture', async () => {
    mockMine = { data: [], isLoading: false };
    const arbre = await rendre();
    expect(parTexte(arbre, 'Attribuer un créneau à ce club')).toBeUndefined();
    expect(textes(arbre)).toContain('Lundi 18:00 – 19:30');
  });

  it('6. aucun secret seme ne s affiche', async () => {
    const arbre = await rendre();
    await appuyer(parTexte(arbre, 'Attribuer un créneau à ce club'));
    const tout = textes(arbre).join('\n');
    SECRETS.forEach((secret) => expect(tout).not.toContain(secret));
  });
});
