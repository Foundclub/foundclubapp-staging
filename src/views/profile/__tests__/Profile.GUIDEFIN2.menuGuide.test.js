import { ScrollView, Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { PRESIDENT_GUIDE_SETTINGS } from '@/domains/tour/presidentGuideSettings';

import Profile from '../Profile';

// GUIDE-RELANCE (L6, 28/10) — audit du guide Entraîneur, décisions d'Adel :
// « 3- A » : relancer le guide depuis Mon compte quand on l'a déjà fait ouvre
// un petit menu (reprendre, revoir sans rien créer, faire un bonus) au lieu de
// tout refaire en vrai sans prévenir (capture 74) ; « 5- A » : un guide remis
// « plus tard » attend dans Mon compte, avec une pastille.
// Doublures reprises de `Profile.menuProfil.test.js` ; texte lu dans le VRAI fr.js.

/** @type {any} */
let mockUserData;
/** @type {any} */
let mockTour;
// RESA-OUVERTURE : COMPLEXES_GERANT allumé ; ce témoin ne parle pas du complexe.
jest.mock('@/views/complexe/components/EntreeComplexe', () => () => null);

jest.mock('@/context/useTour', () => ({ useTour: () => mockTour }));
// Le vrai guide Dirigeant, même interrupteur éteint : sans lui, le catalogue rend l'ancien tour.
jest.mock('@/domains/tour/tourCatalog', () => {
  const actual = jest.requireActual('@/domains/tour/tourCatalog');
  const { PRESIDENT_GUIDE } = jest.requireActual('@/domains/tour/presidentGuide');
  return {
    ...actual,
    getTourProfile: (key) => (key === 'president' && mockTour?.profileKey === 'president'
      ? PRESIDENT_GUIDE
      : actual.getTourProfile(key)),
  };
});

// MSG-SUPPORT (20/10) — « Écrire à l'assistance » ouvre MA conversation avec l'équipe
// (le serveur la crée à la première ouverture) : doublure du service, pas de réseau.
const mockOuvrirAssistance = jest.fn();
jest.mock('@/services/chat/assistanceService', () => ({
  ouvrirMaConversationAssistance: (/** @type {any[]} */ ...args) => mockOuvrirAssistance(...args),
}));

// PAR-L7 (13/10) — « Mon compte » d'un parent compte ses enfants (`useMesEnfantsEnBref`, qui lit
// trois services) : doublure commune, « aucun enfant ».
// R17-SIGNALER-1 : « Mes signalements » lit ses signalements (doublure, pas de reseau).
jest.mock('@/services/facilityReport/facilityReportQueries', () => ({
  useMyFacilityReports: () => ({ data: null }),
}));
jest.mock('@/views/profile/parent/useMesEnfantsEnBref');

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: () => {},
}));

// `react-native-gesture-handler` est publie en TypeScript non transpile et ne
// figure pas dans le `transformIgnorePatterns` du projet.
jest.mock('react-native-gesture-handler', () => ({
  ScrollView: jest.requireActual('react-native').ScrollView,
}));

jest.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ isPending: false, mutate: jest.fn() }),
}));

jest.mock('react-i18next', () => {
  const catalogue = jest.requireActual('@/theme/strings/translations/fr').default;

  return {
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
        const valeur = String(cle || '')
          .split('.')
          .reduce((noeud, segment) => (noeud == null ? undefined : noeud[segment]), catalogue);
        if (typeof valeur === 'string') return valeur;
        return typeof repli === 'string' ? repli : cle;
      },
    }),
  };
});

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    addAccount: jest.fn(),
    authSessions: [],
    canEditClub: () => false,
    canManageTeam: () => false,
    freeUsageSummary: null,
    logoutMutation: { mutate: jest.fn() },
    refetchUserData: jest.fn(),
    subscriptionAccessLevel: 'free',
    switchAccount: jest.fn(),
    userData: mockUserData,
    userDataError: null,
    userDataLoading: false,
  }),
}));

jest.mock('@/store/appContext', () => ({
  useAppContext: () => [{ fcmToken: 'token-test' }, jest.fn()],
}));

// Le VRAI theme, sans le contexte React qui le porte : un mock en Proxy rend les
// echecs Jest illisibles (constat du lot paywall, 2026-08-02).
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

