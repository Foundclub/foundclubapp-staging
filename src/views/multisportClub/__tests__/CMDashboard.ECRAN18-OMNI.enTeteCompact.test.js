import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';

import CMDashboard from '../CMDashboard';
import MultisportHeroCard from '../components/MultisportHeroCard';

// ECRAN18-OMNI (06/10) — décision d'Adel `omni A` : la ligne compacte de la planche
// P5-club-ordi (ECRAN18-ENTETE, club simple) vaut aussi pour « Gestion du club » d'un club
// OMNISPORT sur ordinateur. Avant ce lot, `CMDashboard` posait la grande carte du téléphone
// (`MultisportHeroCard` : badge, écusson de 80 centré, nom, adresse, téléphone, e-mail, phrase
// de résumé) au-dessus de la planche à 2 colonnes.
// Même bascule que la planche (`isDesktop && isCmAdmin`) ; le téléphone et un visiteur gardent
// la carte. Rien n'est perdu : « Modifier » reste dans la ligne, le badge OMNISPORT aussi.
//
// 🧪 `CMDashboard.js` n'avait qu'un témoin qui LIT sa source (CMDashboard.ST-VUES) : celui-ci
// le MONTE, services et écrans voisins doublés.

let mockIsDesktop = false;
/** @type {any} */
let mockUserData;

jest.mock('@/responsive', () => ({
  ...jest.requireActual('@/responsive'),
  useIsDesktop: () => mockIsDesktop,
}));

const mockCm = {
  addressDetails: '1 rue du Stade, Montrivage',
  admins: [],
  documentId: 'cm-1',
  email: 'contact@usm.fr',
  name: 'Union Sportive de Montrivage',
  phoneNumber: '0102030405',
};
// Trois sections, deux sports : le sport vient de `sport`, sinon de la première activité
// (la même lecture que « Mes sections »), et un sport ne se répète pas.
const mockSections = [
  {
    documentId: 's-1', name: 'USM Football', sport: 'Football', stats: { members: 5 },
  },
  {
    activites: [{ name: 'Arts martiaux' }], documentId: 's-2', name: 'USM Judo',
  },
  {
    documentId: 's-3', name: 'USM Football féminin', sport: 'Football',
  },
];

jest.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ isPending: false, mutate: jest.fn() }),
  useQuery: (/** @type {any} */ options) => {
    const reponse = { error: null, isLoading: false, refetch: jest.fn() };
    const cle = options?.queryKey?.[0];
    if (cle === 'multisport-club') return { ...reponse, data: mockCm };
    if (cle === 'cm-clubs') return { ...reponse, data: { data: mockSections } };
    if (cle === 'cm-teams') return { ...reponse, data: { data: [] } };
    return { ...reponse, data: undefined };
  },
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ options) => {
      const gabarit = (() => {
        if (typeof repli === 'string') return repli;
        if (repli && typeof repli.defaultValue === 'string') return repli.defaultValue;
        return cle;
      })();
      const valeurs = repli && typeof repli === 'object' ? repli : options;
      if (!valeurs || typeof valeurs !== 'object') return gabarit;
      return gabarit.replace(
        /\{\{(\w+)\}\}/g,
        (/** @type {string} */ entier, /** @type {string} */ nom) => (
          valeurs[nom] === undefined ? entier : String(valeurs[nom])
        ),
      );
    },
  }),
}));

jest.mock('@/theme/themeContext', () => {
  const couleurs = jest.requireActual('@/theme/colors').default();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(couleurs),
      Colors: couleurs,
      Fonts: jest.requireActual('@/theme/fonts').default(couleurs),
      Images: {
        arrowRight: 1, edit: 2, envelope: 3, phone: 4,
      },
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: mockUserData }),
}));
jest.mock('@/context/ClubScopeContext', () => ({ useClubScope: () => ({}) }));
jest.mock('@/domains/club/useClub', () => ({
  __esModule: true,
  default: () => ({ getClubInitials: (/** @type {string} */ nom) => String(nom).slice(0, 2) }),
}));
jest.mock('@/domains/requests/requestNavigation', () => ({ navigateToRequestsHub: jest.fn() }));
jest.mock('@/services/multisportClub/multisportClubService', () => ({
  deleteCMSection: jest.fn(),
  getCMClubs: jest.fn(),
  getCMTeams: jest.fn(),
  getCMWeekendResults: jest.fn(),
  getMultisportClubById: jest.fn(),
  remindCMWeekendScore: jest.fn(),
}));
jest.mock('@/utils/errors/displayError', () => ({ displayErrorAlert: jest.fn() }));

// Les cadres de l'écran rendent leurs enfants, sans plus.
jest.mock('@/components/templates/ScreenContainer', () => function ScreenContainerMock(
  /** @type {any} */ { children },
) {
  return children;
});
jest.mock(
  '@/components/molecules/onboardingWrapper/OnboardingWrapper',
  () => function OnboardingWrapperMock(/** @type {any} */ { children }) {
    return children;
  },
);
jest.mock(
  '@/components/molecules/tutorial/TutorialFlowBoundary',
  () => function TutorialFlowBoundaryMock(/** @type {any} */ { children }) {
    return children;
  },
);
jest.mock(
  '@/components/molecules/withDataWrapper/WithDataWrapper',
  () => function WithDataWrapperMock(/** @type {any} */ { children }) {
    return children;
  },
);
jest.mock('@/components/atoms/button/Button', () => function ButtonMock() {
  return null;
});
jest.mock(
  '@/components/molecules/clubLogoMark/ClubLogoMark',
  () => function ClubLogoMarkMock() {
    return null;
  },
);

