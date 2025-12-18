import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  Dimensions,
  Platform,
} from 'react-native';
import { GestureHandlerRootView, ScrollView } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { BlurView } from '@react-native-community/blur';

import useTheme from '@/theme/themeContext';
import PlayerToken from './PlayerToken';
import Button from '@/components/atoms/button/Button';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Aspect ratios per sport
/** @type {Record<string, number>} */
const FIELD_ASPECT_RATIOS = {
  football: 1.5, // 3:2 portrait
  rugby: 1.4,
  basket: 1.7,
  basketball: 1.7,
  handball: 1.5,
  volley: 1.8,
  volleyball: 1.8,
  generic: 1.5,
};

// Spring config
const SPRING_CONFIG = {
  damping: 15,
  stiffness: 150,
  mass: 0.8,
};

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

/**
 * @typedef {Object} Player
 * @property {string} [id]
 * @property {string} [documentId]
 * @property {string} [firstname]
 * @property {string} [lastname]
 * @property {string|null} [avatar]
 * @property {boolean} [isManual]
 */

/**
 * @typedef {Object} Placement
 * @property {string} playerId
 * @property {number} positionX
 * @property {number} positionY
 */

/**
 * @typedef {Object} Composition
 * @property {string} [sportContext]
 * @property {Placement[]} [placements]
 */

/**
 * Ghost Token - Follows finger during drag
 * @param {Object} props
 * @param {Player|null} props.player
 * @param {import('react-native-reanimated').SharedValue<number>} props.x
 * @param {import('react-native-reanimated').SharedValue<number>} props.y
 * @param {import('react-native-reanimated').SharedValue<number>} props.visible
 */
const GhostToken = ({ player, x, y, visible }) => {
  const { Colors } = useTheme();
  
  const initials = useMemo(() => {
    const first = player?.firstname?.charAt(0)?.toUpperCase() || '';
    const last = player?.lastname?.charAt(0)?.toUpperCase() || '';
    return first + last || '?';
  }, [player]);

  const animatedStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      transform: [
        { translateX: x.value - 35 },
        { translateY: y.value - 40 },
        { scale: withSpring(visible.value ? 1.3 : 0, SPRING_CONFIG) },
      ],
      opacity: visible.value ? 1 : 0,
    };
  });

  if (!player) return null;

  return (
    <Animated.View
      style={[
        styles.ghostToken,
        { 
          backgroundColor: Colors.primary500, 
          borderColor: Colors.neutral00,
          shadowColor: Colors.primary500,
        },
        animatedStyle,
      ]}
      pointerEvents="none"
    >
      {player?.avatar ? (
        <Image source={{ uri: player.avatar }} style={styles.ghostAvatar} />
      ) : (
        <View style={styles.ghostInitialsContainer}>
          <Text style={styles.ghostInitials}>{initials}</Text>
        </View>
      )}
      <Text style={styles.ghostName} numberOfLines={1}>{player?.firstname || ''}</Text>
    </Animated.View>
  );
};

/**
 * Drop Zone Indicator with glow effect
 * @param {Object} props
 * @param {import('react-native-reanimated').SharedValue<number>} props.visible
 * @param {import('react-native-reanimated').SharedValue<number>} props.isOverField
 */
const DropZoneIndicator = ({ visible, isOverField }) => {
  const { Colors } = useTheme();
  
  const animatedStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      opacity: withTiming(visible.value ? 0.5 : 0, { duration: 200 }),
      borderColor: isOverField.value ? '#00FF00' : Colors.primary500,
      backgroundColor: isOverField.value ? 'rgba(0, 255, 0, 0.1)' : 'transparent',
    };
  });

  return (
    <Animated.View 
      style={[styles.dropZone, animatedStyle]} 
      pointerEvents="none"
    />
  );
};

/**
 * Remove Zone - appears when dragging a field player
 * @param {Object} props
 * @param {import('react-native-reanimated').SharedValue<number>} props.visible
 */
