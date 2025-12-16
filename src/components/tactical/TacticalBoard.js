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
} from 'react-native';
import { GestureHandlerRootView, ScrollView } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';

import useTheme from '@/theme/themeContext';
import PlayerToken from './PlayerToken';
import Button from '@/components/atoms/button/Button';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Spring config
const SPRING_CONFIG = {
  damping: 15,
  stiffness: 150,
  mass: 0.8,
};

// Field background images
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
 * Ghost Token - Follows finger during drag
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
        { translateY: y.value - 35 },
        { scale: withSpring(visible.value ? 1.25 : 0, SPRING_CONFIG) },
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
        <Text style={styles.ghostInitials}>{initials}</Text>
      )}
      <Text style={styles.ghostName} numberOfLines={1}>{player?.firstname || ''}</Text>
    </Animated.View>
  );
};

/**
 * Drop Zone Indicator
 */
const DropZoneIndicator = ({ visible }) => {
  const { Colors } = useTheme();
  
  const animatedStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      opacity: withTiming(visible.value ? 0.3 : 0, { duration: 200 }),
      transform: [{ scale: withSpring(visible.value ? 1 : 0.9, SPRING_CONFIG) }],
    };
  });

  return (
    <Animated.View 
      style={[styles.dropZone, { borderColor: Colors.primary500 }, animatedStyle]} 
      pointerEvents="none"
    />
  );
};

/**
 * Add Manual Player Modal
 */
