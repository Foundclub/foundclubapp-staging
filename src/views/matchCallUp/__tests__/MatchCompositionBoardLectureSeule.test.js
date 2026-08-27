import {
  Text, View,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { publishEventConvocation, saveEventCompositionDraft } from '@/services/event/eventService';

import MatchCompositionBoard from '../MatchCompositionBoard';

// ==========================================================================
// COMPOLECT — LE MODE CONSULTATION DU PLATEAU NEUF (D1, D2, D4, D9).
//
// 🗣️ Adel, 26/08 : « pour les convocations avec composition, quand on ouvre,
// on doit voir vraiment la composition en plein ecran avec le banc — pas le
// reste ».
//
// 🧨 CE QUE LA MESURE A TROUVE : cet ecran n'avait AUCUNE notion de lecture
// seule (`grep -c readOnly` rendait 0). Le mode est CREE par ce lot ; le
// branchement n'en est que la consequence.
//
// Ce fichier ne verrouille pas un dessin, il verrouille QUATRE promesses :
//   1. 🔒 en consultation, AUCUN appel d'ecriture n'est possible — ni par un
//      bouton, ni en rappelant la fonction elle-meme ;
//   2. 👀 on voit quand meme tout : le terrain, les jetons, les compteurs et
//      le bandeau des remplacants ;
//   3. 🚪 qui peut modifier a UN bouton « Modifier », et lui seul ;
//   4. 🚪 les REPONSES des convoques restent atteignables (D4) — un ecran
//      qu'aucun bouton n'atteint n'existe pas, le depot l'a paye 3 fois.
//
// 🥇 Et un temoin de NON-REGRESSION : le chemin d'EDITION est intact. C'est
// lui qui casserait le plus cher.
// ==========================================================================

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
/** @type {any} */
let mockRouteParams = {};

const mockNavigation = { goBack: mockGoBack, navigate: mockNavigate };

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

// Le geste est REMPLACE par un enregistreur. En consultation, la promesse est
// qu'il n'y en a AUCUN : c'est la presence meme de `props.gesture` qu'on compte.
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
// sans `.env` — gitignore, donc absent de toute copie de travail. Sans cette
// doublure la SUITE ENTIERE tombe a 0 test execute.
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

/**
 * Les noeuds qui portent un geste : en consultation, il ne doit y en avoir AUCUN.
 * @param {any} arbre
 * @returns {any[]}
 */
const noeudsAvecGeste = (arbre) => arbre.root
  .findAll((/** @type {any} */ noeud) => Boolean(noeud.props?.gesture), { deep: true });

const joueur = (id, firstname, lastname) => ({ documentId: id, firstname, lastname });
const ONZE = Array.from({ length: 11 }, (_, i) => joueur(`p${i}`, `Prenom${i}`, `Nom${i}`));
const DOUZE = [...ONZE, joueur('p11', 'Douzieme', 'Remplacant')];

const placementsPublies = ONZE.map((player, index) => ({
  playerId: player.documentId,
  positionX: 50,
  positionY: 10 + index,
  slotId: `team_1:slot_${index + 1}`,
}));

/** @type {any[]} */
const arbresMontes = [];

/**
 * Monte l'ecran en CONSULTATION, sauf parametres contraires.
 * @param {any} [parametres]
 * @returns {Promise<any>}
 */
const rendreEnLecture = async (parametres = {}) => {
  mockRouteParams = {
    canEdit: true,
    clubId: 'club_1',
    eventId: 'evt_1',
    eventLabel: 'Match contre Saint-Julien',
    existingComposition: { teams: [{ id: 'team_1', placements: placementsPublies }] },
    readOnly: true,
    selectedPlayers: DOUZE,
    sport: 'football',
    startPlacements: placementsPublies,
    teamId: 'team_1',
    teamName: 'Senior 1',
    ...parametres,
  };
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<MatchCompositionBoard />);
  });
  arbresMontes.push(arbre);
  return arbre;
};

/** @type {any} */
let mesureOrigine;