const RemoveZone = ({ visible }) => {
  const animatedStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      opacity: withTiming(visible.value ? 1 : 0, { duration: 200 }),
      transform: [{ translateY: withSpring(visible.value ? 0 : 50, SPRING_CONFIG) }],
    };
  });

  return (
    <Animated.View style={[styles.removeZone, animatedStyle]} pointerEvents="none">
      <Text style={styles.removeZoneText}>↓ Retirer du terrain</Text>
    </Animated.View>
  );
};

/**
 * Add Manual Player Modal
 * @param {Object} props
 * @param {boolean} props.visible
 * @param {() => void} props.onClose
 * @param {(data: {firstname: string, lastname: string, number?: string}) => void} props.onAdd
 */
const AddPlayerModal = ({ visible, onClose, onAdd }) => {
  const { Colors, Fonts } = useTheme();
  const [firstname, setFirstname] = useState('');
  const [lastname, setLastname] = useState('');
  const [number, setNumber] = useState('');

  const handleSubmit = () => {
    if (!firstname.trim() || !lastname.trim()) {
      Alert.alert('Erreur', 'Prénom et nom requis');
      return;
    }
    onAdd({ 
      firstname: firstname.trim(), 
      lastname: lastname.trim(),
      number: number.trim() || undefined,
    });
    setFirstname('');
    setLastname('');
    setNumber('');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: Colors.neutral800 }]}>
          <Text style={[Fonts.h3Bold, { color: Colors.neutral00, textAlign: 'center', marginBottom: 20 }]}>
            ➕ Ajouter un joueur
          </Text>
          
          <TextInput
            placeholder="Prénom"
            placeholderTextColor={Colors.neutral300}
            value={firstname}
            onChangeText={setFirstname}
            style={[styles.input, { backgroundColor: Colors.neutral900, color: Colors.neutral00, borderColor: Colors.primary500 + '50' }]}
            autoFocus
          />
          
          <TextInput
            placeholder="Nom"
            placeholderTextColor={Colors.neutral300}
            value={lastname}
            onChangeText={setLastname}
            style={[styles.input, { backgroundColor: Colors.neutral900, color: Colors.neutral00, borderColor: Colors.primary500 + '50' }]}
          />
          
          <TextInput
            placeholder="Numéro (optionnel)"
            placeholderTextColor={Colors.neutral300}
            value={number}
            onChangeText={setNumber}
            keyboardType="number-pad"
            maxLength={2}
            style={[styles.input, { backgroundColor: Colors.neutral900, color: Colors.neutral00, borderColor: Colors.primary500 + '50' }]}
          />
          
          <View style={styles.modalButtons}>
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: Colors.neutral700 }]} onPress={onClose}>
              <Text style={{ color: Colors.neutral00, fontWeight: '600' }}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: Colors.primary500 }]} onPress={handleSubmit}>
              <Text style={{ color: '#FFF', fontWeight: '700' }}>Ajouter</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

/**
 * TacticalBoard - High Performance Drag & Drop with Fixed Aspect Ratio
 * @param {Object} props
 * @param {string} [props.sport]
 * @param {Player[]} [props.players]
 * @param {Composition|null} [props.initialComposition]
 * @param {(composition: Composition) => void} [props.onSave]
 * @param {() => void} [props.onBack]
 */
