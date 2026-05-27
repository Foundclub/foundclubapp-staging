import { BlurView } from '@sbaiahmed1/react-native-blur';
import {
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Dimensions,
  Image,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { GestureHandlerRootView, ScrollView } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import RenderedTacticalField from '@/components/tactical/RenderedTacticalField';

import {
  getTacticalFieldAspectRatio,
} from '@/utils/tacticalField';

import { useAppFeedback } from '@/context/AppFeedbackContext';
// eslint-disable-next-line perfectionist/sort-imports
import PlayerToken from './PlayerToken';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

// Spring config
const SPRING_CONFIG = {
  damping: 15,
  mass: 0.8,
  stiffness: 150,
};

/**
 * @typedef {object} Player
 * @property {string} [id]
 * @property {string} [documentId]
 * @property {string} [firstname]
 * @property {string} [lastname]
 * @property {string|null} [avatar]
 * @property {boolean} [isManual]
 */

/**
 * @typedef {object} Placement
 * @property {string} playerId
 * @property {number} positionX
 * @property {number} positionY
 */

/**
 * @typedef {object} Composition
 * @property {string} [sportContext]
 * @property {Placement[]} [placements]
 */

/**
 * Ghost Token - Follows finger during drag
 * @param {object} props
 * @param {Player|null} props.player
 * @param {import('react-native-reanimated').SharedValue<number>} props.x
 * @param {import('react-native-reanimated').SharedValue<number>} props.y
 * @param {import('react-native-reanimated').SharedValue<number>} props.visible
 */
function GhostToken({
  player, visible, x, y,
}) {
  const { Colors } = useTheme();

  const initials = useMemo(() => {
    const first = player?.firstname?.charAt(0)?.toUpperCase() || '';
    const last = player?.lastname?.charAt(0)?.toUpperCase() || '';
    return first + last || '?';
  }, [player]);

  const animatedStyle = useAnimatedStyle(() => {
    'worklet';

    return {
      opacity: visible.value ? 1 : 0,
      transform: [
        { translateX: x.value - 35 },
        { translateY: y.value - 40 },
        { scale: withSpring(visible.value ? 1.3 : 0, SPRING_CONFIG) },
      ],
    };
  });

  if (!player) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ghostToken,
        {
          backgroundColor: Colors.primary500,
          borderColor: Colors.neutral00,
          shadowColor: Colors.primary500,
        },
        animatedStyle,
      ]}
    >
      {player?.avatar ? (
        <Image source={{ uri: player.avatar }} style={styles.ghostAvatar} />
      ) : (
        <View style={styles.ghostInitialsContainer}>
          <Text style={styles.ghostInitials}>{initials}</Text>
        </View>
      )}
      <Text numberOfLines={1} style={styles.ghostName}>{player?.firstname || ''}</Text>
    </Animated.View>
  );
}

/**
 * Drop Zone Indicator with glow effect
 * @param {object} props
 * @param {import('react-native-reanimated').SharedValue<number>} props.visible
 * @param {import('react-native-reanimated').SharedValue<number>} props.isOverField
 */
function DropZoneIndicator({ isOverField, visible }) {
  const { Colors } = useTheme();

  const animatedStyle = useAnimatedStyle(() => {
    'worklet';

    return {
      backgroundColor: isOverField.value ? 'rgba(0, 255, 0, 0.1)' : 'transparent',
      borderColor: isOverField.value ? '#00FF00' : Colors.primary500,
      opacity: withTiming(visible.value ? 0.5 : 0, { duration: 200 }),
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.dropZone, animatedStyle]}
    />
  );
}

/**
 * Remove Zone - appears when dragging a field player
 * @param {object} props
 * @param {import('react-native-reanimated').SharedValue<number>} props.visible
 */
function RemoveZone({ visible }) {
  const animatedStyle = useAnimatedStyle(() => {
    'worklet';

    return {
      opacity: withTiming(visible.value ? 1 : 0, { duration: 200 }),
      transform: [{ translateY: withSpring(visible.value ? 0 : 50, SPRING_CONFIG) }],
    };
  });

  return (
    <Animated.View pointerEvents="none" style={[styles.removeZone, animatedStyle]}>
      <Text style={styles.removeZoneText}>Retirer du terrain</Text>
    </Animated.View>
  );
}

