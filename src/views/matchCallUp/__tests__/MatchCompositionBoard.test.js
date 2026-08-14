import {
  Alert, Switch, Text, View,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { publishEventConvocation, saveEventCompositionDraft } from '@/services/event/eventService';

import MatchCompositionBoard from '../MatchCompositionBoard';

// D79 — ECRANS 5 et 6 du pack composition : le terrain + banc, et la feuille
// « Enregistrer ou publier ».
//
// Les 3 regles que ce fichier tient, parce que ce sont les temoins d'arret du lot :
//   1. Le glisser-deposer marche DANS LES DEUX SENS : banc -> terrain ET
//      terrain -> banc.
//   2. « Demander une reponse » est BRANCHE sur `requireResponse`, a la racine du
//      pack — la ou le serveur (D73) le lit. Il n'est pas simule.
//   3. Publier enregistre AVANT de publier : publier un etat non enregistre
//      enverrait la composition precedente.

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
/** @type {any} */
let mockRouteParams = {};
/** @type {any} */
let mockAlert;

const mockNavigation = { goBack: mockGoBack, navigate: mockNavigate };

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

// Le geste est REMPLACE par un enregistreur : chaque `Gesture.Pan()` garde ses
// rappels, et le test les declenche lui-meme. C'est la seule facon d'exercer un
// glisser-deposer sans doigt.
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
    // `runOnJS` rend la fonction telle quelle : appelee depuis un rappel de
    // geste, elle s'execute donc pour de vrai dans le test.
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

// La feuille (ecran 6) ne rend son contenu QUE quand elle est ouverte : c'est ce
// qui permet de prouver qu'elle s'ouvre sur « Publier », et pas avant.
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

// C-A — le mur payant. Comme `BottomModal`, il ne rend son contenu que quand il
// est ouvert : c'est ce qui permet de prouver qu'un refus l'ouvre VRAIMENT.
jest.mock('@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { decision, isVisible }) => (
      isVisible ? <TexteRN>{`FEUILLE_OFFRE:${decision?.reason || ''}`}</TexteRN> : null
    ),
  };
});

jest.mock('@/views/tactical_v2/DraggableToken', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { player }) => <TexteRN>{`JETON:${player?.lastname}`}</TexteRN>,
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
  await act(async () => { await cible.props.onPress(); });
};

/**
 * Le geste attache au jeton de ce joueur.
 * @param {any} arbre
 * @param {string} nom
 * @returns {any}
 */
const gesteDuJeton = (arbre, nom) => {
  // 🧨 On REMONTE depuis le jeton rendu : `props.children` ne contient que
  // l'arbre ECRIT, pas la sortie d'un composant. Chercher « JETON:… » dans les
  // enfants d'un parent ne trouve donc rien.
  const jeton = arbre.root.findAll((/** @type {any} */ noeud) => noeud.type === Text
    && aplatirTexte(noeud.props.children) === `JETON:${nom}`)[0];
  let courant = jeton;
  while (courant && !courant.props?.gesture) courant = courant.parent;
  return courant.props.gesture;
};

/**
 * Joue un glisser-deposer complet sur le jeton de ce joueur.
 * @param {any} arbre
 * @param {string} nom
 * @param {{ x: number, y: number }} versOu Coordonnees ecran du lacher.
 * @returns {Promise<void>}
 */
const glisser = async (arbre, nom, versOu) => {
  const geste = gesteDuJeton(arbre, nom);
  await act(async () => {
    geste.rappels.onStart({ absoluteX: 10, absoluteY: 10 });
    geste.rappels.onUpdate({ absoluteX: versOu.x, absoluteY: versOu.y });
    geste.rappels.onEnd({ absoluteX: versOu.x, absoluteY: versOu.y });
    geste.rappels.onFinalize();
  });
};

const joueur = (id, firstname, lastname) => ({ documentId: id, firstname, lastname });
const ONZE = Array.from({ length: 11 }, (_, i) => joueur(`p${i}`, `Prenom${i}`, `Nom${i}`));
const DOUZE = [...ONZE, joueur('p11', 'Douzieme', 'Remplacant')];

