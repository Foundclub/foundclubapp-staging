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
  getCumulativePlaytime,
  isUnderPlaytimeFloor,
  readTeamLineup,
  startNextRound,
} from '@/domains/detection/detectionRotation';
import {
  buildDraftPayloadWithSplit,
  getRequestedPosition,
} from '@/domains/detection/detectionSplit';
import { extractSubscriptionDecisionFromError } from '@/domains/subscription/subscriptionDecision';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import SubscriptionPaywallSheet from '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet';
import RenderedTacticalField from '@/components/tactical/RenderedTacticalField';
import ScreenContainer from '@/components/templates/ScreenContainer';
import DraggableToken from '@/components/tactical/DraggableToken';
// ♻️ Voir le commentaire de `DetectionTeamsBoard` : les coordonnees de depart
// des 5 sports sont reprises telles quelles, jamais recopiees.
import { getMatchFormation } from '@/views/matchCallUp/matchCompositionUtils';

import { RouteNames } from '@/navigation/routeNames';

import { useGetEventTeamComposition } from '@/services/event/eventQueries';
import { saveEventCompositionDraft } from '@/services/event/eventService';

import { getTacticalFieldAspectRatio } from '@/utils/tacticalField';

/**
 * C-E — ECRAN 17 du pack composition : « Rotation + chasuble ».
 *
 * 🎯 C'EST LA RAISON D'ETRE D'UNE DETECTION. Un recruteur qui ne voit pas les
 * temps de jeu ne peut pas garantir que chaque joueur a eu sa chance : celui
 * qu'on oublie 40 minutes sur le cote ne sera juge par personne. Cet ecran rend
 * l'oubli VISIBLE — le temps de jeu cumule est ecrit sur chaque jeton, et il
 * passe au ROUGE sous le plancher de `PLAYTIME_FLOOR_MINUTES` minutes (5), pose
 * une seule fois dans `detectionRotation` et lu par `isUnderPlaytimeFloor`.
 *
 * ⚠️ VOCABULAIRE — le mot « banc » est interdit en detection (regle du pack §6).
 * Celui qui attend son tour est en **ROTATION**, jamais « remplacant ». Les
 * joueurs sans equipe du tout sont les **NON AFFECTES** de l'ecran 16 (mot
 * tranche par C-D) : ils n'apparaissent pas ici, cet ecran ne montre qu'une
 * equipe a la fois.
 *
 * 🧭 CE QUE LE SERVEUR SAIT DEJA FAIRE, MESURE LE 2026-08-15 : `rounds[]` porte
 * `{ index, playtimeByPlayer, startedAt }` et chaque equipe porte `rotation[]`
 * (admin `event-composition.ts:486-504`). Tout vit dans le champ `composition`,
 * qui est du JSON. ⇒ **aucune migration**, aucune ligne d'admin a ecrire.
 *
 * ⛔ LE RISQUE GRAVE : perdre une affectation en changeant de manche. Le calcul
 * est enferme dans `startNextRound`, qui ne touche QUE `rounds` et recopie les
 * equipes telles quelles — c'est le temoin 4 du lot qui le tient.
 */

/** @type {any[]} */
const EMPTY_LIST = [];

const GHOST_SIZE = 64;
const LONG_PRESS_MS = 120;
const DRAG_SPRING = { damping: 18, stiffness: 220 };
const SOURCE_ROTATION = 'rotation';
const MILLISECONDS_PER_MINUTE = 60000;

const getPlayerId = (/** @type {any} */ player) => String(player?.documentId || player?.id || '');

const getPlayerName = (/** @type {any} */ player) => [player?.firstname, player?.lastname]
  .filter(Boolean).join(' ').trim();

// Chasuble -> jeton du theme. Table de C-D, reprise telle quelle : en inventer
// une seconde ferait deux verites pour la meme couleur.
const getBibToken = (/** @type {any} */ Colors, /** @type {string} */ bibColor) => ({
  bleu: Colors.primary500,
  jaune: Colors.gold500,
  rouge: Colors.error500,
  vert: Colors.success500,
}[bibColor] || Colors.primary500);

