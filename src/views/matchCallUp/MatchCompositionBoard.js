/* eslint-disable jsdoc/require-jsdoc */
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import {
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
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

import { RouteNames } from '@/navigation/routeNames';

import {
  publishEventConvocation,
  saveEventCompositionDraft,
} from '@/services/event/eventService';

import { getCompositionPlayerId } from '@/utils/compositionPlayer';
import { getTacticalFieldAspectRatio, getTacticalSportKey } from '@/utils/tacticalField';

import { isManualCallUpPlayer } from './matchCallUpUtils';
import {
  buildFormationSlots,
  buildMatchCompositionPack,
  getBenchPlayers,
  getBoardCounters,
  placePlayerAt,
  removePlayerFromField,
} from './matchCompositionUtils';

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

function MatchCompositionBoard() {
  const { Colors, Fonts } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  // Sert a retrouver le fil de l'equipe apres publication (voir `handlePublish`).
  const { startTeamChat } = /** @type {any} */ (useMessaging());

  /** @type {any} */
  const params = useMemo(() => route.params || {}, [route.params]);
  const {
    canEdit = false,
    eventId,
    magnetEnabled = false,
    readOnly = false,
    selectedPlayers = EMPTY_LIST,
    sport = 'football',
    startPlacements = EMPTY_LIST,
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
  const isReadOnly = Boolean(readOnly);

  const [placements, setPlacements] = useState(() => (
    Array.isArray(startPlacements) ? startPlacements : EMPTY_LIST
  ));
  const [isSheetVisible, setIsSheetVisible] = useState(false);
  const [requireResponse, setRequireResponse] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [activeDragPlayer, setActiveDragPlayer] = useState(null);
  const [subscriptionPaywallDecision, setSubscriptionPaywallDecision] = useState(null);

  const slots = useMemo(() => buildFormationSlots(sport), [sport]);
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
  const counters = useMemo(() => getBoardCounters({
    manualPlayers, placements, players: selectedPlayers, sport,
  }), [manualPlayers, placements, selectedPlayers, sport]);

  const playerById = useMemo(() => {
    const map = new Map();
    (Array.isArray(selectedPlayers) ? selectedPlayers : EMPTY_LIST)
      .forEach((/** @type {any} */ player) => {
        const playerId = getCompositionPlayerId(player);
        if (playerId) map.set(playerId, player);
      });
    return map;
  }, [selectedPlayers]);

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
  const beginDrag = useCallback((player) => {
    if (!player) return;
    measureField();
    Vibration.vibrate(8);
    setActiveDragPlayer(player);
  }, [measureField]);

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
    if (isReadOnly) return;
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
  }, [buildPack, eventId, handleActionError, isBusy, isReadOnly, t, teamId]);

  const handlePublish = useCallback(async () => {
    if (isReadOnly) return;
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
      Alert.alert(
        t('matchComposition.board.alerts.published.title'),
        t('matchComposition.board.alerts.published.message'),
        [{
          onPress: () => {
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
          },
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
      <ScreenContainer bgImage="bg2" bottomInsetMode="edge-to-edge" style={[styles.screen]}>
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
          {renderChip(t('matchComposition.board.chips.placed', {
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

        <View style={styles.fieldWrapper}>
          <View
            collapsable={false}
            onLayout={measureField}
            ref={fieldNodeRef}
            style={[styles.fieldSurface, { aspectRatio: 1 / getTacticalFieldAspectRatio(sport) }]}
          >
            <RenderedTacticalField sport={sport} style={styles.fieldFill}>
              {placements.map((/** @type {any} */ placement) => {
                const player = playerById.get(String(placement?.playerId || ''));
                if (!player) return null;
                const jeton = (
                  <View
                    accessibilityLabel={t('matchComposition.board.tokenOnField', {
                      name: `${player?.firstname || ''} ${player?.lastname || ''}`.trim(),
                    })}
                    key={`placed-${placement.playerId}`}
                    style={[
                      styles.fieldToken,
                      { left: `${placement.positionX}%`, top: `${placement.positionY}%` },
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
              const jeton = (
                <View
                  accessibilityLabel={t('matchComposition.board.tokenOnBench', {
                    name: `${player?.firstname || ''} ${player?.lastname || ''}`.trim(),
                  })}
                  key={`bench-${getCompositionPlayerId(player)}`}
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

        {/* 🔒 COMPOLECT (D1) — EN CONSULTATION, LE PIED D'ECRAN NE PORTE PLUS
            AUCUNE ACTION D'ECRITURE. Le terrain gagne la place. */}
        {isReadOnly ? null : (
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <Button
              onPress={handleSave}
              style={styles.footerSave}
              title={t('matchComposition.board.actions.save')}
              variant="Secondary"
            />
            <Button
              icon="send"
              iconPosition="before"
              onPress={() => setIsSheetVisible(true)}
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
      <View pointerEvents="none" style={styles.dragGhostLayer}>
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
  fieldToken: {
    marginLeft: -29,
    marginTop: -36,
    position: 'absolute',
  },
  fieldWrapper: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 14,
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
});

export default MatchCompositionBoard;