const TacticalBoard = ({
  sport = 'generic',
  players = [],
  initialComposition = null,
  onSave,
  onBack,
}) => {
  const { Colors, Fonts, Images } = useTheme();
  /** @type {React.MutableRefObject<View|null>} */
  const fieldRef = useRef(null);
  const [fieldLayout, setFieldLayout] = useState({ x: 0, y: 0, width: 300, height: 400 });
  
  /** @type {Placement[]} */
  const initialPlacements = initialComposition?.placements || [];
  const [placements, setPlacements] = useState(initialPlacements);
  
  // Modal & manual players
  const [modalVisible, setModalVisible] = useState(false);
  /** @type {Player[]} */
  const initialManualPlayers = [];
  const [manualPlayers, setManualPlayers] = useState(initialManualPlayers);
  
  // Ghost token shared values
  const ghostX = useSharedValue(0);
  const ghostY = useSharedValue(0);
  const ghostVisible = useSharedValue(0);
  const dropZoneVisible = useSharedValue(0);
  const isOverField = useSharedValue(0);
  const removeZoneVisible = useSharedValue(0);
  const [ghostPlayer, setGhostPlayer] = useState(/** @type {Player|null} */ (null));
  const [isDraggingFromField, setIsDraggingFromField] = useState(false);

  // Calculate field dimensions with fixed aspect ratio
  const sportKey = sport?.toLowerCase?.() || 'generic';
  const aspectRatio = FIELD_ASPECT_RATIOS[sportKey] || 1.5;
  const fieldImage = FIELD_IMAGES[sportKey] || FIELD_IMAGES.generic;

  // All players
  const allPlayers = useMemo(() => [...players, ...manualPlayers], [players, manualPlayers]);

  // Bench players
  const benchPlayers = useMemo(() => {
    const placedIds = placements.map((/** @type {Placement} */ p) => p.playerId);
    return allPlayers.filter((/** @type {Player} */ p) => !placedIds.includes(p.documentId || p.id || ''));
  }, [allPlayers, placements]);

  // Get player by ID
  const getPlayerById = useCallback((/** @type {string} */ playerId) => {
    return allPlayers.find((/** @type {Player} */ p) => (p.documentId || p.id) === playerId);
  }, [allPlayers]);

  // Measure field
  const onFieldLayout = useCallback((/** @type {any} */ e) => {
    const { width, height } = e.nativeEvent.layout;
    // @ts-ignore
    fieldRef.current?.measureInWindow((/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ w, /** @type {number} */ h) => {
      setFieldLayout({ x, y, width: w || width, height: h || height });
    });
  }, []);

  /**
   * Drag start handler
   */
  const handleDragStart = useCallback(
    (/** @type {{player: Player, absoluteX: number, absoluteY: number, index?: number}} */ { player, absoluteX, absoluteY }) => {
      ghostX.value = absoluteX;
      ghostY.value = absoluteY;
      ghostVisible.value = 1;
      dropZoneVisible.value = 1;
      setGhostPlayer(player);
      
      // Check if dragging from field (show remove zone)
      const playerId = player.documentId || player.id || '';
      const isOnField = placements.some((/** @type {Placement} */ p) => p.playerId === playerId);
      setIsDraggingFromField(isOnField);
      if (isOnField) {
        removeZoneVisible.value = 1;
      }
    },
    [ghostX, ghostY, ghostVisible, dropZoneVisible, removeZoneVisible, placements]
  );

  // Drag end
  const handleDragEnd = useCallback(() => {
    ghostVisible.value = 0;
    dropZoneVisible.value = 0;
    removeZoneVisible.value = 0;
    isOverField.value = 0;
    setGhostPlayer(null);
    setIsDraggingFromField(false);
  }, [ghostVisible, dropZoneVisible, removeZoneVisible, isOverField]);

  /**
   * On Drop handler
   */
  const handleDrop = useCallback(
    (/** @type {{player: Player, absoluteX: number, absoluteY: number}} */ { player, absoluteX, absoluteY }) => {
      ghostVisible.value = 0;
      dropZoneVisible.value = 0;
      removeZoneVisible.value = 0;
      isOverField.value = 0;
      setGhostPlayer(null);
      setIsDraggingFromField(false);
      
      const playerId = player.documentId || player.id || '';
      
      // Check if dropped in remove zone (bottom 15% of screen)
      const isInRemoveZone = absoluteY > SCREEN_HEIGHT * 0.85;
      
      const isOnField = (
        absoluteX >= fieldLayout.x &&
        absoluteX <= fieldLayout.x + fieldLayout.width &&
        absoluteY >= fieldLayout.y &&
        absoluteY <= fieldLayout.y + fieldLayout.height
      );

      if (isInRemoveZone) {
        // Remove from field
        setPlacements((/** @type {Placement[]} */ prev) => prev.filter((/** @type {Placement} */ p) => p.playerId !== playerId));
      } else if (isOnField) {
        const posX = ((absoluteX - fieldLayout.x) / fieldLayout.width) * 100;
        const posY = ((absoluteY - fieldLayout.y) / fieldLayout.height) * 100;
        
        setPlacements((/** @type {Placement[]} */ prev) => {
          const filtered = prev.filter((/** @type {Placement} */ p) => p.playerId !== playerId);
          return [...filtered, {
            playerId,
            positionX: Math.max(5, Math.min(95, posX)),
            positionY: Math.max(5, Math.min(95, posY)),
          }];
        });
      } else {
        // Dropped outside - remove from placements (return to bench)
        setPlacements((/** @type {Placement[]} */ prev) => prev.filter((/** @type {Placement} */ p) => p.playerId !== playerId));
      }
    },
    [fieldLayout, ghostVisible, dropZoneVisible, removeZoneVisible, isOverField]
  );

  /**
   * Add manual player
   */
  const handleAddManualPlayer = useCallback(
    (/** @type {{firstname: string, lastname: string, number?: string}} */ data) => {
      setManualPlayers((/** @type {Player[]} */ prev) => [...prev, {
        id: `manual_${Date.now()}`,
        documentId: `manual_${Date.now()}`,
        firstname: data.firstname,
        lastname: data.lastname,
        number: data.number,
        avatar: null,
        isManual: true,
      }]);
      setModalVisible(false);
    },
    []
  );

  // Save
  const handleSave = useCallback(() => {
    onSave?.({ sportContext: sport, placements });
  }, [sport, placements, onSave]);

  const placedCount = placements.length;
  const totalPlayers = allPlayers.length;

  // Calculate max field height based on available space
  const maxFieldWidth = SCREEN_WIDTH - 24; // Padding
  const maxFieldHeight = maxFieldWidth * aspectRatio;

  return (
    <GestureHandlerRootView style={[styles.container, { backgroundColor: Colors.neutral900 }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: Colors.neutral800, borderBottomColor: Colors.primary500 + '30' }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Image source={Images.arrowLeft} style={{ width: 20, height: 20, tintColor: Colors.neutral00 }} />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>⚽ Composition</Text>
          <View style={[styles.countBadge, { backgroundColor: Colors.primary500 }]}>
            <Text style={styles.countText}>{placedCount}/{totalPlayers}</Text>
          </View>
        </View>
        
        <View style={styles.backBtn} />
      </View>

      {/* Field Container with Fixed Aspect Ratio */}
      <View style={styles.fieldWrapper}>
        {/* Ambient background to fill empty space */}
        <View style={[styles.ambientBg, { backgroundColor: Colors.neutral800 }]} />
        
        <View 
          ref={fieldRef} 
          style={[
            styles.field, 
            { 
              width: maxFieldWidth,
              height: Math.min(maxFieldHeight, SCREEN_HEIGHT * 0.55),
              borderColor: Colors.primary500 + '40',
            }
          ]} 
          onLayout={onFieldLayout}
        >
          <Image source={fieldImage} style={styles.fieldImage} resizeMode="cover" />
          
          {/* Drop zone indicator */}
          <DropZoneIndicator visible={dropZoneVisible} isOverField={isOverField} />
          
          {/* Placed Players */}
          {placements.map((/** @type {Placement} */ placement, /** @type {number} */ idx) => {
            const player = getPlayerById(placement.playerId);
            if (!player) return null;
            
            const left = (placement.positionX / 100) * fieldLayout.width - 30;
            const top = (placement.positionY / 100) * fieldLayout.height - 37;
            
            return (
              <View key={placement.playerId} style={[styles.fieldTokenWrapper, { left, top }]}>
                <PlayerToken
                  player={player}
                  index={idx}
                  isOnField={true}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDrop={handleDrop}
                />
              </View>
            );
          })}
        </View>
      </View>

      {/* Remove Zone (appears when dragging from field) */}
      <RemoveZone visible={removeZoneVisible} />

      {/* Bench with Glassmorphism effect */}
      <View style={styles.benchWrapper}>
        {Platform.OS === 'ios' ? (
          <BlurView 
            style={StyleSheet.absoluteFill} 
            blurType="dark" 
            blurAmount={10}
            reducedTransparencyFallbackColor={Colors.neutral800}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.neutral800 + 'F0' }]} />
        )}
        
        <View style={styles.benchContent}>
          <View style={styles.benchHeader}>
            <View style={styles.benchTitleRow}>
              <Text style={{ color: Colors.neutral00, fontSize: 14, fontWeight: '700' }}>
                🪑 BANC
              </Text>
              <View style={[styles.benchCountBadge, { backgroundColor: Colors.neutral700 }]}>
                <Text style={{ color: Colors.neutral200, fontSize: 11, fontWeight: '600' }}>
                  {benchPlayers.length}
                </Text>
              </View>
            </View>
            <Text style={{ color: Colors.primary100, fontSize: 11 }}>
              Maintenir + glisser
            </Text>
          </View>
          
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.benchScroll}
            nestedScrollEnabled
          >
            {/* Add Button */}
            <TouchableOpacity
              style={[styles.addButton, { borderColor: Colors.primary500, backgroundColor: Colors.primary500 + '15' }]}
              onPress={() => setModalVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={{ color: Colors.primary500, fontSize: 28, fontWeight: '300' }}>+</Text>
              <Text style={{ color: Colors.primary100, fontSize: 8, marginTop: 2 }}>Ajouter</Text>
            </TouchableOpacity>

            {benchPlayers.map((/** @type {Player} */ player, /** @type {number} */ idx) => (
              <PlayerToken
                key={player.documentId || player.id}
                player={player}
                index={idx}
                isOnField={false}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDrop={handleDrop}
              />
            ))}
            
            {benchPlayers.length === 0 && (
              <View style={styles.emptyBench}>
                <Text style={{ color: Colors.primary500, fontSize: 12 }}>✓ Tous placés !</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>

      {/* Footer */}
      <View style={[styles.footer, { backgroundColor: Colors.neutral900, borderTopColor: Colors.neutral700 }]}>
        <View style={{ flex: 1 }}>
          <Button title="Annuler" variant="Secondary" onPress={onBack} />
        </View>
        <View style={{ flex: 1 }}>
          <Button 
            title={`Enregistrer (${placedCount})`} 
            variant="Primary" 
            onPress={handleSave} 
          />
        </View>
      </View>

      {/* Ghost Token */}
      <View style={styles.ghostContainer} pointerEvents="none">
        <GhostToken player={ghostPlayer} x={ghostX} y={ghostY} visible={ghostVisible} />
      </View>

      {/* Modal */}
      <AddPlayerModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onAdd={handleAddManualPlayer}
      />
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
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
  // Field
  fieldWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  ambientBg: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.3,
  },
  field: {
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 2,
  },
  fieldImage: {
    width: '100%',
    height: '100%',
  },
  fieldTokenWrapper: {
    position: 'absolute',
  },
  dropZone: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 3,
    borderStyle: 'dashed',
    borderRadius: 14,
    margin: 6,
  },
  // Remove zone
  removeZone: {
    position: 'absolute',
    bottom: 160,
    left: 20,
    right: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 59, 48, 0.9)',
    borderRadius: 12,
    alignItems: 'center',
  },
  removeZoneText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  // Bench
  benchWrapper: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    marginTop: -16,
  },
  benchContent: {
    paddingTop: 14,
    paddingBottom: 8,
  },
  benchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  benchTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  benchCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  benchScroll: {
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 90,
    paddingBottom: 4,
  },
  addButton: {
    width: 66,
    height: 82,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
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
  // Ghost Token
  ghostContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
  ghostToken: {
    position: 'absolute',
    width: 70,
    height: 90,
    borderRadius: 35,
    borderWidth: 3,
    alignItems: 'center',
    paddingTop: 6,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 30,
  },
  ghostAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  ghostInitialsContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostInitials: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '700',
  },
  ghostName: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(1, 179, 244, 0.3)',
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 12,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
});

export default TacticalBoard;
