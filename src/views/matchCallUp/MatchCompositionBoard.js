/* eslint-disable jsdoc/require-jsdoc */
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  runOnJS,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useMessaging from '@/domains/messaging/useMessaging';
import { invalidateAfterAction } from '@/domains/refresh/afterAction';
import { extractSubscriptionDecisionFromError } from '@/domains/subscription/subscriptionDecision';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import SubscriptionPaywallSheet from '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet';
import DraggableToken, { GHOST_TOKEN_SIZE } from '@/components/tactical/DraggableToken';
import RenderedTacticalField from '@/components/tactical/RenderedTacticalField';
import ScreenContainer from '@/components/templates/ScreenContainer';
import {
  buildPublishedBoardTarget,
  findPublishedBranchForTeam,
} from '@/views/playerConvocation/playerConvocationUtils';

import { RouteNames } from '@/navigation/routeNames';

import {
  getEventConvocation,
  publishEventConvocation,
  saveEventCompositionDraft,
} from '@/services/event/eventService';

import { getCompositionPlayerId } from '@/utils/compositionPlayer';
import {
  fitTacticalFieldInBox,
  getTacticalFieldAspectRatio,
  getTacticalSportKey,
} from '@/utils/tacticalField';

import { isManualCallUpPlayer } from './matchCallUpUtils';
import {
  buildFormationSlots,
  buildMatchCompositionPack,
  buildSlotsFromFormation,
  getBenchPlayers,
  getBoardCounters,
  placePlayerAt,
  removePlayerFromField,
} from './matchCompositionUtils';
import { getMatchFormationByKey } from './matchFormationCatalog';
import useSiteCompositionRecovery from './useSiteCompositionRecovery';

/**
 * D79 — ECRANS 5 et 6 du pack composition : le terrain + banc, et la feuille
 * « Enregistrer ou publier ».
 *
 * Les 2 ecrans vivent dans le MEME fichier parce que le pack les dessine ainsi :
 * a l'ecran 6, le terrain reste visible derriere la feuille. En faire deux
 * ecrans de pile obligerait a le redessiner.
 *
 * ♻️ CE QUI EST REPRIS, PAS REECRIT :
 *   · `DraggableToken` — le jeton (terrain, banc, fantome), qui sait deja
 *     reconnaitre un joueur saisi a la main.
 *   · `RenderedTacticalField` — les traces de terrain et leurs couleurs.
 *   · Le geste du board existant : appui long 120 ms, `minDistance(6)`, mesure
 *     du terrain par `measureInWindow`, jeton fantome pilote par reanimated.
 *   · `BottomModal` — le voile, le flou et la poignee de la feuille.
 *
 * 🧨 Le defaut qui avait tue ce glisser-deposer une premiere fois (D42) : une
 * liste vide ecrite `= []` dans la destructuration des parametres de route
 * fabrique un tableau NEUF a chaque rendu. Toutes les listes par defaut de ce
 * fichier sont donc gelees au niveau module.
 */

/** @type {any[]} */
const EMPTY_LIST = Object.freeze([]);

const DRAG_SPRING = { damping: 18, stiffness: 220 };
const LONG_PRESS_MS = 120;

/** Le jeton vient du banc — il n'a encore aucune place sur le terrain. */
const SOURCE_BENCH = 'bench';

/** Retrait lateral de l'enveloppe du terrain (le calcul de taille du site le deduit). */
const FIELD_WRAPPER_PADDING = 14;

/**
 * ⌨️ COMPO-WEB — ou poser un joueur AU CLAVIER quand le sport n'a aucun poste
 * dessine (ou qu'ils sont tous pris) : la premiere case libre d'une grille 4 x 4.
 */
const GRILLE_CLAVIER = Object.freeze([20, 40, 60, 80]
  .flatMap((y) => [20, 40, 60, 80].map((x) => Object.freeze({ x, y }))));

