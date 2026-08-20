import { QueryClient } from '@tanstack/react-query';
import { Alert, View } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { publishEventConvocation, saveEventCompositionDraft } from '@/services/event/eventService';

import MatchCompositionBoard from '../MatchCompositionBoard';

/**
 * AB03 — LE TEMPS ENTRE « JE PUBLIE MA COMPO » ET « JE LA VOIS ».
 *
 * Constat d Adel du 2026-08-20 (point 15) : « il y a un gros probleme de temps
 * de chargement entre le moment ou on cree les choses et le moment ou elles
 * s affichent. »
 *
 * 📏 CE QUI A ETE MESURE, sur les sept creations de l app — le detail chiffre
 * est dans le message de commit. La pire est CELLE-CI, et pour deux raisons qui
 * s additionnent :
 *
 *  1️⃣ L APP ATTEND. `handlePublish` enchainait TROIS allers-retours en file
 *     indienne avant d afficher quoi que ce soit : enregistrer la compo,
 *     publier la convocation, puis `startTeamChat` — une recherche du fil de
 *     l equipe dont le resultat ne sert QUE si l utilisateur appuie sur « OK ».
 *     Le troisieme etait donc paye par tout le monde, y compris par ceux qui
 *     ferment l alerte.
 *
 *  2️⃣ L APP NE SAIT PAS. Le dossier `matchCallUp/` — le chemin qu emprunte une
 *     composition de MATCH — ne contenait AUCUNE invalidation de cache : zero
 *     occurrence de `queryClient` sur ses onze fichiers. Or `EventDetails`
 *     monte `useGetEventConvocation` et `useGetEventTeamComposition` avec
 *     `refetchOnMount: false`, et son rafraichissement au retour de focus se
 *     desarme tout seul quand la donnee a moins de 30 s (`EVENT_DETAILS_STALE_MS`,
 *     EventDetails.js:117, 4719). Un coach qui ouvre son match, publie sa compo
 *     et revient — l affaire de quelques secondes — retombait donc sur l ANCIEN
 *     ecran, sans sa composition, jusqu a ce que les 30 s soient passees.
 *
 * 🔁 LA CORRECTION REUTILISE CE QUI EXISTE : `AFTER_ACTION_CACHES.publishComposition`
 * etait declare dans `domains/refresh/afterAction.js` depuis le lot T08 et
 * n etait appele par PERSONNE. Aucune racine neuve n a ete inventee ici.
 */

const mockNavigate = jest.fn();
const mockPopTo = jest.fn();
const mockGoBack = jest.fn();
const mockStartTeamChat = jest.fn();
/** @type {any} */
let mockRouteParams = {};
/** @type {any} */
let mockAlert;
/** @type {any} */
let mockClientDeTest = null;

const mockNavigation = {
  goBack: mockGoBack,
  navigate: mockNavigate,
  popTo: mockPopTo,
};

jest.mock('@tanstack/react-query', () => {
  const reel = jest.requireActual('@tanstack/react-query');
  return { ...reel, useQueryClient: () => mockClientDeTest };
});

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: mockRouteParams }),
}));

jest.mock('react-i18next', () => ({
  initReactI18next: { init: () => {}, type: '3rdParty' },
  useTranslation: () => ({
    t: (/** @type {string} */ cle) => cle,
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));

jest.mock('react-native-gesture-handler', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  const fabriquerGeste = () => {
    /** @type {any} */
    const geste = { rappels: {} };
    ['activateAfterLongPress', 'minDistance'].forEach((nom) => {
      geste[nom] = () => geste;
    });
    ['onStart', 'onUpdate', 'onEnd', 'onFinalize'].forEach((nom) => {
      geste[nom] = (/** @type {any} */ fn) => { geste.rappels[nom] = fn; return geste; };
    });
    return geste;
  };

  return {
    Gesture: { Pan: fabriquerGeste },
    GestureDetector: (/** @type {any} */ { children, gesture }) => (
      <VueRN gesture={gesture}>{children}</VueRN>
    ),
    GestureHandlerRootView: VueRN,
  };
});

jest.mock('react-native-reanimated', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: { View: VueRN },
    runOnJS: (/** @type {any} */ fn) => fn,
    useAnimatedStyle: () => ({}),
    useSharedValue: (/** @type {any} */ valeur) => ({ value: valeur }),
    withSpring: (/** @type {any} */ valeur) => valeur,
    withTiming: (/** @type {any} */ valeur) => valeur,
  };
});