// COLLECTIVITES 1c — Profil lit `/collectivites/mine` (la porte « Ma collectivite ») :
// doublure, comme tout service que l ecran importe (le client HTTP ne se charge pas ici).
// RESA-L6B-1 — le nombre de « Mes réservations » (rangée cachée par COMPLEXES_JOUEUR) lit le
// serveur des complexes : doublé ici comme les autres services de « Mon compte ».
jest.mock('@/views/reserverTerrain/components/NombreAVenir', () => () => null);
jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  // COLL-ACCUEIL (01/10) : la pastille de la rangee de la Ville lit les demandes en attente.
  useCollectiviteRequests: () => ({ data: [] }),
  useMyCollectivites: () => ({ data: [] }),
  useMyManagerRequests: () => ({ data: [] }),
}));

jest.mock('@/services/auth/authService', () => ({
  deleteAccount: jest.fn(),
}));

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);

jest.mock(
  '@/components/molecules/withDataWrapper/WithDataWrapper',
  () => function WithDataWrapperMock({ children }) { return children; },
);

jest.mock(
  '@/components/molecules/onboardingWrapper/OnboardingWrapper',
  () => function OnboardingWrapperMock({ children }) { return children; },
);

jest.mock(
  '@/components/molecules/tutorial/TutorialFlowBoundary',
  () => function TutorialFlowBoundaryMock({ children }) { return children; },
);

jest.mock(
  '@/components/molecules/bottomModal/BottomModal',
  () => function BottomModalMock() { return null; },
);

jest.mock(
  '@/components/molecules/profileAvatar/ProfileAvatar',
  () => function ProfileAvatarMock() { return null; },
);

jest.mock(
  '@/components/molecules/clubLogoMark/ClubLogoMark',
  () => function ClubLogoMarkMock() { return null; },
);

jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');

  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { disabled: props.disabled, onPress: props.onPress },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});

/**
 * Aplati les enfants React en une chaîne.
 * @param {any} enfants - Enfants.
 * @returns {string} Texte.
 */
const aplatirTexte = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};

const tourDe = (etat) => ({
  hasGuideHistory: false,
  isGuide: false,
  isTourActive: false,
  pauseTour: jest.fn(),
  resumeTour: jest.fn(),
  startTour: jest.fn(() => true),
  tourStatus: null,
  ...etat,
});

let arbre;
const monter = async (role = { name: 'Coach', type: 'coach' }) => {
  mockUserData = {
    club: { documentId: 'club-1', name: 'AS Test' },
    documentId: 'coach-1',
    firstname: 'Sam',
    lastname: 'Coach',
    multisportClubs: [],
    role,
  };
  await act(async () => {
    arbre = renderer.create(
      <Profile navigation={{ navigate: jest.fn(), setParams: jest.fn() }} route={{ params: {} }} />,
    );
  });
};
const toucher = async (libelle) => {
  const rangee = arbre.root.findAllByType(TouchableOpacity)
    .find((n) => n.findAllByType(Text).some((x) => aplatirTexte(x.props.children) === libelle));
  if (!rangee) throw new Error(`Rangée introuvable : ${libelle}`);
  await act(async () => { rangee.props.onPress(); });
};

afterEach(() => { act(() => arbre?.unmount()); });

// GUIDE-FINITIONS-2 N10 (rejeu du 28/10, captures 12 et 56) : les choix du menu se
// confondaient avec les rangées normales (même drapeau, pas de retrait), et « Faire
// un bonus » ne disait pas lequel.
const styleDe = (noeud) => Object.assign({}, ...[noeud.props.style].flat(5).filter(Boolean));
const rangeeDe = (libelle) => arbre.root.findAllByType(TouchableOpacity)
  .find((n) => n.findAllByType(Text).some((x) => aplatirTexte(x.props.children) === libelle));

// 360×640 (05/11) : le menu s'ouvrait sous le bord de l'écran, rien ne semblait bouger au toucher.
describe('le menu du guide s’ouvre sous les yeux', () => {
  const liste = () => arbre.root.findByType(ScrollView);
  const grandit = () => act(() => { liste().props.onContentSizeChange(360, 1200); });

  it('à l’ouverture, la liste défile une fois, une fois le menu posé', async () => {
    mockTour = tourDe({ hasGuideHistory: true });
    await monter();
    const defile = liste().instance.scrollToEnd;
    defile.mockClear();
    await toucher('Guide entraîneur·e');
    grandit();
    expect(defile).toHaveBeenCalledTimes(1);
    grandit();
    expect(defile).toHaveBeenCalledTimes(1);
  });

  it('témoin : à la fermeture, et sans menu, elle ne bouge pas', async () => {
    mockTour = tourDe({ hasGuideHistory: true });
    await monter();
    const defile = liste().instance.scrollToEnd;
    defile.mockClear();
    grandit();
    expect(defile).not.toHaveBeenCalled();
    await toucher('Guide entraîneur·e');
    grandit();
    defile.mockClear();
    await toucher('Guide entraîneur·e');
    grandit();
    expect(defile).not.toHaveBeenCalled();
  });
});

