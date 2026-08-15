/* eslint-disable jsdoc/require-jsdoc */
import { useNavigation, useRoute } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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

import { extractSubscriptionDecisionFromError } from '@/domains/subscription/subscriptionDecision';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';
import RenderedTacticalField from '@/components/tactical/RenderedTacticalField';
import ScreenContainer from '@/components/templates/ScreenContainer';
import {
  buildFormationSlots,
  getBenchPlayers,
  placePlayerAt,
  removePlayerFromField,
} from '@/views/matchCallUp/matchCompositionUtils';
import DraggableToken from '@/views/tactical_v2/DraggableToken';
import { getCompositionPlayerId } from '@/views/tactical_v2/multiTeamCompositionUtils';

import { RouteNames } from '@/navigation/routeNames';

import { useGetTeamDefaultComposition } from '@/services/team/teamQueries';
import { saveTeamDefaultComposition } from '@/services/team/teamService';

import { getTacticalFieldAspectRatio } from '@/utils/tacticalField';

import {
  buildCompoTemplateSources,
  buildTeamDefaultCompositionPayload,
  COMPO_SOURCE_NEW,
  COMPO_SOURCE_TEMPLATE,
  getDefaultCompoSourceKey,
  getPlacementPositionLabel,
} from './teamCompoTemplateUtils';

/**
 * C-C — ECRAN 11 du pack composition : la compo type d'une equipe.
 *
 * ⚠️ IL REMPLACE UNE FONCTION VIVANTE. La porte
 * `Équipe → « Avec l'offre Équipe » → Composition type` ouvrait l'ANCIEN parcours
 * (`TacticalSelectionV2` → terrain historique). Seule sa DESTINATION change :
 * les conditions d'affichage de la porte ne sont pas touchees.
 *
 * ♻️ CE QUI EST REPRIS, PAS REECRIT :
 *   · `DraggableToken` — le jeton, avatar et initiales compris.
 *   · `RenderedTacticalField` — les traces de terrain et leurs couleurs.
 *   · `placePlayerAt` / `removePlayerFromField` / `getBenchPlayers` du pack — la
 *     meme arithmetique de placement que le terrain match.
 *   · `SegmentedControl` — le composant du design system exige par le pack.
 *   · `PUT /teams/:id/default-composition` — la route existe deja.
 *
 * ponytail: le geste de glisser-deposer est le MEME que celui de l'ecran 5, mais
 * il est recopie et non partage — il vit inline dans `MatchCompositionBoard.js`,
 * qui appartient a un autre lot en cours. Plafond assume : deux copies a tenir.
 * Voie de sortie : le lot C-F (« couper net l'ancien systeme ») deplace de toute
 * facon les pieces partagees vers un endroit neutre ; ce geste part avec elles.
 */

/** Le jeton fantome qui suit le doigt. Memes valeurs que l'ecran 5. */
const GHOST_SIZE = 56;
const LONG_PRESS_MS = 120;
const DRAG_SPRING = { damping: 18, stiffness: 220 };
const SOURCE_BENCH = 'bench';

// Gelee ET typee : `Object.freeze([])` rend un `readonly never[]`, que le
// typage refuse ensuite partout ou une liste est attendue.
/** @type {any[]} */
const EMPTY_LIST = [];
Object.freeze(EMPTY_LIST);