/**
 * Add Manual Player Modal
 * @param {object} props
 * @param {boolean} props.visible
 * @param {() => void} props.onClose
 * @param {(data: {firstname: string, lastname: string, number?: string}) => void} props.onAdd
 */
function AddPlayerModal({ onAdd, onClose, visible }) {
  const { Colors, Fonts } = useTheme();
  const { showBanner } = useAppFeedback();
  const [firstname, setFirstname] = useState('');
  const [lastname, setLastname] = useState('');
  const [number, setNumber] = useState('');

  const handleSubmit = () => {
    if (!firstname.trim() || !lastname.trim()) {
      showBanner({
        body: 'Prénom et nom requis.',
        title: 'Erreur',
        tone: 'error',
      });
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
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: Colors.neutral800 }]}>
          <Text style={[Fonts.h3Bold, { color: Colors.neutral00, marginBottom: 20, textAlign: 'center' }]}>
            Ajouter un joueur
          </Text>

          <TextInput
            autoFocus
            onChangeText={setFirstname}
            placeholder="Prénom"
            placeholderTextColor={Colors.neutral300}
            style={[styles.input, { backgroundColor: Colors.neutral900, borderColor: `${Colors.primary500}50`, color: Colors.neutral00 }]}
            value={firstname}
          />

          <TextInput
            onChangeText={setLastname}
            placeholder="Nom"
            placeholderTextColor={Colors.neutral300}
            style={[styles.input, { backgroundColor: Colors.neutral900, borderColor: `${Colors.primary500}50`, color: Colors.neutral00 }]}
            value={lastname}
          />

          <TextInput
            keyboardType="number-pad"
            maxLength={2}
            onChangeText={setNumber}
            placeholder="Numéro (optionnel)"
            placeholderTextColor={Colors.neutral300}
            style={[styles.input, { backgroundColor: Colors.neutral900, borderColor: `${Colors.primary500}50`, color: Colors.neutral00 }]}
            value={number}
          />

          <View style={styles.modalButtons}>
            <TouchableOpacity onPress={onClose} style={[styles.modalBtn, { backgroundColor: Colors.neutral700 }]}>
              <Text style={{ color: Colors.neutral00, fontWeight: '600' }}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSubmit} style={[styles.modalBtn, { backgroundColor: Colors.primary500 }]}>
              <Text style={{ color: '#FFF', fontWeight: '700' }}>Ajouter</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/**
 * TacticalBoard - High Performance Drag & Drop with Fixed Aspect Ratio
 * @param {object} props
 * @param {string} [props.sport]
 * @param {Player[]} [props.players]
 * @param {Composition|null} [props.initialComposition]
 * @param {(composition: Composition) => void} [props.onSave]
 * @param {() => void} [props.onBack]
 */
