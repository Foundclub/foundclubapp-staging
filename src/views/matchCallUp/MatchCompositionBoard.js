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
  Switch,
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

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import RenderedTacticalField from '@/components/tactical/RenderedTacticalField';
import ScreenContainer from '@/components/templates/ScreenContainer';
import DraggableToken from '@/views/tactical_v2/DraggableToken';
import { getCompositionPlayerId } from '@/views/tactical_v2/multiTeamCompositionUtils';

import { RouteNames } from '@/navigation/routeNames';

import {
  publishEventConvocation,
  saveEventCompositionDraft,
} from '@/services/event/eventService';

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

const GHOST_SIZE = 64;
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

  /** @type {any} */
  const params = useMemo(() => route.params || {}, [route.params]);
  const {
    eventId,
    magnetEnabled = false,
    selectedPlayers = EMPTY_LIST,
    sport = 'football',
    startPlacements = EMPTY_LIST,
    teamComposition = null,
    teamId,
    teamName = '',
  } = params;

  const [placements, setPlacements] = useState(() => (
    Array.isArray(startPlacements) ? startPlacements : EMPTY_LIST
  ));
  const [isSheetVisible, setIsSheetVisible] = useState(false);
  const [requireResponse, setRequireResponse] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [activeDragPlayer, setActiveDragPlayer] = useState(null);

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

  const startDrag = useCallback((player, pageX, pageY) => {
    if (!player) return;
    measureField();
    Vibration.vibrate(8);
    setActiveDragPlayer(player);
    ghostX.value = pageX - (GHOST_SIZE / 2);
    ghostY.value = pageY - (GHOST_SIZE / 2);
    ghostScale.value = withSpring(1, DRAG_SPRING);
    ghostOpacity.value = withTiming(1, { duration: 90 });
  }, [ghostOpacity, ghostScale, ghostX, ghostY, measureField]);

  const updateDrag = useCallback((pageX, pageY) => {
    ghostX.value = pageX - (GHOST_SIZE / 2);
    ghostY.value = pageY - (GHOST_SIZE / 2);
  }, [ghostX, ghostY]);

  const resetGhost = useCallback(() => {
    ghostScale.value = withSpring(0, DRAG_SPRING);
    ghostOpacity.value = withTiming(0, { duration: 140 });
    setActiveDragPlayer(null);
  }, [ghostOpacity, ghostScale]);

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

  const handleSave = useCallback(async () => {
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
      Alert.alert(
        t('matchComposition.board.alerts.error.title'),
        t('matchComposition.board.alerts.error.save'),
      );
    } finally {
      setIsBusy(false);
    }
  }, [buildPack, eventId, isBusy, t, teamId]);

  const handlePublish = useCallback(async () => {
    if (!eventId || !teamId || isBusy) return;
    setIsBusy(true);
    try {
      // La compo part TOUJOURS avant la convocation : publier ce qui n'a pas ete
      // enregistre publierait l'etat precedent.
      await saveEventCompositionDraft(eventId, { draft: buildPack(), teamId });
      await publishEventConvocation(eventId, { teamId });
      setIsSheetVisible(false);
      Alert.alert(
        t('matchComposition.board.alerts.published.title'),
        t('matchComposition.board.alerts.published.message'),
        [{
          onPress: () => {
            // @ts-ignore
            navigation.navigate(RouteNames.EventDetails, { eventId });
          },
          text: t('matchComposition.board.alerts.published.ok'),
        }],
      );
    } catch (error) {
      Alert.alert(
        t('matchComposition.board.alerts.error.title'),
        t('matchComposition.board.alerts.error.publish'),
      );
    } finally {
      setIsBusy(false);
    }
  }, [buildPack, eventId, isBusy, navigation, t, teamId]);

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
              depilant, donc la selection cochee est retrouvee telle quelle. */}
          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.8}
            // @ts-ignore
            onPress={() => navigation.navigate(RouteNames.MatchCallUpSelection, params)}
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
        </View>

        <View style={styles.chipRow}>
          {renderChip(t('matchComposition.board.chips.placed', {
            placed: counters.placed, starters: counters.starters,
          }), true)}
          {renderChip(t('matchComposition.board.chips.bench', { count: counters.bench }), false)}
          <View style={styles.chipSpacer} />
          {renderChip(magnetEnabled
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
                return (
                  <GestureDetector
                    gesture={createDragGesture(player, String(placement.playerId))}
                    key={`placed-${placement.playerId}`}
                  >
                    <View
                      accessibilityLabel={t('matchComposition.board.tokenOnField', {
                        name: `${player?.firstname || ''} ${player?.lastname || ''}`.trim(),
                      })}
                      style={[
                        styles.fieldToken,
                        { left: `${placement.positionX}%`, top: `${placement.positionY}%` },
                      ]}
                    >
                      <DraggableToken isOnField player={player} />
                    </View>
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
            <Text numberOfLines={1} style={[Fonts.p4, { color: Colors.neutral300 }]}>
              {t('matchComposition.board.bench.hint')}
            </Text>
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
            {benchPlayers.map((/** @type {any} */ player) => (
              <GestureDetector
                gesture={createDragGesture(player, SOURCE_BENCH)}
                key={`bench-${getCompositionPlayerId(player)}`}
              >
                <View
                  accessibilityLabel={t('matchComposition.board.tokenOnBench', {
                    name: `${player?.firstname || ''} ${player?.lastname || ''}`.trim(),
                  })}
                >
                  <DraggableToken player={player} />
                </View>
              </GestureDetector>
            ))}
          </ScrollView>
        </View>

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

      {/* Jeton fantome qui suit le doigt, au-dessus de tout. */}
      {activeDragPlayer ? (
        <Animated.View pointerEvents="none" style={[styles.dragGhost, ghostStyle]}>
          <DraggableToken isGhost player={activeDragPlayer} />
        </Animated.View>
      ) : null}
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
  dragGhost: {
    left: 0,
    position: 'absolute',
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