function TeamCompoTemplateScreen() {
  const { Colors, Fonts } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  // 🧨 Fige : `route.params || {}` fabrique un objet NEUF a chaque rendu, et
  // c'est exactement ce defaut qui avait gele le glisser-deposer (D42).
  /** @type {any} */
  const params = useMemo(() => route.params || {}, [route.params]);
  const {
    players = EMPTY_LIST,
    sport = 'football',
    teamId,
    teamName = '',
  } = params;

  const { data: defaultCompositionPayload } = useGetTeamDefaultComposition(teamId || '', {
    enabled: Boolean(teamId),
  });

  const sources = useMemo(() => buildCompoTemplateSources({
    defaultComposition: defaultCompositionPayload,
    players,
    sport,
  }), [defaultCompositionPayload, players, sport]);

  const [pickedKey, setPickedKey] = useState(/** @type {any} */ (null));
  const [placements, setPlacements] = useState(/** @type {any} */ (null));

  const activeKey = pickedKey || getDefaultCompoSourceKey(sources);
  const activeSource = sources.find((source) => source.key === activeKey) || sources[0];
  const activePlacements = placements || activeSource?.placements || EMPTY_LIST;

  const slots = useMemo(() => buildFormationSlots(sport), [sport]);
  const benchPlayers = useMemo(
    () => getBenchPlayers(players, activePlacements),
    [activePlacements, players],
  );
  const playerById = useMemo(() => {
    const map = new Map();
    (Array.isArray(players) ? players : EMPTY_LIST).forEach((/** @type {any} */ player) => {
      const playerId = getCompositionPlayerId(player);
      if (playerId) map.set(playerId, player);
    });
    return map;
  }, [players]);

  const handlePickSource = useCallback((/** @type {any} */ key) => {
    setPickedKey(String(key));
    // Changer de source REPART de cette source : garder les jetons deplaces
    // ferait croire que la compo type contient ce qu'on vient de bouger.
    setPlacements(null);
  }, []);

  // --- Glisser-deposer. Le rectangle du terrain est la seule zone mesuree :
  // lacher dedans place, lacher dehors remet au banc.
  const fieldNodeRef = useRef(/** @type {any} */ (null));
  const fieldRectRef = useRef(/** @type {any} */ (null));
  const ghostX = useSharedValue(0);
  const ghostY = useSharedValue(0);
  const ghostScale = useSharedValue(0);
  const ghostOpacity = useSharedValue(0);
  const [activeDragPlayer, setActiveDragPlayer] = useState(/** @type {any} */ (null));

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

  const startDrag = useCallback((
    /** @type {any} */ player,
    /** @type {number} */ pageX,
    /** @type {number} */ pageY,
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

  const updateDrag = useCallback((/** @type {number} */ pageX, /** @type {number} */ pageY) => {
    ghostX.value = pageX - (GHOST_SIZE / 2);
    ghostY.value = pageY - (GHOST_SIZE / 2);
  }, [ghostX, ghostY]);

  const resetGhost = useCallback(() => {
    ghostScale.value = withSpring(0, DRAG_SPRING);
    ghostOpacity.value = withTiming(0, { duration: 140 });
    setActiveDragPlayer(null);
  }, [ghostOpacity, ghostScale]);

  const endDrag = useCallback((
    /** @type {any} */ player,
    /** @type {string} */ source,
    /** @type {number} */ pageX,
    /** @type {number} */ pageY,
  ) => {
    const playerId = getCompositionPlayerId(player);
    if (!playerId) return;
    const rect = fieldRectRef.current;

    const droppedOnField = Boolean(rect)
      && pageX >= rect.x && pageX <= rect.x + rect.width
      && pageY >= rect.y && pageY <= rect.y + rect.height;

    if (droppedOnField) {
      setPlacements((/** @type {any} */ current) => placePlayerAt({
        // La compo type EST une formation : le pack demande la pastille de
        // poste sur ses jetons, donc chaque jeton doit tenir un repere.
        magnetEnabled: true,
        placements: current || activeSource?.placements || EMPTY_LIST,
        playerId,
        slots,
        x: ((pageX - rect.x) / rect.width) * 100,
        y: ((pageY - rect.y) / rect.height) * 100,
      }));
      return;
    }

    if (source !== SOURCE_BENCH) {
      setPlacements((/** @type {any} */ current) => removePlayerFromField(
        current || activeSource?.placements || EMPTY_LIST,
        playerId,
      ));
    }
  }, [activeSource?.placements, slots]);

  const createDragGesture = useCallback((
    /** @type {any} */ player,
    /** @type {string} */ source,
  ) => (
    Gesture.Pan()
      .activateAfterLongPress(LONG_PRESS_MS)
      .minDistance(6)
      .onStart((event) => {
        'worklet';

        runOnJS(/** @type {any} */ (startDrag))(player, event.absoluteX, event.absoluteY);
      })
      .onUpdate((event) => {
        'worklet';

        runOnJS(/** @type {any} */ (updateDrag))(event.absoluteX, event.absoluteY);
      })
      .onEnd((event) => {
        'worklet';

        runOnJS(/** @type {any} */ (endDrag))(player, source, event.absoluteX, event.absoluteY);
      })
      .onFinalize(() => {
        'worklet';

        runOnJS(/** @type {any} */ (resetGhost))();
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

  // --- Enregistrer.
  const saveMutation = useMutation({
    mutationFn: () => saveTeamDefaultComposition(teamId, {
      composition: buildTeamDefaultCompositionPayload({
        placements: activePlacements,
        players,
        sport,
      }),
    }),
    onError: (/** @type {any} */ error) => {
      // 💰 Un refus d'abonnement montre l'OFFRE, en ECRAN PLEIN (ecran 12) —
      // jamais une alerte muette.
      const decision = extractSubscriptionDecisionFromError(error);
      if (decision) {
        // @ts-ignore — `navigate` est bien la sur un ecran de pile.
        navigation.navigate(RouteNames.CompositionPaywall, { decision });
        return;
      }
      Alert.alert(
        t('compoTemplate.alerts.error.title'),
        t('compoTemplate.alerts.error.save'),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teamDefaultComposition', teamId] });
      Alert.alert(
        t('compoTemplate.alerts.saved.title'),
        t('compoTemplate.alerts.saved.message'),
      );
    },
  });

  const handleSave = useCallback(() => {
    if (!teamId || saveMutation.isPending) return;
    saveMutation.mutate();
  }, [saveMutation, teamId]);

  // « Dupliquer » : repartir de la compo affichee, sur un terrain qu'on peut
  // modifier sans ecraser le modele tant qu'on n'enregistre pas.
  const handleDuplicate = useCallback(() => {
    setPickedKey(COMPO_SOURCE_NEW);
    setPlacements(activePlacements);
  }, [activePlacements]);

  const segmentOptions = useMemo(() => sources.map((source) => ({
    label: t(`compoTemplate.sources.${source.key}`),
    value: source.key,
  })), [sources, t]);

  const isDefaultTemplate = activeKey === COMPO_SOURCE_TEMPLATE && activeSource?.available;

  return (
    <GestureHandlerRootView style={styles.root}>
      <ScreenContainer bgImage="bg2" bottomInsetMode="edge-to-edge" style={[styles.screen]}>
        <View style={styles.header}>
          <HeaderBackButton onPress={() => navigation.goBack()} />
          <View style={styles.headerTexts}>
            <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>
              {t('compoTemplate.title')}
            </Text>
            <Text numberOfLines={1} style={[Fonts.p3, { color: Colors.neutral300 }]}>
              {[teamName, t('compoTemplate.subtitle')].filter(Boolean).join(' · ')}
            </Text>
          </View>
          {isDefaultTemplate ? (
            <View
              style={[
                styles.chip,
                {
                  backgroundColor: withAlpha(Colors.primary500, 0.16),
                  borderColor: withAlpha(Colors.primary500, 0.45),
                },
              ]}
            >
              <Text style={[Fonts.p4Bold, { color: Colors.primary100 }]}>
                {t('compoTemplate.defaultChip')}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.segments}>
          <SegmentedControl
            onChange={handlePickSource}
            options={segmentOptions}
            value={activeKey}
          />
        </View>

        <View style={styles.fieldWrapper}>
          <View
            collapsable={false}
            onLayout={measureField}
            ref={fieldNodeRef}
            style={[styles.fieldSurface, { aspectRatio: 1 / getTacticalFieldAspectRatio(sport) }]}
          >
            <RenderedTacticalField sport={sport} style={styles.fieldFill}>
              {activePlacements.map((/** @type {any} */ placement) => {
                const player = playerById.get(String(placement?.playerId || ''));
                if (!player) return null;
                const positionLabel = getPlacementPositionLabel(placement, sport);
                return (
                  <GestureDetector
                    gesture={createDragGesture(player, String(placement.playerId))}
                    key={`placed-${placement.playerId}`}
                  >
                    <View
                      accessibilityLabel={t('compoTemplate.tokenOnField', {
                        name: `${player?.firstname || ''} ${player?.lastname || ''}`.trim(),
                      })}
                      style={[
                        styles.fieldToken,
                        { left: `${placement.positionX}%`, top: `${placement.positionY}%` },
                      ]}
                    >
                      <DraggableToken isOnField player={player} />
                      {/* La pastille de poste : le pack la veut sur la compo
                          type et en detection, JAMAIS sur le terrain match. */}
                      {positionLabel ? (
                        <View
                          style={[
                            styles.positionPill,
                            {
                              backgroundColor: Colors.primary500,
                              borderColor: Colors.primary900,
                            },
                          ]}
                        >
                          <Text style={[Fonts.p4Bold, { color: Colors.primary900 }]}>
                            {positionLabel}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </GestureDetector>
                );
              })}
            </RenderedTacticalField>
          </View>
          {activePlacements.length === 0 ? (
            <Text style={[Fonts.p3, styles.fieldEmpty, { color: Colors.neutral300 }]}>
              {activeSource?.unavailableReason
                ? t(`compoTemplate.unavailable.${activeSource.unavailableReason}`)
                : t('compoTemplate.emptyField')}
            </Text>
          ) : null}
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
          <Text style={[Fonts.p3Bold, styles.benchTitle, { color: Colors.neutral00 }]}>
            {t('compoTemplate.bench.title', { count: benchPlayers.length }).toUpperCase()}
          </Text>
          <ScrollView
            contentContainerStyle={styles.benchContent}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {benchPlayers.length === 0 ? (
              <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
                {t('compoTemplate.bench.empty')}
              </Text>
            ) : null}
            {benchPlayers.map((/** @type {any} */ player) => (
              <GestureDetector
                gesture={createDragGesture(player, SOURCE_BENCH)}
                key={`bench-${getCompositionPlayerId(player)}`}
              >
                <View
                  accessibilityLabel={t('compoTemplate.tokenOnBench', {
                    name: `${player?.firstname || ''} ${player?.lastname || ''}`.trim(),
                  })}
                >
                  <DraggableToken player={player} />
                </View>
              </GestureDetector>
            ))}
          </ScrollView>
        </View>

        <View
          style={[
            styles.applyCard,
            {
              backgroundColor: withAlpha(Colors.neutral00, 0.04),
              borderColor: withAlpha(Colors.neutral00, 0.1),
            },
          ]}
        >
          <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>
            {t('compoTemplate.apply.title')}
          </Text>
          <Text style={[Fonts.p3, styles.applySubtitle, { color: Colors.neutral300 }]}>
            {t('compoTemplate.apply.subtitle')}
          </Text>
        </View>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Button
            onPress={handleDuplicate}
            style={styles.footerDuplicate}
            title={t('compoTemplate.actions.duplicate')}
            variant="Secondary"
          />
          <Button
            isLoading={saveMutation.isPending}
            onPress={handleSave}
            style={styles.footerSave}
            title={t('compoTemplate.actions.save')}
            variant="Primary"
          />
        </View>

        {/* Le jeton fantome suit le doigt, par-dessus tout le reste. */}
        {activeDragPlayer ? (
          <Animated.View pointerEvents="none" style={[styles.ghost, ghostStyle]}>
            <DraggableToken isGhost={false} isOnField player={activeDragPlayer} />
          </Animated.View>
        ) : null}
      </ScreenContainer>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  applyCard: {
    borderRadius: 18,
    borderWidth: 1,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
  },
  applySubtitle: {
    marginTop: 4,
  },
  benchContent: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  benchStrip: {
    borderTopWidth: 1,
    marginTop: 12,
  },
  benchTitle: {
    letterSpacing: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  fieldEmpty: {
    paddingHorizontal: 16,
    paddingTop: 12,
    textAlign: 'center',
  },
  fieldFill: {
    height: '100%',
    width: '100%',
  },
  fieldSurface: {
    alignSelf: 'center',
    borderRadius: 16,
    overflow: 'hidden',
    width: '100%',
  },
  fieldToken: {
    marginLeft: -22,
    marginTop: -22,
    position: 'absolute',
  },
  fieldWrapper: {
    paddingHorizontal: 14,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  footerDuplicate: {
    width: 116,
  },
  footerSave: {
    flex: 1,
  },
  ghost: {
    left: 0,
    pointerEvents: 'none',
    position: 'absolute',
    top: 0,
    zIndex: 20,
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
  positionPill: {
    borderRadius: 999,
    borderWidth: 2,
    bottom: -4,
    left: -6,
    paddingHorizontal: 5,
    position: 'absolute',
  },
  root: {
    flex: 1,
  },
  screen: {
    paddingHorizontal: 0,
  },
  segments: {
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
});

export default TeamCompoTemplateScreen;
