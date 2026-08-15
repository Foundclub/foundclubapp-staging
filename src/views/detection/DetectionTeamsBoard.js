/* eslint-disable jsdoc/require-jsdoc */
import { useNavigation, useRoute } from '@react-navigation/native';
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
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  addTeam,
  getUnassignedIds,
  movePlayerToTeam,
  readTeamLineup,
} from '@/domains/detection/detectionRotation';
import {
  buildDetectionSplitPayload,
  buildDraftPayloadWithSplit,
  getRequestedPosition,
  MAX_DETECTION_TEAMS,
  SPLIT_BY,
  splitIntoTeams,
} from '@/domains/detection/detectionSplit';
import { extractSubscriptionDecisionFromError } from '@/domains/subscription/subscriptionDecision';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import SubscriptionPaywallSheet from '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet';
import RenderedTacticalField from '@/components/tactical/RenderedTacticalField';
import ScreenContainer from '@/components/templates/ScreenContainer';
import DraggableToken from '@/views/tactical_v2/DraggableToken';
// ♻️ Les coordonnees de depart des 5 sports, reprises TELLES QUELLES : le pack
// dit « ce sont les placements valides, reprends-les tels quels ». Les recopier
// ici en ferait une seconde verite qui divergerait au premier ajustement.
// ⚠️ Couplage assume et nomme : c'est le SEUL emprunt de la detection au dossier
// `matchCallUp`, et il ne porte AUCUN texte (le pack interdit les mots du match
// en detection, pas ses tables de sport). Voie de sortie : quand le lot C-F
// retirera `tactical_v2`, ces tables remonteront dans `@/utils/tacticalField`.
import { getMatchFormation } from '@/views/matchCallUp/matchCompositionUtils';

import { RouteNames } from '@/navigation/routeNames';

import { useGetEventTeamComposition } from '@/services/event/eventQueries';
import {
  publishEventConvocation,
  saveEventCompositionDraft,
} from '@/services/event/eventService';

import { getTacticalFieldAspectRatio } from '@/utils/tacticalField';

/**
 * C-E — ECRAN 16 du pack composition : « Terrains multi-equipes ».
 *
 * Un onglet par equipe, un terrain par onglet, et un bandeau `NON AFFECTES · N`
 * en bas. Glisser un jeton du bandeau vers le terrain l'affecte a l'equipe
 * ouverte ; glisser un jeton du terrain vers l'exterieur le rend aux non
 * affectes. C'est le « Glisse pour echanger » du pack.
 *
 * ⚠️ VOCABULAIRE — le mot « banc » est interdit en detection (regle du pack §6).
 * Le mot de remplacement est celui tranche par C-D : **NON AFFECTE**. L'ancien
 * hub (`tactical_v2`) affichait « Remplacants / en attente » : c'est
 * precisement ce que cet ecran remplace.
 *
 * 🧭 CE QUI N'EST PAS RANGE, ET POURQUOI CE N'EST PAS UN MANQUE : les positions
 * x/y de chaque jeton. Le serveur range `teams[].players` (une liste ordonnee)
 * et `teams[].rotation`, rien de plus — mesure du 2026-08-15 sur
 * `normalizeDetectionSplit` (admin `event-composition.ts:495-504`). Le jeton se
 * place donc sur la position de depart du sport, dans l'ordre de la liste. Le
 * pack ne demande pas mieux ici : ses chips disent « Glisse pour echanger » et
 * « Glisse pour placer », pas « place au pixel ». ⇒ aucune migration.
 *
 * ♻️ CE QUI EST REPRIS, PAS REECRIT : `RenderedTacticalField` (les traces),
 * `DraggableToken` (le jeton et son fantome), le geste du board de D79 (appui
 * long 120 ms, `minDistance(6)`, mesure par `measureInWindow`), et
 * `SubscriptionPaywallSheet` — un refus du serveur montre l'offre au lieu d'une
 * alerte muette.
 */

/** @type {any[]} */
const EMPTY_LIST = [];