const AddPlayerModal = ({ visible, onClose, onAdd }) => {
  const { Colors, Fonts } = useTheme();
  const [firstname, setFirstname] = useState('');
  const [lastname, setLastname] = useState('');

  const handleSubmit = () => {
    if (!firstname.trim() || !lastname.trim()) {
      Alert.alert('Erreur', 'Prénom et nom requis');
      return;
    }
    onAdd({ firstname: firstname.trim(), lastname: lastname.trim() });
    setFirstname('');
    setLastname('');
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
 * TacticalBoard - High Performance Drag & Drop
 */
const TacticalBoard = ({
  sport = 'generic',
  players = [],
  initialComposition = null,
  onSave,
  onBack,
}) => {
  const { Colors, Fonts, Images } = useTheme();
  const fieldRef = useRef(null);
  const [fieldLayout, setFieldLayout] = useState({ x: 0, y: 0, width: 300, height: 400 });
  
  // Placements state
  const [placements, setPlacements] = useState(() => {
    if (initialComposition?.placements) {
      return initialComposition.placements;
    }
    return [];
  });
  
  // Modal & manual players
  const [modalVisible, setModalVisible] = useState(false);
  const [manualPlayers, setManualPlayers] = useState([]);
  
  // Ghost token shared values
  const ghostX = useSharedValue(0);
  const ghostY = useSharedValue(0);
  const ghostVisible = useSharedValue(0);
  const dropZoneVisible = useSharedValue(0);
  const [ghostPlayer, setGhostPlayer] = useState(null);

  // Field image
  const fieldImage = useMemo(() => {
    const key = sport?.toLowerCase?.() || 'generic';
    return FIELD_IMAGES[key] || FIELD_IMAGES.generic;
  }, [sport]);

  // All players
  const allPlayers = useMemo(() => [...players, ...manualPlayers], [players, manualPlayers]);

  // Bench players
  const benchPlayers = useMemo(() => {
    const placedIds = placements.map(p => p.playerId);
    return allPlayers.filter(p => !placedIds.includes(p.documentId || p.id));
  }, [allPlayers, placements]);

  // Get player by ID
  const getPlayerById = useCallback((playerId) => {
    return allPlayers.find(p => (p.documentId || p.id) === playerId);
  }, [allPlayers]);

  // Measure field
  const onFieldLayout = useCallback((e) => {
    const { width, height } = e.nativeEvent.layout;
    fieldRef.current?.measureInWindow((x, y, w, h) => {
      setFieldLayout({ x, y, width: w || width, height: h || height });
    });
  }, []);

  // Drag start
  const handleDragStart = useCallback(({ player, absoluteX, absoluteY }) => {
    ghostX.value = absoluteX;
    ghostY.value = absoluteY;
    ghostVisible.value = 1;
    dropZoneVisible.value = 1;
    setGhostPlayer(player);
  }, []);

  // Drag end
  const handleDragEnd = useCallback(() => {
    ghostVisible.value = 0;
    dropZoneVisible.value = 0;
    setGhostPlayer(null);
  }, []);

  // On Drop
  const handleDrop = useCallback(({ player, absoluteX, absoluteY }) => {
    ghostVisible.value = 0;
    dropZoneVisible.value = 0;
    setGhostPlayer(null);
    
    const playerId = player.documentId || player.id;
    
    const isOnField = (
      absoluteX >= fieldLayout.x &&
      absoluteX <= fieldLayout.x + fieldLayout.width &&
      absoluteY >= fieldLayout.y &&
      absoluteY <= fieldLayout.y + fieldLayout.height
    );

    if (isOnField) {
      const posX = ((absoluteX - fieldLayout.x) / fieldLayout.width) * 100;
      const posY = ((absoluteY - fieldLayout.y) / fieldLayout.height) * 100;
      
      setPlacements(prev => {
        const filtered = prev.filter(p => p.playerId !== playerId);
        return [...filtered, {
          playerId,
          positionX: Math.max(8, Math.min(92, posX)),
          positionY: Math.max(8, Math.min(92, posY)),
        }];
      });
    } else {
      setPlacements(prev => prev.filter(p => p.playerId !== playerId));
    }
  }, [fieldLayout]);

  // Add manual player
  const handleAddManualPlayer = useCallback((data) => {
    setManualPlayers(prev => [...prev, {
      id: `manual_${Date.now()}`,
      documentId: `manual_${Date.now()}`,
      firstname: data.firstname,
      lastname: data.lastname,
      avatar: null,
      isManual: true,
    }]);
    setModalVisible(false);
  }, []);

  // Save
  const handleSave = useCallback(() => {
    onSave?.({ sportContext: sport, placements });
  }, [sport, placements, onSave]);

  const placedCount = placements.length;
  const totalPlayers = allPlayers.length;

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

      {/* Help text */}
      <View style={[styles.helpBanner, { backgroundColor: Colors.primary500 + '15' }]}>
        <Text style={{ color: Colors.primary300, fontSize: 12, textAlign: 'center' }}>
          👆 Glissez les joueurs du banc vers le terrain
        </Text>
      </View>

      {/* Field */}
      <View style={styles.fieldContainer}>
        <View ref={fieldRef} style={styles.field} onLayout={onFieldLayout}>
          <Image source={fieldImage} style={styles.fieldImage} resizeMode="cover" />
          
          {/* Drop zone indicator */}
          <DropZoneIndicator visible={dropZoneVisible} />
          
          {/* Placed Players */}
          {placements.map((placement, idx) => {
            const player = getPlayerById(placement.playerId);
            if (!player) return null;
            
            const left = (placement.positionX / 100) * fieldLayout.width - 32;
            const top = (placement.positionY / 100) * fieldLayout.height - 40;
            
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

      {/* Bench */}
      <View style={[styles.benchContainer, { backgroundColor: Colors.neutral800 }]}>
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
          {benchPlayers.length > 0 && (
            <Text style={{ color: Colors.primary300, fontSize: 11 }}>
              ↑ Glissez vers le terrain
            </Text>
          )}
        </View>
        
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.benchScroll}
          nestedScrollEnabled
        >
          {/* Add Button */}
          <TouchableOpacity
            style={[styles.addButton, { borderColor: Colors.primary500, backgroundColor: Colors.primary500 + '10' }]}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={{ color: Colors.primary500, fontSize: 28, fontWeight: '300' }}>+</Text>
            <Text style={{ color: Colors.primary300, fontSize: 8, marginTop: 2 }}>Ajouter</Text>
          </TouchableOpacity>

          {benchPlayers.map((player, idx) => (
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
    paddingVertical: 14,
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
  helpBanner: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  fieldContainer: {
    flex: 1,
    padding: 10,
  },
  field: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 2,
    borderColor: 'rgba(1, 179, 244, 0.2)',
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
    margin: 8,
  },
  benchContainer: {
    paddingTop: 12,
    paddingBottom: 10,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -10,
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
    minHeight: 85,
    paddingBottom: 4,
  },
  addButton: {
    width: 62,
    height: 78,
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
    height: 85,
    borderRadius: 14,
    borderWidth: 3,
    alignItems: 'center',
    paddingTop: 6,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 25,
  },
  ghostAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  ghostInitials: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  ghostName: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
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
    paddingVertical: 16,
    fontSize: 16,
    marginBottom: 14,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
});

export default TacticalBoard;
