import { Text, View } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { publishEventConvocation, saveEventCompositionDraft } from '@/services/event/eventService';

import MatchCompositionBoard from '../MatchCompositionBoard';

jest.setTimeout(30000);

// ==========================================================================
// COMPOMODIF · M3 — LE MESSAGE ENVOYE APRES MODIFICATION DOIT PORTER LA COMPO
// D'APRES.
//
// 🗣️ Adel, 27/08 : « le message que ca envoie apres modif, c'est la compo
// D'AVANT la modif ».
//
// 🧭 CE QUI A ETE ECARTE PAR LA MESURE, ET COMMENT :
//   · le SERVEUR est hors de cause. `publishConvocation`
//     (`admin/src/api/event/services/event-composition.ts:2039`) relit le
//     brouillon qui vient d'etre ecrit, en fabrique `published`, et c'est CE
//     pack-la — jamais un cache — que le controleur passe a
//     `publishLineupShareToTeamChat` (`event.ts:3502`). Le message ne peut
//     donc porter que ce que l'app a envoye ;
//   · l'ORDRE des deux appels de l'app est bon : `saveEventCompositionDraft`
//     part AVANT `publishEventConvocation`.
//
// 🧨 CE QUI RESTE, ET C'EST LA CAUSE : le terrain de cet ecran est un
// `useState` amorce UNE SEULE FOIS par `startPlacements`. Or la porte
// « Modifier » de COMPOLECT-2 laisse ce plateau SOUS l'ecran de selection :
// « Suivant » y REVIENT en depilant — le composant n'est jamais remonte, son
// `useState` garde le terrain d'AVANT, et c'est lui qui part au serveur, donc
// dans le message de l'equipe.
// ==========================================================================

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockPopTo = jest.fn();
/** @type {any} */
let mockRouteParams = {};

const mockNavigation = { goBack: mockGoBack, navigate: mockNavigate, popTo: mockPopTo };

const mockClientRequeteFige = { invalidateQueries: jest.fn() };

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => mockClientRequeteFige,
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: mockRouteParams }),
}));

jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;
  return {
    initReactI18next: { init: () => {}, type: '3rdParty' },
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ options) => {
        const lire = (/** @type {string} */ chemin) => chemin.split('.').reduce(
          (/** @type {any} */ noeud, /** @type {string} */ segment) => (
            noeud && typeof noeud === 'object' ? noeud[segment] : undefined
          ),
          traductions,
        );
        const compte = options?.count;
        let valeur = lire(cle);
        if (typeof valeur !== 'string' && compte !== undefined) {
          valeur = lire(`${cle}${compte === 1 ? '_one' : '_other'}`);
        }
        if (typeof valeur !== 'string') return cle;
        return valeur.replace(/{{(\w+)}}/g, (_correspondance, nom) => (
          options && options[nom] !== undefined ? String(options[nom]) : ''
        ));
      },
    }),
  };
});

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

// `useMessaging` tire `useAuth`, donc le client HTTP, qui refuse de se charger
// sans `.env` — gitignore, donc absent de toute copie de travail.
jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({ startTeamChat: jest.fn().mockResolvedValue(null) }),
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
    default: (/** @type {any} */ { decision, isVisible }) => (
      isVisible ? <TexteRN>{`FEUILLE_OFFRE:${decision?.reason || ''}`}</TexteRN> : null
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

/**
 * Aplati les enfants React en une chaine, pour lire le texte rendu.
 * @param {any} enfants
 * @returns {string}
 */
const aplatirTexte = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};

/**
 * Tout le texte visible de l'arbre rendu, concatene.
 * @param {any} arbre
 * @returns {string}
 */
const texteVisible = (arbre) => arbre.root
  .findAllByType(Text)
  .map((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children))
  .join(' | ');

/**
 * Appuie sur l'element le plus profond dont le texte contient ce libelle.
 * @param {any} arbre
 * @param {string} libelle
 * @returns {Promise<void>}
 */