// Les voisins de la page : le témoin ne regarde que l'en-tête.
jest.mock('../components/MultisportHeroCard', () => function MultisportHeroCardMock() {
  return null;
});
jest.mock('../components/ClubResultsBoard', () => function ClubResultsBoardMock() {
  return null;
});
jest.mock('../components/MultisportActionGrid', () => function MultisportActionGridMock() {
  return null;
});
jest.mock('../components/MultisportAdminsSection', () => function MultisportAdminsSectionMock() {
  return null;
});
jest.mock('../components/MultisportSectionsList', () => function MultisportSectionsListMock() {
  return null;
});
jest.mock(
  '../components/MultisportSponsorsSection',
  () => function MultisportSponsorsSectionMock() {
    return null;
  },
);
jest.mock('../components/MultisportStatsRow', () => function MultisportStatsRowMock() {
  return null;
});
jest.mock('../components/WeekendResultsCard', () => ({
  __esModule: true,
  default: function WeekendResultsCardMock() {
    return null;
  },
  weekendRowKey: (/** @type {any} */ ligne) => `${ligne?.eventId}:${ligne?.teamId}`,
}));

/** @type {any} */
let mockNavigation;
/** @type {any[]} */
const arbresMontes = [];

const monter = () => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <CMDashboard navigation={mockNavigation} route={{ params: { cmId: 'cm-1' } }} />,
    );
  });
  arbresMontes.push(arbre);
  return arbre;
};

const aplatir = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
  return String(enfants);
};
const texteDe = (/** @type {any} */ noeud) => noeud.findAllByType(Text)
  .map((/** @type {any} */ texte) => aplatir(texte.props.children))
  .join(' ');
const enTete = (/** @type {any} */ arbre) => arbre.root
  .findAll((/** @type {any} */ noeud) => noeud.props?.testID === 'club-entete-compact');
const pressableAvecTexte = (/** @type {any} */ racine, /** @type {string} */ libelle) => racine
  .findAll((/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function')
  .find((/** @type {any} */ noeud) => texteDe(noeud).trim() === libelle);

/** Le dirigeant du club omnisport : le club est dans SES clubs omnisports. */
const devenirDirigeant = () => {
  mockUserData = {
    documentId: 'u-1',
    multisportClubs: [{ documentId: 'cm-1', name: 'Union Sportive de Montrivage' }],
  };
};

beforeEach(() => {
  mockIsDesktop = false;
  mockNavigation = { navigate: jest.fn(), setParams: jest.fn() };
  devenirDirigeant();
});

afterEach(() => {
  act(() => {
    arbresMontes.splice(0).forEach((arbre) => arbre.unmount());
  });
});

describe('ECRAN18-OMNI · « Gestion du club » d un club omnisport, sur ordinateur', () => {
  it('🔴 sur ordinateur, le dirigeant voit la ligne : écusson, surtitre, nom, sports, badge', () => {
    mockIsDesktop = true;
    const arbre = monter();

    const [tete] = enTete(arbre);
    expect(tete).toBeDefined();
    const lus = texteDe(tete);
    expect(lus).toContain('Gestion du club');
    expect(lus).toContain('Union Sportive de Montrivage');
    expect(lus).toContain('Football · Arts martiaux');
    expect(lus).toContain('OMNISPORT');
    expect(tete.findAllByType(ClubLogoMark).map((/** @type {any} */ n) => n.props.size))
      .toEqual([60]);
    // La grande carte du téléphone n'est plus posée.
    expect(arbre.root.findAllByType(MultisportHeroCard)).toHaveLength(0);
  });

  it('🔴 rien n est perdu : « Modifier » est dans la ligne et ouvre la fiche du club', () => {
    mockIsDesktop = true;
    const [tete] = enTete(monter());
    expect(tete).toBeDefined();

    const modifier = pressableAvecTexte(tete, 'Modifier');
    expect(modifier.props.accessibilityLabel).toBe('Modifier les informations du club');
    act(() => modifier.props.onPress());
    expect(mockNavigation.navigate).toHaveBeenCalledWith('MultisportClubEdit', { cmId: 'cm-1' });
  });

  it('📱 au téléphone, rien ne change : la grande carte, avec « Modifier »', () => {
    const arbre = monter();

    expect(enTete(arbre)).toHaveLength(0);
    const [carte] = arbre.root.findAllByType(MultisportHeroCard);
    expect(carte.props.canEdit).toBe(true);
    expect(carte.props.cm).toBe(mockCm);
    act(() => carte.props.onEditPress());
    expect(mockNavigation.navigate).toHaveBeenCalledWith('MultisportClubEdit', { cmId: 'cm-1' });
  });

  it('🔒 sur ordinateur, qui ne dirige pas ce club garde la grande carte, sans « Modifier »', () => {
    mockIsDesktop = true;
    mockUserData = { documentId: 'u-9', multisportClubs: [] };
    const arbre = monter();

    expect(enTete(arbre)).toHaveLength(0);
    const [carte] = arbre.root.findAllByType(MultisportHeroCard);
    expect(carte.props.canEdit).toBe(false);
  });

  // BH03 · P14-02 — un joueur ou un coach d'une SECTION (son club a un `parentMultisport`)
  // etait traite en administrateur du club multisport : « Modifier », sections, etc.
  it('🔒 un membre d une section n administre pas le club multisport parent', () => {
    mockUserData = {
      club: { parentMultisport: { documentId: 'cm-1', name: 'Union Sportive de Montrivage' } },
      documentId: 'u-9',
      multisportClubs: [],
    };
    const arbre = monter();

    const [carte] = arbre.root.findAllByType(MultisportHeroCard);
    expect(carte.props.canEdit).toBe(false);
  });
});
