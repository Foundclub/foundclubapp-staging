/* eslint-disable max-len -- donnees de test : les fixtures se lisent mieux sur une ligne */
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import FacilityList from '../FacilityList';

// 🏟️ COLL-C2C (02/10) — « TES INSTALLATIONS », CÔTÉ CLUB, EN 3 GROUPES (planche P8v2-installations-tel,
// décision D32). Le VRAI i18next (fr.js) écrit les phrases.
//
// Ce que ce témoin exige (ROUGE avant le lot) :
//   - dès qu il y a une installation de la Ville : « Au club », « Tes créneaux de la Ville » (créneau
//     par créneau : « U15 · chaque mardi 17:30 – 19:00 ») et « À demander à la Ville », dans cet ordre,
//     chacun avec son nombre et UNE ligne qui dit ce qu on y fait ;
//   - « Prêtées par la Ville » et la phrase répétée sur chaque carte disparaissent ; la Ville est
//     nommée UNE fois ;
//   - un groupe 2 vide se cache ; un groupe 1 vide garde sa ligne et « Ajouter » ;
//   - « Demander » ouvre l écran du lot C3B (`ClubSlotRequest`), l installation déjà choisie ;
//   - sans installation de la Ville, l écran d avant ; le mode Ville (C2B) ne bouge pas.

/** @type {any} */
let mockRoute;
/** @type {any} */
let mockFacilityContext;
/** @type {any[]} */
const mockOptionsDuContexte = [];
const mockNavigate = jest.fn();