const appuyerSur = async (arbre, libelle) => {
  const cible = arbre.root
    .findAll((/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function'
      && aplatirTexte(noeud.props.children).includes(libelle))
    .pop();
  if (!cible) throw new Error(`Aucun bouton « ${libelle} ». Vu : ${texteVisible(arbre)}`);
  await act(async () => { await cible.props.onPress(); });
};

const joueur = (id, firstname, lastname) => ({ documentId: id, firstname, lastname });
const ONZE = Array.from({ length: 11 }, (_, i) => joueur(`p${i}`, `Prenom${i}`, `Nom${i}`));
const DOUZE = [...ONZE, joueur('p11', 'Douzieme', 'Remplacant')];

const TERRAIN_PUBLIE = ONZE.map((personne, index) => ({
  playerId: personne.documentId,
  positionX: 50,
  positionY: 10 + index,
  slotId: `team_1:slot_${index + 1}`,
}));

// Le terrain APRES modification : le titulaire `p10` a laisse sa place au
// remplacant `p11`. C'est la difference qu'Adel doit lire dans le message.
const TERRAIN_MODIFIE = [
  ...TERRAIN_PUBLIE.slice(0, 10),
  {
    playerId: 'p11', positionX: 50, positionY: 20, slotId: 'team_1:slot_11',
  },
];

/** @type {any[]} */
const arbresMontes = [];

/**
 * Les parametres de route du plateau, en consultation par defaut.
 * @param {any} [parametres]
 * @returns {any}
 */
const parametresPlateau = (parametres = {}) => ({
  canEdit: true,
  clubId: 'club_1',
  eventId: 'evt_1',
  eventLabel: 'Match contre Saint-Julien',
  existingComposition: { teams: [{ id: 'team_1', placements: TERRAIN_PUBLIE }] },
  readOnly: true,
  selectedPlayers: DOUZE,
  sport: 'football',
  startPlacements: TERRAIN_PUBLIE,
  teamId: 'team_1',
  teamName: 'Senior 1',
  ...parametres,
});

/**
 * Monte le plateau.
 * @param {any} [parametres]
 * @returns {Promise<any>}
 */
const rendre = async (parametres = {}) => {
  mockRouteParams = parametresPlateau(parametres);
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<MatchCompositionBoard />);
  });
  arbresMontes.push(arbre);
  return arbre;
};

/**
 * 🧨 LE GESTE QUI REPRODUIT LE DEFAUT : « Suivant » depuis la selection REVIENT
 * sur ce plateau en depilant. Le composant n'est PAS remonte — il recoit
 * seulement de nouveaux parametres de route. C'est exactement ce que fait ce
 * rendu-ci : meme arbre, parametres neufs.
 * @param {any} arbre
 * @param {any} parametres
 * @returns {Promise<void>}
 */
const revenirSurLePlateau = async (arbre, parametres) => {
  mockRouteParams = parametresPlateau(parametres);
  await act(async () => {
    arbre.update(<MatchCompositionBoard />);
  });
};

/**
 * Le pack reellement envoye au serveur au dernier enregistrement.
 * @returns {any}
 */
const packEnvoye = () => {
  const appel = [...saveEventCompositionDraft.mock.calls].pop();
  return appel?.[1]?.draft || null;
};

/** @type {any} */
let mesureOrigine;

beforeEach(() => {
  mockNavigate.mockClear();
  mockGoBack.mockClear();
  mockPopTo.mockClear();
  saveEventCompositionDraft.mockReset().mockResolvedValue({});
  publishEventConvocation.mockReset().mockResolvedValue({});

  mesureOrigine = View.prototype.measureInWindow;
  View.prototype.measureInWindow = function mesurerTerrain(/** @type {any} */ rappel) {
    rappel(0, 0, 300, 450);
  };
});

afterEach(async () => {
  await act(async () => {
    arbresMontes.splice(0).forEach((arbre) => arbre.unmount());
  });
  View.prototype.measureInWindow = mesureOrigine;
});

