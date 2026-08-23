import { QueryClient } from '@tanstack/react-query';
import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import { EventWizardProvider, useEventWizard } from '../EventWizardContext';
import EventWizardTeam from '../EventWizardTeam';

// Q2 — LE PRECHARGEMENT DE L'EFFECTIF, AU TOUCHER DE L'EQUIPE (D3 + D4).
//
// 🎯 LE RETARD MESURE. L'equipe est deposee dans le tunnel des l'etape 2
// (`EventWizardTeam.js`, `SET_TEAM`), mais le GET /teams/:id qui rapporte son
// EFFECTIF ne partait qu'au montage de l'etape 6 (`EventWizardParticipants`,
// `useGetTeam`) — TROIS ecrans de saisie plus tard. Ce GET est lourd
// (`teamService.js:309-352` : 8 relations, `players.populate: '*'`, validation
// Joi), et l'organisateur le payait entierement en attente, devant la liste
// qu'il venait ouvrir.
//
// 🧊 CE QUE CE TEMOIN REGARDE, ET POURQUOI IL NE SE CONTENTE PAS D'UN ESPION.
// Un espion sur `prefetchQuery` prouverait qu'on a APPELE quelque chose. Ce qui
// compte est ailleurs : que l'etape 6 RETROUVE la reponse. Le temoin monte donc
// un VRAI `QueryClient` et lit son cache apres le toucher. Si la cle de
// prechargement s'ecartait d'un caractere de celle de `useGetTeam`
// (`teamQueries.js:43` : `['team', teamId]`), le cache serait peuple, l'espion
// serait vert, et l'etape 6 repartirait quand meme chercher l'effectif.
//
// 🔒 LE GARDE-FOU DU LOT est le temoin ② (D4) : hors match, on ne precharge
// RIEN. `shouldOfferMatchCallUp` (`eventWizardDetectionUtils.js:140-144`) coupe
// la convocation pour tous les autres types — leur faire payer un GET lourd que
// personne ne lira serait une depense pure.

/** Le vrai cache react-query du tunnel : c'est LUI que l'etape 6 relira. */
const mockCacheDuTunnel = { /** @type {any} */ client: null };

/** Les identifiants pour lesquels le serveur a vraiment ete appele. */
const mockAppelsEffectif = [];

/** Les equipes servies a la place de l'appel reseau. */
const mockReseau = {
  equipes: [
    { club: { documentId: 'club-1', name: 'FC Test' }, documentId: 'eq-1', name: 'U15 A' },
    { club: { documentId: 'club-1', name: 'FC Test' }, documentId: 'eq-2', name: 'Seniors B' },
  ],
};

/** L'effectif complet, tel que `getTeamById` le rend. */
const EFFECTIF_COMPLET = {
  club: { documentId: 'club-1', name: 'FC Test' },
  documentId: 'eq-1',
  name: 'U15 A',
  players: [
    { documentId: 'j1', firstname: 'Karim', lastname: 'Benali' },
    { documentId: 'j2', firstname: 'Louis', lastname: 'Marchand' },
    { documentId: 'j3', firstname: 'Theo', lastname: 'Nguyen' },
  ],
};

// Le VRAI react-query — seul `useQueryClient` est detourne, pour rendre le
// cache du temoin la ou l'ecran attend celui de l'application. `prefetchQuery`
// reste donc la VRAIE implementation : ce qui atterrit dans le cache est ce qui
// y atterrirait en vrai.
jest.mock('@tanstack/react-query', () => {
  const reel = jest.requireActual('@tanstack/react-query');
  return { ...reel, useQueryClient: () => mockCacheDuTunnel.client };
});

jest.mock('react-i18next', () => ({
  initReactI18next: { init: () => {}, type: '3rdParty' },
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
      if (typeof repli === 'string') return repli;
      if (repli && typeof repli.defaultValue === 'string') return repli.defaultValue;
      return cle;
    },
  }),
}));

// Le VRAI theme, sans le contexte React qui le porte. ⛔ Jamais un Proxy.
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
      Images: { chevronDown: 1 },
      Spaces: espaces,
    }),
  };
});

