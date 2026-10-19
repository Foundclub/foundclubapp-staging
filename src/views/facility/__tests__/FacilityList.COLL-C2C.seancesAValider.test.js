/* eslint-disable max-len -- donnees de test : les fixtures se lisent mieux sur une ligne */
import { Alert, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import FacilityList from '../FacilityList';

// 🏟️ COLL-C2C (02/10) — D32 : « SÉANCES À VALIDER », CÔTÉ DIRIGEANT. Une séance posée dans un
// créneau du club déjà plein à cette heure attend SA décision (le serveur la met en attente et le
// prévient : tests/authz/COLL-C2C-seance-dans-le-creneau.test.js du dépôt admin). Le VRAI
// i18next (fr.js) écrit les phrases.
//
// Ce que ce témoin exige (ROUGE avant le lot) :
//   - le dirigeant lit « Séances à valider (n) », chaque séance « U15 · mar. 6 oct. 17:30 – 19:00 »
//     et son installation, avec « Accepter » et « Refuser » ;
//   - « Accepter » envoie la décision et relit la page ; « Refuser » demande confirmation d abord ;
//   - un membre qui ne dirige pas le club ne voit rien ; la Ville non plus.
//
// Harnais repris de FacilityList.COLL-C2C.troisGroupes.test.js (mêmes doublures).

/** @type {any} */
let mockRoute;
/** @type {any} */
let mockFacilityContext;
/** @type {any[]} */
const mockOptionsDuContexte = [];
const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
  useNavigation: () => ({ goBack: jest.fn(), navigate: mockNavigate, setOptions: jest.fn() }),
  useRoute: () => mockRoute,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {any[]} */ ...args) => jest.requireActual('i18next').t(...args),
  }),
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: { club: { documentId: 'as-montrivage' } } }),
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
      Images: { calendar: 3, edit: 2, pin: 1 },
      Spaces: espaces,
    }),
  };
});

jest.mock('@/services/facility/facilityQueries', () => ({
  useClubFacilityContext: (/** @type {any} */ contexte, /** @type {any} */ options) => {
    mockOptionsDuContexte.push(options);
    return mockFacilityContext;
  },
}));
jest.mock('@/services/seasonSlot/seasonSlotQueries', () => ({
  useInstallationsWeekSummary: () => ({}),
}));
jest.mock('@/components/molecules/bottomModal/BottomModal', () => function BottomModalMock(
  /** @type {any} */ { children, isVisible },
) {
  return isVisible ? children : null;
});
jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useCollectiviteInstallations: () => ({
    data: [], error: null, isLoading: false, isRefetching: false, refetch: jest.fn(),
  }),
}));
const mockDecider = jest.fn();
// COLL-C4B-BIS (03/10) : la carte d une installation de la Ville lit sa fermeture (bandeau).
jest.mock('@/services/facilityClosure/facilityClosureQueries', () => ({
  useFacilityClosures: () => ({ data: null }),
}));
jest.mock('@/services/facility/facilityService', () => ({
  decideClubSession: (/** @type {any[]} */ ...args) => mockDecider(...args),
  deleteFacility: jest.fn(),
  getFacilitySections: (/** @type {any[]} */ installations) => (
    Array.isArray(installations) && installations.length ? [{ data: installations, title: '' }] : []
  ),
}));
jest.mock('@/navigation/useBottomDockLayout', () => ({
  __esModule: true,
  default: () => ({ sceneBottomInset: 24 }),
}));
jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);
jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() { return null; });
jest.mock('@/components/atoms/emptyState/EmptyState', () => function EmptyStateMock() { return null; });
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(PressableRN, { onPress: props.onPress }, reactActuel.createElement(TexteRN, null, props.title));
  };
});
jest.mock(
  '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet',
  () => function SubscriptionPaywallSheetMock() { return null; },
);

const VILLE = { collectivite: { documentId: 'ville-montrivage', name: 'Ville de Montrivage' } };
const deLaVille = (/** @type {any} */ installation) => ({
  ...VILLE, isReadOnly: true, isShared: true, ownerName: 'Ville de Montrivage', ownerType: 'collectivite', ...installation,
});
const SALLE = {
  documentId: 'salle-annexe', isReadOnly: false, isShared: false, maxSlots: 1, name: 'Salle annexe', ownerType: 'club', type: 'Gymnase',
};
const creneau = (/** @type {string} */ id, /** @type {number} */ weekday, debut, fin, equipe = 'U15') => ({
  documentId: id, endTime: fin, facility: { documentId: 'gym-tilleuls' }, startTime: debut, team: equipe ? { name: equipe } : null, weekday,
});
const GYMNASE = deLaVille({
  address: { description: '12 rue des Tilleuls' },
  clubSeasonSlots: [creneau('s1', 2, '17:30', '19:00'), creneau('s2', 4, '18:00', '19:30')],
  documentId: 'gym-tilleuls',
  maxSlots: 2,
  name: 'Gymnase des Tilleuls',
  type: 'Gymnase',
});
const DOJO = deLaVille({
  closingTime: '22:00:00', documentId: 'dojo', maxSlots: 1, name: 'Dojo municipal', openingTime: '08:00:00', type: 'Dojo',
});
/** @type {any[]} */
const arbresMontes = [];
const rendre = () => {
  /** @type {any} */
  let arbre;
  act(() => { arbre = renderer.create(<FacilityList />); });
  arbresMontes.push(arbre);
  return arbre;
};
const aplatir = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
  return String(enfants);
};
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text).map((n) => aplatir(n.props.children).trim());
// Les boutons sont doubles (`ButtonMock`) : on vise la doublure elle-meme, une fois par bouton.
const appuyer = (/** @type {any} */ arbre, /** @type {string} */ libelle, rang = 0) => {
  const cibles = arbre.root.findAll((/** @type {any} */ n) => n.type?.name === 'ButtonMock' && n.props.title === libelle);
  act(() => { cibles[rang].props.onPress(); });
};
const avecInstallations = (/** @type {any[]} */ installations) => {
  mockFacilityContext = {
    data: { allFacilities: installations, cmId: null }, error: null, isLoading: false, isRefetching: false, refetch: jest.fn(),
  };
};