describe('COMPOMODIF · M3 — le message porte la compo D APRES', () => {
  // 🥇 LE TEMOIN QUI TRANCHE. Le coach lit sa compo publiee, appuie sur
  // « Modifier », remplace un titulaire, revient sur le plateau, publie.
  // Le pack envoye au serveur — le SEUL a partir duquel le message est
  // fabrique — doit porter le NOUVEAU terrain.
  test('🧨 apres un aller-retour par « Modifier », le terrain PUBLIE est le nouveau', async () => {
    const arbre = await rendre();

    await revenirSurLePlateau(arbre, {
      canEdit: true,
      readOnly: false,
      startPlacements: TERRAIN_MODIFIE,
    });

    await appuyerSur(arbre, 'Publier');
    await appuyerSur(arbre, 'Publier');

    const placesPubliees = (packEnvoye()?.teams?.[0]?.placements || [])
      .map((/** @type {any} */ place) => place.playerId);
    expect(placesPubliees).toContain('p11');
    expect(placesPubliees).not.toContain('p10');
  });

  test('🧨 le terrain AFFICHE suit lui aussi la modification', async () => {
    const arbre = await rendre();

    await revenirSurLePlateau(arbre, {
      canEdit: true,
      readOnly: false,
      startPlacements: TERRAIN_MODIFIE,
    });

    // Le remplacant est monte sur le terrain, le titulaire est descendu au banc.
    // Tout ce qui precede le bandeau « REMPLACANTS » est le terrain.
    const [terrain, banc] = texteVisible(arbre).split('REMPLA');
    expect(terrain).toContain('JETON:Remplacant');
    expect(terrain).not.toContain('JETON:Nom10');
    expect(banc).toContain('JETON:Nom10');
  });

  test('🧨 un convoque RETIRE de la liste quitte aussi le terrain publie', async () => {
    const arbre = await rendre();

    await revenirSurLePlateau(arbre, {
      canEdit: true,
      readOnly: false,
      selectedPlayers: ONZE.slice(0, 10),
      startPlacements: TERRAIN_PUBLIE.slice(0, 10),
    });

    await appuyerSur(arbre, 'Publier');
    await appuyerSur(arbre, 'Publier');

    const pack = packEnvoye();
    expect((pack?.teams?.[0]?.placements || []).map((/** @type {any} */ p) => p.playerId))
      .not.toContain('p10');
    expect(pack?.selectedPlayerIds || []).not.toContain('p10');
  });

  // 🔒 NON-REGRESSION — ce que le lot ne doit PAS casser : le terrain pose a la
  // main pendant l'edition ne doit pas etre efface par un simple re-rendu.
  test('🔒 un re-rendu SANS nouveaux parametres ne touche pas au terrain', async () => {
    const arbre = await rendre({ readOnly: false });

    await act(async () => {
      arbre.update(<MatchCompositionBoard />);
    });

    await appuyerSur(arbre, 'Publier');
    await appuyerSur(arbre, 'Publier');

    expect((packEnvoye()?.teams?.[0]?.placements || []).map((/** @type {any} */ p) => p.playerId))
      .toEqual(TERRAIN_PUBLIE.map((place) => place.playerId));
  });

  // 🔒 NON-REGRESSION — l'ordre reste « enregistrer, PUIS publier » : publier ce
  // qui n'a pas ete enregistre publierait l'etat precedent.
  test('🔒 la compo part toujours AVANT la convocation', async () => {
    const arbre = await rendre({ readOnly: false });

    await appuyerSur(arbre, 'Publier');
    await appuyerSur(arbre, 'Publier');

    expect(saveEventCompositionDraft).toHaveBeenCalled();
    expect(publishEventConvocation).toHaveBeenCalled();
    expect(saveEventCompositionDraft.mock.invocationCallOrder[0])
      .toBeLessThan(publishEventConvocation.mock.invocationCallOrder[0]);
  });
});