jest.mock('@/components/molecules/wizardStepLayout/WizardStepLayout', () => function GabaritMock(
  /** @type {any} */ props,
) {
  return props.children;
});

jest.mock('@/domains/auth/useAuth', () => {
  const { USER_ROLES } = jest.requireActual('@/domains/auth/authUseCases');
  return {
    __esModule: true,
    default: () => ({
      USER_ROLES,
      userData: {
        club: { documentId: 'club-1', name: 'FC Test' },
        documentId: 'moi',
        role: { name: USER_ROLES.president, type: 'president' },
        trainedTeams: [{ club: { documentId: 'club-1' }, documentId: 'eq-1', name: 'U15 A' }],
      },
    }),
  };
});

// ⛔ Jamais `requireActual` sur un service : le client HTTP exige `API_URL` et
// la suite entiere meurt au chargement (0 test execute).
// C'est CETTE doublure que le prechargement doit appeler — et son compteur qui
// prouve qu'on ne l'appelle PAS hors match.
jest.mock('@/services/team/teamService', () => ({
  getTeamById: (/** @type {string} */ identifiant) => {
    mockAppelsEffectif.push(identifiant);
    return Promise.resolve({ ...EFFECTIF_COMPLET, documentId: identifiant });
  },
  getTeams: () => Promise.resolve([]),
}));

// `useGetTeams` est PAGINEE : rendre le tableau directement donne une liste
// VIDE sans la moindre erreur, et l'ecran n'afficherait aucune equipe a taper.
jest.mock('@/services/team/teamQueries', () => ({
  useGetTeams: () => ({
    data: { pages: [{ data: mockReseau.equipes }] },
    error: null,
    isLoading: false,
    refetch: () => {},
  }),
}));

jest.mock('@/services/activity/activityQueries', () => ({
  useGetActivities: () => ({ data: [], error: null, isLoading: false }),
}));
jest.mock('@/services/category/categoryQueries', () => ({
  useGetCategories: () => ({ data: [], error: null, isLoading: false }),
}));
jest.mock('@/services/section/sectionQueries', () => ({
  useGetSections: () => ({ data: [], error: null, isLoading: false }),
}));

jest.mock('@/components/molecules/autocompleteSelect/AutocompleteSelect', () => () => null);
jest.mock('@/components/molecules/input/Input', () => () => null);

jest.mock('@/components/atoms/button/Button', () => function BoutonMock(/** @type {any} */ props) {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return reactActuel.createElement(
    PressableRN,
    { accessibilityRole: 'button', disabled: Boolean(props.disabled), onPress: props.onPress },
    reactActuel.createElement(TexteRN, null, props.title),
  );
});

// La carte d'equipe rendue comme un pressable portant le nom de l'equipe : on
// appuie « sur le texte », pas sur une forme d'arbre.
jest.mock('@/views/event/wizard/components/EventWizardTeamCard', () => function CarteEquipeMock(
  /** @type {any} */ props,
) {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return reactActuel.createElement(
    PressableRN,
    { accessibilityRole: 'button', onPress: props.onPress },
    reactActuel.createElement(TexteRN, null, props.team?.name),
  );
});

/** Le dispatch du tunnel, capte pour semer le type d'evenement. */
let semer = () => {};

/**
 * Sonde sans rendu : elle expose le `dispatch` du tunnel.
 * @returns {null} Rien.
 */
function PriseDeCourant() {
  semer = useEventWizard().dispatch;
  return null;
}

/**
 * Tous les textes rendus sous ce noeud, dans l'ordre du rendu.
 * @param {any} instance Instance de test (ou racine).
 * @param {string[]} [recueil] Accumulateur.
 * @returns {string[]} Les textes trouves.
 */
const textesDe = (instance, recueil = []) => {
  const enfants = instance?.children || [];
  enfants.forEach((/** @type {any} */ enfant) => {
    if (typeof enfant === 'string' || typeof enfant === 'number') {
      recueil.push(String(enfant));
      return;
    }
    textesDe(enfant, recueil);
  });
  return recueil;
};

