import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ImageBackground,
  Vibration,
  Alert,
} from 'react-native';
import { GestureHandlerRootView, ScrollView, Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedRef,
  measure,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useTheme from '@/theme/themeContext';
import DraggableToken from './DraggableToken';
import Button from '@/components/atoms/button/Button';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import { updateEvent } from '@/services/event/eventService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Field aspect ratios per sport
/** @type {Record<string, number>} */
const FIELD_ASPECT_RATIOS = {
  football: 1.5,
  rugby: 1.4,
  basket: 1.7,
  basketball: 1.7,
  handball: 1.5,
  volley: 1.8,
  volleyball: 1.8,
  generic: 1.5,
};

// Field images
/** @type {Record<string, any>} */
const FIELD_IMAGES = {
  football: require('@/assets/fields/field_football.png'),
  rugby: require('@/assets/fields/field_rugby.png'),
  basket: require('@/assets/fields/field_basket.png'),
  basketball: require('@/assets/fields/field_basket.png'),
  handball: require('@/assets/fields/field_handball.png'),
  volley: require('@/assets/fields/field_volley.png'),
  volleyball: require('@/assets/fields/field_volley.png'),
  generic: require('@/assets/fields/field_generic.png'),
};

// Spring config
const SPRING_CONFIG = {
  damping: 18,
  stiffness: 200,
  mass: 0.8,
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
const TacticalBoard = () => {
  const { Colors, Fonts, Images, Alignments, Spaces } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  
  // Get params
  /** @type {{selectedPlayers?: TacticalPlayer[], eventId?: string, sport?: string, existingComposition?: any, teamId?: string}} */
  const params = route.params || {};
  const { 
    selectedPlayers = [], 
    eventId, 
    sport = 'football',
    existingComposition,
    teamId, 
  } = params;
  
  // Initialize players from existing composition
  const { initialFieldPlayers, initialBenchPlayers } = useMemo(() => {
    if (existingComposition?.placements?.length) {
      // Build field players from composition
      const fieldFromCompo = existingComposition.placements
        .filter(p => selectedPlayers.some(sp => (sp.id === p.playerId) || (sp.documentId === p.playerId)))
        .map(p => ({
          id: p.playerId,
          x: p.positionX,
          y: p.positionY,
        }));
      
      // Players not in composition go to bench
      const placedIds = new Set(fieldFromCompo.map(fp => fp.id));
      const benchFromCompo = selectedPlayers.filter(p => {
        const id = p.id || p.documentId;
        return !placedIds.has(id);
      });
      
      return { 
        initialFieldPlayers: fieldFromCompo, 
        initialBenchPlayers: benchFromCompo,
      };
    }
    
    // No existing composition - all players on bench
    return { 
      initialFieldPlayers: [], 
      initialBenchPlayers: selectedPlayers,
    };
  }, [existingComposition, selectedPlayers]);
  
  // Field ref using Reanimated for UI Thread measurements
  const fieldRef = useAnimatedRef();
  
  // Field dimensions in SharedValues for worklet access
  const fieldX = useSharedValue(0);
  const fieldY = useSharedValue(0);
  const fieldW = useSharedValue(300);
  const fieldH = useSharedValue(450);
  
  // Also keep React state for rendering positioned players
  const [fieldRect, setFieldRect] = useState({ x: 0, y: 0, width: 300, height: 450 });
  
  // === STATE ===
  // Bench players (not placed on field)
  const [benchPlayers, setBenchPlayers] = useState(initialBenchPlayers);
  
  // Field players (placed on field) - { id, x, y } where x,y are percentages
  const [fieldPlayers, setFieldPlayers] = useState(initialFieldPlayers);
  
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
            setFieldRect({ x, y, width, height });
          }
        });
      } catch (e) {
        console.warn('[TacticalBoard] Measure failed:', e);
      }
    }, 100);
  }, [fieldRef, fieldX, fieldY, fieldW, fieldH]);

  // Get player by ID from either bench or selected
  const getPlayerById = useCallback((/** @type {string} */ id) => {
    return selectedPlayers.find(p => (p.id || p.documentId) === id);
  }, [selectedPlayers]);

  // === DRAG HANDLERS ===
  
  // Start drag from bench
  const startDragFromBench = useCallback((/** @type {TacticalPlayer} */ player, /** @type {number} */ pageX, /** @type {number} */ pageY) => {
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
  const startDragFromField = useCallback((/** @type {string} */ playerId, /** @type {number} */ pageX, /** @type {number} */ pageY) => {
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
  const updateDragPosition = useCallback((/** @type {number} */ pageX, /** @type {number} */ pageY) => {
    ghostX.value = pageX - GHOST_TOKEN_WIDTH / 2;
    ghostY.value = pageY - GHOST_TOKEN_HEIGHT / 2;
  }, [ghostX, ghostY]);

  // End drag - use SharedValues for precise coordinates
  const endDrag = useCallback((/** @type {number} */ pageX, /** @type {number} */ pageY) => {
    if (!activeDragPlayer) return;
    
    const playerId = activeDragPlayer.id || activeDragPlayer.documentId || '';
    
    // Use current SharedValue values for precision
    const fx = fieldX.value;
    const fy = fieldY.value;
    const fw = fieldW.value;
    const fh = fieldH.value;
    
    console.log('[TacticalBoard] Drop at:', { pageX, pageY });
    console.log('[TacticalBoard] Field rect (SharedValues):', { x: fx, y: fy, width: fw, height: fh });
    
    // Check if dropped on field
    const isOnField = (
      pageX >= fx &&
      pageX <= fx + fw &&
      pageY >= fy &&
      pageY <= fy + fh
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
      
      // Update field players
      setFieldPlayers(prev => {
        const filtered = prev.filter(p => p.id !== playerId);
        return [...filtered, { id: playerId, x: clampedX, y: clampedY }];
      });
      
      // Remove from bench if coming from bench
      if (dragSource === 'bench') {
        setBenchPlayers(prev => prev.filter(p => (p.id || p.documentId) !== playerId));
      }
    } else {
      // Dropped outside field - return to bench
      if (dragSource === 'field') {
        setFieldPlayers(prev => prev.filter(p => p.id !== playerId));
        setBenchPlayers(prev => {
          // Check if already in bench
          const exists = prev.some(p => (p.id || p.documentId) === playerId);
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
  const createBenchPanGesture = useCallback((/** @type {TacticalPlayer} */ player) => {
    return Gesture.Pan()
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
      });
  }, [startDragFromBench, updateDragPosition, endDrag]);

  // Create pan gesture for field player
  const createFieldPanGesture = useCallback((/** @type {string} */ playerId) => {
    return Gesture.Pan()
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
      });
  }, [startDragFromField, updateDragPosition, endDrag]);

  // === SAVE ===
  const handleSave = useCallback(async () => {
    if (!eventId) {
      Alert.alert('Erreur', 'ID événement manquant');
      return;
    }
    
    setIsSaving(true);
    try {
      const compositionData = {
        sportContext: sport,
        placements: fieldPlayers.map(fp => ({
          playerId: fp.id,
          positionX: fp.x,
          positionY: fp.y,
        })),
      };
      
      await updateEvent({
        documentId: eventId,
        eventData: {
          composition: compositionData, // json field accepts object directly
        },
      });
      
      Alert.alert('Succès', 'Composition enregistrée !', [
        { text: 'OK', onPress: () => navigation.goBack() }
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
        source={Images.bg1}
        style={[Alignments.fill, { paddingTop: insets.top }]}
        resizeMode="cover"
      >
        {/* Header with safe area */}
        <View style={styles.header}>
          <HeaderBackButton onPress={() => navigation.goBack()} />
          <View style={styles.headerCenter}>
            <Text style={[Fonts.h3Bold, { color: Colors.neutral00 }]}>Composition</Text>
            <View style={[styles.countBadge, { backgroundColor: Colors.primary500 }]}>
              <Text style={[Fonts.p3, { color: '#FFF', fontWeight: '700' }]}>{fieldPlayers.length}/{selectedPlayers.length}</Text>
            </View>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        {/* Field Area */}
        <View style={styles.fieldContainer}>
          <Animated.View 
            ref={fieldRef}
            style={[
              styles.field, 
              { 
                width: fieldWidth, 
                height: fieldHeight,
                borderColor: Colors.primary500 + '40',
              }
            ]}
            onLayout={measureField}
          >
            <Image source={fieldImage} style={styles.fieldImage} resizeMode="cover" />
            
            {/* Drop zone indicator */}
            <Animated.View style={[styles.dropZoneIndicator, { borderColor: Colors.primary500 }, dropZoneStyle]} />
            
            {/* Placed players */}
            {fieldPlayers.map((fp) => {
              const player = getPlayerById(fp.id);
              if (!player) return null;
              
              // Use React state for consistent display
              // fp.x/y are percentages where the finger was (center of ghost)
              // We need to center the field token on that same point
              const pixelX = (fp.x / 100) * fieldRect.width;
              const pixelY = (fp.y / 100) * fieldRect.height;
              
              // Center the token on the stored position
              const left = pixelX - FIELD_TOKEN_WIDTH / 2;
              const top = pixelY - FIELD_TOKEN_HEIGHT / 2;
              
              // Hide if currently being dragged
              const isDragging = activeDragPlayer && (activeDragPlayer.id || activeDragPlayer.documentId) === fp.id;
              
              const panGesture = createFieldPanGesture(fp.id);
              
              return (
                <GestureDetector key={fp.id} gesture={panGesture}>
                  <View style={[styles.fieldPlayerWrapper, { left, top, opacity: isDragging ? 0 : 1 }]}>
                    <DraggableToken player={player} isOnField />
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
              🪑 Banc ({benchPlayers.length})
            </Text>
            <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
              Maintenir + glisser
            </Text>
          </View>
          
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.benchScroll}
          >
            {benchPlayers.map((player) => {
              const playerId = player.id || player.documentId || '';
              const isDragging = activeDragPlayer && (activeDragPlayer.id || activeDragPlayer.documentId) === playerId;
              const panGesture = createBenchPanGesture(player);
              
              return (
                <GestureDetector key={playerId} gesture={panGesture}>
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
            <Button title="Retour" variant="Secondary" onPress={() => navigation.goBack()} />
          </View>
          <View style={{ flex: 1 }}>
            <Button 
              title={isSaving ? 'Enregistrement...' : `Enregistrer (${fieldPlayers.length})`}
              variant="Primary"
              onPress={handleSave}
              disabled={isSaving}
            />
          </View>
        </View>

        {/* Ghost Token Overlay */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {activeDragPlayer && (
            <DraggableToken
              player={activeDragPlayer}
              isGhost
              translateX={ghostX}
              translateY={ghostY}
              scale={ghostScale}
              opacity={ghostOpacity}
            />
          )}
        </View>
      </ImageBackground>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 16,
    paddingVertical: 8,
  },
  headerSpacer: {
    width: 44,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  fieldContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end', // Push field to bottom, against bench
    paddingTop: 4,
    paddingBottom: 0, // No gap with bench
    paddingHorizontal: 8,
  },
  field: {
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
  },
  fieldImage: {
    width: '100%',
    height: '100%',
  },
  dropZoneIndicator: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 3,
    borderStyle: 'dashed',
    borderRadius: 14,
    margin: 4,
  },
  fieldPlayerWrapper: {
    position: 'absolute',
  },
  benchContainer: {
    paddingTop: 12,
    paddingBottom: 8,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  benchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  benchScroll: {
    paddingHorizontal: 12,
    minHeight: 90,
    alignItems: 'center',
  },
  emptyBench: {
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
  },
});

export default TacticalBoard;