// ==========================================================================
// COMPOMODIF · M2 — MODIFIER N'EFFACE PAS LES REPONSES DES CONVOQUES.
//
// 🗣️ Adel, 27/08 : « j'ai l'impression que ca marche a moitie, plus comme une
// nouvelle publication que comme une modification ».
//
// 📏 CE QUI A ETE MESURE, ET OU :
//   · les reponses sont CONSERVEES, par construction : publier n'ecrit que
//     `event.composition`, alors qu'une reponse vit dans `event.participations`
//     / `event.missings`. Le serveur le verrouille par ses propres temoins —
//     `admin/tests/authz/event-composition-pack-d73.test.js:176` (« republier
//     conserve les reponses deja donnees par les joueurs ») et
//     `admin/tests/authz/event-composition-convocation.test.js:407` et `:420` ;
//   · un NOUVEAU message part dans le canal, et une notification part a tous
//     les convoques : c'est ce qui donne la sensation de « republication »
//     (`admin/src/api/event/controllers/event.ts:3491` et `:3502`). C'est un
//     comportement SERVEUR voulu, pas un defaut de cet ecran.
//
// 🔒 CE QUE CE TEMOIN TIENT, DEPUIS L'APP : le geste de publication n'envoie
// RIEN qui puisse effacer une reponse. Si un jour quelqu'un glissait un
// `resetResponses` ou une liste de participations dans cette charge, ce temoin
// virerait au rouge.
// ==========================================================================
describe('COMPOMODIF · M2 — une modification ne remet aucune reponse a zero', () => {
  // ⚠️ On compare des NOMS DE CHAMPS, jamais des morceaux de texte : « preset »
  // contient « reset », et un temoin qui cherche des sous-chaines accuserait un
  // champ innocent tout en laissant passer le vrai.
  const CLES_INTERDITES = [
    'clearResponses',
    'missings',
    'participationRequests',
    'participations',
    'reset',
    'resetResponses',
    'responses',
    'rsvp',
  ];

  /**
   * Tous les noms de champs d'une charge, a n'importe quelle profondeur.
   * @param {any} valeur
   * @param {Set<string>} [vus]
   * @returns {Set<string>}
   */
  const nomsDeChamps = (valeur, vus = new Set()) => {
    if (Array.isArray(valeur)) {
      valeur.forEach((entree) => nomsDeChamps(entree, vus));
      return vus;
    }
    if (valeur && typeof valeur === 'object') {
      Object.keys(valeur).forEach((nom) => {
        vus.add(nom);
        nomsDeChamps(valeur[nom], vus);
      });
    }
    return vus;
  };

  test('🔒 la charge envoyee ne porte AUCUN champ qui touche aux reponses', async () => {
    const arbre = await rendre({ readOnly: false });

    await revenirSurLePlateau(arbre, {
      canEdit: true,
      readOnly: false,
      startPlacements: TERRAIN_MODIFIE,
    });
    await appuyerSur(arbre, 'Publier');
    await appuyerSur(arbre, 'Publier');

    const champs = nomsDeChamps([...saveEventCompositionDraft.mock.calls]);
    CLES_INTERDITES.forEach((cle) => expect([...champs]).not.toContain(cle));
  });

  test('🔒 publier la convocation n envoie QUE l equipe visee', async () => {
    const arbre = await rendre({ readOnly: false });

    await appuyerSur(arbre, 'Publier');
    await appuyerSur(arbre, 'Publier');

    const [identifiant, charge] = [...publishEventConvocation.mock.calls].pop();
    expect(identifiant).toBe('evt_1');
    expect(Object.keys(charge || {})).toEqual(['teamId']);
  });

  // 🔒 Et la modification reste une MODIFICATION de la meme branche : on ne
  // fabrique pas une equipe neuve a chaque tour, sinon la convocation d'avant
  // — et les reponses qui s'y rattachent — deviendrait orpheline.
  test('🔒 la modification reste sur la MEME branche d equipe', async () => {
    const arbre = await rendre({
      readOnly: false,
      teamComposition: { draft: { teams: [{ id: 'branche_reelle', name: 'Senior 1' }] } },
    });

    await appuyerSur(arbre, 'Publier');
    await appuyerSur(arbre, 'Publier');

    expect(packEnvoye()?.teams?.[0]?.id).toBe('branche_reelle');
  });
});
