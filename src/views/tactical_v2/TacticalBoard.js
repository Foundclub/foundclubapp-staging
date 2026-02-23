import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import {
  Gesture, GestureDetector, GestureHandlerRootView, ScrollView,
} from 'react-native-gesture-handler';
import Animated, {
  measure,
  runOnJS,
  useAnimatedRef,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';

import { RouteNames } from '@/navigation/routeNames';

import { updateEvent } from '@/services/event/eventService';

import DraggableToken from './DraggableToken';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

// Field aspect ratios per sport
/** @type {Record<string, number>} */
const FIELD_ASPECT_RATIOS = {
  basket: 1.7,
  basketball: 1.7,
  football: 1.5,
  generic: 1.5,
  handball: 1.5,
  rugby: 1.4,
  volley: 1.8,
  volleyball: 1.8,
};

// Field images
/** @type {Record<string, any>} */
const FIELD_IMAGES = {
  basket: require('@/assets/fields/field_basket.png'),
  basketball: require('@/assets/fields/field_basket.png'),
  football: require('@/assets/fields/field_generic.png'),
  generic: require('@/assets/fields/field_generic.png'),
  handball: require('@/assets/fields/field_handball.png'),
  rugby: require('@/assets/fields/field_rugby.png'),
  volley: require('@/assets/fields/field_volley.png'),
  volleyball: require('@/assets/fields/field_volley.png'),
};

// Spring config
const SPRING_CONFIG = {
  damping: 18,
  mass: 0.8,
  stiffness: 200,
};

// Token dimensions (for precise centering)
const GHOST_TOKEN_WIDTH = 70;
const GHOST_TOKEN_HEIGHT = 88;
const FIELD_TOKEN_WIDTH = 58;
const FIELD_TOKEN_HEIGHT = 72;

/**
 * @typedef {import('./types').TacticalPlayer} TacticalPlayer
 * @typedef {import('./types').FieldPlayer} FieldPlayer
 */

/**
 * TacticalBoard V2 - Overlay pattern for reliable drag & drop
 */
function TacticalBoard() {
  const {
    Alignments, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();

  // Get params
  /** @type {{selectedPlayers?: TacticalPlayer[], players?: any[], eventId?: string, sport?: string, existingComposition?: any, teamId?: string, readOnly?: boolean, canEdit?: boolean, manualPlayers?: any[]}} */
  const params = route.params || {};
  const {
    canEdit = false,
    eventId,
    existingComposition,
    manualPlayers = [],
    players = [],
    readOnly = false,
    selectedPlayers = [],
    sport = 'football',
    teamId,
  } = params;

  // Use poolPlayers for reconstruction (selectedPlayers from editor, players from viewer)
  const poolPlayers = useMemo(() => {
    const base = selectedPlayers.length > 0 ? selectedPlayers : players;
    // Include manual players from composition
    const manuals = existingComposition?.manualPlayers || manualPlayers || [];
    const baseIds = new Set(base.map((/** @type {TacticalPlayer} */ p) => p.id || p.documentId));
    const uniqueManuals = manuals.filter((/** @type {TacticalPlayer} */ m) => !baseIds.has(m.id || m.documentId));
    return [...base, ...uniqueManuals];
  }, [selectedPlayers, players, existingComposition, manualPlayers]);

  // DEBUG: Log reconstruction data
  console.log('[TacticalBoard] Params:', {
    existingComposition,
    manualPlayersParam: manualPlayers,
    playersCount: players.length,
    poolPlayersCount: poolPlayers.length,
    selectedPlayersCount: selectedPlayers.length,
  });

  // Initialize players from existing composition
  const { initialBenchPlayers, initialFieldPlayers } = useMemo(() => {
    if (existingComposition?.placements?.length) {
      // Build field players from composition with FULL player data
      const fieldFromCompo = existingComposition.placements
        .map((/** @type {{ playerId?: string; positionX?: number; positionY?: number }} */ p) => {
          const original = poolPlayers.find((sp) => (sp.id === p.playerId) || (sp.documentId === p.playerId));
          if (!original) return null;
          return {
            ...original,
            documentId: original.documentId || p.playerId,
            id: original.id || p.playerId,
            x: p.positionX,
            y: p.positionY,
          };
        })
        .filter((/** @type {FieldPlayer | null} */ p) => Boolean(p));

      // Players not in composition go to bench
      const placedIds = new Set(fieldFromCompo.map((/** @type {any} */ fp) => fp.id || fp.documentId));
      const benchFromCompo = poolPlayers.filter((/** @type {TacticalPlayer} */ p) => {
        const id = p.id || p.documentId;
        return !placedIds.has(id);
      });

      return {
        initialBenchPlayers: benchFromCompo,
        initialFieldPlayers: fieldFromCompo,
      };
    }

    // No existing composition - all players on bench
    return {
      initialBenchPlayers: poolPlayers,
      initialFieldPlayers: [],
    };
  }, [existingComposition, poolPlayers]);

  // Field ref using Reanimated for UI Thread measurements
  const fieldRef = useAnimatedRef();

  // Field dimensions in SharedValues for worklet access
  const fieldX = useSharedValue(0);
  const fieldY = useSharedValue(0);
  const fieldW = useSharedValue(300);
  const fieldH = useSharedValue(450);

  // Also keep React state for rendering positioned players
  const [fieldRect, setFieldRect] = useState({
    height: 450, width: 300, x: 0, y: 0,
  });

  // === STATE ===
  // Bench players (not placed on field)
  const [benchPlayers, setBenchPlayers] = useState(/** @type {TacticalPlayer[]} */ (initialBenchPlayers));

  // Field players (placed on field) - { id, x, y } where x,y are percentages
  const [fieldPlayers, setFieldPlayers] = useState(/** @type {FieldPlayer[]} */ (initialFieldPlayers));

  // Active drag state
  const [activeDragPlayer, setActiveDragPlayer] = useState(/** @type {TacticalPlayer|null} */ (null));
  const [dragSource, setDragSource] = useState(/** @type {'bench'|'field'|null} */ (null));

  // Ghost token shared values
  const ghostX = useSharedValue(0);
  const ghostY = useSharedValue(0);
  const ghostScale = useSharedValue(0);
  const ghostOpacity = useSharedValue(0);

  // Drop zone indicator
  const dropZoneActive = useSharedValue(0);

  // Saving state
  const [isSaving, setIsSaving] = useState(false);

  // Sport specific
  const sportKey = (sport?.toLowerCase?.() || 'football');
  const aspectRatio = FIELD_ASPECT_RATIOS[sportKey] || 1.5;
  const fieldImage = FIELD_IMAGES[sportKey] || FIELD_IMAGES.generic;

  // Calculate field dimensions - maximize space
  const fieldWidth = SCREEN_WIDTH - 16; // Minimal padding
  const fieldHeight = Math.min(fieldWidth * aspectRatio, SCREEN_HEIGHT * 0.65); // Use more vertical space

  // Measure field on layout - updates both SharedValues and React state
  const measureField = useCallback(() => {
    // Using setTimeout to ensure layout is complete
    setTimeout(() => {
      try {
        // @ts-ignore
        fieldRef.current?.measureInWindow((x, y, width, height) => {
          if (width > 0 && height > 0) {
            fieldX.value = x;
            fieldY.value = y;
            fieldW.value = width;
            fieldH.value = height;
            setFieldRect({
              height, width, x, y,
            });
          }
        });
      } catch (e) {
        console.warn('[TacticalBoard] Measure failed:', e);
      }
    }, 100);
  }, [fieldRef, fieldX, fieldY, fieldW, fieldH]);

  // Get player by ID from pool (includes team players + manual players)
  const getPlayerById = useCallback((/** @type {string} */ id) => poolPlayers.find((p) => (p.id || p.documentId) === id), [poolPlayers]);

  // === DRAG HANDLERS ===

  // Start drag from bench
  const startDragFromBench = useCallback((/** @type {TacticalPlayer | undefined} */ player, /** @type {number | undefined} */ pageX, /** @type {number | undefined} */ pageY) => {
    if (!player || typeof pageX !== 'number' || typeof pageY !== 'number') return;
    // Re-measure field at drag start for accurate coordinates
    measureField();

    Vibration.vibrate(10);
    setActiveDragPlayer(player);
    setDragSource('bench');

    // Ghost centered on finger
    ghostX.value = pageX - GHOST_TOKEN_WIDTH / 2;
    ghostY.value = pageY - GHOST_TOKEN_HEIGHT / 2;
    ghostScale.value = withSpring(1, SPRING_CONFIG);
    ghostOpacity.value = withTiming(1, { duration: 100 });
    dropZoneActive.value = 1;
  }, [measureField, ghostX, ghostY, ghostScale, ghostOpacity, dropZoneActive]);

  // Start drag from field
  const startDragFromField = useCallback((/** @type {string | undefined} */ playerId, /** @type {number | undefined} */ pageX, /** @type {number | undefined} */ pageY) => {
    if (!playerId || typeof pageX !== 'number' || typeof pageY !== 'number') return;
    const player = getPlayerById(playerId);
    if (!player) return;

    // Re-measure field at drag start
    measureField();

    Vibration.vibrate(10);
    setActiveDragPlayer(player);
    setDragSource('field');

    // Ghost centered on finger
    ghostX.value = pageX - GHOST_TOKEN_WIDTH / 2;
    ghostY.value = pageY - GHOST_TOKEN_HEIGHT / 2;
    ghostScale.value = withSpring(1, SPRING_CONFIG);
    ghostOpacity.value = withTiming(1, { duration: 100 });
    dropZoneActive.value = 1;
  }, [getPlayerById, measureField, ghostX, ghostY, ghostScale, ghostOpacity, dropZoneActive]);

  // Update drag position
  const updateDragPosition = useCallback((/** @type {number | undefined} */ pageX, /** @type {number | undefined} */ pageY) => {
    if (typeof pageX !== 'number' || typeof pageY !== 'number') return;
    ghostX.value = pageX - GHOST_TOKEN_WIDTH / 2;
    ghostY.value = pageY - GHOST_TOKEN_HEIGHT / 2;
  }, [ghostX, ghostY]);

  // End drag - use SharedValues for precise coordinates
  const endDrag = useCallback((/** @type {number | undefined} */ pageX, /** @type {number | undefined} */ pageY) => {
    if (!activeDragPlayer || typeof pageX !== 'number' || typeof pageY !== 'number') return;

    const playerId = activeDragPlayer.id || activeDragPlayer.documentId || '';

    // Use current SharedValue values for precision
    const fx = fieldX.value;
    const fy = fieldY.value;
    const fw = fieldW.value;
    const fh = fieldH.value;

    console.log('[TacticalBoard] Drop at:', { pageX, pageY });
    console.log('[TacticalBoard] Field rect (SharedValues):', {
      height: fh, width: fw, x: fx, y: fy,
    });

    // Check if dropped on field
    const isOnField = (
      pageX >= fx
      && pageX <= fx + fw
      && pageY >= fy
      && pageY <= fy + fh
    );

    console.log('[TacticalBoard] Is on field:', isOnField);

    if (isOnField) {
      // Simple: store finger position as percentage (no offsets)
      const posX = ((pageX - fx) / fw) * 100;
      const posY = ((pageY - fy) / fh) * 100;

      // Clamp to valid range
      const clampedX = Math.max(5, Math.min(95, posX));
      const clampedY = Math.max(5, Math.min(95, posY));

      console.log('[TacticalBoard] Storing position:', { clampedX, clampedY });

      // Update field players - store full player data with coordinates
      setFieldPlayers((/** @type {FieldPlayer[]} */ prev) => {
        const filtered = prev.filter((/** @type {FieldPlayer} */ p) => (p.id || p.documentId) !== playerId);
        // Get full player data
        const fullPlayer = getPlayerById(playerId) || activeDragPlayer;
        if (!fullPlayer) return prev;
        return [...filtered, {
          ...fullPlayer, id: playerId, x: clampedX, y: clampedY,
        }];
      });

      // Remove from bench if coming from bench
      if (dragSource === 'bench') {
        setBenchPlayers((/** @type {TacticalPlayer[]} */ prev) => prev.filter((p) => (p.id || p.documentId) !== playerId));
      }
    } else {
      // Dropped outside field - return to bench
      if (dragSource === 'field') {
        setFieldPlayers((/** @type {FieldPlayer[]} */ prev) => prev.filter((p) => p.id !== playerId));
        setBenchPlayers((/** @type {TacticalPlayer[]} */ prev) => {
          // Check if already in bench
          const exists = prev.some((p) => (p.id || p.documentId) === playerId);
          if (exists) return prev;
          const player = getPlayerById(playerId);
          return player ? [...prev, player] : prev;
        });
      }
      // If from bench and dropped outside, do nothing (player stays in bench)
    }

    // Reset drag state
    ghostScale.value = withSpring(0, SPRING_CONFIG);
    ghostOpacity.value = withTiming(0, { duration: 150 });
    dropZoneActive.value = 0;
    setActiveDragPlayer(null);
    setDragSource(null);
  }, [activeDragPlayer, dragSource, getPlayerById, fieldX, fieldY, fieldW, fieldH, ghostScale, ghostOpacity, dropZoneActive]);

  // === GESTURE HANDLERS ===

  // Create pan gesture for bench player
  const createBenchPanGesture = useCallback((/** @type {TacticalPlayer} */ player) => Gesture.Pan()
    .activateAfterLongPress(100)
    .minDistance(5)
    .onStart((e) => {
      'worklet';

      runOnJS(startDragFromBench)(player, e.absoluteX, e.absoluteY);
    })
    .onUpdate((e) => {
      'worklet';

      runOnJS(updateDragPosition)(e.absoluteX, e.absoluteY);
    })
    .onEnd((e) => {
      'worklet';

      runOnJS(endDrag)(e.absoluteX, e.absoluteY);
    }), [startDragFromBench, updateDragPosition, endDrag]);

  // Create pan gesture for field player
  const createFieldPanGesture = useCallback((/** @type {string} */ playerId) => Gesture.Pan()
    .activateAfterLongPress(100)
    .minDistance(5)
    .onStart((e) => {
      'worklet';

      runOnJS(startDragFromField)(playerId, e.absoluteX, e.absoluteY);
    })
    .onUpdate((e) => {
      'worklet';

      runOnJS(updateDragPosition)(e.absoluteX, e.absoluteY);
    })
    .onEnd((e) => {
      'worklet';

      runOnJS(endDrag)(e.absoluteX, e.absoluteY);
    }), [startDragFromField, updateDragPosition, endDrag]);

  // === SAVE ===
  const handleSave = useCallback(async () => {
    if (!eventId) {
      Alert.alert('Erreur', 'ID événement manquant');
      return;
    }

    setIsSaving(true);
    try {
      // Extract manual players from all players (field + bench)
      const allCurrentPlayers = [...fieldPlayers, ...benchPlayers];
      const extractedManualPlayers = allCurrentPlayers
        .filter((/** @type {TacticalPlayer | FieldPlayer} */ p) => p.isManual || (p.id && String(p.id).startsWith('manual_')) || (p.documentId && String(p.documentId).startsWith('manual_')))
        .map((/** @type {TacticalPlayer | FieldPlayer} */ p) => ({
          avatar: p.avatar,
          documentId: p.documentId || p.id,
          firstname: p.firstname,
          id: p.id,
          isManual: true,
          lastname: p.lastname,
          number: p.number,
        }));

      const compositionData = {
        manualPlayers: extractedManualPlayers,
        placements: fieldPlayers.map((/** @type {FieldPlayer} */ fp) => ({
          playerId: fp.documentId || fp.id,
          positionX: fp.x,
          positionY: fp.y,
        })),
        sportContext: sport,
      };

      await updateEvent({
        documentId: eventId,
        eventData: {
          composition: compositionData, // json field accepts object directly
        },
      });

      Alert.alert('Succès', 'Composition enregistrée !', [
        { onPress: () => /** @type {any} */ (navigation).navigate(RouteNames.EventDetails, { eventId }), text: 'OK' },
      ]);
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Erreur', 'Impossible de sauvegarder');
    } finally {
      setIsSaving(false);
    }
  }, [eventId, sport, fieldPlayers, navigation]);

  // === ANIMATED STYLES ===
  const dropZoneStyle = useAnimatedStyle(() => {
    'worklet';

    return {
      opacity: withTiming(dropZoneActive.value ? 0.4 : 0, { duration: 200 }),
    };
  });

  return (
    <GestureHandlerRootView style={Alignments.fill}>
      <ImageBackground
        resizeMode="cover"
        source={Images.bg1}
        style={[Alignments.fill, { paddingTop: insets.top + 8 }]}
      >

        {/* Field Area */}
        <View style={styles.fieldContainer}>
          <Animated.View
            onLayout={measureField}
            ref={fieldRef}
            style={[
              styles.field,
              {
                borderColor: `${Colors.primary500}40`,
                height: fieldHeight,
                width: fieldWidth,
              },
            ]}
          >
            <Image resizeMode="cover" source={fieldImage} style={styles.fieldImage} />

            {/* Drop zone indicator */}
            <Animated.View style={[styles.dropZoneIndicator, { borderColor: Colors.primary500 }, dropZoneStyle]} />

            {/* Placed players */}
            {fieldPlayers.map((/** @type {FieldPlayer} */ fp) => {
              // fp already has full player data from reconstruction
              if (!fp.firstname && !fp.lastname && !fp.id) return null;

              // Use React state for consistent display
              // fp.x/y are percentages where the finger was (center of ghost)
              // We need to center the field token on that same point
              const pixelX = (fp.x / 100) * fieldRect.width;
              const pixelY = (fp.y / 100) * fieldRect.height;

              // Center the token on the stored position
              const left = pixelX - FIELD_TOKEN_WIDTH / 2;
              const top = pixelY - FIELD_TOKEN_HEIGHT / 2;

              // Hide if currently being dragged
              const playerId = fp.id || fp.documentId;
              if (!playerId) return null;
              const isDragging = activeDragPlayer && (activeDragPlayer.id || activeDragPlayer.documentId) === playerId;

              const panGesture = createFieldPanGesture(playerId);

              return (
                <GestureDetector gesture={panGesture} key={playerId}>
                  <View style={[styles.fieldPlayerWrapper, { left, opacity: isDragging ? 0 : 1, top }]}>
                    <DraggableToken isOnField player={fp} />
                  </View>
                </GestureDetector>
              );
            })}
          </Animated.View>
        </View>

        {/* Bench */}
        <View style={[styles.benchContainer, { backgroundColor: Colors.neutral800 }]}>
          <View style={styles.benchHeader}>
            <Text style={[Fonts.p2, { color: Colors.neutral00, fontWeight: '700' }]}>
              🪑 Banc (
              {benchPlayers.length}
              )
            </Text>
            <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
              Maintenir + glisser
            </Text>
          </View>

          <ScrollView
            contentContainerStyle={styles.benchScroll}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {benchPlayers.map((/** @type {TacticalPlayer} */ player) => {
              const playerId = player.id || player.documentId || '';
              const isDragging = activeDragPlayer && (activeDragPlayer.id || activeDragPlayer.documentId) === playerId;
              const panGesture = createBenchPanGesture(player);

              return (
                <GestureDetector gesture={panGesture} key={playerId}>
                  <View style={{ opacity: isDragging ? 0.3 : 1 }}>
                    <DraggableToken player={player} />
                  </View>
                </GestureDetector>
              );
            })}

            {benchPlayers.length === 0 && (
              <View style={styles.emptyBench}>
                <Text style={[Fonts.p3, { color: Colors.primary500 }]}>✓ Tous les joueurs sont placés !</Text>
              </View>
            )}
          </ScrollView>
        </View>

        {/* Footer */}
        <View style={[styles.footer, { backgroundColor: Colors.neutral900, borderTopColor: Colors.neutral700 }]}>
          <View style={{ flex: 1 }}>
            <Button onPress={() => navigation.goBack()} title="Retour" variant="Secondary" />
          </View>
          {!readOnly && (
            <View style={{ flex: 1 }}>
              <Button
                disabled={isSaving}
                onPress={handleSave}
                title={isSaving ? 'Enregistrement...' : `Enregistrer (${fieldPlayers.length})`}
                variant="Primary"
              />
            </View>
          )}
          {readOnly && canEdit && (
            <View style={{ flex: 1 }}>
              <Button
                onPress={() => /** @type {any} */ (navigation).navigate(RouteNames.TacticalSelectionV2, {
                  eventId,
                  existingComposition,
                  players: poolPlayers,
                  sport,
                  teamId,
                })}
                title="Modifier"
                variant="Primary"
              />
            </View>
          )}
        </View>

        {/* Ghost Token Overlay */}
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {activeDragPlayer && (
            <DraggableToken
              isGhost
              opacity={ghostOpacity}
              player={activeDragPlayer}
              scale={ghostScale}
              translateX={ghostX}
              translateY={ghostY}
            />
          )}
        </View>
      </ImageBackground>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
  },
  benchContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 8,
    paddingTop: 12,
  },
  benchHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 16,
  },
  benchScroll: {
    alignItems: 'center',
    minHeight: 90,
    paddingHorizontal: 12,
  },
  container: {
    flex: 1,
  },
  countBadge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  countText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  dropZoneIndicator: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
    borderStyle: 'dashed',
    borderWidth: 3,
    margin: 4,
  },
  emptyBench: {
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  field: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  fieldContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end', // Push field to bottom, against bench
    paddingBottom: 0, // No gap with bench
    paddingHorizontal: 8,
    paddingTop: 4,
  },
  fieldImage: {
    height: '100%',
    width: '100%',
  },
  fieldPlayerWrapper: {
    position: 'absolute',
  },
  footer: {
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 48,
    paddingVertical: 8,
    position: 'relative',
  },
  headerBackButtonContainer: {
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    top: 0,
    zIndex: 10,
  },
  headerCenter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
});

export default TacticalBoard;