jest.mock('@/services/event/eventService', () => ({
  publishEventConvocation: jest.fn(),
  saveEventCompositionDraft: jest.fn(),
}));

jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({ startTeamChat: mockStartTeamChat }),
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
      Images: { arrowLeft: 1, chevronLeft: 1 },
      Spaces: espaces,
    }),
  };
});

jest.mock('@/components/templates/ScreenContainer', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => <VueRN>{children}</VueRN>,
  };
});

jest.mock('@/components/atoms/headerBackButton/HeaderBackButton', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return { __esModule: true, default: () => <TexteRN>RETOUR</TexteRN> };
});

jest.mock('@/components/tactical/RenderedTacticalField', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => <VueRN>{children}</VueRN>,
  };
});

jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children, footerComponent, isVisible }) => (
      isVisible ? (
        <VueRN>
          {children}
          {footerComponent}
        </VueRN>
      ) : null
    ),
  };
});

jest.mock('@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { isVisible }) => (
      isVisible ? <TexteRN>FEUILLE_OFFRE</TexteRN> : null
    ),
  };
});

jest.mock('@/components/tactical/DraggableToken', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { player }) => <TexteRN>{`JETON:${player?.lastname}`}</TexteRN>,
    GHOST_TOKEN_SIZE: jest.requireActual('@/components/tactical/DraggableToken').GHOST_TOKEN_SIZE,
  };
});

jest.mock('@/components/atoms/button/Button', () => {
  const { Text: TexteRN, TouchableOpacity } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { onPress, title }) => (
      <TouchableOpacity onPress={onPress}>
        <TexteRN>{title}</TexteRN>
      </TouchableOpacity>
    ),
  };
});

/** Le temps qu une relecture met a revenir, une fois marquee perimee. */
const LATENCE_RELECTURE_MS = 40;

/**
 * Les cinq racines que `publishComposition` perime, posees comme requetes
 * ACTIVES et LENTES : c est ce que l ecran paierait s il les attendait.
 *
 * ⚠️ Le motif est celui du lot Y04 (`RequestsHub.acceptation.test.js`), repris
 * tel quel : la MEME `queryFn` dans `fetchQuery` et dans l observateur, parce
 * que `refetchQueries` lit `query.options.queryFn` — celles du DERNIER
 * observateur pose. Et un observateur minimal plutot qu un vrai `QueryObserver`,
 * qui ecraserait ces options et declencherait des lectures parasites.
 * @param {any} client Le cache de test.
 * @returns {Promise<any>} Le compteur des relectures reellement parties.
 */
const poserDesRelecturesLentes = async (client) => {
  const racines = [
    ['event'], ['events'], ['eventComposition'], ['eventConvocation'], ['home-summary'],
  ];
  const lectures = jest.fn();

  const optionsDe = (/** @type {string[]} */ queryKey) => ({
    queryFn: () => new Promise((resolve) => {
      lectures(String(queryKey[0]));
      setTimeout(() => resolve({ valeur: 'lue' }), LATENCE_RELECTURE_MS);
    }),
    queryKey,
  });

  await Promise.all(racines.map((queryKey) => client.fetchQuery(optionsDe(queryKey))));

  racines.forEach((queryKey) => {
    client.getQueryCache().find({ queryKey })?.addObserver(/** @type {any} */ ({
      onQueryUpdate: () => {},
      options: { enabled: true },
      shouldFetchOnReconnect: () => false,
      shouldFetchOnWindowFocus: () => false,
    }));
  });

  lectures.mockClear();
  return lectures;
};

/**
 * Aplati les enfants React en une chaine.
 * @param {any} enfants Le noeud de depart.
 * @returns {string} Le texte concatene.
 */
const aplatirTexte = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};

/** @type {any[]} */
const arbresMontes = [];

const joueur = (/** @type {string} */ id, /** @type {string} */ nom) => ({
  documentId: id,
  firstname: `Prenom${id}`,
  lastname: nom,
});
const ONZE = Array.from({ length: 11 }, (_, i) => joueur(`p${i}`, `Nom${i}`));
const placementsDeDepart = ONZE.map((player, index) => ({
  playerId: player.documentId,
  positionX: 50,
  positionY: 10 + index,
  slotId: `team_1:slot_${index + 1}`,
}));

/**
 * Monte l ecran de composition.
 * @returns {Promise<any>} L arbre rendu.
 */