// R17-SIGNALER-1 : la carte et l accueil lisent le resume des signalements (doublure, pas de reseau).
jest.mock('@/services/facilityReport/facilityReportQueries', () => ({
  useCollectiviteFacilityReportsSummary: () => ({ data: null }),
}));
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
// COLL-C4B-BIS (03/10) : la carte d une installation de la Ville lit sa fermeture (bandeau).
jest.mock('@/services/facilityClosure/facilityClosureQueries', () => ({
  useFacilityClosures: () => ({ data: null }),
}));
jest.mock('@/services/facility/facilityService', () => ({
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
const STADE = deLaVille({
  documentId: 'stade', maxSlots: 2, name: 'Stade municipal', type: 'Terrain',
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

beforeEach(() => {
  mockNavigate.mockClear();
  mockOptionsDuContexte.length = 0;
  mockRoute = { params: { clubId: 'as-montrivage' } };
  avecInstallations([SALLE, GYMNASE, DOJO, STADE]);
});
afterEach(() => {
  act(() => { arbresMontes.splice(0).forEach((arbre) => arbre.unmount()); });
});

describe('COLL-C2C — Tes installations en 3 groupes', () => {
  it('l écran demande les installations de la Ville ET les créneaux du club', () => {
    rendre();
    expect(mockOptionsDuContexte.at(-1)).toMatchObject({ includeClubSlots: true, includeCollectivite: true });
  });

  it('3 groupes, dans l ordre où le dirigeant s en sert, chacun avec son nombre et sa ligne', () => {
    const lus = textes(rendre());
    expect(lus).toContain('1 au club · 1 avec tes créneaux de la Ville · 2 à demander');
    const ordre = ['Au club (1)', 'Salle annexe', 'Tes créneaux de la Ville (1)', 'Gymnase des Tilleuls', 'À demander à la Ville (2)', 'Dojo municipal', 'Stade municipal']
      .map((texte) => lus.indexOf(texte));
    expect(ordre.every((rang) => rang >= 0)).toBe(true);
    expect([...ordre].sort((a, b) => a - b)).toEqual(ordre);
    expect(lus).toContain('À ton club : tu gères son planning.');
    expect(lus).toContain('La Ville de Montrivage t’a attribué ces créneaux pour la saison.');
    expect(lus).toContain('Ton club n’y a pas de créneau : regarde les heures libres et demande.');
  });

  it('les créneaux du club, créneau par créneau ; « Tout le club » quand aucune équipe n est nommée', () => {
    const lus = textes(rendre());
    expect(lus).toContain('U15 · chaque mardi 17:30 – 19:00');
    expect(lus).toContain('U15 · chaque jeudi 18:00 – 19:30');
    avecInstallations([deLaVille({ ...GYMNASE, clubSeasonSlots: [creneau('s3', 6, '10:00', '12:00', null)] })]);
    expect(textes(rendre())).toContain('Tout le club · chaque samedi 10:00 – 12:00');
  });

  // 🎨 COLL-FIX2 (03/10), planche 42 (tournée T10, T10_C42_1) : un créneau RÉPARTI se lisait en
  // deux lignes identiques (« Tout le club · chaque mercredi » et « U15 · chaque mercredi »).
  // La période s'écrit quand le créneau ne couvre pas toute la saison ; pas sinon.
  it('un créneau sur une partie de la saison dit sa période ; toute la saison, rien de plus', () => {
    avecInstallations([deLaVille({
      ...GYMNASE,
      clubSeasonSlots: [
        { ...creneau('s4', 3, '18:00', '19:30', null), validFrom: '2026-09-01', validUntil: '2026-10-06' },
        { ...creneau('s5', 3, '18:00', '19:30'), validFrom: '2026-10-07', validUntil: '2027-06-30' },
        { ...creneau('s6', 2, '17:30', '19:00'), validFrom: '2026-09-01', validUntil: '2027-06-30' },
      ],
    })]);
    const lus = textes(rendre());
    expect(lus).toContain('Tout le club · chaque mercredi 18:00 – 19:30 · 1 sept. – 6 oct.');
    expect(lus).toContain('U15 · chaque mercredi 18:00 – 19:30 · 7 oct. – 30 juin');
    expect(lus).toContain('U15 · chaque mardi 17:30 – 19:00');
  });

  it('la carte dit ce qu est l installation : adresse pour le groupe 2, horaires pour le groupe 3', () => {
    const lus = textes(rendre());
    expect(lus).toContain('Gymnase · 2 équipes à la fois · 12 rue des Tilleuls');
    expect(lus).toContain('Dojo · 1 équipe à la fois · 08:00 – 22:00');
  });

  it('« Prêtées par la Ville » et la phrase répétée disparaissent : la Ville est nommée UNE fois', () => {
    const lus = textes(rendre());
    const tout = lus.join(' | ');
    expect(tout).not.toMatch(/Prêtées/);
    expect(tout).not.toMatch(/planning en lecture seule/);
    expect(tout.match(/Ville de Montrivage/g)).toHaveLength(1);
  });

  it('un groupe 2 vide se cache ; un groupe 1 vide garde sa ligne et « Ajouter »', () => {
    avecInstallations([DOJO]);
    const lus = textes(rendre());
    expect(lus).not.toContain('Tes créneaux de la Ville');
    expect(lus.some((texte) => texte.startsWith('Tes créneaux de la Ville'))).toBe(false);
    expect(lus).toContain('Au club');
    expect(lus).toContain('Aucune installation à ton club pour l’instant.');
    expect(lus).toContain('+ Ajouter une installation');
    expect(lus).toContain('La Ville de Montrivage : ton club n’y a pas de créneau. Regarde les heures libres et demande.');
    expect(lus).toContain('0 au club · 1 à demander');
  });

  it('« Voir le planning » ouvre le planning de la semaine de l installation de la Ville', () => {
    // Le 1er « Voir le planning » est celui de la salle du club (groupe 1) ; le 2e, celui du gymnase.
    appuyer(rendre(), 'Voir le planning', 1);
    expect(mockNavigate).toHaveBeenCalledWith('PlanningWeekFullscreen', expect.objectContaining({
      facilityId: 'gym-tilleuls', sourceType: 'facility',
    }));
  });

  // COLL-C2C (02/10) — l écran de C3B est récolté (staging 34d22001) : le point d accroche y mène.
  it('« Demander » ouvre l écran du lot C3B, l installation déjà choisie', () => {
    const arbre = rendre();
    // FINITIONS-VILLE (T20 K01) : UN seul libellé pour le même geste (plus « Demander une heure »).
    expect(textes(arbre)).not.toContain('Demander une heure');
    appuyer(arbre, 'Demander un créneau', 0);
    appuyer(arbre, 'Demander un créneau', 1);
    expect(mockNavigate.mock.calls).toEqual([
      ['ClubSlotRequest', { clubId: 'as-montrivage', facilityId: 'gym-tilleuls' }],
      ['ClubSlotRequest', { clubId: 'as-montrivage', facilityId: 'dojo' }],
    ]);
    const { ROUTE_DEMANDE_A_LA_VILLE } = jest.requireActual('@/domains/seasonSlot/clubInstallations');
    expect(ROUTE_DEMANDE_A_LA_VILLE).toBe('ClubSlotRequest');
  });

  it('sans installation de la Ville : l écran d avant, sans groupes', () => {
    avecInstallations([SALLE]);
    const lus = textes(rendre());
    expect(lus).toContain('1 installation');
    expect(lus).not.toContain('Au club (1)');
  });

  it('le mode Ville (C2B) ne bouge pas : aucun groupe du club', () => {
    mockRoute = { params: { collectiviteId: 'ville-montrivage' } };
    const lus = textes(rendre());
    expect(lus.some((texte) => /^(Au club|Tes créneaux de la Ville|À demander à la Ville)/.test(texte))).toBe(false);
  });
});

// 🚪 FINITIONS12-COLL (03/10) — point 4 : « TES DEMANDES À LA VILLE » N'AVAIT QU'UNE PORTE, l'accusé
// d'envoi (tournée T11). Une porte PERMANENTE, là où le club demande à la Ville : « Tes
// installations », que le dirigeant ouvre par Gérer mon club › Installations et l'entraîneur par
// la page de son équipe › Installations. ROUGE avant le lot.
describe('FINITIONS12-COLL point 4 — la porte permanente vers « Tes demandes à la Ville »', () => {
  const lien = (/** @type {any} */ arbre) => arbre.root.findAll((/** @type {any} */ n) => (
    n.props?.testID === 'facility-list-tes-demandes' && typeof n.props?.onPress === 'function'
  ));

  it('un club rattaché à une Ville : « Tes demandes à la Ville » ouvre ses demandes', () => {
    const arbre = rendre();
    expect(textes(arbre)).toContain('Tes demandes à la Ville');
    act(() => { lien(arbre)[0].props.onPress(); });
    expect(mockNavigate).toHaveBeenCalledWith('ClubSlotRequests', { clubId: 'as-montrivage' });
  });

  it('sans installation de la Ville, ou en mode Ville : pas de porte', () => {
    avecInstallations([SALLE]);
    expect(lien(rendre())).toHaveLength(0);
    avecInstallations([SALLE, GYMNASE, DOJO, STADE]);
    mockRoute = { params: { collectiviteId: 'ville-montrivage' } };
    expect(lien(rendre())).toHaveLength(0);
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