const GHOST_SIZE = 64;
const LONG_PRESS_MS = 120;
const DRAG_SPRING = { damping: 18, stiffness: 220 };
const SOURCE_UNASSIGNED = 'unassigned';

const getPlayerId = (/** @type {any} */ player) => String(player?.documentId || player?.id || '');

const getPlayerName = (/** @type {any} */ player) => [player?.firstname, player?.lastname]
  .filter(Boolean).join(' ').trim();

// Chasuble -> jeton du theme. Ecart declare par C-D dans
// `docs/CD-detection-decisions.md` (decision 2) : les 4 teintes du pack ne sont
// pas ecrites ici, la porte `verify:theme-contract` compte les hex jusque dans
// les commentaires. On reprend SA table, on n'en invente pas une seconde.
const getBibToken = (/** @type {any} */ Colors, /** @type {string} */ bibColor) => ({
  bleu: Colors.primary500,
  jaune: Colors.gold500,
  rouge: Colors.error500,
  vert: Colors.success500,
}[bibColor] || Colors.primary500);

function DetectionTeamsBoard() {
  const { Colors, Fonts } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();

  // 🧨 Fige : `route.params || {}` fabrique un objet NEUF a chaque rendu — le
  // defaut exact qui avait produit 402 rendus et gele le terrain (D42).
  /** @type {any} */
  const params = useMemo(() => route.params || {}, [route.params]);
  const {
    checkInFirst = false,
    eventId,
    memberMode,
    players: fallbackPlayers = EMPTY_LIST,
    presentIds = null,
    sport = 'football',
    teamId,
  } = params;

  const { data: teamComposition } = useGetEventTeamComposition(eventId, teamId, {
    enabled: Boolean(eventId),
  });

  const allPlayers = useMemo(() => {
    const fromServer = teamComposition?.eligiblePlayers;
    return Array.isArray(fromServer) && fromServer.length ? fromServer : fallbackPlayers;
  }, [fallbackPlayers, teamComposition?.eligiblePlayers]);

  // Le pointage de l'ecran 13 commande VRAIMENT qui apparait ici : un joueur non
  // pointe n'est pas affectable, comme sur l'ecran 14.
  const players = useMemo(() => {
    if (!checkInFirst || !Array.isArray(presentIds)) return allPlayers;
    const present = new Set(presentIds);
    return allPlayers.filter((/** @type {any} */ player) => present.has(getPlayerId(player)));
  }, [allPlayers, checkInFirst, presentIds]);

  const playerById = useMemo(
    () => new Map(players.map((/** @type {any} */ player) => [getPlayerId(player), player])),
    [players],
  );
  const presentIdList = useMemo(() => players.map(getPlayerId).filter(Boolean), [players]);

  const storedSplit = teamComposition?.detectionSplit || null;
  const slotCount = useMemo(() => getMatchFormation(sport).length, [sport]);
  const formation = useMemo(() => getMatchFormation(sport), [sport]);

  // La repartition deja rangee gagne. Sans elle, on en calcule une plutot que
  // d'ouvrir un ecran vide : arriver ici veut dire que le coach vient de valider
  // les ecrans 13 a 15.
  const [teams, setTeams] = useState(() => {
    const stored = storedSplit?.teams;
    if (Array.isArray(stored) && stored.length) return stored;
    return splitIntoTeams({
      checkInFirst,
      memberMode,
      players: fallbackPlayers,
      presentIds: presentIds || EMPTY_LIST,
      splitBy: storedSplit?.splitBy,
      teamCount: storedSplit?.teamCount || 2,
    }).teams.map((team, index) => ({
      bibColor: team.bibColor,
      name: `Equipe ${index + 1}`,
      players: team.playerIds,
      rotation: /** @type {string[]} */ ([]),
      terrain: null,
    }));
  });
  const [activeTeamIndex, setActiveTeamIndex] = useState(0);
  const [isBusy, setIsBusy] = useState(false);
  const [activeDragPlayer, setActiveDragPlayer] = useState(/** @type {any} */ (null));
  const [subscriptionPaywallDecision, setSubscriptionPaywallDecision] = useState(
    /** @type {any} */ (null),
  );

  const activeTeam = teams[activeTeamIndex] || null;
  const lineup = useMemo(
    () => readTeamLineup(activeTeam, slotCount),
    [activeTeam, slotCount],
  );
  const unassignedIds = useMemo(
    () => getUnassignedIds(presentIdList, teams),
    [presentIdList, teams],
  );
  const splitByPosition = storedSplit?.splitBy === SPLIT_BY.REQUESTED_POSITION;

  // --- Glisser-deposer : le rectangle du terrain est la seule zone mesuree.
  // Lacher DEDANS affecte a l'equipe ouverte, lacher DEHORS rend aux non
  // affectes. C'est ce qui fait les deux sens sans mesurer aussi le bandeau.
  const fieldNodeRef = useRef(null);
  const fieldRectRef = useRef(/** @type {any} */ (null));
  const ghostX = useSharedValue(0);
  const ghostY = useSharedValue(0);
  const ghostScale = useSharedValue(0);
  const ghostOpacity = useSharedValue(0);

  const measureField = useCallback(() => {
    const node = fieldNodeRef.current;
    // @ts-ignore — `measureInWindow` existe sur une View native.
    if (!node?.measureInWindow) return;
    // @ts-ignore
    node.measureInWindow((
      /** @type {number} */ x,
      /** @type {number} */ y,
      /** @type {number} */ width,
      /** @type {number} */ height,
    ) => {
      if (width > 0 && height > 0) {
        fieldRectRef.current = {
          height, width, x, y,
        };
      }
    });
  }, []);

  // ⚠️ Les valeurs par defaut ne sont pas decoratives : `runOnJS` attend une
  // fonction dont TOUS les parametres sont facultatifs. Sans elles, la porte
  // `type-check` compte 3 erreurs de plus par ecran (mesure du 2026-08-15).
  const startDrag = useCallback((
    /** @type {any} */ player = null,
    /** @type {number} */ pageX = 0,
    /** @type {number} */ pageY = 0,
  ) => {
    if (!player) return;
    measureField();
    Vibration.vibrate(8);
    setActiveDragPlayer(player);
    ghostX.value = pageX - (GHOST_SIZE / 2);
    ghostY.value = pageY - (GHOST_SIZE / 2);
    ghostScale.value = withSpring(1, DRAG_SPRING);
    ghostOpacity.value = withTiming(1, { duration: 90 });
  }, [ghostOpacity, ghostScale, ghostX, ghostY, measureField]);

  const updateDrag = useCallback((
    /** @type {number} */ pageX = 0,
    /** @type {number} */ pageY = 0,
  ) => {
    ghostX.value = pageX - (GHOST_SIZE / 2);
    ghostY.value = pageY - (GHOST_SIZE / 2);
  }, [ghostX, ghostY]);

  const resetGhost = useCallback(() => {
    ghostScale.value = withSpring(0, DRAG_SPRING);
    ghostOpacity.value = withTiming(0, { duration: 140 });
    setActiveDragPlayer(null);
  }, [ghostOpacity, ghostScale]);

  const endDrag = useCallback((
    /** @type {any} */ player = null,
    /** @type {string} */ source = '',
    /** @type {number} */ pageX = 0,
    /** @type {number} */ pageY = 0,
  ) => {
    const playerId = getPlayerId(player);
    if (!playerId) return;
    const rect = fieldRectRef.current;

    const droppedOnField = Boolean(rect)
      && pageX >= rect.x && pageX <= rect.x + rect.width
      && pageY >= rect.y && pageY <= rect.y + rect.height;

    // 🔒 Un seul chemin d'ecriture : `movePlayerToTeam`, qui retire de TOUTES les
    // equipes avant d'ajouter. Le doublon est impossible par construction, et
    // c'est le temoin 3 du lot qui le tient.
    if (droppedOnField) {
      setTeams((current) => movePlayerToTeam(current, playerId, activeTeamIndex));
      return;
    }

    if (source !== SOURCE_UNASSIGNED) {
      setTeams((current) => movePlayerToTeam(current, playerId, null));
    }
  }, [activeTeamIndex]);

  const createDragGesture = useCallback((
    /** @type {any} */ player,
    /** @type {string} */ source,
  ) => (
    Gesture.Pan()
      .activateAfterLongPress(LONG_PRESS_MS)
      .minDistance(6)
      .onStart((event) => {
        'worklet';

        runOnJS(startDrag)(player, event.absoluteX, event.absoluteY);
      })
      .onUpdate((event) => {
        'worklet';

        runOnJS(updateDrag)(event.absoluteX, event.absoluteY);
      })
      .onEnd((event) => {
        'worklet';

        runOnJS(endDrag)(player, source, event.absoluteX, event.absoluteY);
      })
      .onFinalize(() => {
        'worklet';

        runOnJS(resetGhost)();
      })
  ), [endDrag, resetGhost, startDrag, updateDrag]);

  const ghostStyle = useAnimatedStyle(() => ({
    opacity: ghostOpacity.value,
    transform: [
      { translateX: ghostX.value },
      { translateY: ghostY.value },
      { scale: ghostScale.value },
    ],
  }));

  // --- Enregistrer / publier.
  const buildPayload = useCallback(() => buildDetectionSplitPayload({
    checkInFirst,
    memberMode: memberMode || storedSplit?.memberMode,
    players,
    presentIds: presentIds || presentIdList,
    rounds: storedSplit?.rounds || EMPTY_LIST,
    splitBy: storedSplit?.splitBy,
    teamCount: teams.length,
    teamNames: teams.map((/** @type {any} */ team) => team?.name),
    // Les equipes viennent de l'ecran, jamais d'un recalcul : le coach a place,
    // on range sa decision. L'ordre est « places d'abord, rotation ensuite », le
    // meme que celui que `readTeamLineup` relira.
    teams: teams.map((/** @type {any} */ team) => {
      const { placedIds, rotationIds } = readTeamLineup(team, slotCount);
      return {
        bibColor: team?.bibColor,
        playerIds: [...placedIds, ...rotationIds],
        rotationIds,
        terrain: team?.terrain || null,
      };
    }),
  }), [
    checkInFirst, memberMode, players, presentIdList, presentIds, slotCount, storedSplit, teams,
  ]);

  /**
   * 💰 Un refus du serveur montre l'OFFRE quand il en porte une, au lieu d'une
   * alerte muette. Motif repris de l'ecran 5 (D79/C-A) : le serveur repond 403
   * en joignant `details.decision`.
   * @param {any} error
   * @param {string} messageKey
   * @returns {void}
   */
  const handleActionError = useCallback((
    /** @type {any} */ error,
    /** @type {string} */ messageKey,
  ) => {
    const decision = extractSubscriptionDecisionFromError(error);
    if (decision) {
      setSubscriptionPaywallDecision(decision);
      return;
    }
    Alert.alert(t('detection.alerts.error.title'), t(messageKey));
  }, [t]);

  const persist = useCallback(async () => {
    // 🧨 `saveDraft` REMPLACE le brouillon de l'equipe par la charge recue :
    // envoyer un `{ detectionSplit }` seul EFFACERAIT la composition deja posee.
    // `buildDraftPayloadWithSplit` renvoie donc le brouillon tel quel, augmente.
    await saveEventCompositionDraft(eventId, {
      draft: buildDraftPayloadWithSplit(teamComposition?.draft, buildPayload()),
      teamId,
    });
  }, [buildPayload, eventId, teamComposition?.draft, teamId]);

  const handleSave = useCallback(async () => {
    if (!eventId || !teamId || isBusy) return;
    setIsBusy(true);
    try {
      await persist();
      Alert.alert(t('detection.alerts.saved.title'), t('detection.alerts.saved.message'));
    } catch (error) {
      handleActionError(error, 'detection.alerts.error.save');
    } finally {
      setIsBusy(false);
    }
  }, [eventId, handleActionError, isBusy, persist, t, teamId]);

  const handlePublish = useCallback(async () => {
    if (!eventId || !teamId || isBusy) return;
    setIsBusy(true);
    try {
      // La repartition part TOUJOURS avant la publication : publier ce qui n'a
      // pas ete enregistre publierait l'etat precedent.
      await persist();
      await publishEventConvocation(eventId, { teamId });
      Alert.alert(
        t('detection.alerts.published.title'),
        t('detection.alerts.published.message'),
        [{
          // @ts-ignore — `navigate` est bien la sur un ecran de pile.
          onPress: () => navigation.navigate(RouteNames.EventDetails, { eventId }),
          text: t('detection.alerts.published.ok'),
        }],
      );
    } catch (error) {
      handleActionError(error, 'detection.alerts.error.publish');
    } finally {
      setIsBusy(false);
    }
  }, [eventId, handleActionError, isBusy, navigation, persist, t, teamId]);

  const renderChip = (
    /** @type {string} */ label,
    /** @type {boolean} */ isOn,
  ) => (
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

  // Le jeton du pack porte sa PASTILLE DE POSTE en detection — le poste que le
  // joueur a demande en candidatant. Elle n'apparait jamais sur un terrain de
  // match (le coach connait ses joueurs) : c'est exactement ce que dit le pack.
  const renderToken = (
    /** @type {any} */ player,
    /** @type {boolean} */ isOnField,
  ) => {
    const position = getRequestedPosition(player);
    return (
      <View>
        <DraggableToken isOnField={isOnField} player={player} />
        {position ? (
          <View style={[styles.positionBadge, { backgroundColor: Colors.primary500 }]}>
            <Text numberOfLines={1} style={[Fonts.p4Bold, { color: Colors.primary900 }]}>
              {position}
            </Text>
          </View>
        ) : null}
      </View>
    );
  };

  const renderTeamTab = (/** @type {any} */ team, /** @type {number} */ index) => {
    const isActive = index === activeTeamIndex;
    const token = getBibToken(Colors, team?.bibColor);

    return (
      <TouchableOpacity
        accessibilityRole="tab"
        accessibilityState={{ selected: isActive }}
        activeOpacity={0.8}
        key={`${team?.bibColor || 'team'}-${index}`}
        onPress={() => setActiveTeamIndex(index)}
        style={[
          styles.teamTab,
          {
            backgroundColor: isActive ? withAlpha(token, 0.18) : withAlpha(Colors.neutral00, 0.035),
            borderColor: isActive ? token : withAlpha(Colors.neutral00, 0.12),
          },
        ]}
      >
        <Text style={[Fonts.p3Bold, { color: isActive ? token : Colors.neutral300 }]}>
          {t('detection.teams.board.teamTab', {
            count: (Array.isArray(team?.players) ? team.players : []).length,
            name: team?.bibColor
              ? t(`detection.teams.manual.bibs.${team.bibColor}`)
              : team?.name,
          })}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <GestureHandlerRootView style={styles.root}>
      <ScreenContainer bgImage="bg2" bottomInsetMode="edge-to-edge" style={[styles.screen]}>
        <View style={styles.header}>
          <HeaderBackButton onPress={() => navigation.goBack()} />
          <View style={styles.headerTexts}>
            <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>
              {t('detection.teams.board.title')}
            </Text>
            <Text numberOfLines={1} style={[Fonts.p3, { color: Colors.neutral300 }]}>
              {t('detection.teams.board.subtitle', { count: teams.length, sport })}
            </Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.8}
            // @ts-ignore — `navigate` est bien la sur un ecran de pile. Relancer,
            // c'est revenir a l'ecran 15 : `navigate` vers un ecran deja empile
            // y revient en DEPILANT, donc les reglages y sont retrouves tels quels.
            onPress={() => navigation.navigate(RouteNames.DetectionTeamsAuto, params)}
            style={[
              styles.headerAction,
              {
                backgroundColor: withAlpha(Colors.primary500, 0.12),
                borderColor: withAlpha(Colors.primary500, 0.45),
              },
            ]}
          >
            <Text style={[Fonts.p4Bold, { color: Colors.primary500 }]}>
              {t('detection.teams.board.relaunch')}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.tabsContent}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabs}
        >
          {teams.map(renderTeamTab)}
          {teams.length < MAX_DETECTION_TEAMS ? (
            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.8}
              onPress={() => setTeams((current) => addTeam(current))}
              style={[styles.addTeam, { borderColor: withAlpha(Colors.primary500, 0.6) }]}
            >
              <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>
                {t('detection.teams.board.addTeam')}
              </Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>

        <View style={styles.chipRow}>
          {renderChip(t('detection.teams.board.chips.placed', {
            placed: lineup.placedIds.length,
            slots: slotCount,
          }), true)}
          {splitByPosition
            ? renderChip(t('detection.teams.board.chips.splitByPosition'), true)
            : null}
          <View style={styles.chipSpacer} />
          {renderChip(t('detection.teams.board.chips.swap'), false)}
        </View>

        <View style={styles.fieldWrapper}>
          <View
            collapsable={false}
            onLayout={measureField}
            ref={fieldNodeRef}
            style={[styles.fieldSurface, { aspectRatio: 1 / getTacticalFieldAspectRatio(sport) }]}
          >
            <RenderedTacticalField sport={sport} style={styles.fieldFill}>
              {lineup.placedIds.map((
                /** @type {string} */ playerId,
                /** @type {number} */ index,
              ) => {
                const player = playerById.get(playerId);
                const spot = formation[index];
                if (!player || !spot) return null;
                return (
                  <GestureDetector
                    gesture={createDragGesture(player, playerId)}
                    key={`placed-${playerId}`}
                  >
                    <View
                      accessibilityLabel={t('detection.teams.board.tokenOnField', {
                        name: getPlayerName(player),
                        team: activeTeam?.bibColor
                          ? t(`detection.teams.manual.bibs.${activeTeam.bibColor}`)
                          : activeTeam?.name,
                      })}
                      style={[styles.fieldToken, { left: `${spot[0]}%`, top: `${spot[1]}%` }]}
                    >
                      {renderToken(player, true)}
                    </View>
                  </GestureDetector>
                );
              })}
            </RenderedTacticalField>
          </View>
        </View>

        {/* 🈲 Le bandeau du bas s'appelle NON AFFECTES, jamais « remplacants » ni
            « en attente » : le mot banc et ses synonymes sont interdits en
            detection (§6), et c'est le mot que C-D a tranche. */}
        <View
          style={[
            styles.strip,
            {
              backgroundColor: withAlpha(Colors.neutral00, 0.04),
              borderTopColor: withAlpha(Colors.neutral00, 0.1),
            },
          ]}
        >
          <View style={styles.stripHeader}>
            <Text style={[Fonts.p3Bold, styles.stripTitle, { color: Colors.neutral00 }]}>
              {t('detection.teams.board.unassigned.title', {
                count: unassignedIds.length,
              }).toUpperCase()}
            </Text>
            <Text numberOfLines={1} style={[Fonts.p4, { color: Colors.neutral300 }]}>
              {t('detection.teams.board.unassigned.hint')}
            </Text>
          </View>
          <ScrollView
            contentContainerStyle={styles.stripContent}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {unassignedIds.length === 0 ? (
              <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
                {t('detection.teams.board.unassigned.empty')}
              </Text>
            ) : null}
            {unassignedIds.map((/** @type {string} */ playerId) => {
              const player = playerById.get(playerId);
              if (!player) return null;
              return (
                <GestureDetector
                  gesture={createDragGesture(player, SOURCE_UNASSIGNED)}
                  key={`unassigned-${playerId}`}
                >
                  <View
                    accessibilityLabel={t('detection.teams.board.tokenUnassigned', {
                      name: getPlayerName(player),
                    })}
                  >
                    {renderToken(player, false)}
                  </View>
                </GestureDetector>
              );
            })}
          </ScrollView>
        </View>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Button
            isLoading={isBusy}
            onPress={handleSave}
            style={styles.footerGhost}
            title={t('detection.teams.board.actions.save')}
            variant="Secondary"
          />
          {/* 🚪 LA PORTE DE L'ECRAN 17. Le pack dessine son retour (« Voir les N
              equipes ») mais pas son aller : un ecran qu'aucun bouton n'atteint
              n'existe pas, et c'est le defaut que ce lot repare. */}
          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.8}
            onPress={() => {
              // @ts-ignore — `navigate` est bien la sur un ecran de pile.
              navigation.navigate(RouteNames.DetectionRotation, {
                ...params,
                detectionSplit: buildPayload(),
                teamIndex: activeTeamIndex,
              });
            }}
            style={[
              styles.headerAction,
              {
                backgroundColor: withAlpha(Colors.primary500, 0.12),
                borderColor: withAlpha(Colors.primary500, 0.45),
              },
            ]}
          >
            <Text style={[Fonts.p4Bold, { color: Colors.primary500 }]}>
              {t('detection.teams.board.actions.rotation')}
            </Text>
          </TouchableOpacity>
          <Button
            isLoading={isBusy}
            onPress={handlePublish}
            style={styles.footerCta}
            title={t('detection.teams.board.actions.publish', { count: teams.length })}
            variant="Primary"
          />
        </View>

        {activeDragPlayer ? (
          <Animated.View pointerEvents="none" style={[styles.ghostLayer, ghostStyle]}>
            <DraggableToken isGhost player={activeDragPlayer} />
          </Animated.View>
        ) : null}

        <SubscriptionPaywallSheet
          close={() => setSubscriptionPaywallDecision(null)}
          clubDocumentId={subscriptionPaywallDecision?.clubDocumentId || null}
          decision={subscriptionPaywallDecision}
          isVisible={Boolean(subscriptionPaywallDecision)}
          navigation={navigation}
        />
      </ScreenContainer>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  addTeam: {
    alignItems: 'center',
    borderRadius: 20,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 16,
  },
  chip: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  chipRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  chipSpacer: {
    flex: 1,
  },
  fieldFill: {
    height: '100%',
    width: '100%',
  },
  fieldSurface: {
    borderRadius: 16,
    overflow: 'hidden',
    width: '100%',
  },
  fieldToken: {
    marginLeft: -24,
    marginTop: -24,
    position: 'absolute',
  },
  fieldWrapper: {
    flex: 1,
    paddingHorizontal: 16,
  },
  footer: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  footerCta: {
    flex: 1,
  },
  footerGhost: {
    width: 120,
  },
  ghostLayer: {
    left: 0,
    position: 'absolute',
    top: 0,
    zIndex: 50,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingRight: 16,
    paddingVertical: 8,
  },
  headerAction: {
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 12,
  },
  headerTexts: {
    flex: 1,
  },
  positionBadge: {
    borderRadius: 8,
    bottom: 0,
    left: 0,
    minWidth: 20,
    paddingHorizontal: 4,
    position: 'absolute',
  },
  root: {
    flex: 1,
  },
  screen: {
    flex: 1,
  },
  strip: {
    borderTopWidth: 1,
    paddingVertical: 12,
  },
  stripContent: {
    gap: 12,
    paddingHorizontal: 16,
  },
  stripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 8,
    paddingHorizontal: 16,
  },
  stripTitle: {
    letterSpacing: 1,
  },
  tabs: {
    flexGrow: 0,
  },
  tabsContent: {
    gap: 8,
    paddingHorizontal: 16,
  },
  teamTab: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1.5,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 16,
  },
});

export default DetectionTeamsBoard;