// Le terrain mesure 300 x 450 a l'ecran : c'est ce rectangle que `measureInWindow`
// rend, donc (150, 225) tombe en son centre et (2000, 2000) en dehors.
const RECT_TERRAIN = {
  height: 450, width: 300, x: 0, y: 0,
};
const CENTRE_TERRAIN = { x: 150, y: 225 };
const HORS_TERRAIN = { x: 2000, y: 2000 };

const placementsDeDepart = ONZE.map((player, index) => ({
  playerId: player.documentId,
  positionX: 50,
  positionY: 10 + index,
  slotId: `team_1:slot_${index + 1}`,
}));

/** @type {any[]} */
const arbresMontes = [];

/**
 * Monte l'ecran.
 * @param {any} [parametres]
 * @returns {Promise<any>}
 */
const rendre = async (parametres = {}) => {
  mockRouteParams = {
    eventId: 'evt_1',
    selectedPlayers: DOUZE,
    sport: 'football',
    startPlacements: placementsDeDepart,
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

// 🧨 MESURE (2026-08-12) : le prereglage react-native fournit bien un
// `measureInWindow` sur la ref d'une `View`, mais c'est un LEURRE MUET — il
// n'appelle jamais son rappel. Sans ce remplacement, l'ecran ne connait aucun
// rectangle de terrain, tout lacher tombe « dehors », et le sens banc -> terrain
// ne peut pas etre exerce du tout. `createNodeMock` ne sert a rien ici : la ref
// d'une `View` rend l'instance du composant, pas un noeud hote.
/** @type {any} */
let mesureOrigine;

beforeEach(() => {
  mockNavigate.mockClear();
  mockGoBack.mockClear();
  saveEventCompositionDraft.mockReset().mockResolvedValue({});
  publishEventConvocation.mockReset().mockResolvedValue({});
  mockAlert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

  mesureOrigine = View.prototype.measureInWindow;
  View.prototype.measureInWindow = function mesurerTerrain(/** @type {any} */ rappel) {
    rappel(RECT_TERRAIN.x, RECT_TERRAIN.y, RECT_TERRAIN.width, RECT_TERRAIN.height);
  };
});

afterEach(async () => {
  await act(async () => {
    arbresMontes.splice(0).forEach((arbre) => arbre.unmount());
  });
  mockAlert.mockRestore();
  View.prototype.measureInWindow = mesureOrigine;
});

describe('D79 ecran 5 — le terrain et son banc', () => {
  test('en-tete, pastilles, bandeau de banc et les 2 CTA sont la', async () => {
    const arbre = await rendre();
    const texte = texteVisible(arbre);

    expect(texte).toContain('Composition');
    expect(texte).toContain('Match · Senior 1 · Football');
    expect(texte).toContain('Modifier');
    expect(texte).toContain('11/11 placés');
    expect(texte).toContain('Banc 1');
    expect(texte).toContain('REMPLAÇANTS · 1');
    expect(texte).toContain('Glisse un joueur sur le terrain');
    expect(texte).toContain('Enregistrer');
    expect(texte).toContain('Publier');
  });

  test('la pastille de placement dit le mode reel : libre ou aimante', async () => {
    expect(texteVisible(await rendre())).toContain('Placement libre');
    expect(texteVisible(await rendre({ magnetEnabled: true }))).toContain('Aimanté aux postes');
  });

  // Le pack dit « bouton Modifier a droite (retour a la selection) » : c'est
  // l'ecran 1 qu'on veut retrouver, pas l'ecran 4.
  test('« Modifier » ramene a la SELECTION des convoques', async () => {
    const arbre = await rendre();
    await appuyerSur(arbre, 'Modifier');

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    const [nomEcran, parametres] = mockNavigate.mock.calls[0];
    expect(nomEcran).toBe('MatchCallUpSelection');
    expect(parametres.eventId).toBe('evt_1');
  });

  test('les jetons du terrain et ceux du banc sont bien separes', async () => {
    const arbre = await rendre();
    const texte = texteVisible(arbre);

    expect(texte).toContain('JETON:Nom0');
    expect(texte).toContain('JETON:Remplacant');
  });

  test('terrain vide : tout le monde est au banc, et le bandeau le dit', async () => {
    const arbre = await rendre({ startPlacements: [] });
    const texte = texteVisible(arbre);

    expect(texte).toContain('0/11 placés');
    expect(texte).toContain('REMPLAÇANTS · 12');
  });

  test('tout le monde sur le terrain : le banc le dit au lieu de rester muet', async () => {
    const arbre = await rendre({ selectedPlayers: ONZE });
    expect(texteVisible(arbre)).toContain('Tout le monde est sur le terrain.');
  });
});

describe('D79 ecran 5 — le glisser-deposer, DANS LES DEUX SENS', () => {
  test('BANC -> TERRAIN : lacher sur le terrain place le joueur', async () => {
    const arbre = await rendre();
    expect(texteVisible(arbre)).toContain('11/11 placés');

    await glisser(arbre, 'Remplacant', CENTRE_TERRAIN);

    const texte = texteVisible(arbre);
    expect(texte).toContain('12/11 placés');
    expect(texte).toContain('REMPLAÇANTS · 0');
  });

  test('TERRAIN -> BANC : lacher hors du terrain remet le joueur au banc', async () => {
    const arbre = await rendre();

    await glisser(arbre, 'Nom0', HORS_TERRAIN);

    const texte = texteVisible(arbre);
    expect(texte).toContain('10/11 placés');
    expect(texte).toContain('REMPLAÇANTS · 2');
  });

  test('un jeton du banc lache HORS du terrain reste au banc, sans rien casser', async () => {
    const arbre = await rendre();

    await glisser(arbre, 'Remplacant', HORS_TERRAIN);

    expect(texteVisible(arbre)).toContain('REMPLAÇANTS · 1');
  });

  test('deplacer un jeton DANS le terrain ne le duplique pas', async () => {
    const arbre = await rendre();

    await glisser(arbre, 'Nom0', CENTRE_TERRAIN);

    const texte = texteVisible(arbre);
    expect(texte).toContain('11/11 placés');
    expect(texte.match(/JETON:Nom0/g)).toHaveLength(1);
  });

  test('aller-retour complet : le terrain revient a son etat de depart', async () => {
    const arbre = await rendre();

    await glisser(arbre, 'Nom0', HORS_TERRAIN);
    expect(texteVisible(arbre)).toContain('10/11 placés');

    await glisser(arbre, 'Nom0', CENTRE_TERRAIN);
    expect(texteVisible(arbre)).toContain('11/11 placés');
  });
});

describe('D79 ecran 6 — la feuille enregistrer / publier', () => {
  test('elle ne s ouvre que sur « Publier »', async () => {
    const arbre = await rendre();
    expect(texteVisible(arbre)).not.toContain('Publier la compo ?');

    await appuyerSur(arbre, 'Publier');

    expect(texteVisible(arbre)).toContain('Publier la compo ?');
  });

  test('elle porte le kicker, le titre, le texte et le recap en 3 lignes', async () => {
    const arbre = await rendre();
    await appuyerSur(arbre, 'Publier');
    const texte = texteVisible(arbre);

    expect(texte).toContain('CONVOCATION');
    expect(texte).toContain('La convocation part dans le canal Senior 1');
    expect(texte).toContain('Titulaires');
    expect(texte).toContain('11 sur le terrain');
    expect(texte).toContain('Remplaçants');
    expect(texte).toContain('1 sur le banc');
    expect(texte).toContain('Joueurs hors app');
    expect(texte).toContain('Demander une réponse');
    expect(texte).toContain('Publier la convocation');
  });

  test('le recap compte les VRAIS joueurs hors app convoques', async () => {
    const horsApp = {
      documentId: 'manual_1', firstname: 'Yanis', isManual: true, lastname: 'Bertrand',
    };
    const arbre = await rendre({ selectedPlayers: [...ONZE, horsApp], startPlacements: placementsDeDepart });
    await appuyerSur(arbre, 'Publier');

    expect(texteVisible(arbre)).toContain('1 ajouté à la main');
  });
});

describe('D79 ecran 6 — « Demander une reponse » est BRANCHE, pas simule', () => {
  test('il est allume par defaut, et part a true dans le pack', async () => {
    const arbre = await rendre();
    await appuyerSur(arbre, 'Publier');

    expect(arbre.root.findAllByType(Switch)[0].props.value).toBe(true);

    await appuyerSur(arbre, 'Publier la convocation');

    const [, charge] = saveEventCompositionDraft.mock.calls[0];
    expect(charge.draft.requireResponse).toBe(true);
  });

  test('l eteindre envoie requireResponse = false a la RACINE du pack', async () => {
    const arbre = await rendre();
    await appuyerSur(arbre, 'Publier');
    await act(async () => {
      arbre.root.findAllByType(Switch)[0].props.onValueChange(false);
    });
    await appuyerSur(arbre, 'Publier la convocation');

    const [, charge] = saveEventCompositionDraft.mock.calls[0];
    expect(charge.draft.requireResponse).toBe(false);
    // `visibility` voyage avec lui : le serveur lit les deux au meme endroit.
    expect(charge.draft.visibility).toBe('team');
  });
});

describe('D79 — enregistrer et publier', () => {
  test('« Enregistrer » ecrit un brouillon et ne publie RIEN', async () => {
    const arbre = await rendre();
    await appuyerSur(arbre, 'Enregistrer');

    expect(saveEventCompositionDraft).toHaveBeenCalledTimes(1);
    expect(publishEventConvocation).not.toHaveBeenCalled();
    expect(mockAlert).toHaveBeenCalledWith('Composition enregistrée', expect.any(String));
  });

  test('le brouillon porte les placements du terrain et la reserve du banc', async () => {
    const arbre = await rendre();
    await appuyerSur(arbre, 'Enregistrer');

    const [eventId, charge] = saveEventCompositionDraft.mock.calls[0];
    expect(eventId).toBe('evt_1');
    expect(charge.teamId).toBe('team_1');
    expect(charge.draft.teams[0].placements).toHaveLength(11);
    expect(charge.draft.reservePlayerIds).toEqual(['p11']);
    expect(charge.draft.selectedPlayerIds).toHaveLength(12);
  });

  test('« Publier » ENREGISTRE d abord : publier un etat non enregistre enverrait l ancien', async () => {
    const arbre = await rendre();
    await appuyerSur(arbre, 'Publier');
    await appuyerSur(arbre, 'Publier la convocation');

    expect(saveEventCompositionDraft).toHaveBeenCalledTimes(1);
    expect(publishEventConvocation).toHaveBeenCalledTimes(1);
    expect(saveEventCompositionDraft.mock.invocationCallOrder[0])
      .toBeLessThan(publishEventConvocation.mock.invocationCallOrder[0]);
  });

  test('un echec serveur se dit, et ne fait pas croire a une publication', async () => {
    publishEventConvocation.mockRejectedValue(new Error('403'));
    const arbre = await rendre();
    await appuyerSur(arbre, 'Publier');
    await appuyerSur(arbre, 'Publier la convocation');

    expect(mockAlert).toHaveBeenCalledWith('Erreur', 'Impossible de publier cette convocation.');
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// C-A (💰) LE MUR PAYANT — la seule fuite d'argent mesuree du pack
// ---------------------------------------------------------------------------
//
// Mesure du lot C1 : publier sans offre etait refuse par une ALERTE GENERIQUE.
// Le serveur repond pourtant 403 EN JOIGNANT la decision d'abonnement
// (event.ts:3203 -> buildSubscriptionPermissionDeniedDetails), et l'app sait
// deja l'extraire. Le mur payant n'etait branche que sur l'ANCIEN terrain
// (TacticalBoard, MultiTeamCompositionBoard) : sur le neuf, le coach etait
// refuse SANS qu'on lui montre l'offre qui debloque son geste. Chaque
// publication refusee etait donc une vente perdue en silence.
//
// ♻️ Rien n'est invente ici : c'est le motif exact de RequestsHub et des 11
// autres ecrans qui l'utilisent deja (§1 bis, barreau 2).
//
// La forme de l'erreur est celle que l'ecran RECOIT vraiment : l'intercepteur
// HTTP rejette la charge Strapi DEBALLEE (client.native.js:93), pas l'erreur
// axios. C'est ce qui rend `details.decision` lisible.
const refusAvecOffre = () => ({
  details: {
    code: 'SUBSCRIPTION_PERMISSION_DENIED',
    decision: {
      action: 'composition.manage',
      allowed: false,
      clubDocumentId: 'club_1',
      paywall: 'composition-required',
      reason: 'PLAN_REQUIRED',
      remainingFreeUses: 0,
      requiredPlan: ['TEAM'],
      teamDocumentId: 'team_1',
    },
  },
  message: 'Cette fonctionnalite necessite une offre FoundClub active.',
  name: 'ForbiddenError',
  status: 403,
});

describe('C-A — publier sans abonnement ouvre la FEUILLE D OFFRE, pas une alerte', () => {
  test('🥇 le refus 403 qui porte une decision ouvre le mur payant', async () => {
    publishEventConvocation.mockRejectedValue(refusAvecOffre());
    const arbre = await rendre();
    await appuyerSur(arbre, 'Publier');
    await appuyerSur(arbre, 'Publier la convocation');

    expect(texteVisible(arbre)).toContain('FEUILLE_OFFRE:PLAN_REQUIRED');
  });

  test('⛔ et l alerte generique ne s affiche PLUS : elle cachait l offre', async () => {
    publishEventConvocation.mockRejectedValue(refusAvecOffre());
    const arbre = await rendre();
    await appuyerSur(arbre, 'Publier');
    await appuyerSur(arbre, 'Publier la convocation');

    expect(mockAlert).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('la feuille de publication se referme, sinon elle masquerait l offre', async () => {
    publishEventConvocation.mockRejectedValue(refusAvecOffre());
    const arbre = await rendre();
    await appuyerSur(arbre, 'Publier');
    await appuyerSur(arbre, 'Publier la convocation');

    expect(texteVisible(arbre)).not.toContain('Publier la convocation');
  });

  test('🔎 le refus peut aussi venir de l ENREGISTREMENT : publier enregistre d abord', async () => {
    // `handlePublish` appelle saveEventCompositionDraft AVANT publish. Ne
    // brancher que le second laisserait ce chemin-la sur l'alerte generique.
    saveEventCompositionDraft.mockRejectedValue(refusAvecOffre());
    const arbre = await rendre();
    await appuyerSur(arbre, 'Publier');
    await appuyerSur(arbre, 'Publier la convocation');

    expect(texteVisible(arbre)).toContain('FEUILLE_OFFRE:PLAN_REQUIRED');
    expect(publishEventConvocation).not.toHaveBeenCalled();
  });

  test('« Enregistrer » seul ouvre aussi l offre au lieu de son alerte', async () => {
    saveEventCompositionDraft.mockRejectedValue(refusAvecOffre());
    const arbre = await rendre();
    await appuyerSur(arbre, 'Enregistrer');

    expect(texteVisible(arbre)).toContain('FEUILLE_OFFRE:PLAN_REQUIRED');
    expect(mockAlert).not.toHaveBeenCalled();
  });

  test('⛔ NON-REGRESSION : un echec SANS decision garde son alerte', async () => {
    publishEventConvocation.mockRejectedValue(new Error('coupure reseau'));
    const arbre = await rendre();
    await appuyerSur(arbre, 'Publier');
    await appuyerSur(arbre, 'Publier la convocation');

    expect(mockAlert).toHaveBeenCalledWith('Erreur', 'Impossible de publier cette convocation.');
    expect(texteVisible(arbre)).not.toContain('FEUILLE_OFFRE');
  });
});