function TacticalBoard({
  initialComposition = null,
  onBack,
  onSave,
  players = [],
  sport = 'generic',
}) {
  const { Colors, Fonts, Images } = useTheme();
  /** @type {import('react').MutableRefObject<View | null>} */
  const fieldRef = useRef(null);
  const [fieldLayout, setFieldLayout] = useState({
    height: 400, width: 300, x: 0, y: 0,
  });

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
  const [, setIsDraggingFromField] = useState(false);

  // Calculate field dimensions with fixed aspect ratio
  const aspectRatio = getTacticalFieldAspectRatio(sport);

  // All players
  const allPlayers = useMemo(() => [...players, ...manualPlayers], [players, manualPlayers]);

  // Bench players
  const benchPlayers = useMemo(() => {
    const placedIds = placements.map((/** @type {Placement} */ p) => p.playerId);
    return allPlayers.filter((/** @type {Player} */ p) => !placedIds.includes(p.documentId || p.id || ''));
  }, [allPlayers, placements]);

  // Get player by ID
  const getPlayerById = useCallback((/** @type {string} */ playerId) => allPlayers.find((/** @type {Player} */ p) => (p.documentId || p.id) === playerId), [allPlayers]);

  // Measure field
  const onFieldLayout = useCallback((/** @type {any} */ e) => {
    const { height, width } = e.nativeEvent.layout;
    // @ts-ignore
    fieldRef.current?.measureInWindow((/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ w, /** @type {number} */ h) => {
      setFieldLayout({
        height: h || height, width: w || width, x, y,
      });
    });
  }, []);

  /**
   * Drag start handler
   */
  const handleDragStart = useCallback(
    (/** @type {{player: Player, absoluteX: number, absoluteY: number, index?: number}} */ { absoluteX, absoluteY, player }) => {
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
    [ghostX, ghostY, ghostVisible, dropZoneVisible, removeZoneVisible, placements],
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
    (/** @type {{player: Player, absoluteX: number, absoluteY: number}} */ { absoluteX, absoluteY, player }) => {
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
        absoluteX >= fieldLayout.x
        && absoluteX <= fieldLayout.x + fieldLayout.width
        && absoluteY >= fieldLayout.y
        && absoluteY <= fieldLayout.y + fieldLayout.height
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
    [fieldLayout, ghostVisible, dropZoneVisible, removeZoneVisible, isOverField],
  );

  /**
   * Add manual player
   */
  const handleAddManualPlayer = useCallback(
    (/** @type {{firstname: string, lastname: string, number?: string}} */ data) => {
      setManualPlayers((/** @type {Player[]} */ prev) => [...prev, {
        avatar: null,
        documentId: `manual_${Date.now()}`,
        firstname: data.firstname,
        id: `manual_${Date.now()}`,
        isManual: true,
        lastname: data.lastname,
        number: data.number,
      }]);
      setModalVisible(false);
    },
    [],
  );

  // Save
  const handleSave = useCallback(() => {
    onSave?.({ placements, sportContext: sport });
  }, [sport, placements, onSave]);

  const placedCount = placements.length;
  const totalPlayers = allPlayers.length;

  // Calculate max field height based on available space
  const maxFieldWidth = SCREEN_WIDTH - 24; // Padding
  const maxFieldHeight = maxFieldWidth * aspectRatio;

  return (
    <GestureHandlerRootView style={[styles.container, { backgroundColor: Colors.neutral900 }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: Colors.neutral800, borderBottomColor: `${Colors.primary500}30` }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Image source={Images.arrowLeft} style={{ height: 20, tintColor: Colors.neutral00, width: 20 }} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>Composition</Text>
          <View style={[styles.countBadge, { backgroundColor: Colors.primary500 }]}>
            <Text style={styles.countText}>
              {placedCount}
              /
              {totalPlayers}
            </Text>
          </View>
        </View>

        <View style={styles.backBtn} />
      </View>

      {/* Field Container with Fixed Aspect Ratio */}
      <View style={styles.fieldWrapper}>
        {/* Ambient background to fill empty space */}
        <View style={[styles.ambientBg, { backgroundColor: Colors.neutral800 }]} />

        <View
          onLayout={onFieldLayout}
          ref={fieldRef}
          style={[
            styles.field,
            {
              borderColor: `${Colors.primary500}40`,
              height: Math.min(maxFieldHeight, SCREEN_HEIGHT * 0.55),
              width: maxFieldWidth,
            },
          ]}
        >
          <RenderedTacticalField sport={sport} style={StyleSheet.absoluteFillObject} />

          {/* Drop zone indicator */}
          <DropZoneIndicator isOverField={isOverField} visible={dropZoneVisible} />

          {/* Placed Players */}
          {placements.map((/** @type {Placement} */ placement, /** @type {number} */ idx) => {
            const player = getPlayerById(placement.playerId);
            if (!player) return null;

            const left = (placement.positionX / 100) * fieldLayout.width - 30;
            const top = (placement.positionY / 100) * fieldLayout.height - 37;

            return (
              <View key={placement.playerId} style={[styles.fieldTokenWrapper, { left, top }]}>
                <PlayerToken
                  index={idx}
                  isOnField
                  onDragEnd={handleDragEnd}
                  onDragStart={handleDragStart}
                  onDrop={handleDrop}
                  player={player}
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
            blurAmount={10}
            blurType="dark"
            reducedTransparencyFallbackColor={Colors.neutral800}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: `${Colors.neutral800}F0` }]} />
        )}

        <View style={styles.benchContent}>
          <View style={styles.benchHeader}>
            <View style={styles.benchTitleRow}>
              <Text style={{ color: Colors.neutral00, fontSize: 14, fontWeight: '700' }}>
                BANC
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
            contentContainerStyle={styles.benchScroll}
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
          >
            {/* Add Button */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setModalVisible(true)}
              style={[styles.addButton, { backgroundColor: `${Colors.primary500}15`, borderColor: Colors.primary500 }]}
            >
              <Text style={{ color: Colors.primary500, fontSize: 28, fontWeight: '300' }}>+</Text>
              <Text style={{ color: Colors.primary100, fontSize: 8, marginTop: 2 }}>Ajouter</Text>
            </TouchableOpacity>

            {benchPlayers.map((/** @type {Player} */ player, /** @type {number} */ idx) => (
              <PlayerToken
                index={idx}
                isOnField={false}
                key={player.documentId || player.id}
                onDragEnd={handleDragEnd}
                onDragStart={handleDragStart}
                onDrop={handleDrop}
                player={player}
              />
            ))}

            {benchPlayers.length === 0 && (
              <View style={styles.emptyBench}>
                <Text style={{ color: Colors.primary500, fontSize: 12 }}>Tous places !</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>

      {/* Footer */}
      <View style={[styles.footer, { backgroundColor: Colors.neutral900, borderTopColor: Colors.neutral700 }]}>
        <View style={{ flex: 1 }}>
          <Button onPress={onBack} title="Annuler" variant="Secondary" />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            onPress={handleSave}
            title={`Enregistrer (${placedCount})`}
            variant="Primary"
          />
        </View>
      </View>

      {/* Ghost Token */}
      <View pointerEvents="none" style={styles.ghostContainer}>
        <GhostToken player={ghostPlayer} visible={ghostVisible} x={ghostX} y={ghostY} />
      </View>

      {/* Modal */}
      <AddPlayerModal
        onAdd={handleAddManualPlayer}
        onClose={() => setModalVisible(false)}
        visible={modalVisible}
      />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  backBtn: {
    alignItems: 'center',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
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
  header: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  headerCenter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  // Field
  ambientBg: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.3,
  },
  dropZone: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
    borderStyle: 'dashed',
    borderWidth: 3,
    margin: 6,
  },
  field: {
    borderRadius: 16,
    borderWidth: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  fieldTokenWrapper: {
    position: 'absolute',
  },
  fieldWrapper: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 8,
  },
  // Remove zone
  removeZone: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.9)',
    borderRadius: 12,
    bottom: 160,
    left: 20,
    paddingVertical: 12,
    position: 'absolute',
    right: 20,
  },
  removeZoneText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  // Bench
  addButton: {
    alignItems: 'center',
    borderRadius: 12,
    borderStyle: 'dashed',
    borderWidth: 2,
    height: 82,
    justifyContent: 'center',
    marginRight: 8,
    width: 66,
  },
  benchContent: {
    paddingBottom: 8,
    paddingTop: 14,
  },
  benchCountBadge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
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
    flexDirection: 'row',
    minHeight: 90,
    paddingBottom: 4,
    paddingHorizontal: 12,
  },
  benchTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  benchWrapper: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -16,
    overflow: 'hidden',
  },
  emptyBench: {
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  footer: {
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  // Ghost Token
  ghostAvatar: {
    borderColor: '#FFF',
    borderRadius: 26,
    borderWidth: 2,
    height: 52,
    width: 52,
  },
  ghostContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
  ghostInitials: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '700',
  },
  ghostInitialsContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 26,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  ghostName: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { height: 1, width: 0 },
    textShadowRadius: 4,
  },
  ghostToken: {
    alignItems: 'center',
    borderRadius: 35,
    borderWidth: 3,
    elevation: 30,
    height: 90,
    paddingTop: 6,
    position: 'absolute',
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    width: 70,
  },
  // Modal
  input: {
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
    marginBottom: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  modalBtn: {
    alignItems: 'center',
    borderRadius: 12,
    flex: 1,
    paddingVertical: 14,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalContent: {
    borderColor: 'rgba(1, 179, 244, 0.3)',
    borderRadius: 20,
    borderWidth: 1,
    maxWidth: 340,
    padding: 24,
    width: '100%',
  },
  modalOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
});

export default TacticalBoard;