function DetectionRotationBoard() {
  const { Colors, Fonts } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();

  // 🧨 Fige : `route.params || {}` fabrique un objet NEUF a chaque rendu (D42).
  /** @type {any} */
  const params = useMemo(() => route.params || {}, [route.params]);
  const {
    detectionSplit: splitFromRoute = null,
    eventId,
    players: fallbackPlayers = EMPTY_LIST,
    sport = 'football',
    teamId,
    teamIndex = 0,
  } = params;

  const { data: teamComposition } = useGetEventTeamComposition(eventId, teamId, {
    enabled: Boolean(eventId),
  });

  const players = useMemo(() => {
    const fromServer = teamComposition?.eligiblePlayers;
    return Array.isArray(fromServer) && fromServer.length ? fromServer : fallbackPlayers;
  }, [fallbackPlayers, teamComposition?.eligiblePlayers]);

  const playerById = useMemo(
    () => new Map(players.map((/** @type {any} */ player) => [getPlayerId(player), player])),
    [players],
  );

  const slotCount = useMemo(() => getMatchFormation(sport).length, [sport]);
  const formation = useMemo(() => getMatchFormation(sport), [sport]);

  // La repartition arrive par la route quand on vient de l'ecran 16 (elle y est
  // plus fraiche que le serveur : le coach vient de glisser des jetons), sinon
  // du serveur quand on ouvre cet ecran directement.
  const [split, setSplit] = useState(
    () => splitFromRoute || teamComposition?.detectionSplit || { rounds: [], teams: [] },
  );
  const [isBusy, setIsBusy] = useState(false);
  const [activeDragPlayer, setActiveDragPlayer] = useState(/** @type {any} */ (null));
  const [subscriptionPaywallDecision, setSubscriptionPaywallDecision] = useState(
    /** @type {any} */ (null),
  );

  const teams = useMemo(() => (Array.isArray(split?.teams) ? split.teams : []), [split?.teams]);
  const team = teams[teamIndex] || null;
  const rounds = useMemo(() => (Array.isArray(split?.rounds) ? split.rounds : []), [split?.rounds]);
  const currentRound = rounds[rounds.length - 1] || null;

  const lineup = useMemo(() => readTeamLineup(team, slotCount), [slotCount, team]);
  const cumulativePlaytime = useMemo(() => getCumulativePlaytime(rounds), [rounds]);

  const bibLabel = team?.bibColor
    ? t(`detection.teams.manual.bibs.${team.bibColor}`)
    : (team?.name || '');
  const bibToken = getBibToken(Colors, team?.bibColor);

  // --- Glisser-deposer : le rectangle du terrain est la seule zone mesuree.
  // Lacher DEDANS fait entrer le joueur, lacher DEHORS le met en rotation.
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

  /**
   * Faire entrer ou sortir un joueur de l'equipe ouverte.
   *
   * 🔒 On ne touche QUE `rotation` : l'effectif (`players`) ne bouge jamais ici.
   * Une entree ou une sortie de terrain n'est pas un changement d'equipe — c'est
   * cette separation qui rend impossible de perdre quelqu'un en le faisant
   * tourner.
   * @param {string} playerId
   * @param {boolean} shouldPlay
   * @returns {void}
   */
  const setPlaying = useCallback((
    /** @type {string} */ playerId,
    /** @type {boolean} */ shouldPlay,
  ) => {
    setSplit((/** @type {any} */ current) => {
      const currentTeams = Array.isArray(current?.teams) ? current.teams : [];
      const target = currentTeams[teamIndex];
      if (!target) return current;

      const stored = Array.isArray(target.rotation) ? target.rotation : [];
      const waiting = new Set(stored.map((/** @type {any} */ entry) => String(entry)));
      if (shouldPlay) waiting.delete(playerId);
      else waiting.add(playerId);

      return {
        ...current,
        teams: currentTeams.map((/** @type {any} */ entry, /** @type {number} */ index) => (
          index === teamIndex ? { ...entry, rotation: [...waiting] } : entry
        )),
      };
    });
  }, [teamIndex]);

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

    if (droppedOnField) {
      setPlaying(playerId, true);
      return;
    }
    if (source !== SOURCE_ROTATION) setPlaying(playerId, false);
  }, [setPlaying]);

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

  /**
   * « Lancer la manche N+1 ».
   *
   * ⏱️ Les minutes ecoulees se comptent depuis `startedAt` de la manche en
   * cours. Une manche sans horodatage — la toute premiere, ouverte par cet ecran
   * — ne rapporte rien a personne : compter du temps qu'on n'a pas mesure serait
   * pire que de ne rien compter.
   * @returns {void}
   */
  const handleNextRound = useCallback(async () => {
    if (!eventId || !teamId || isBusy) return;
    const startedAt = currentRound?.startedAt ? Date.parse(currentRound.startedAt) : NaN;
    const elapsedMinutes = Number.isFinite(startedAt)
      ? Math.max(0, Math.round((Date.now() - startedAt) / MILLISECONDS_PER_MINUTE))
      : 0;

    const nextSplit = startNextRound(split, {
      elapsedMinutes,
      onFieldIds: lineup.placedIds,
      startedAt: new Date().toISOString(),
    });

    setIsBusy(true);
    try {
      // 🧨 `saveDraft` REMPLACE le brouillon : on renvoie donc l'existant tel
      // quel, augmente de la repartition. Envoyer la repartition seule
      // effacerait la composition deja posee, en silence.
      await saveEventCompositionDraft(eventId, {
        draft: buildDraftPayloadWithSplit(teamComposition?.draft, nextSplit),
        teamId,
      });
      setSplit(nextSplit);
    } catch (error) {
      handleActionError(error, 'detection.alerts.error.save');
    } finally {
      setIsBusy(false);
    }
  }, [
    currentRound?.startedAt, eventId, handleActionError, isBusy, lineup.placedIds,
    split, teamComposition?.draft, teamId,
  ]);

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

  // Le jeton porte DEUX pastilles en detection : son poste demande (regle du
  // pack) et son temps de jeu cumule. La seconde passe au rouge sous le
  // plancher — c'est elle qui fait tout le travail de cet ecran.
  const renderToken = (
    /** @type {any} */ player,
    /** @type {boolean} */ isOnField,
  ) => {
    const minutes = cumulativePlaytime[getPlayerId(player)] || 0;
    const isForgotten = isUnderPlaytimeFloor(minutes);
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
        <View
          style={[
            styles.playtimeBadge,
            { backgroundColor: isForgotten ? Colors.error500 : withAlpha(Colors.neutral900, 0.85) },
          ]}
        >
          <Text numberOfLines={1} style={[Fonts.p4Bold, { color: Colors.neutral00 }]}>
            {t('detection.teams.rotation.playtime', { count: minutes })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <GestureHandlerRootView style={styles.root}>
      <ScreenContainer bgImage="bg2" bottomInsetMode="edge-to-edge" style={[styles.screen]}>
        <View style={styles.header}>
          <HeaderBackButton onPress={() => navigation.goBack()} />
          <View style={styles.headerTexts}>
            <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>
              {t('detection.teams.rotation.title', { bib: bibLabel })}
            </Text>
            <Text numberOfLines={1} style={[Fonts.p3, { color: Colors.neutral300 }]}>
              {team?.terrain
                ? t('detection.teams.rotation.subtitleWithField', { field: team.terrain, sport })
                : t('detection.teams.rotation.subtitle', { sport })}
            </Text>
          </View>
          {/* La pastille PLEINE de la chasuble, comme le dessine le pack. */}
          <View style={[styles.bibBadge, { backgroundColor: bibToken }]}>
            <Text style={[Fonts.p4Bold, { color: Colors.primary900 }]}>
              {t('detection.teams.rotation.bib', { bib: bibLabel })}
            </Text>
          </View>
        </View>

        <View style={styles.chipRow}>
          {renderChip(t('detection.teams.rotation.chips.onField', {
            count: lineup.placedIds.length,
          }), true)}
          {renderChip(t('detection.teams.rotation.chips.round', {
            current: currentRound?.index || rounds.length || 1,
            total: Math.max(1, rounds.length),
          }), false)}
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
                    key={`playing-${playerId}`}
                  >
                    <View
                      accessibilityLabel={t('detection.teams.rotation.tokenOnField', {
                        count: cumulativePlaytime[playerId] || 0,
                        name: getPlayerName(player),
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

        {/* 🈲 ROTATION, jamais « remplacants » : le mot banc et ses synonymes
            sont interdits en detection (§6). */}
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
              {t('detection.teams.rotation.rotationBand.title', {
                count: lineup.rotationIds.length,
              }).toUpperCase()}
            </Text>
            <Text numberOfLines={1} style={[Fonts.p4, { color: Colors.neutral300 }]}>
              {t('detection.teams.rotation.rotationBand.hint')}
            </Text>
          </View>
          <ScrollView
            contentContainerStyle={styles.stripContent}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {lineup.rotationIds.length === 0 ? (
              <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
                {t('detection.teams.rotation.rotationBand.empty')}
              </Text>
            ) : null}
            {lineup.rotationIds.map((/** @type {string} */ playerId) => {
              const player = playerById.get(playerId);
              if (!player) return null;
              return (
                <GestureDetector
                  gesture={createDragGesture(player, SOURCE_ROTATION)}
                  key={`waiting-${playerId}`}
                >
                  <View
                    accessibilityLabel={t('detection.teams.rotation.tokenInRotation', {
                      count: cumulativePlaytime[playerId] || 0,
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
            // `navigate` vers un ecran deja empile y revient en DEPILANT : on
            // retrouve l'ecran 16 tel qu'on l'a laisse, onglet compris.
            // @ts-ignore — `navigate` est bien la sur un ecran de pile.
            onPress={() => navigation.navigate(RouteNames.DetectionTeamsBoard, params)}
            style={styles.footerGhost}
            title={t('detection.teams.rotation.actions.teams', { count: teams.length })}
            variant="Secondary"
          />
          <Button
            isLoading={isBusy}
            onPress={handleNextRound}
            style={styles.footerCta}
            title={t('detection.teams.rotation.actions.nextRound', { count: rounds.length + 1 })}
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
  bibBadge: {
    borderRadius: 16,
    justifyContent: 'center',
    minHeight: 32,
    paddingHorizontal: 12,
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
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  footerCta: {
    flex: 1,
  },
  footerGhost: {
    width: 140,
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
  headerTexts: {
    flex: 1,
  },
  playtimeBadge: {
    borderRadius: 8,
    bottom: 0,
    minWidth: 24,
    paddingHorizontal: 4,
    position: 'absolute',
    right: 0,
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
});

export default DetectionRotationBoard;
