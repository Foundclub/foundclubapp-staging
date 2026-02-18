import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import useTheme from '@/theme/themeContext';
import Button from '@/components/atoms/button/Button';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import ScreenContainer from '@/components/templates/ScreenContainer';
import { getImageUrl } from '@/utils/imageUrl';

/**
 * @typedef {import('./types').TacticalPlayer} TacticalPlayer
 */

/**
 * TacticalSelection - Step 1: Select players for the composition
 * Displays team players with checkboxes for multi-selection
 */
const TacticalSelection = () => {
  const { Colors, Fonts, Alignments, Spaces } = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  
  // Get players from navigation params
  /** @type {{players?: TacticalPlayer[], eventId?: string, sport?: string, existingComposition?: any, teamId?: string}} */
  const params = route.params || {};
  const { 
    players: teamPlayers = [], 
    eventId, 
    sport = 'football',
    existingComposition,
    teamId,
  } = params;
  
  // Initialize selected IDs from existing composition
  const initialSelectedIds = useMemo(() => {
    if (existingComposition?.placements?.length) {
      const ids = existingComposition.placements.map((/** @type {{ playerId?: string }} */ p) => p.playerId || '');
      return new Set(ids);
    }
    return new Set();
  }, [existingComposition]);
  
  // State
  /** @type {[Set<string>, React.Dispatch<React.SetStateAction<Set<string>>>]} */
  const [selectedIds, setSelectedIds] = useState(initialSelectedIds);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [manualFirstname, setManualFirstname] = useState('');
  const [manualLastname, setManualLastname] = useState('');
  const [manualNumber, setManualNumber] = useState('');
  /** @type {TacticalPlayer[]} */
  const initialManualPlayers = existingComposition?.manualPlayers || [];
  const [manualPlayers, setManualPlayers] = useState(initialManualPlayers);
  
  // Edit modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  /** @type {[TacticalPlayer|null, React.Dispatch<React.SetStateAction<TacticalPlayer|null>>]} */
  const [editingPlayer, setEditingPlayer] = useState(/** @type {TacticalPlayer | null} */ (null));
  const [editFirstname, setEditFirstname] = useState('');
  const [editLastname, setEditLastname] = useState('');
  const [editNumber, setEditNumber] = useState('');
  
  // Number overrides for team players (store overridden jersey numbers)
  const [numberOverrides, setNumberOverrides] = useState(
    /** @type {Record<string, string>} */ ({}),
  );

  // Combined players list - deduplicate to avoid showing manuals twice
  const allPlayers = useMemo(() => {
    const seenIds = new Set();
    const result = /** @type {TacticalPlayer[]} */ ([]);
    
    // Add team players first
    for (const p of teamPlayers) {
      const id = p.id || p.documentId || '';
      if (!seenIds.has(id)) {
        seenIds.add(id);
        result.push(p);
      }
    }
    
    // Add manual players if not already in team players
    for (const p of manualPlayers) {
      const id = p.id || p.documentId || '';
      if (!seenIds.has(id)) {
        seenIds.add(id);
        result.push(p);
      }
    }
    
    return result;
  }, [teamPlayers, manualPlayers]);

  // Filtered by search
  const filteredPlayers = useMemo(() => {
    if (!searchQuery.trim()) return allPlayers;
    const q = searchQuery.toLowerCase();
    return allPlayers.filter((/** @type {TacticalPlayer} */ p) =>
      p.firstname?.toLowerCase().includes(q) || 
      p.lastname?.toLowerCase().includes(q) ||
      String(p.number || '').includes(q)
    );
  }, [allPlayers, searchQuery]);

  // Toggle selection
  const toggleSelection = useCallback((/** @type {string} */ playerId) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(playerId)) {
        newSet.delete(playerId);
      } else {
        newSet.add(playerId);
      }
      return newSet;
    });
  }, []);

  // Select all
  const selectAll = useCallback(() => {
    setSelectedIds(new Set(allPlayers.map(p => p.id || p.documentId || '')));
  }, [allPlayers]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Add manual player
  const handleAddManualPlayer = useCallback(() => {
    if (!manualFirstname.trim() || !manualLastname.trim()) {
      Alert.alert('Erreur', 'Prénom et nom requis');
      return;
    }
    
    const newPlayer = {
      id: `manual_${Date.now()}`,
      documentId: `manual_${Date.now()}`,
      firstname: manualFirstname.trim(),
      lastname: manualLastname.trim(),
      number: manualNumber.trim() || undefined,
      avatar: null,
      isManual: true,
    };
    
    setManualPlayers(prev => [...prev, newPlayer]);
    setSelectedIds(prev => new Set([...prev, newPlayer.id])); // Auto-select
    setManualFirstname('');
    setManualLastname('');
    setManualNumber('');
    setModalVisible(false);
  }, [manualFirstname, manualLastname, manualNumber]);

  // Open edit modal
  const handleEditPlayer = useCallback((/** @type {TacticalPlayer} */ player) => {
    setEditingPlayer(player);
    const playerId = player.id || player.documentId || '';
    setEditFirstname(player.firstname || '');
    setEditLastname(player.lastname || '');
    // Use override if exists, otherwise use player's number
    const overrideNum = numberOverrides[playerId];
    setEditNumber(overrideNum !== undefined ? String(overrideNum) : (player.number?.toString() || ''));
    setEditModalVisible(true);
  }, [numberOverrides]);

  // Save edits
  const handleSaveEdit = useCallback(() => {
    if (!editingPlayer) return;
    const playerId = editingPlayer.id || editingPlayer.documentId || '';
    
    if (editingPlayer.isManual || String(playerId).startsWith('manual_')) {
      // Update manual player in list
      setManualPlayers(prev => prev.map(p => 
        (p.id || p.documentId) === playerId
          ? { ...p, firstname: editFirstname.trim(), lastname: editLastname.trim(), number: editNumber.trim() || undefined }
          : p
      ));
    } else {
      // Store number override for team player
      if (editNumber.trim()) {
        setNumberOverrides(prev => ({
          ...prev,
          [playerId]: editNumber.trim(),
        }));
      } else {
        // Remove override if empty
        setNumberOverrides(prev => {
          const next = { ...prev };
          delete next[playerId];
          return next;
        });
      }
    }
    setEditModalVisible(false);
    setEditingPlayer(null);
  }, [editingPlayer, editFirstname, editLastname, editNumber]);

  // Delete manual player
  const handleDeletePlayer = useCallback(() => {
    if (!editingPlayer) return;
    const playerId = editingPlayer.id || editingPlayer.documentId || '';
    
    if (editingPlayer.isManual || String(playerId).startsWith('manual_')) {
      Alert.alert(
        'Supprimer',
        `Supprimer ${editingPlayer.firstname} ${editingPlayer.lastname} ?`,
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Supprimer',
            style: 'destructive',
            onPress: () => {
              setManualPlayers(prev => prev.filter(p => (p.id || p.documentId) !== playerId));
              setSelectedIds(prev => {
                const next = new Set(prev);
                next.delete(playerId);
                return next;
              });
              setEditModalVisible(false);
              setEditingPlayer(null);
            },
          },
        ]
      );
    }
  }, [editingPlayer]);

  // Navigate to Board
  const handleValidate = useCallback(() => {
    if (selectedIds.size === 0) {
      Alert.alert('Attention', 'Sélectionnez au moins un joueur');
      return;
    }
    
    const selectedPlayers = allPlayers.filter(p => 
      selectedIds.has(p.id || '') || selectedIds.has(p.documentId || '')
    );
    
    // @ts-ignore
    navigation.navigate('TacticalBoardV2', {
      selectedPlayers,
      eventId,
      sport,
      existingComposition, // Pass through for loading positions
      teamId, // Pass through for future team default composition
    });
  }, [selectedIds, allPlayers, eventId, sport, existingComposition, teamId, navigation]);

  // Render player item
  const renderPlayer = useCallback((/** @type {{ item: TacticalPlayer }} */ { item }) => {
    // Use documentId preferably (that's what composition stores), fallback to id
    const playerId = String(item.documentId || item.id || '');
    // Check if selected - handles both id formats
    const isSelected = selectedIds.has(playerId)
      || selectedIds.has(String(item.id || ''))
      || selectedIds.has(String(item.documentId || ''));
    const initials = `${item.firstname?.charAt(0) || ''}${item.lastname?.charAt(0) || ''}`.toUpperCase();
    const isManualPlayer = item.isManual || String(playerId).startsWith('manual_');
    
    // Get display number (with override for team players)
    const displayNumber = isManualPlayer ? item.number : (numberOverrides[playerId] || item.number);
    
    // Avatar URI - null for manual players (force initials)
    const rawAvatarUrl = isManualPlayer ? null : (
      typeof item.avatar === 'string' ? item.avatar : item.avatar?.url
    );
    const avatarUri = rawAvatarUrl ? getImageUrl(rawAvatarUrl) : null;
    
    return (
      <TouchableOpacity 
        style={[
          styles.playerRow,
          { 
            backgroundColor: isSelected ? Colors.primary500 + '20' : Colors.neutral800,
            borderColor: isSelected ? Colors.primary500 : Colors.neutral700,
          }
        ]}
        onPress={() => toggleSelection(playerId)}
        onLongPress={() => handleEditPlayer(item)}
        activeOpacity={0.7}
      >
        {/* Checkbox */}
        <View style={[
          styles.checkbox,
          { 
            borderColor: isSelected ? Colors.primary500 : Colors.neutral300,
            backgroundColor: isSelected ? Colors.primary500 : 'transparent',
          }
        ]}>
          {isSelected && <Text style={styles.checkmark}>✓</Text>}
        </View>
        
        {/* Avatar - Initials for manual players */}
        <View style={[styles.avatar, { backgroundColor: isManualPlayer ? Colors.primary500 + '40' : Colors.neutral700 }]}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
          ) : (
            <Text style={[styles.avatarInitials, { color: isManualPlayer ? Colors.primary500 : Colors.neutral00 }]}>{initials}</Text>
          )}
        </View>
        
        {/* Info */}
        <View style={styles.playerInfo}>
          <Text style={[Fonts.p1, { color: Colors.neutral00, fontWeight: '600' }]}>
            {item.firstname} {item.lastname}
          </Text>
          {displayNumber && (
            <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
              N°{displayNumber}
            </Text>
          )}
          {isManualPlayer && (
            <Text style={[Fonts.p3, { color: Colors.primary500, fontStyle: 'italic' }]}>
              Ajouté manuellement
            </Text>
          )}
        </View>
        
        {/* Edit button */}
        <TouchableOpacity 
          style={[styles.editBtn, { backgroundColor: Colors.neutral700 }]}
          onPress={() => handleEditPlayer(item)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={{ color: Colors.neutral00, fontSize: 12 }}>✏️</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }, [selectedIds, Colors, Fonts, toggleSelection, handleEditPlayer, numberOverrides]);

  return (
    <ScreenContainer bgImage="bg2" style={[{ paddingHorizontal: 0 }]}>
      {/* Header */}
      <View style={styles.header}>
        <HeaderBackButton onPress={() => navigation.goBack()} />
        <Text style={[Fonts.h3Bold, { color: Colors.neutral00 }]}>Sélection des joueurs</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Search & Actions */}
      <View style={[Spaces.paddingHorizontal[24], Spaces.paddingTop[12]]}>
        <TextInput
          style={[styles.searchInput, { backgroundColor: Colors.neutral800, color: Colors.neutral00, borderColor: Colors.neutral700 }]}
          placeholder="Rechercher..."
          placeholderTextColor={Colors.neutral300}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Quick Actions */}
      <View style={[styles.actionsRow, Spaces.paddingHorizontal[24]]}>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.neutral800 }]} onPress={selectAll}>
          <Text style={[Fonts.p3, { color: Colors.primary500, fontWeight: '600' }]}>Tout sélectionner</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.neutral800 }]} onPress={clearSelection}>
          <Text style={[Fonts.p3, { color: Colors.neutral300, fontWeight: '600' }]}>Effacer</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.primary500 }]} onPress={() => setModalVisible(true)}>
          <Text style={[Fonts.p3, { color: '#FFF', fontWeight: '600' }]}>+ Ajouter</Text>
        </TouchableOpacity>
      </View>

      {/* Selection Count */}
      <View style={[Spaces.paddingHorizontal[24], Spaces.paddingTop[12], Spaces.paddingBottom[8]]}>
        <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>
          {selectedIds.size} joueur{selectedIds.size > 1 ? 's' : ''} sélectionné{selectedIds.size > 1 ? 's' : ''}
        </Text>
      </View>

      {/* Player List */}
      <FlatList
        data={filteredPlayers}
        keyExtractor={(item) => String(item.id || item.documentId || Math.random())}
        renderItem={renderPlayer}
        contentContainerStyle={[Spaces.paddingHorizontal[24], styles.listContent]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>
              {searchQuery ? 'Aucun résultat' : 'Aucun joueur dans l\'équipe'}
            </Text>
          </View>
        }
      />

      {/* Footer */}
      <View style={[styles.footer, { backgroundColor: Colors.neutral900, borderTopColor: Colors.neutral700 }]}>
        <Button 
          title={`Valider (${selectedIds.size})`}
          variant="Primary"
          onPress={handleValidate}
          disabled={selectedIds.size === 0}
        />
      </View>

      {/* Add Manual Player Modal */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: Colors.neutral800 }]}>
            <Text style={[Fonts.h3Bold, { color: Colors.neutral00, textAlign: 'center', marginBottom: 20 }]}>
              Ajouter un joueur
            </Text>
            
            <TextInput
              placeholder="Prénom *"
              placeholderTextColor={Colors.neutral300}
              value={manualFirstname}
              onChangeText={setManualFirstname}
              style={[styles.input, { backgroundColor: Colors.neutral900, color: Colors.neutral00, borderColor: Colors.neutral700 }]}
              autoFocus
            />
            
            <TextInput
              placeholder="Nom *"
              placeholderTextColor={Colors.neutral300}
              value={manualLastname}
              onChangeText={setManualLastname}
              style={[styles.input, { backgroundColor: Colors.neutral900, color: Colors.neutral00, borderColor: Colors.neutral700 }]}
            />
            
            <TextInput
              placeholder="Numéro (optionnel)"
              placeholderTextColor={Colors.neutral300}
              value={manualNumber}
              onChangeText={setManualNumber}
              keyboardType="number-pad"
              maxLength={2}
              style={[styles.input, { backgroundColor: Colors.neutral900, color: Colors.neutral00, borderColor: Colors.neutral700 }]}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: Colors.neutral700 }]} onPress={() => setModalVisible(false)}>
                <Text style={[Fonts.p1, { color: Colors.neutral00, fontWeight: '600' }]}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: Colors.primary500 }]} onPress={handleAddManualPlayer}>
                <Text style={[Fonts.p1, { color: '#FFF', fontWeight: '700' }]}>Ajouter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Player Modal */}
      <Modal visible={editModalVisible} transparent animationType="fade" onRequestClose={() => setEditModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: Colors.neutral800 }]}>
            <Text style={[Fonts.h3Bold, { color: Colors.neutral00, textAlign: 'center', marginBottom: 20 }]}>
              {editingPlayer?.isManual || String(editingPlayer?.id || '').startsWith('manual_') 
                ? 'Modifier le joueur' 
                : 'Modifier le numéro'}
            </Text>
            
            {/* Only show name fields for manual players */}
            {(editingPlayer?.isManual || String(editingPlayer?.id || '').startsWith('manual_')) && (
              <>
                <TextInput
                  placeholder="Prénom"
                  placeholderTextColor={Colors.neutral300}
                  value={editFirstname}
                  onChangeText={setEditFirstname}
                  style={[styles.input, { backgroundColor: Colors.neutral900, color: Colors.neutral00, borderColor: Colors.neutral700 }]}
                />
                
                <TextInput
                  placeholder="Nom"
                  placeholderTextColor={Colors.neutral300}
                  value={editLastname}
                  onChangeText={setEditLastname}
                  style={[styles.input, { backgroundColor: Colors.neutral900, color: Colors.neutral00, borderColor: Colors.neutral700 }]}
                />
              </>
            )}
            
            <TextInput
              placeholder="Numéro"
              placeholderTextColor={Colors.neutral300}
              value={editNumber}
              onChangeText={setEditNumber}
              keyboardType="number-pad"
              maxLength={2}
              style={[styles.input, { backgroundColor: Colors.neutral900, color: Colors.neutral00, borderColor: Colors.neutral700 }]}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: Colors.neutral700 }]} onPress={() => setEditModalVisible(false)}>
                <Text style={[Fonts.p1, { color: Colors.neutral00, fontWeight: '600' }]}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: Colors.primary500 }]} onPress={handleSaveEdit}>
                <Text style={[Fonts.p1, { color: '#FFF', fontWeight: '700' }]}>Enregistrer</Text>
              </TouchableOpacity>
            </View>
            
            {/* Delete button for manual players */}
            {(editingPlayer?.isManual || String(editingPlayer?.id || '').startsWith('manual_')) && (
              <TouchableOpacity 
                style={[styles.deleteBtn, { borderColor: Colors.error500 }]} 
                onPress={handleDeletePlayer}
              >
                <Text style={[Fonts.p1, { color: Colors.error500, fontWeight: '600' }]}>Supprimer ce joueur</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
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
  searchInput: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
  },
  actionsRow: {
    flexDirection: 'row',
    paddingTop: 12,
    gap: 8,
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  listContent: {
    paddingBottom: 20,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkmark: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarInitials: {
    fontSize: 14,
    fontWeight: '700',
  },
  playerInfo: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
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
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 16,
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
    borderRadius: 10,
    alignItems: 'center',
  },
  editBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
});

export default TacticalSelection;