describe('N10 — le menu du guide se distingue des rangées', () => {
  it('ses choix sont en retrait, la rangée du guide non', async () => {
    mockTour = tourDe({ hasGuideHistory: true });
    await monter();
    await toucher('Guide entraîneur·e');
    expect(styleDe(rangeeDe('Guide entraîneur·e')).marginLeft || 0).toBe(0);
    expect(styleDe(rangeeDe('Revoir sans rien créer')).marginLeft)
      .toBeGreaterThanOrEqual(24);
    expect(styleDe(rangeeDe('Faire un bonus')).marginLeft).toBeGreaterThanOrEqual(24);
  });

  // GUIDE-E-CORR-2 (testeur, iPhone, 10/11 11:15) : « Revoir le guide sans rien c… ». Le retrait
  // de 42 rétrécit la ligne, et son libellé restait tenu sur UNE ligne (l'anglais, plus long, aussi).
  // Le libellé est aussi raccourci (fr et en) : en anglais, deux lignes ne suffisaient pas.
  it('un choix du menu passe sur deux lignes plutôt que d’être coupé', async () => {
    mockTour = tourDe({ hasGuideHistory: true });
    await monter();
    await toucher('Guide entraîneur·e');
    const libelle = (texte) => rangeeDe(texte).findAllByType(Text)
      .find((x) => aplatirTexte(x.props.children) === texte);
    expect(libelle('Revoir sans rien créer').props.numberOfLines).toBe(2);
    expect(libelle('Recommencer à zéro').props.numberOfLines).toBe(2);
    // Témoin : une rangée sans retrait garde sa ligne unique.
    expect(libelle('Guide entraîneur·e').props.numberOfLines).toBe(1);
  });

  it('« Faire un bonus » nomme ses bonus', async () => {
    mockTour = tourDe({ hasGuideHistory: true });
    await monter();
    await toucher('Guide entraîneur·e');
    const ligne = rangeeDe('Faire un bonus').findAllByType(Text)
      .map((x) => aplatirTexte(x.props.children)).join(' ');
    expect(ligne).toMatch(/qui vient/i);
    expect(ligne).toMatch(/convo/i);
  });
});

describe('L1 — Mon compte d’un dirigeant', () => {
  const aLaRangee = () => arbre.root.findAllByType(Text)
    .some((x) => aplatirTexte(x.props.children) === 'Guide entraîneur·e');

  // Décision du chef du 08/11 (STORES-2696) : guide Dirigeant allumé, le coach devenu dirigeant
  // en créant son club voit « Guide dirigeant·e » : le guide de son rôle passe avant l'historique
  // du guide entraîneur (Profile.js, `guideKey`). Éteint, il retrouve « Guide entraîneur·e ».
  it('devenu dirigeant en créant son club (« Moi ») : il retrouve un guide', async () => {
    mockTour = tourDe({ hasGuideHistory: true });
    await monter({ name: 'President', type: 'president' });
    const attendu = PRESIDENT_GUIDE_SETTINGS.enabled ? 'Guide dirigeant·e' : 'Guide entraîneur·e';
    expect(arbre.root.findAllByType(Text)
      .some((x) => aplatirTexte(x.props.children) === attendu)).toBe(true);
  });

  it('guide Dirigeant : pas de « Revoir », ce profil n’a pas de visite', async () => {
    mockTour = tourDe({ hasGuideHistory: true, isGuide: true, profileKey: 'president' });
    await monter({ name: 'President', type: 'president' });
    await toucher('Guide dirigeant·e');
    expect(rangeeDe('Revoir sans rien créer')).toBeUndefined();
  });

  it('guide Dirigeant : « Faire un bonus » dit ses bonus, pas ceux du coach', async () => {
    mockTour = tourDe({ hasGuideHistory: true, isGuide: true, profileKey: 'president' });
    await monter({ name: 'President', type: 'president' });
    await toucher('Guide dirigeant·e');
    const textes = arbre.root.findAllByType(Text).map((x) => aplatirTexte(x.props.children));
    expect(textes).toContain('Faire un bonus');
    expect(textes).not.toContain('Voir qui vient, puis convoquer pour un match');
    expect(textes.some((texte) => String(texte).includes('Cotisation'))).toBe(true);
  });

  it('témoin : dirigeant sans guide joué, pas de rangée pour l’instant', async () => {
    mockTour = tourDe({ hasGuideHistory: false });
    await monter({ name: 'President', type: 'president' });
    expect(aLaRangee()).toBe(false);
  });
});