const rendre = async () => {
  mockRouteParams = {
    eventId: 'evt_1',
    selectedPlayers: ONZE,
    sport: 'football',
    startPlacements: placementsDeDepart,
    teamId: 'team_1',
    teamName: 'Senior 1',
  };
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<MatchCompositionBoard />);
  });
  arbresMontes.push(arbre);
  return arbre;
};

/**
 * Appuie sur l element le plus profond dont le texte contient ce libelle.
 * @param {any} arbre L arbre rendu.
 * @param {string} libelle Le texte cherche.
 * @returns {Promise<number>} Le temps rendu a l utilisateur, en millisecondes.
 */
const appuyerSur = async (arbre, libelle) => {
  const cible = arbre.root
    .findAll((/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function'
      && aplatirTexte(noeud.props.children).includes(libelle))
    .pop();
  expect(cible).toBeDefined();
  const debut = Date.now();
  await act(async () => { await cible.props.onPress(); });
  return Date.now() - debut;
};

/**
 * Ouvre la feuille et appuie sur « Publier ».
 * @param {any} arbre L arbre rendu.
 * @returns {Promise<number>} Le temps entre l appui et le retour de la main.
 */
const publier = async (arbre) => {
  await appuyerSur(arbre, 'matchComposition.board.actions.publish');
  return appuyerSur(arbre, 'matchComposition.sheet.actions.publish');
};

/** @type {any} */
let mesureOrigine;

beforeEach(() => {
  jest.clearAllMocks();
  mockClientDeTest = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  /** @type {any} */ (saveEventCompositionDraft).mockResolvedValue({});
  /** @type {any} */ (publishEventConvocation).mockResolvedValue({});
  // 🎯 CE DOUBLE-CI PORTE LA MESURE. `startTeamChat` est un ALLER-RETOUR reel
  // (`loadChatsForLookup`, puis la creation du fil s il manque) : le rendre
  // instantane rendrait le temoin de vitesse vert sur du code lent. On lui donne
  // donc la meme latence simulee qu a une relecture.
  mockStartTeamChat.mockImplementation(() => new Promise((resolve) => {
    setTimeout(() => resolve({ documentId: 'chat_1' }), LATENCE_RELECTURE_MS);
  }));
  mockAlert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

  mesureOrigine = View.prototype.measureInWindow;
  View.prototype.measureInWindow = function mesurerTerrain(/** @type {any} */ rappel) {
    rappel(0, 0, 300, 450);
  };
});

afterEach(async () => {
  await act(async () => {
    arbresMontes.splice(0).forEach((arbre) => arbre.unmount());
  });
  mockAlert.mockRestore();
  mockClientDeTest.clear();
  View.prototype.measureInWindow = mesureOrigine;
});

describe('AB03 — publier une composition de match : la vitesse, et ce qui se relit', () => {
  // 1️⃣ LE TEMOIN PRINCIPAL. Il ne mesure pas « c est rapide », il mesure « la
  // main revient AVANT que les relectures soient revenues ». C est la seule
  // formulation qui reste vraie sur un reseau lent.
  it('🥇 temoin de vitesse — la main revient sans attendre le fil ni les relectures', async () => {
    await poserDesRelecturesLentes(mockClientDeTest);
    const arbre = await rendre();

    const attente = await publier(arbre);

    // Les DEUX POST sont incompressibles — publier ce qui n a pas ete
    // enregistre publierait l etat precedent. Tout le reste est evitable :
    // la recherche du fil ne sert QUE si l utilisateur appuie sur « OK », et
    // les relectures se terminent tres bien apres que l ecran a disparu.
    // 📏 MESURE, ROUGE puis VERT, avec 40 ms de latence simulee.
    //    La borne est LARGE expres — ce temoin mesure un ORDRE DE GRANDEUR,
    //    pas la vitesse de la machine qui l execute.
    expect(attente).toBeLessThan(LATENCE_RELECTURE_MS);
    expect(mockAlert).toHaveBeenCalled();
  });

  // 1️⃣ bis — ET LE FIL EST QUAND MEME CHERCHE. Sans ce temoin, il suffirait de
  // SUPPRIMER `startTeamChat` pour rendre le temoin ci-dessus vert : le coach
  // perdrait alors l atterrissage sur le fil de son equipe.
  it('🔒 le fil de l equipe est cherche quand meme, et « OK » y emmene toujours', async () => {
    const arbre = await rendre();

    await publier(arbre);
    expect(mockStartTeamChat).toHaveBeenCalledWith('team_1');

    const TITRE_REUSSITE = 'matchComposition.board.alerts.published.title';
    const [, , boutons] = mockAlert.mock.calls
      .find((/** @type {any[]} */ appel) => appel[0] === TITRE_REUSSITE);
    await act(async () => { await boutons[0].onPress(); });
    // ⚠️ Le fil n'est plus attendu AVANT l'alerte : il arrive maintenant pendant
    // que l'utilisateur lit. On laisse donc la latence simulee s'ecouler — c'est
    // exactement ce que ce temoin doit prouver : l'atterrissage se fait toujours,
    // simplement il ne retient plus personne.
    await act(async () => {
      await new Promise((resolve) => { setTimeout(resolve, LATENCE_RELECTURE_MS * 2); });
    });

    expect(mockPopTo).toHaveBeenCalledWith('EventDetails', { eventId: 'evt_1' });
    expect(mockNavigate).toHaveBeenCalledWith('Conversation', { chatId: 'chat_1' });
  });

  // 2️⃣ La compo publiee apparait sans que l utilisateur ait a faire un geste :
  // les caches que lit `EventDetails` sont marques perimes, donc relus.
  it('la compo publiee se relit seule : « event » et « eventConvocation » perimes', async () => {
    const lectures = await poserDesRelecturesLentes(mockClientDeTest);
    const arbre = await rendre();

    await publier(arbre);
    await act(async () => { await Promise.resolve(); });

    const racinesRelues = lectures.mock.calls.map(([racine]) => racine);
    expect(racinesRelues).toContain('event');
    expect(racinesRelues).toContain('eventConvocation');
    expect(racinesRelues).toContain('eventComposition');
  });

  // 3️⃣ 🔒 LE GARDE-FOU. Rendre la main plus vite ne doit pas rendre la main sur
  // un echec : une publication refusee n affiche AUCUNE reussite, et ne perime
  // RIEN — perimer apres un echec ferait clignoter l ecran pour rien.
  it('🔒 une publication qui ECHOUE n annonce aucune reussite et ne perime rien', async () => {
    const lectures = await poserDesRelecturesLentes(mockClientDeTest);
    /** @type {any} */ (publishEventConvocation).mockRejectedValue(new Error('refus serveur'));
    const arbre = await rendre();

    await publier(arbre);
    await act(async () => { await Promise.resolve(); });

    const titres = mockAlert.mock.calls.map((/** @type {any[]} */ appel) => appel[0]);
    expect(titres).toContain('matchComposition.board.alerts.error.title');
    expect(titres).not.toContain('matchComposition.board.alerts.published.title');
    expect(lectures).not.toHaveBeenCalled();
    expect(mockPopTo).not.toHaveBeenCalled();
  });

  // 4️⃣ 🔒 LA CONTREPARTIE DU TEMOIN 1, et sans elle il suffirait de SUPPRIMER
  // l invalidation pour rendre le temoin de vitesse vert. Les cinq racines
  // declarees par `publishComposition` partent bel et bien.
  it('🔒 les 5 relectures partent quand meme : ne pas attendre n est pas ne pas faire', async () => {
    const lectures = await poserDesRelecturesLentes(mockClientDeTest);
    const arbre = await rendre();

    await publier(arbre);
    await act(async () => { await Promise.resolve(); });

    expect([...new Set(lectures.mock.calls.map(([racine]) => racine))].sort()).toEqual([
      'event', 'eventComposition', 'eventConvocation', 'events', 'home-summary',
    ]);
  });

  // 5️⃣ LE TEMOIN QUI CONTROLE LE TEMOIN. Sans lui, le temoin 1 pourrait etre
  // vert parce que la latence simulee ne coute rien — et ne prouverait alors
  // strictement rien. Ici on ATTEND les memes relectures, sur le meme cache :
  // l attente doit depasser une latence complete.
  it('le temoin mesure bien ce qu il pretend : attendre ces relectures coute cher', async () => {
    await poserDesRelecturesLentes(mockClientDeTest);

    const debut = Date.now();
    await act(async () => {
      await Promise.all([
        ['event'], ['events'], ['eventComposition'], ['eventConvocation'], ['home-summary'],
      ].map((queryKey) => mockClientDeTest.invalidateQueries({ queryKey })));
    });

    expect(Date.now() - debut).toBeGreaterThanOrEqual(LATENCE_RELECTURE_MS);
  });
});