const SEANCE = {
  date: '2026-10-06', documentId: 'ev-1', endTime: '19:00', facility: { documentId: 'gym-tilleuls', name: 'Gymnase des Tilleuls' }, startTime: '17:30', team: { documentId: 'team-U15', name: 'U15' },
};
const avecSeances = (/** @type {any[]} */ seances, canManage = true) => {
  avecInstallations([SALLE, GYMNASE, DOJO]);
  mockFacilityContext.data = { ...mockFacilityContext.data, canManageClubSlots: canManage, pendingClubSessions: seances };
};

beforeEach(() => {
  mockNavigate.mockClear();
  mockDecider.mockReset();
  mockDecider.mockResolvedValue({ data: { status: 'confirmed' } });
  mockOptionsDuContexte.length = 0;
  mockRoute = { params: { clubId: 'as-montrivage' } };
  avecSeances([SEANCE]);
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => {
  act(() => { arbresMontes.splice(0).forEach((arbre) => arbre.unmount()); });
  /** @type {any} */ (Alert.alert).mockRestore?.();
});

describe('COLL-C2C — D32 : les séances qui attendent le dirigeant', () => {
  it('le dirigeant lit chaque séance, son installation, et ses deux gestes', () => {
    const lus = textes(rendre());
    expect(lus).toContain('Séances à valider (1)');
    expect(lus).toContain('Tes créneaux sont déjà pleins à ces heures : accepte ou refuse.');
    expect(lus).toContain('U15 · mar. 6 oct. 17:30 – 19:00');
    expect(lus).toContain('Gymnase des Tilleuls');
    expect(lus).toContain('Accepter');
    expect(lus).toContain('Refuser');
    // Le bloc passe AVANT les groupes : c est ce qui attend une réponse.
    expect(lus.indexOf('Séances à valider (1)')).toBeLessThan(lus.indexOf('Au club (1)'));
  });

  it('« Accepter » envoie la décision, puis la page se relit', async () => {
    const arbre = rendre();
    await act(async () => { appuyer(arbre, 'Accepter'); });
    expect(mockDecider).toHaveBeenCalledWith('ev-1', 'approve');
    expect(mockFacilityContext.refetch).toHaveBeenCalled();
  });

  it('« Refuser » demande confirmation, puis envoie la décision', async () => {
    const arbre = rendre();
    act(() => { appuyer(arbre, 'Refuser'); });
    expect(mockDecider).not.toHaveBeenCalled();
    const [titre, texte, boutons] = /** @type {any} */ (Alert.alert).mock.calls[0];
    expect(titre).toBe('Refuser la séance ?');
    expect(texte).toBe('Elle est annulée, et son entraîneur est prévenu.');
    const confirmer = boutons.find((/** @type {any} */ bouton) => bouton.style === 'destructive');
    await act(async () => { await confirmer.onPress(); });
    expect(mockDecider).toHaveBeenCalledWith('ev-1', 'refuse');
  });

  it('un membre qui ne dirige pas le club ne voit rien ; aucune séance, aucun bloc', () => {
    avecSeances([SEANCE], false);
    expect(textes(rendre()).some((texte) => texte.startsWith('Séances à valider'))).toBe(false);
    avecSeances([]);
    expect(textes(rendre()).some((texte) => texte.startsWith('Séances à valider'))).toBe(false);
  });

  it('le mode Ville (C2B) ne montre jamais ce bloc', () => {
    mockRoute = { params: { collectiviteId: 'ville-montrivage' } };
    expect(textes(rendre()).some((texte) => texte.startsWith('Séances à valider'))).toBe(false);
  });
});

jest.mock(
  '@/components/atoms/skeletonLoader/SkeletonLoader',
  () => function SkeletonMock({ children }) { return children; },
);
jest.mock('@/context/AppFeedbackContext', () => ({
  useAppFeedback: () => ({ showBanner: jest.fn() }),
}));

// R17-PLANNING (20/10) : la section « Planning de toutes les installations » a son propre témoin
// (PlanningDesInstallations.R17PLAN.test.js) ; ici elle est doublée.
jest.mock(
  '@/components/organisms/planning/PlanningDesInstallations',
  () => function PlanningDesInstallationsDouble() { return null; },
);