/** @type {any} */
let arbre;

/**
 * Monte l'etape « Equipe organisatrice » avec un type d'evenement seme.
 * @param {string} nomDuType Le nom du type d'evenement.
 * @returns {void} Rien.
 */
const monterEtapeEquipe = (nomDuType) => {
  const navigation = {
    canGoBack: () => true,
    goBack: () => {},
    navigate: () => {},
    push: () => {},
    replace: () => {},
    reset: () => {},
    setParams: () => {},
  };

  const element = createElement(
    EventWizardProvider,
    null,
    createElement(PriseDeCourant),
    createElement(EventWizardTeam, { navigation, route: { params: {} } }),
  );

  act(() => { arbre = renderer.create(element); });
  act(() => semer({ payload: { documentId: 't-1', name: nomDuType }, type: 'SET_TYPE' }));
};

/**
 * Tape l'equipe qui porte ce nom, comme Adel le ferait du doigt.
 * ⚠️ L'element natif ne porte PAS `onPress` — le pressable de React Native le
 * traduit en gestionnaires de « responder ». Le geste se declenche donc sur le
 * composite.
 * @param {string} nom Le nom affiche de l'equipe.
 * @returns {Promise<void>} Quand le cache a fini de se remplir.
 */
const taperLEquipe = async (nom) => {
  const cible = arbre.root.findAll(
    (/** @type {any} */ noeud) => typeof noeud.type !== 'string'
      && typeof noeud.props?.onPress === 'function',
    { deep: true },
  ).find((/** @type {any} */ noeud) => textesDe(noeud).includes(nom));
  if (!cible) throw new Error(`aucune carte d equipe ne porte le nom « ${nom} »`);

  // `prefetchQuery` est asynchrone : sans le `await`, on lirait le cache avant
  // que la reponse y soit posee, et le temoin serait rouge pour une mauvaise
  // raison.
  await act(async () => { cible.props.onPress(); });
};

beforeEach(() => {
  mockAppelsEffectif.length = 0;
  mockCacheDuTunnel.client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
});

afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
  mockCacheDuTunnel.client.clear();
});

describe("Q2 — le prechargement de l'effectif au toucher de l'equipe", () => {
  test('① tunnel MATCH : taper une equipe pose son effectif dans le cache', async () => {
    monterEtapeEquipe('Match');
    await taperLEquipe('U15 A');

    // LA cle : la MEME que celle de `useGetTeam` (`teamQueries.js:43`). C'est
    // elle, et elle seule, qui fait que l'etape 6 lira le cache au lieu de
    // repartir en reseau.
    const enCache = mockCacheDuTunnel.client.getQueryData(['team', 'eq-1']);

    expect(enCache).toBeDefined();
    expect(enCache.players).toHaveLength(3);
    expect(mockAppelsEffectif).toEqual(['eq-1']);
  });

  test('② tunnel ENTRAINEMENT : on ne precharge RIEN — le garde-fou du lot', async () => {
    monterEtapeEquipe('Entrainement');
    await taperLEquipe('U15 A');

    expect(mockAppelsEffectif).toEqual([]);
    expect(mockCacheDuTunnel.client.getQueryCache().getAll()).toHaveLength(0);
  });

  test('③ tunnel MATCH : taper une AUTRE equipe precharge la sienne, sans effacer', async () => {
    monterEtapeEquipe('Match');
    await taperLEquipe('U15 A');
    await taperLEquipe('Seniors B');

    // D5 — re-taper une equipe est inoffensif : deux cles differentes, deux
    // entrees de cache. Rien a nettoyer, `SET_TEAM` vidant deja la convocation.
    expect(mockCacheDuTunnel.client.getQueryData(['team', 'eq-1'])).toBeDefined();
    expect(mockCacheDuTunnel.client.getQueryData(['team', 'eq-2'])).toBeDefined();
    expect(mockAppelsEffectif).toEqual(['eq-1', 'eq-2']);
  });
});
