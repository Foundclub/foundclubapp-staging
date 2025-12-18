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
      const ids = existingComposition.placements.map(p => p.playerId);
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
  const initialManualPlayers = [];
  const [manualPlayers, setManualPlayers] = useState(initialManualPlayers);

  // Combined players list
  const allPlayers = useMemo(() => {
    return [...teamPlayers, ...manualPlayers];
  }, [teamPlayers, manualPlayers]);

  // Filtered by search
  const filteredPlayers = useMemo(() => {
    if (!searchQuery.trim()) return allPlayers;
    const q = searchQuery.toLowerCase();
    return allPlayers.filter(p => 
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
    const playerId = item.id || item.documentId || '';
    const isSelected = selectedIds.has(playerId);
    const initials = `${item.firstname?.charAt(0) || ''}${item.lastname?.charAt(0) || ''}`.toUpperCase();
    
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
        
        {/* Avatar */}
        <View style={[styles.avatar, { backgroundColor: Colors.neutral700 }]}>
          {item.avatar ? (
            <Image source={{ uri: item.avatar }} style={styles.avatarImage} />
          ) : (
            <Text style={[styles.avatarInitials, { color: Colors.neutral00 }]}>{initials}</Text>
          )}
        </View>
        
        {/* Info */}
        <View style={styles.playerInfo}>
          <Text style={[Fonts.p1, { color: Colors.neutral00, fontWeight: '600' }]}>
            {item.firstname} {item.lastname}
          </Text>
          {item.number && (
            <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
              N°{item.number}
            </Text>
          )}
          {item.isManual && (
            <Text style={[Fonts.p3, { color: Colors.primary500, fontStyle: 'italic' }]}>
              Ajouté manuellement
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  }, [selectedIds, Colors, Fonts, toggleSelection]);

  return (
    <ScreenContainer bgImage="bg1" style={[{ paddingHorizontal: 0 }]}>
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
        keyExtractor={(item) => item.id || item.documentId || String(Math.random())}
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
});

export default TacticalSelection;