function MatchCompositionBoard() {
  const { Colors, Fonts } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  // Sert a retrouver le fil de l'equipe apres publication (voir `handlePublish`).
  const { startTeamChat } = /** @type {any} */ (useMessaging());

  // 🔄 COMPOMSG — LA DERNIERE VERSION PUBLIEE, relue au serveur (voir l'effet
  // plus bas). Elle RECOUVRE les parametres recus : la carte du fil n'est qu'une
  // photo prise a la publication, et une compo republiee depuis doit se voir.
  const [relectureServeur, setRelectureServeur] = useState(/** @type {any} */ (null));

  // 🌐 COMPO-WEB — sur le SITE, un terrain arrive par l'adresse (lien,
  // rechargement) SANS ses joueurs : il les relit sur le serveur, et
  // `recovery.publicationBlocked` ferme la publication tant qu'il n'en a aucun.
  // Sur le telephone, ce crochet rend `route.params` tel quel, sans blocage.
  const { params: paramsRecus, recovery } = useSiteCompositionRecovery(route.params, 'field');
  /** @type {any} */
  const params = useMemo(
    () => ({ ...(paramsRecus || {}), ...(relectureServeur || {}) }),
    [paramsRecus, relectureServeur],
  );
  const {
    canEdit = false,
    clubId = null,
    eventId,
    eventLabel = '',
    formationKey = null,
    magnetEnabled = false,
    messageVersion = null,
    readOnly = false,
    refreshFromServer = false,
    selectedPlayers = EMPTY_LIST,
    serverVersion = null,
    sport = 'football',
    startPlacements = EMPTY_LIST,
    teamCategory = '',
    teamComposition = null,
    teamId,
    teamName = '',
  } = params;

  // COMPOLECT (D1) — LE MODE CONSULTATION.
  //
  // 🗣️ Adel, 26/08 : « quand on ouvre une convocation avec composition, on doit
  // voir vraiment la composition en plein ecran avec le banc — pas le reste ».
  // Cet ecran dessinait deja exactement ca ; il n'avait simplement AUCUNE notion
  // de lecture seule (`grep -c readOnly` rendait 0). C'est ce mode-la qui est
  // cree ici, et c'est lui le vrai travail du lot : le branchement n'en est que
  // la consequence.
  //
  // Ce qui RESTE en consultation : le terrain, les jetons, les pastilles de
  // comptage et le bandeau des remplacants.
  // Ce qui DISPARAIT : tout ce qui ecrit — le glisser-deposer, « Enregistrer »,
  // « Publier », et la consigne « Glisse un joueur… », qui promettrait un geste
  // qui n'existe plus.
  //
  // 🔒 URL-BOOLEENS (29/09) — UN TERRAIN SANS AUCUN JOUEUR NE S'OUVRE PAS EN
  // ECRITURE. Sur le site, les joueurs (des objets) ne voyagent pas dans
  // l'adresse : le terrain y arrive vide, et « Publier » remplacait la vraie
  // compo par une compo a 0 joueur (le serveur ne le refuse pas). Sur le
  // telephone ce cas n'existe pas : la selection refuse « Suivant » a 0 coche.
  const isReadOnly = Boolean(readOnly)
    || !Array.isArray(selectedPlayers) || selectedPlayers.length === 0;
  // 🔒 COMPO-WEB — JAMAIS UNE PUBLICATION VIDE PAR ACCIDENT. La garde ci-dessus
  // reste le FILET (un terrain sans joueur ne s'ouvre pas en ecriture). Celle-ci
  // couvre ce qu'elle ne voit pas — relecture du serveur en cours ou en echec,
  // convoque introuvable — et c'est elle qui DIT pourquoi (bandeau), des que
  // l'ecriture etait demandee. Sur le telephone, le crochet ne bloque jamais.
  const publicationBloquee = !readOnly && Boolean(recovery?.publicationBlocked);

  // 🔄 COMPOMSG — OUVERT DEPUIS UNE CARTE DU FIL, LE PLATEAU RELIT LA DERNIERE
  // VERSION PUBLIEE.
  //
  // 🗣️ Adel, 23/09 : le plein ecran (ouvert depuis la carte) montrait 8 joueurs
  // sur le terrain, « Tu es convoque » en montrait 9 pour le meme match. La
  // carte avait ete postee a la version 1 ; la compo avait ete republiee depuis.
  //
  // ⚖️ UNE requete, a l'ouverture du plateau — jamais au rendu du fil, ou chaque
  // carte d'un historique en couterait une. Meme clef de cache que « Tu es
  // convoque » et la page de l'evenement : la relecture les rafraichit aussi.
  // ⛔ En echec, on ne casse rien : la photo de la carte reste a l'ecran.
  useEffect(() => {
    if (!isReadOnly || !refreshFromServer || !eventId) return undefined;
    if (typeof queryClient?.fetchQuery !== 'function') return undefined;
    let actif = true;
    queryClient.fetchQuery({
      queryFn: () => getEventConvocation(eventId, teamId),
      queryKey: ['eventConvocation', eventId, teamId || 'auto'],
    }).then((/** @type {any} */ convocation) => {
      if (!actif) return;
      const branche = findPublishedBranchForTeam(convocation, teamId);
      const cible = buildPublishedBoardTarget(branche?.published, {
        sport,
        teamName: branche?.team?.name || teamName,
      });
      if (!cible) return;
      setRelectureServeur({
        ...cible,
        refreshFromServer: false,
        serverVersion: cible.publishedVersion,
      });
    }).catch(() => {});
    return () => { actif = false; };
  }, [eventId, isReadOnly, queryClient, refreshFromServer, sport, teamId, teamName]);

  // 🌐 COMPOMSG (point 2) — SUR LE SITE, LE TERRAIN N'AVAIT AUCUNE TAILLE.
  // Mesure au banc avec le vrai gabarit du site (23/09) : enveloppe 390 x 0,
  // dessin 0 x 0. Une surface qui n'a qu'un ratio (ni largeur ni hauteur) vaut
  // 0 px dans un navigateur ; sur l'iPhone, Yoga la dimensionne. Le site mesure
  // donc la place de l'enveloppe et donne au terrain la plus grande taille qui
  // y tient aux proportions du sport. ⛔ L'iPhone n'est pas touche.
  const [fieldBox, setFieldBox] = useState(/** @type {any} */ (null));
  const measureFieldWrapper = useCallback((/** @type {any} */ event) => {
    if (Platform.OS !== 'web') return;
    const { height, width } = event?.nativeEvent?.layout || {};
    setFieldBox((/** @type {any} */ avant) => (
      avant && avant.height === height && avant.width === width ? avant : { height, width }
    ));
  }, []);
  const siteFieldSize = Platform.OS === 'web'
    ? fitTacticalFieldInBox(fieldBox, sport, FIELD_WRAPPER_PADDING)
    : null;

  // 🪧 La carte etait-elle depassee ? On ne le dit que si les DEUX versions sont
  // connues : une carte ancienne sans numero ne declenche aucun bandeau.
  const isMessageOutdated = isReadOnly
    && Number(serverVersion) > 0
    && Number(messageVersion) > 0
    && Number(serverVersion) > Number(messageVersion);

  const [placements, setPlacements] = useState(() => (
    Array.isArray(startPlacements) ? startPlacements : EMPTY_LIST
  ));

  // 🧨 COMPOMODIF (M3) — LE TERRAIN DOIT SUIVRE QUAND ON REVIENT SUR CET ECRAN.
  //
  // 🗣️ Adel, 27/08 : « le message que ca envoie apres modif, c'est la compo
  // D'AVANT la modif ».
  //
  // 🧭 CE QUI A ETE ECARTE PAR LA MESURE : le serveur est HORS DE CAUSE.
  // `publishConvocation` relit le brouillon qu'on vient d'ecrire, en fabrique
  // `published`, et c'est CE pack — jamais un cache — que le controleur passe a
  // `publishLineupShareToTeamChat`. Et l'ordre des 2 appels de l'app est bon :
  // la compo part avant la convocation. Le message ne peut donc porter que ce
  // que CET ecran a envoye.
  //
  // 🧨 LA CAUSE : depuis COMPOLECT-2, la lecture d'une compo publiee ouvre ce
  // plateau, et sa porte « Modifier » EMPILE l'ecran de selection PAR-DESSUS.
  // « Suivant » y REVIENT en depilant (`navigate` vers un ecran deja empile) :
  // le composant n'est jamais remonte, l'amorce de ce `useState` ne rejoue pas,
  // et le terrain d'AVANT reste en place — c'est lui qui part au serveur, donc
  // dans le message de toute l'equipe.
  //
  // ⚠️ On compare les IDENTITES, pas le contenu : `resumeFieldForSelection`
  // rend toujours un tableau NEUF, alors qu'un simple re-rendu (un jeton qu'on
  // deplace) garde le meme. Poser un jeton a la main n'est donc jamais efface.
  const [rangeeRecue, setRangeeRecue] = useState(startPlacements);
  if (startPlacements !== rangeeRecue) {
    setRangeeRecue(startPlacements);
    setPlacements(Array.isArray(startPlacements) ? startPlacements : EMPTY_LIST);
  }
  const [isSheetVisible, setIsSheetVisible] = useState(false);
  const [requireResponse, setRequireResponse] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [activeDragPlayer, setActiveDragPlayer] = useState(null);
  const [subscriptionPaywallDecision, setSubscriptionPaywallDecision] = useState(null);

  // 🎁 LOT TERRAIN — LE TERRAIN PORTE LA COMPO TYPE CHOISIE A L'ECRAN 4.
  //
  // Avant ce lot, ce plateau ne connaissait QUE l'unique disposition du sport :
  // choisir un 4-4-2 a l'ecran precedent n'avait aucun effet ici, et
  // l'aimantation visait toujours les memes 11 points. On relit donc la compo
  // type par sa cle — la passer en entier dans les parametres de navigation
  // dupliquerait la donnee au lieu de la nommer.
  const formation = useMemo(
    () => getMatchFormationByKey(sport, teamCategory, formationKey),
    [formationKey, sport, teamCategory],
  );
  const slots = useMemo(
    () => (formation ? buildSlotsFromFormation(formation) : buildFormationSlots(sport)),
    [formation, sport],
  );
  // Les postes ENCORE LIBRES : ce sont eux qu'on dessine en creux sur le
  // terrain. Un poste tenu disparait sous son jeton — deux dessins au meme
  // endroit seraient illisibles.
  const freeSlots = useMemo(() => {
    const taken = new Set(
      (Array.isArray(placements) ? placements : [])
        .map((/** @type {any} */ placement) => placement?.slotId)
        .filter(Boolean),
    );
    return slots.filter((entry) => !taken.has(entry.slotId));
  }, [placements, slots]);
  // Le parametre `sport` arrive parfois ecrit a la main (« Football à 11 ») : la
  // cle de traduction se prend sur le sport NORMALISE, jamais sur le libelle brut.
  const sportLabel = t(`matchComposition.sports.${getTacticalSportKey(sport)}`);
  const benchPlayers = useMemo(
    () => getBenchPlayers(selectedPlayers, placements),
    [placements, selectedPlayers],
  );
  const manualPlayers = useMemo(
    () => (Array.isArray(selectedPlayers) ? selectedPlayers : EMPTY_LIST)
      .filter(isManualCallUpPlayer),
    [selectedPlayers],
  );
  // 🎁 LOT TERRAIN — LE DENOMINATEUR DE « N/M places » SUIT LA COMPO TYPE.
  // Sans cela, un 4-2-3-1 choisi a l'ecran 4 affichait « 0/11 » venu de
  // l'effectif theorique du sport, meme quand la formation en demandait 8.
  const counters = useMemo(() => getBoardCounters({
    manualPlayers, placements, players: selectedPlayers, sport, starters: formation?.starters,
  }), [formation?.starters, manualPlayers, placements, selectedPlayers, sport]);

  const playerById = useMemo(() => {
    const map = new Map();
    (Array.isArray(selectedPlayers) ? selectedPlayers : EMPTY_LIST)
      .forEach((/** @type {any} */ player) => {
        const playerId = getCompositionPlayerId(player);
        if (playerId) map.set(playerId, player);
      });
    return map;
  }, [selectedPlayers]);

  // ⌨️ COMPO-WEB — LE CHEMIN SANS SOURIS, SUR LE SITE.
  //
  // Decision d'Adel (29/09) : sur ordinateur, l'entraineur place ses joueurs a
  // la souris (glisser-deposer) ET au clavier. Le chemin clavier tient en deux
  // gestes : Entree (ou Espace) sur un jeton le CHOISIT, puis Entree sur un
  // poste libre l'y POSE — ou « Remettre au banc ».
  // ♻️ Aucune regle neuve : poser passe par `placePlayerAt`, retirer par
  // `removePlayerFromField`, exactement comme le lacher du glisser-deposer.
  // ⛔ Telephone : rien ne change (`Platform.OS`), le glisser-deposer y reste le
  // seul geste.
  const clavierActif = Platform.OS === 'web' && !isReadOnly;
  const [joueurAuClavier, setJoueurAuClavier] = useState(/** @type {string | null} */ (null));
  const joueurChoisi = clavierActif && joueurAuClavier
    ? playerById.get(joueurAuClavier) || null
    : null;
  const nomDuJoueurChoisi = joueurChoisi
    ? `${joueurChoisi?.firstname || ''} ${joueurChoisi?.lastname || ''}`.trim()
    : '';
  const joueurChoisiSurLeTerrain = Boolean(joueurChoisi) && placements
    .some((/** @type {any} */ placement) => String(placement?.playerId || '') === joueurAuClavier);
  const caseLibreAuClavier = GRILLE_CLAVIER.find(({ x, y }) => !placements.some(
    (/** @type {any} */ placement) => Math.abs(Number(placement?.positionX) - x) < 8
      && Math.abs(Number(placement?.positionY) - y) < 8,
  )) || GRILLE_CLAVIER[0];

  const choisirAuClavier = useCallback((/** @type {any} */ player) => {
    const playerId = getCompositionPlayerId(player);
    if (!playerId) return;
    setJoueurAuClavier((current) => (current === playerId ? null : playerId));
  }, []);

  const toucheSurUnJeton = useCallback((/** @type {any} */ player) => (
    /** @type {any} */ event,
  ) => {
    const touche = event?.nativeEvent?.key || event?.key;
    if (touche === 'Escape') {
      setJoueurAuClavier(null);
      return;
    }
    if (touche !== 'Enter' && touche !== ' ') return;
    event?.preventDefault?.();
    choisirAuClavier(player);
  }, [choisirAuClavier]);

  const poserAuClavier = useCallback((
    /** @type {{ x: number, y: number, surUnPoste: boolean }} */ cible,
  ) => {
    if (!joueurAuClavier) return;
    setPlacements((current) => placePlayerAt({
      // Un poste NOMME (« au poste GB ») est vise expres : le jeton s'y accroche.
      magnetEnabled: cible.surUnPoste,
      placements: current,
      playerId: joueurAuClavier,
      slots,
      x: cible.x,
      y: cible.y,
    }));
    setJoueurAuClavier(null);
  }, [joueurAuClavier, slots]);

  // 🔒 COMPO-WEB — ce que dit le bandeau de garde, selon la raison du blocage.
  let gardeTitre = t('matchComposition.board.guard.emptyTitle');
  let gardeMessage = t('matchComposition.board.guard.emptyMessage');
  if (recovery?.status === 'loading') {
    gardeTitre = t('matchComposition.board.guard.loading');
    gardeMessage = '';
  } else if (recovery?.status === 'failed') {
    gardeTitre = t('matchComposition.board.guard.failedTitle');
    gardeMessage = t('matchComposition.board.guard.failedMessage');
  } else if (recovery?.status === 'missing') {
    gardeTitre = t('matchComposition.board.guard.missingTitle');
    gardeMessage = t('matchComposition.board.guard.missingMessage', {
      count: recovery.missingCount,
    });
  }

  // ⌨️ COMPO-WEB — LE FOCUS SE VOIT. Mesure au banc (capture) : le jeton qui
  // avait le focus clavier ne portait AUCUN contour — on tabulait a l'aveugle.
  // Le jeton (ou la cible) qui a le focus porte un anneau clair ; le jeton
  // CHOISI garde son anneau de couleur.
  const [focusClavier, setFocusClavier] = useState(/** @type {string | null} */ (null));
  // ⚠️ La bordure est RESERVEE en permanence (transparente) : seule sa couleur
  // change. Un anneau qui ajoute 2 px au focus fait grandir le banc et
  // redimensionne le terrain PENDANT le glisser (le clic de souris donne aussi
  // le focus) — mesure au banc : le joueur n'etait plus pose.
  const anneauClavier = (/** @type {string} */ cle, /** @type {boolean} */ estChoisi) => {
    if (!clavierActif) return null;
    let borderColor = Colors.transparent;
    if (estChoisi) borderColor = Colors.primary500;
    else if (focusClavier === cle) borderColor = Colors.neutral00;
    return [styles.jetonChoisi, { borderColor }];
  };
  const prendreLeFocus = (/** @type {string} */ cle) => (
    clavierActif ? () => setFocusClavier(cle) : undefined
  );
  const perdreLeFocus = (/** @type {string} */ cle) => (
    clavierActif
      ? () => setFocusClavier((/** @type {string | null} */ actuel) => (
        actuel === cle ? null : actuel
      ))
      : undefined
  );

  const remettreAuBancAuClavier = useCallback(() => {
    if (!joueurAuClavier) return;
    setPlacements((current) => removePlayerFromField(current, joueurAuClavier));
    setJoueurAuClavier(null);
  }, [joueurAuClavier]);

  // --- Glisser-deposer : le rectangle du terrain est la seule zone mesuree.
  // Lacher DEDANS place, lacher DEHORS remet au banc. C'est ce qui fait les deux
  // sens sans avoir a mesurer aussi le bandeau du bas.
  const fieldNodeRef = useRef(null);
  const fieldRectRef = useRef(null);
  const ghostX = useSharedValue(0);
  const ghostY = useSharedValue(0);
  const ghostScale = useSharedValue(0);
  const ghostOpacity = useSharedValue(0);

  const measureField = useCallback(() => {
    const node = fieldNodeRef.current;
    // @ts-ignore — `measureInWindow` existe sur une View native.
    if (!node?.measureInWindow) return;
    // @ts-ignore
    node.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) {
        fieldRectRef.current = {
          height, width, x, y,
        };
      }
    });
  }, []);

  // 🧵 T01 — CE QUI RESTE SUR LE FIL JS, ET CE QUI N'Y VA PLUS.
  //
  // Constat iPhone du 2026-08-17 : l'apercu restait colle au coin en haut a
  // gauche pendant tout le glissement, alors que le LACHER tombait juste. La
  // cause n'est pas dans le calcul — c'est que la position de l'apercu faisait
  // l'aller-retour fil UI -> `runOnJS` -> fil JS -> fil UI a CHAQUE mouvement de
  // doigt. Or ce meme geste declenche `setActiveDragPlayer`, donc un rendu de
  // tout cet ecran : le fil JS est occupe exactement quand le doigt bouge, les
  // rappels s'entassent, et l'apercu ne recoit jamais sa position.
  //
  // ⇒ La position vit maintenant DANS le worklet (fil UI), la ou le doigt est
  // deja. Ne reste sur le fil JS que ce qui en a vraiment besoin : mesurer le
  // terrain, vibrer, et dire QUI on traine.
  // 🖱️ COMPO-WEB — SUR LE SITE, L'APERCU DU JETON NE SUIVAIT PAS LA SOURIS.
  //
  // Le site n'a pas de fil UI : `react-native-reanimated` y est une doublure dont
  // les valeurs partagees ne redessinent RIEN. Mesure au banc : l'apercu restait
  // fige a son point de depart pendant tout le glisser (le lacher, lui, tombait
  // juste). Et le calque de l'apercu ne commence pas au coin de la page (le
  // gabarit du site a son en-tete) : la position doit en retirer le decalage.
  // ⇒ Sur le site SEULEMENT, chaque mouvement repositionne l'apercu, dans le
  // repere de son calque, et redessine. ⛔ Telephone : rien ne change — le
  // worklet n'appelle ce chemin que si `surLeSite`, et la position y reste
  // ecrite sur le fil UI (T01).
  const surLeSite = Platform.OS === 'web';
  const calqueFantomeRef = useRef(null);
  const decalageCalqueRef = useRef({ x: 0, y: 0 });
  const [, redessinerLeFantome] = useReducer((/** @type {number} */ compte) => compte + 1, 0);
  const suivreLaSourisSurLeSite = useCallback((x = 0, y = 0) => {
    ghostX.value = x - decalageCalqueRef.current.x - (GHOST_TOKEN_SIZE.width / 2);
    ghostY.value = y - decalageCalqueRef.current.y - (GHOST_TOKEN_SIZE.height / 2);
    redessinerLeFantome();
  }, [ghostX, ghostY]);

  const beginDrag = useCallback((player) => {
    if (!player) return;
    measureField();
    if (surLeSite) {
      const calque = /** @type {any} */ (calqueFantomeRef.current);
      calque?.measureInWindow?.((/** @type {number} */ x, /** @type {number} */ y) => {
        decalageCalqueRef.current = { x: Number(x) || 0, y: Number(y) || 0 };
      });
    }
    Vibration.vibrate(8);
    setActiveDragPlayer(player);
  }, [measureField, surLeSite]);

  const clearDragPlayer = useCallback(() => {
    setActiveDragPlayer(null);
  }, []);

  const endDrag = useCallback((player, source, pageX, pageY) => {
    const playerId = getCompositionPlayerId(player);
    if (!playerId) return;
    const rect = fieldRectRef.current;

    const droppedOnField = Boolean(rect)
      && pageX >= rect.x && pageX <= rect.x + rect.width
      && pageY >= rect.y && pageY <= rect.y + rect.height;

    if (droppedOnField) {
      setPlacements((current) => placePlayerAt({
        magnetEnabled,
        placements: current,
        playerId,
        slots,
        x: ((pageX - rect.x) / rect.width) * 100,
        y: ((pageY - rect.y) / rect.height) * 100,
      }));
      return;
    }

    // Lache hors du terrain : un jeton qui en venait retourne au banc. Un jeton
    // qui venait deja du banc n'a rien a faire — il y est.
    if (source !== SOURCE_BENCH) {
      setPlacements((current) => removePlayerFromField(current, playerId));
    }
  }, [magnetEnabled, slots]);

  const createDragGesture = useCallback((player, source) => (
    Gesture.Pan()
      .activateAfterLongPress(LONG_PRESS_MS)
      .minDistance(6)
      .onStart((event) => {
        'worklet';

        // La position d'abord, sur ce fil-ci : l'apercu est sous le doigt des la
        // premiere image, meme si le fil JS met du temps a repondre.
        ghostX.value = event.absoluteX - (GHOST_TOKEN_SIZE.width / 2);
        ghostY.value = event.absoluteY - (GHOST_TOKEN_SIZE.height / 2);
        ghostScale.value = withSpring(1, DRAG_SPRING);
        ghostOpacity.value = withTiming(1, { duration: 90 });
        runOnJS(beginDrag)(player);
      })
      .onUpdate((event) => {
        'worklet';

        ghostX.value = event.absoluteX - (GHOST_TOKEN_SIZE.width / 2);
        ghostY.value = event.absoluteY - (GHOST_TOKEN_SIZE.height / 2);
        // 🖱️ COMPO-WEB — le site seulement (voir `suivreLaSourisSurLeSite`).
        if (surLeSite) runOnJS(suivreLaSourisSurLeSite)(event.absoluteX, event.absoluteY);
      })
      .onEnd((event) => {
        'worklet';

        runOnJS(endDrag)(player, source, event.absoluteX, event.absoluteY);
      })
      .onFinalize(() => {
        'worklet';

        ghostScale.value = withSpring(0, DRAG_SPRING);
        ghostOpacity.value = withTiming(0, { duration: 140 });
        runOnJS(clearDragPlayer)();
      })
  ), [
    beginDrag,
    clearDragPlayer,
    endDrag,
    ghostOpacity,
    ghostScale,
    ghostX,
    ghostY,
    suivreLaSourisSurLeSite,
    surLeSite,
  ]);

  // --- Enregistrer / publier.
  const buildPack = useCallback(() => buildMatchCompositionPack({
    basePack: teamComposition?.draft || teamComposition?.bootstrap?.composition || null,
    manualPlayers,
    placements,
    players: selectedPlayers,
    requireResponse,
    sport,
    teamName,
  }), [
    manualPlayers,
    placements,
    requireResponse,
    selectedPlayers,
    sport,
    teamComposition,
    teamName,
  ]);

  /**
   * C-A — un refus du serveur montre l'OFFRE quand il en porte une.
   *
   * 💰 Le serveur repond 403 en JOIGNANT la decision d'abonnement
   * (`details.decision`, pose par `buildSubscriptionPermissionDeniedDetails`).
   * Jusqu'ici cet ecran affichait une alerte generique : le coach etait refuse
   * sans qu'on lui montre ce qui debloquerait son geste. C'est le motif deja
   * utilise par RequestsHub et 11 autres ecrans, repris tel quel.
   *
   * 🧨 La feuille de publication doit se REFERMER : posee par-dessus, elle
   * masquerait le mur payant.
   *
   * Les 2 gestes de l'ecran passent par ici — publier commence par enregistrer,
   * et c'est cet enregistrement-la qui est refuse en premier.
   * @param {any} error - L'erreur rejetee par le service.
   * @param {string} messageKey - La cle du message d'erreur ordinaire.
   * @returns {void}
   */
  const handleActionError = useCallback((
    /** @type {any} */ error,
    /** @type {string} */ messageKey,
  ) => {
    const subscriptionDecision = extractSubscriptionDecisionFromError(error);
    if (subscriptionDecision) {
      setIsSheetVisible(false);
      setSubscriptionPaywallDecision(subscriptionDecision);
      return;
    }

    Alert.alert(
      t('matchComposition.board.alerts.error.title'),
      t(messageKey),
    );
  }, [t]);

  // 🔒 COMPOLECT — LE VERROU EST ICI, PAS SEULEMENT SUR LE BOUTON. Retirer un
  // bouton cache un geste ; le fermer a la source le supprime. Les 2 seules
  // ecritures de l'ecran passent par ces 2 fonctions.
  const handleSave = useCallback(async () => {
    if (isReadOnly || publicationBloquee) return;
    if (!eventId || !teamId || isBusy) return;
    setIsBusy(true);
    try {
      await saveEventCompositionDraft(eventId, { draft: buildPack(), teamId });
      setIsSheetVisible(false);
      Alert.alert(
        t('matchComposition.board.alerts.saved.title'),
        t('matchComposition.board.alerts.saved.message'),
      );
    } catch (error) {
      handleActionError(error, 'matchComposition.board.alerts.error.save');
    } finally {
      setIsBusy(false);
    }
  }, [buildPack, eventId, handleActionError, isBusy, isReadOnly, publicationBloquee, t, teamId]);

  const handlePublish = useCallback(async () => {
    if (isReadOnly || publicationBloquee) return;
    if (!eventId || !teamId || isBusy) return;
    setIsBusy(true);
    try {
      // La compo part TOUJOURS avant la convocation : publier ce qui n'a pas ete
      // enregistre publierait l'etat precedent.
      await saveEventCompositionDraft(eventId, { draft: buildPack(), teamId });
      await publishEventConvocation(eventId, { teamId });

      // 🧨 AB03 — CE DOSSIER NE RAFRAICHISSAIT RIEN, ET C'EST CE QUI FAISAIT
      // « attendre pour voir ». Mesure du 2026-08-20 : `matchCallUp/` ne
      // contenait AUCUNE occurrence de `queryClient` sur ses onze fichiers,
      // alors que c'est le chemin d'une composition de MATCH. Or `EventDetails`
      // monte `useGetEventConvocation` et `useGetEventTeamComposition` avec
      // `refetchOnMount: false`, et son rafraichissement au retour de focus se
      // desarme quand la donnee a moins de 30 s (`EVENT_DETAILS_STALE_MS`).
      // ⇒ le coach revenait sur son match SANS sa composition, et devait
      //   attendre que ces 30 s passent — ou tirer pour rafraichir.
      // ♻️ `publishComposition` etait DEJA declare dans le module de T08 et
      //   n'etait appele par personne : aucune racine neuve n'est inventee ici.
      // ⚠️ On ne l'attend pas : `invalidateQueries` marque les requetes de
      //   facon SYNCHRONE, seule la relecture est asynchrone, et le
      //   `queryClient` est un singleton qui survit au demontage de cet ecran.
      invalidateAfterAction(queryClient, 'publishComposition').catch(() => {});

      // 🧩 Le serveur vient de poster la bulle de composition dans le fil de
      // l'equipe (`publishLineupShareToTeamChat`) — mais il ne rend PAS l'id du
      // fil dans sa reponse. On le retrouve donc par le helper partage du depot,
      // celui qu'emploie deja `TeamDetails` : il cherche le fil existant avant
      // d'en creer un, et ici il existe forcement, la publication vient de le
      // creer au besoin.
      //
      // ⏱️ AB03 — MAIS ON NE L'ATTEND PLUS AVANT DE PARLER. Ce troisieme
      // aller-retour (`loadChatsForLookup`, puis la creation du fil s'il
      // manque) ne sert QU'A l'atterrissage, c'est-a-dire uniquement si
      // l'utilisateur appuie sur « OK » — et il etait paye par tout le monde, y
      // compris par ceux qui ferment l'alerte. Il part maintenant EN MEME TEMPS
      // que l'alerte s'affiche, et n'est lu qu'au moment ou il sert.
      // 📏 Mesure (temoin de vitesse, 40 ms de latence simulee) : 58 ms -> 8 ms.
      const filDeLEquipe = startTeamChat(teamId).catch(() => null);

      setIsSheetVisible(false);
      const allerALaFicheEtAuFil = () => {
        // 🚪 T01 — DEPILER AVANT DE PARTIR, et c'est ce qui repare le retour.
        // Le fil de l'equipe ne vit pas dans cette pile mais dans
        // `PrivateNavigator` : y aller laisse les 3 ecrans de composition
        // DESSOUS, et le bouton retour retombe sur l'ecran de publication —
        // une compo publiee se reproposait ainsi a la republication.
        // `popTo` est l'idiome du depot (`FriendlyMatchWizardRecap`) ; on
        // n'emploie pas `reset`, qui ecrase la pile entiere (defaut deja paye
        // par `HistoryWizardSingle`).
        // @ts-ignore
        navigation.popTo(RouteNames.EventDetails, { eventId });
        // Sans fil trouve, on s'arrete a l'evenement : jamais bloque, et
        // jamais de retour vers l'ecran de publication.
        // ⚠️ L'evenement est atteint AVANT de lire le fil : si la recherche
        // n'est pas encore revenue, le coach est deja arrive quelque part.
        filDeLEquipe.then((/** @type {any} */ teamChat) => {
          if (teamChat?.documentId) {
            // @ts-ignore
            navigation.navigate(RouteNames.Conversation, { chatId: teamChat.documentId });
          }
        });
      };
      // 🌐 COMPO-WEB — SUR LE SITE, UNE ALERTE SANS CHOIX. La doublure `Alert` du
      // site change toute alerte A BOUTON en OK / ANNULER du navigateur :
      // « Annuler » laissait l'entraineur sur le terrain, et un second « Publier »
      // renvoyait la convocation — et ses notifications — a toute l'equipe. Le site
      // informe donc, puis part. ⛔ Telephone : l'alerte et son bouton, inchanges.
      if (Platform.OS === 'web') {
        Alert.alert(
          t('matchComposition.board.alerts.published.title'),
          t('matchComposition.board.alerts.published.message'),
        );
        allerALaFicheEtAuFil();
        return;
      }
      Alert.alert(
        t('matchComposition.board.alerts.published.title'),
        t('matchComposition.board.alerts.published.message'),
        [{
          onPress: allerALaFicheEtAuFil,
          text: t('matchComposition.board.alerts.published.ok'),
        }],
      );
    } catch (error) {
      handleActionError(error, 'matchComposition.board.alerts.error.publish');
    } finally {
      setIsBusy(false);
    }
  }, [
    buildPack,
    eventId,
    handleActionError,
    isBusy,
    isReadOnly,
    navigation,
    publicationBloquee,
    queryClient,
    startTeamChat,
    t,
    teamId,
  ]);

  const renderChip = (/** @type {string} */ label, /** @type {boolean} */ isOn) => (
    <View
      key={label}
      style={[
        styles.chip,
        {
          backgroundColor: isOn ? withAlpha(Colors.primary500, 0.12) : Colors.transparent,
          borderColor: isOn ? Colors.primary500 : withAlpha(Colors.neutral00, 0.28),
        },
      ]}
    >
      <Text style={[Fonts.p4Bold, { color: isOn ? Colors.primary500 : Colors.neutral00 }]}>
        {label}
      </Text>
    </View>
  );

  const renderSummaryRow = (label, value, isFirst) => (
    <View
      key={label}
      style={[
        styles.summaryRow,
        {
          borderTopColor: withAlpha(Colors.neutral00, 0.08),
          borderTopWidth: isFirst ? 0 : 1,
        },
      ]}
    >
      <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>{label}</Text>
      <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>{value}</Text>
    </View>
  );

  return (
    <GestureHandlerRootView style={styles.root}>
      {/* COMPOMSG — `fillHeight` : sur le SITE, le gabarit n'etire pas son
          contenu, et le terrain (en `flex: 1`) y tombait a 0 px. Sans effet
          sur l'iPhone, ou le gabarit remplit deja l'ecran. */}
      <ScreenContainer
        bgImage="bg2"
        bottomInsetMode="edge-to-edge"
        fillHeight
        style={[styles.screen]}
      >
        <View style={styles.header}>
          <HeaderBackButton onPress={() => navigation.goBack()} />
          <View style={styles.headerTexts}>
            <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>
              {t('matchComposition.board.title')}
            </Text>
            <Text numberOfLines={1} style={[Fonts.p3, { color: Colors.neutral300 }]}>
              {[t('matchComposition.start.eventLabel'), teamName, sportLabel]
                .filter(Boolean).join(' · ')}
            </Text>
          </View>
          {/* Le pack dit « retour a la selection » : on remonte a l'ecran 1, pas
              a l'ecran 4. `navigate` vers un ecran deja empile y revient en
              depilant, donc la selection cochee est retrouvee telle quelle.
              🧨 S04 — ET LE TERRAIN PART AVEC. Depiler cet ecran DETRUIT son
              `useState` : sans ce parametre, les jetons poses a la main
              n'existent plus nulle part, et le retour les reconstruisait depuis
              une rangee de depart.
              🚪 COMPOLECT (D2) — EN CONSULTATION, C'EST LA SEULE PORTE VERS
              L'ECRITURE, et elle n'existe que pour qui peut vraiment modifier.
              🧨 ET ELLE DOIT EFFACER `readOnly` : `MatchCallUpSelection`
              retransmet `...params` au terrain (`:318`). Un `readOnly` oublie
              ici reviendrait par la bande et rendrait l'EDITION consultable. */}
          {isReadOnly && !canEdit ? null : (
            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.8}
              // @ts-ignore
              onPress={() => navigation.navigate(RouteNames.MatchCallUpSelection, {
                ...params,
                canEdit: true,
                readOnly: false,
                startPlacements: placements,
              })}
              style={[
                styles.editButton,
                {
                  backgroundColor: withAlpha(Colors.primary500, 0.12),
                  borderColor: withAlpha(Colors.primary500, 0.45),
                },
              ]}
            >
              <Text style={[Fonts.p4Bold, { color: Colors.primary500 }]}>
                {t('matchComposition.board.edit')}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.chipRow}>
          {/* 👀 COMPOMSG — « 8/11 places » compte les POSTES ENCORE VIDES : c'est
              un outil d'entraineur. Un lecteur (joueur, dirigeant) lit ce qu'il
              cherche : combien de titulaires. L'entraineur garde sa pastille. */}
          {isReadOnly && !canEdit
            ? renderChip(t('matchComposition.board.chips.starters', {
              count: counters.placed,
            }), true)
            : renderChip(t('matchComposition.board.chips.placed', {
              placed: counters.placed, starters: counters.starters,
            }), true)}
          {renderChip(t('matchComposition.board.chips.bench', { count: counters.bench }), false)}
          <View style={styles.chipSpacer} />
          {/* La pastille d'aimantation decrit un GESTE de placement : en
              consultation elle n'aurait plus d'objet. Les 2 pastilles de
              COMPTAGE, elles, restent — c'est la lecture du terrain. */}
          {isReadOnly ? null : renderChip(magnetEnabled
            ? t('matchComposition.board.chips.magnet')
            : t('matchComposition.board.chips.freePlacement'), false)}
        </View>

        {/* 🪧 COMPOMSG — la carte du fil etait une version DEPASSEE : on le dit,
            sinon le lecteur croit que la compo a change sous ses yeux. */}
        {isMessageOutdated ? (
          <View
            style={[
              styles.versionBanner,
              {
                backgroundColor: withAlpha(Colors.primary500, 0.12),
                borderColor: withAlpha(Colors.primary500, 0.45),
              },
            ]}
          >
            <Text style={[Fonts.p4, { color: Colors.neutral00 }]}>
              {t('matchComposition.board.updatedSinceMessage', { version: serverVersion })}
            </Text>
          </View>
        ) : null}

        <View onLayout={measureFieldWrapper} style={styles.fieldWrapper}>
          <View
            collapsable={false}
            onLayout={measureField}
            ref={fieldNodeRef}
            style={[
              styles.fieldSurface,
              { aspectRatio: 1 / getTacticalFieldAspectRatio(sport) },
              siteFieldSize,
            ]}
            testID="compo-terrain"
          >
            <RenderedTacticalField sport={sport} style={styles.fieldFill}>
              {/* 🎁 LOT TERRAIN — LES POSTES SE VOIENT ENFIN.
                  Le plateau ne dessinait QUE les jetons poses : le coach ne
                  savait pas ou l'aimantation allait coller, ni combien de
                  postes restaient. On dessine donc les postes ENCORE LIBRES, en
                  creux. Un poste tenu disparait sous son jeton — deux dessins
                  au meme endroit seraient illisibles. */}
              {freeSlots.map((/** @type {any} */ entry) => (
                <View
                  key={`slot-${entry.slotId}`}
                  // 🪤 `box-none` et NON `none`, et ce n'est pas un detail : le
                  // temoin V03 entre dans l'arbre par « la premiere vue qui se
                  // declare intraversable au doigt » pour retrouver le jeton
                  // fantome. Un `pointerEvents="none"` ici se serait glisse
                  // AVANT lui et aurait fait mesurer un repere de poste a la
                  // place du fantome. `box-none` dit la meme chose pour une vue
                  // sans enfant — jamais une cible — sans voler cette entree.
                  pointerEvents="box-none"
                  style={[
                    styles.fieldSlot,
                    {
                      borderColor: withAlpha(Colors.neutral00, 0.45),
                      left: `${entry.positionX}%`,
                      top: `${entry.positionY}%`,
                    },
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={[Fonts.p4Bold, { color: withAlpha(Colors.neutral00, 0.75) }]}
                  >
                    {entry.label}
                  </Text>
                </View>
              ))}
              {placements.map((/** @type {any} */ placement) => {
                const player = playerById.get(String(placement?.playerId || ''));
                if (!player) return null;
                const jeton = (
                  <View
                    accessibilityLabel={t('matchComposition.board.tokenOnField', {
                      name: `${player?.firstname || ''} ${player?.lastname || ''}`.trim(),
                    })}
                    accessibilityRole={clavierActif ? 'button' : undefined}
                    accessibilityState={clavierActif
                      ? { selected: joueurAuClavier === String(placement.playerId) }
                      : undefined}
                    focusable={clavierActif || undefined}
                    key={`placed-${placement.playerId}`}
                    onBlur={perdreLeFocus(`jeton:${placement.playerId}`)}
                    onFocus={prendreLeFocus(`jeton:${placement.playerId}`)}
                    // @ts-ignore — `onKeyDown` n'existe que sur le site (react-native-web).
                    onKeyDown={clavierActif ? toucheSurUnJeton(player) : undefined}
                    style={[
                      styles.fieldToken,
                      { left: `${placement.positionX}%`, top: `${placement.positionY}%` },
                      anneauClavier(
                        `jeton:${placement.playerId}`,
                        joueurAuClavier === String(placement.playerId),
                      ),
                    ]}
                  >
                    <DraggableToken isOnField player={player} />
                  </View>
                );
                // 🔒 COMPOLECT — en consultation le jeton n'est plus qu'un
                // dessin : sans `GestureDetector` autour de lui, aucun appui
                // long ne peut le decoller.
                if (isReadOnly) return jeton;
                return (
                  <GestureDetector
                    gesture={createDragGesture(player, String(placement.playerId))}
                    key={`placed-${placement.playerId}`}
                  >
                    {jeton}
                  </GestureDetector>
                );
              })}
              {/* ⌨️ COMPO-WEB — un joueur est choisi au clavier : chaque poste
                  LIBRE devient une cible (un vrai bouton, atteignable a la
                  tabulation). Sans poste libre, une seule cible : la premiere
                  case libre du terrain. */}
              {joueurChoisi ? (freeSlots.length > 0 ? freeSlots : [null]).map((
                /** @type {any} */ entry,
              ) => (
                <TouchableOpacity
                  accessibilityLabel={entry
                    ? t('matchComposition.board.keyboard.placeOnSlot', {
                      label: entry.label, name: nomDuJoueurChoisi,
                    })
                    : t('matchComposition.board.keyboard.placeOnField', {
                      name: nomDuJoueurChoisi,
                    })}
                  accessibilityRole="button"
                  activeOpacity={0.8}
                  key={`cible-${entry ? entry.slotId : 'terrain'}`}
                  onBlur={perdreLeFocus(`cible:${entry ? entry.slotId : 'terrain'}`)}
                  onFocus={prendreLeFocus(`cible:${entry ? entry.slotId : 'terrain'}`)}
                  onPress={() => poserAuClavier(entry
                    ? { surUnPoste: true, x: entry.positionX, y: entry.positionY }
                    : { surUnPoste: false, x: caseLibreAuClavier.x, y: caseLibreAuClavier.y })}
                  style={[
                    styles.cibleClavier,
                    {
                      backgroundColor: withAlpha(Colors.primary500, 0.22),
                      borderColor: focusClavier === `cible:${entry ? entry.slotId : 'terrain'}`
                        ? Colors.neutral00
                        : Colors.primary500,
                      left: `${entry ? entry.positionX : caseLibreAuClavier.x}%`,
                      top: `${entry ? entry.positionY : caseLibreAuClavier.y}%`,
                    },
                  ]}
                >
                  <Text numberOfLines={1} style={[Fonts.p4Bold, { color: Colors.neutral00 }]}>
                    {entry ? entry.label : '+'}
                  </Text>
                </TouchableOpacity>
              )) : null}
            </RenderedTacticalField>
          </View>
        </View>

        <View
          style={[
            styles.benchStrip,
            {
              backgroundColor: withAlpha(Colors.neutral00, 0.04),
              borderTopColor: withAlpha(Colors.neutral00, 0.1),
            },
          ]}
        >
          <View style={styles.benchHeader}>
            <Text style={[Fonts.p3Bold, styles.benchTitle, { color: Colors.neutral00 }]}>
              {t('matchComposition.board.bench.title', { count: counters.bench }).toUpperCase()}
            </Text>
            {/* « Glisse un joueur sur le terrain » promet un geste : en
                consultation il n'existe pas, la consigne mentirait. */}
            {isReadOnly ? null : (
              <Text numberOfLines={1} style={[Fonts.p4, { color: Colors.neutral300 }]}>
                {t('matchComposition.board.bench.hint')}
              </Text>
            )}
          </View>
          {/* ⌨️ COMPO-WEB — le chemin clavier se DIT (sinon personne ne le trouve),
              et le joueur choisi s'annonce au lecteur d'ecran. */}
          {clavierActif ? (
            <View accessibilityLiveRegion="polite" style={styles.clavierBar}>
              <Text style={[Fonts.p4, styles.clavierTexte, { color: Colors.neutral300 }]}>
                {joueurChoisi
                  ? t('matchComposition.board.keyboard.picked', { name: nomDuJoueurChoisi })
                  : t('matchComposition.board.keyboard.hint')}
              </Text>
              {joueurChoisiSurLeTerrain ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  activeOpacity={0.8}
                  onBlur={perdreLeFocus('action:banc')}
                  onFocus={prendreLeFocus('action:banc')}
                  onPress={remettreAuBancAuClavier}
                  style={[styles.clavierAction, {
                    borderColor: focusClavier === 'action:banc'
                      ? Colors.neutral00
                      : withAlpha(Colors.primary500, 0.45),
                  }]}
                >
                  <Text style={[Fonts.p4Bold, { color: Colors.primary500 }]}>
                    {t('matchComposition.board.keyboard.toBench', { name: nomDuJoueurChoisi })}
                  </Text>
                </TouchableOpacity>
              ) : null}
              {joueurChoisi ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  activeOpacity={0.8}
                  onBlur={perdreLeFocus('action:annuler')}
                  onFocus={prendreLeFocus('action:annuler')}
                  onPress={() => setJoueurAuClavier(null)}
                  style={[styles.clavierAction, {
                    borderColor: focusClavier === 'action:annuler'
                      ? Colors.neutral00
                      : withAlpha(Colors.neutral00, 0.28),
                  }]}
                >
                  <Text style={[Fonts.p4Bold, { color: Colors.neutral00 }]}>
                    {t('matchComposition.board.keyboard.cancel')}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
          <ScrollView
            contentContainerStyle={styles.benchContent}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {benchPlayers.length === 0 ? (
              <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
                {t('matchComposition.board.bench.empty')}
              </Text>
            ) : null}
            {benchPlayers.map((/** @type {any} */ player) => {
              const estChoisi = clavierActif && joueurAuClavier === getCompositionPlayerId(player);
              const jeton = (
                <View
                  accessibilityLabel={t('matchComposition.board.tokenOnBench', {
                    name: `${player?.firstname || ''} ${player?.lastname || ''}`.trim(),
                  })}
                  accessibilityRole={clavierActif ? 'button' : undefined}
                  accessibilityState={clavierActif ? { selected: estChoisi } : undefined}
                  focusable={clavierActif || undefined}
                  key={`bench-${getCompositionPlayerId(player)}`}
                  onBlur={perdreLeFocus(`jeton:${getCompositionPlayerId(player)}`)}
                  onFocus={prendreLeFocus(`jeton:${getCompositionPlayerId(player)}`)}
                  // @ts-ignore — `onKeyDown` n'existe que sur le site (react-native-web).
                  onKeyDown={clavierActif ? toucheSurUnJeton(player) : undefined}
                  style={anneauClavier(
                    `jeton:${getCompositionPlayerId(player)}`,
                    estChoisi,
                  ) || undefined}
                >
                  <DraggableToken player={player} />
                </View>
              );
              if (isReadOnly) return jeton;
              return (
                <GestureDetector
                  gesture={createDragGesture(player, SOURCE_BENCH)}
                  key={`bench-${getCompositionPlayerId(player)}`}
                >
                  {jeton}
                </GestureDetector>
              );
            })}
          </ScrollView>
        </View>

        {/* 🚪 COMPOLECT (D4) — LES REPONSES DES CONVOQUES RESTENT ATTEIGNABLES.
            `MatchConvocationPublished` porte les reponses et la relance, et
            Adel s'en sert : deplacer l'ouverture de la convocation vers ce
            terrain sans laisser de porte l'aurait rendu inatteignable. Un ecran
            qu'aucun bouton n'atteint n'existe pas — le depot a deja paye cette
            erreur trois fois.
            🔒 Reserve a `canEdit`, et ce n'est pas une precaution de style :
            l'ecran 7 lit `GET /events/:id/composition`, que le serveur ferme
            par `ensureCanManageTeam`. Un simple membre y recevrait un 403. */}
        {isReadOnly && canEdit ? (
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <Button
              // @ts-ignore — `navigate` est bien la sur un ecran de pile.
              onPress={() => navigation.navigate(RouteNames.MatchConvocationPublished, {
                clubId,
                eventId,
                eventLabel,
                players: selectedPlayers,
                sport,
                teamId,
                teamName,
              })}
              style={styles.footerPublish}
              title={t('matchConvocation.published.openCta')}
              variant="Secondary"
            />
          </View>
        ) : null}

        {/* 🔒 COMPOLECT (D1) — EN CONSULTATION, LE PIED D'ECRAN NE PORTE PLUS
            AUCUNE ACTION D'ECRITURE. Le terrain gagne la place. */}
        {/* 🔒 COMPO-WEB — POURQUOI ON NE PEUT PAS PUBLIER, dit en clair. Le terrain
            est arrive vide (lien, rechargement) et la relecture du serveur n'a
            rien rendu : publier remplacerait la vraie compo par une compo vide. */}
        {publicationBloquee ? (
          <View
            accessibilityLiveRegion="polite"
            style={[
              styles.gardeBanner,
              {
                backgroundColor: withAlpha(Colors.warning500, 0.09),
                borderColor: withAlpha(Colors.warning500, 0.34),
              },
            ]}
          >
            <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>{gardeTitre}</Text>
            {gardeMessage ? (
              <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>{gardeMessage}</Text>
            ) : null}
          </View>
        ) : null}

        {isReadOnly ? null : (
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <Button
              disabled={publicationBloquee}
              onPress={handleSave}
              style={styles.footerSave}
              title={t('matchComposition.board.actions.save')}
              variant="Secondary"
            />
            <Button
              disabled={publicationBloquee}
              icon="send"
              iconPosition="before"
              onPress={() => {
                if (publicationBloquee) return;
                setIsSheetVisible(true);
              }}
              style={styles.footerPublish}
              title={t('matchComposition.board.actions.publish')}
              variant="Primary"
            />
          </View>
        )}
      </ScreenContainer>

      {/* ECRAN 6 — la feuille. Le terrain reste derriere : c'est `BottomModal`
          qui pose le voile et le flou, on ne les redessine pas. */}
      <BottomModal
        close={() => setIsSheetVisible(false)}
        footerComponent={(
          <View style={styles.sheetFooter}>
            <Button
              onPress={handleSave}
              style={styles.sheetSave}
              title={t('matchComposition.board.actions.save')}
              variant="Secondary"
            />
            <Button
              onPress={handlePublish}
              style={styles.sheetPublish}
              title={t('matchComposition.sheet.actions.publish')}
              variant="Primary"
            />
          </View>
        )}
        isVisible={isSheetVisible}
        snapPoints={['64%']}
        // Le pack demande un bleu-vert tres sombre et un rayon 28 en haut. Ce
        // bleu n'est PAS un jeton du theme : `primary800` en est le plus proche
        // (2 points de luminosite d'ecart), et c'est lui qu'on pose — aucun hex
        // neuf n'entre dans le code, meme en commentaire : le contrat de theme
        // les compte AUSSI dans les commentaires.
        style={[styles.sheetSurface, { backgroundColor: Colors.primary800 }]}
      >
        <View style={styles.sheetBody}>
          {/* La poignee cyan 54x5 du pack : `BottomModal` passe
              `handleComponent={null}`, elle n'existe donc pas sans nous. */}
          <View style={[styles.sheetHandle, { backgroundColor: Colors.primary500 }]} />
          <Text style={[Fonts.p4Bold, styles.sheetKicker, { color: Colors.primary500 }]}>
            {t('matchComposition.sheet.kicker').toUpperCase()}
          </Text>
          <Text style={[Fonts.h3Bold, styles.sheetTitle, { color: Colors.neutral00 }]}>
            {t('matchComposition.sheet.title')}
          </Text>
          <Text style={[Fonts.p2, styles.sheetText, { color: Colors.neutral300 }]}>
            {t('matchComposition.sheet.description', { teamName })}
          </Text>

          <View
            style={[
              styles.summaryCard,
              {
                backgroundColor: withAlpha(Colors.neutral00, 0.05),
                borderColor: withAlpha(Colors.neutral00, 0.1),
              },
            ]}
          >
            {renderSummaryRow(
              t('matchComposition.sheet.summary.starters'),
              t('matchComposition.sheet.summary.startersValue', { count: counters.placed }),
              true,
            )}
            {renderSummaryRow(
              t('matchComposition.sheet.summary.substitutes'),
              t('matchComposition.sheet.summary.substitutesValue', { count: counters.bench }),
              false,
            )}
            {renderSummaryRow(
              t('matchComposition.sheet.summary.offApp'),
              t('matchComposition.sheet.summary.offAppValue', { count: counters.offApp }),
              false,
            )}
          </View>

          <View style={styles.responseRow}>
            <View style={styles.responseTexts}>
              <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>
                {t('matchComposition.sheet.requireResponse.title')}
              </Text>
              <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
                {t('matchComposition.sheet.requireResponse.subtitle')}
              </Text>
            </View>
            <Switch
              accessibilityLabel={t('matchComposition.sheet.requireResponse.title')}
              onValueChange={setRequireResponse}
              thumbColor={Colors.neutral00}
              trackColor={{ false: Colors.neutral700, true: Colors.primary500 }}
              value={requireResponse}
            />
          </View>
        </View>
      </BottomModal>

      {/* Jeton fantome qui suit le doigt, au-dessus de tout.
          🧨 T01 — LE CALQUE RESTE MONTE, TOUJOURS : ne le faire naitre qu'avec
          `activeDragPlayer`, qui arrive par le fil JS, le faisait apparaitre en
          retard a `top: 0, left: 0`.
          🧨 V03 — ET IL NE BOUGE PLUS. Il portait la position, alors qu'il ne
          declarait AUCUNE dimension : un calque sans boite ne donne aucun repere
          a l'enfant absolu qu'il contient (`styles.ghostToken`), et le seul
          apercu du depot qui tient debout — `tactical_v2/TacticalBoard.js` — fait
          l'inverse depuis toujours : un calque plein ecran immobile, et le JETON
          qui porte la position. C'est ce motif-la qui est repris ici, tel quel.
          Il ne coute rien tant qu'il est vide, et `pointerEvents="none"`
          l'empeche d'intercepter le moindre appui. */}
      <View
        pointerEvents="none"
        ref={calqueFantomeRef}
        style={styles.dragGhostLayer}
        testID="compo-fantome"
      >
        {activeDragPlayer ? (
          <DraggableToken
            isGhost
            opacity={ghostOpacity}
            player={activeDragPlayer}
            scale={ghostScale}
            translateX={ghostX}
            translateY={ghostY}
          />
        ) : null}
      </View>

      {/* C-A — le mur payant. Le club vient de la decision elle-meme : le
          serveur le joint a son refus, cet ecran ne le recoit pas en parametre. */}
      <SubscriptionPaywallSheet
        close={() => setSubscriptionPaywallDecision(null)}
        clubDocumentId={subscriptionPaywallDecision?.clubDocumentId || null}
        decision={subscriptionPaywallDecision}
        isVisible={Boolean(subscriptionPaywallDecision)}
        navigation={navigation}
      />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  benchContent: {
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  benchHeader: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    paddingBottom: 8,
    paddingHorizontal: 16,
  },
  benchStrip: {
    borderTopWidth: 1,
    paddingBottom: 8,
    paddingTop: 12,
  },
  benchTitle: {
    letterSpacing: 0.6,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 28,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  chipSpacer: {
    flex: 1,
  },
  // ⌨️ COMPO-WEB — la cible d'un poste, choisie au clavier : un cercle plein,
  // plus gros que le repere en pointilles qu'il recouvre (44 px, cible tactile).
  cibleClavier: {
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 2,
    height: 44,
    justifyContent: 'center',
    marginLeft: -22,
    marginTop: -22,
    position: 'absolute',
    width: 44,
  },
  clavierAction: {
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 32,
    paddingHorizontal: 12,
  },
  clavierBar: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 8,
    paddingHorizontal: 16,
  },
  clavierTexte: {
    flexShrink: 1,
  },
  dragGhostLayer: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 9999,
  },
  editButton: {
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 16,
  },
  fieldFill: {
    borderRadius: 16,
    flex: 1,
  },
  fieldSurface: {
    alignSelf: 'center',
    borderRadius: 16,
    maxWidth: '100%',
  },
  // 🎁 LOT TERRAIN — le repere d'un poste LIBRE. Un cercle en pointilles de
  // 34 pt, centre sur son point : plus petit que le jeton (58 pt) pour qu'on
  // voie d'un coup d'oeil ce qui est tenu et ce qui ne l'est pas.
  fieldSlot: {
    alignItems: 'center',
    borderRadius: 17,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    height: 34,
    justifyContent: 'center',
    marginLeft: -17,
    marginTop: -17,
    position: 'absolute',
    width: 34,
  },
  fieldToken: {
    marginLeft: -29,
    marginTop: -36,
    position: 'absolute',
  },
  fieldWrapper: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: FIELD_WRAPPER_PADDING,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  footerPublish: {
    flex: 1,
  },
  footerSave: {
    flex: 1,
  },
  // 🔒 COMPO-WEB — le bandeau qui dit pourquoi la publication est fermee.
  gardeBanner: {
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
    marginHorizontal: 16,
    marginTop: 8,
    padding: 12,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingRight: 16,
    paddingVertical: 8,
  },
  headerTexts: {
    flex: 1,
  },
  // ⌨️ COMPO-WEB — le jeton choisi au clavier porte un anneau.
  jetonChoisi: {
    borderRadius: 16,
    borderWidth: 2,
  },
  responseRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  responseTexts: {
    flex: 1,
  },
  root: {
    flex: 1,
  },
  screen: {
    paddingHorizontal: 0,
  },
  sheetBody: {
    paddingBottom: 12,
  },
  sheetFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  sheetHandle: {
    alignSelf: 'center',
    borderRadius: 3,
    height: 5,
    marginBottom: 16,
    width: 54,
  },
  sheetKicker: {
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  sheetPublish: {
    flex: 1,
  },
  sheetSave: {
    flex: 1,
  },
  sheetSurface: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  sheetText: {
    marginTop: 8,
    textAlign: 'center',
  },
  sheetTitle: {
    marginTop: 4,
    textAlign: 'center',
  },
  summaryCard: {
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 16,
    paddingHorizontal: 16,
  },
  summaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  // Memes marges que la rangee des pastilles juste au-dessus.
  versionBanner: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});

export default MatchCompositionBoard;