beforeEach(() => {
  mockNavigate.mockClear();
  mockGoBack.mockClear();
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

describe('COMPOLECT · D1 — en consultation, AUCUNE ecriture n est possible', () => {
  test('« Enregistrer » et « Publier » ont disparu du pied d ecran', async () => {
    const texte = texteVisible(await rendreEnLecture());

    expect(texte).not.toContain('Enregistrer');
    expect(texte).not.toContain('Publier');
  });

  test('🔒 aucun service d ecriture n est appele, meme apres un rendu complet', async () => {
    await rendreEnLecture();

    expect(saveEventCompositionDraft).not.toHaveBeenCalled();
    expect(publishEventConvocation).not.toHaveBeenCalled();
  });

  test('🔒 aucun jeton ne porte de geste : le glisser-deposer n existe pas', async () => {
    const arbre = await rendreEnLecture();

    expect(noeudsAvecGeste(arbre)).toHaveLength(0);
  });

  test('la consigne « Glisse un joueur sur le terrain » ne ment plus', async () => {
    const texte = texteVisible(await rendreEnLecture());

    expect(texte).not.toContain('Glisse un joueur sur le terrain');
  });
});

describe('COMPOLECT · D1 — mais on VOIT tout : terrain, compteurs, banc', () => {
  test('les jetons places sont dessines sur le terrain', async () => {
    const texte = texteVisible(await rendreEnLecture());

    expect(texte).toContain('JETON:Nom0');
    expect(texte).toContain('JETON:Nom10');
  });

  test('le bandeau des remplacants est rendu, avec son jeton', async () => {
    const texte = texteVisible(await rendreEnLecture());

    expect(texte).toContain('REMPLAÇANTS · 1');
    expect(texte).toContain('JETON:Remplacant');
  });

  // 🧨 COMPOLECT-2 (§1.3) — LE BANC EXISTE MEME QUAND IL EST VIDE.
  // Adel a montre une capture ou le bandeau dit « REMPLACANTS · 0 » et « Tout le
  // monde est sur le terrain ». Un bandeau qui DISPARAITRAIT a zero donnerait
  // exactement la sensation « ce n'est pas le meme ecran que la creation » —
  // c'est le genre de trou qu'aucun temoin ne voyait, celui de 1 remplacant
  // etant le seul ecrit.
  test('🧨 le bandeau des remplacants reste la MEME quand le banc est VIDE', async () => {
    const texte = texteVisible(await rendreEnLecture({ selectedPlayers: ONZE }));

    expect(texte).toContain('Remplaçants · 0'.toUpperCase());
    expect(texte).toContain('Tout le monde est sur le terrain.');
  });

  test('les pastilles de comptage restent', async () => {
    const texte = texteVisible(await rendreEnLecture());

    expect(texte).toContain('11/11 placés');
    expect(texte).toContain('Banc 1');
  });

  test('l entete garde son titre et son sous-titre', async () => {
    const texte = texteVisible(await rendreEnLecture());

    expect(texte).toContain('Composition');
    expect(texte).toContain('Match · Senior 1 · Football');
  });
});

describe('COMPOLECT · D2 — « Modifier » n apparait que pour qui peut modifier', () => {
  test('avec `canEdit` : le bouton est la, et il n y en a qu UN', async () => {
    const arbre = await rendreEnLecture();
    const boutonsModifier = arbre.root.findAll(
      (/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function'
        && aplatirTexte(noeud.props.children).trim() === 'Modifier',
    );

    expect(boutonsModifier.length).toBeGreaterThan(0);
    expect(texteVisible(arbre).split('Modifier').length - 1).toBe(1);
  });

  test('🔒 sans `canEdit` : AUCUN bouton « Modifier »', async () => {
    const texte = texteVisible(await rendreEnLecture({ canEdit: false }));

    expect(texte).not.toContain('Modifier');
  });

  test('🥇 « Modifier » repart en EDITION, sans emporter la lecture seule', async () => {
    const arbre = await rendreEnLecture();
    await appuyerSur(arbre, 'Modifier');

    const [nomEcran, parametres] = mockNavigate.mock.calls[0];
    expect(nomEcran).toBe('MatchCallUpSelection');
    expect(parametres.eventId).toBe('evt_1');
    // 🧨 LE PIEGE : `MatchCallUpSelection` retransmet `...params` au terrain.
    // Un `readOnly` oublie ici rendrait l'EDITION consultable seulement.
    expect(parametres.readOnly).toBeFalsy();
    expect(parametres.canEdit).toBe(true);
  });
});

describe('COMPOLECT · D4 — les REPONSES restent atteignables', () => {
  test('🚪 un bouton mene a la convocation publiee et a ses reponses', async () => {
    const arbre = await rendreEnLecture();

    expect(texteVisible(arbre)).toContain('Voir la convocation et les réponses');

    await appuyerSur(arbre, 'Voir la convocation et les réponses');
    const [nomEcran, parametres] = mockNavigate.mock.calls[0];
    expect(nomEcran).toBe('MatchConvocationPublished');
    expect(parametres).toEqual(expect.objectContaining({
      eventId: 'evt_1',
      teamId: 'team_1',
    }));
  });

  test('🔒 sans `canEdit`, cette porte n existe pas : le serveur y repondrait 403', async () => {
    const texte = texteVisible(await rendreEnLecture({ canEdit: false }));

    expect(texte).not.toContain('Voir la convocation et les réponses');
  });
});

describe('COMPOLECT · NON-REGRESSION — le chemin d EDITION est intact', () => {
  test('🥇 sans `readOnly`, les 2 boutons d ecriture sont toujours la', async () => {
    const texte = texteVisible(await rendreEnLecture({ readOnly: false }));

    expect(texte).toContain('Enregistrer');
    expect(texte).toContain('Publier');
    expect(texte).toContain('Modifier');
  });

  test('🥇 sans `readOnly`, les jetons portent toujours leur geste', async () => {
    const arbre = await rendreEnLecture({ readOnly: false });

    expect(noeudsAvecGeste(arbre).length).toBeGreaterThan(0);
  });

  test('🥇 sans `readOnly`, « Enregistrer » appelle bien le service', async () => {
    const arbre = await rendreEnLecture({ readOnly: false });
    await appuyerSur(arbre, 'Enregistrer');

    expect(saveEventCompositionDraft).toHaveBeenCalledTimes(1);
  });

  test('sans `readOnly`, la consigne du banc et la pastille de placement restent', async () => {
    const texte = texteVisible(await rendreEnLecture({ readOnly: false }));

    expect(texte).toContain('Glisse un joueur sur le terrain');
    expect(texte).toContain('Placement libre');
  });

  test('🔒 et la porte vers les reponses n apparait PAS en edition', async () => {
    const texte = texteVisible(await rendreEnLecture({ readOnly: false }));

    expect(texte).not.toContain('Voir la convocation et les réponses');
  });
});
