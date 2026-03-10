import { useNavigation, useRoute } from '@react-navigation/native';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Alert,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { useGetEvent } from '@/services/event/eventQueries';

import { getImageUrl } from '@/utils/imageUrl';

/**
 * @typedef {import('./types').TacticalPlayer} TacticalPlayer
 */

/**
 * TacticalSelection - Step 1: Select players for the composition
 * Displays team players with checkboxes for multi-selection
 */
function TacticalSelection() {
  const {
    Colors, Fonts, Spaces,
  } = useTheme();
  const navigation = useNavigation();
  const route = useRoute();

  // Get players from navigation params
  /** @type {{players?: TacticalPlayer[], eventId?: string, sport?: string, existingComposition?: any, teamId?: string}} */
  const params = route.params || {};
  const {
    eventId,
    existingComposition: existingCompositionParam,
    players: teamPlayersParam = [],
    sport: sportParam = 'football',
    teamId: teamIdParam,
  } = params;

  const shouldHydrateFromEvent = Boolean(eventId) && (!Array.isArray(teamPlayersParam) || teamPlayersParam.length === 0);

  const { data: eventFromApi } = useGetEvent(eventId || '', {
    enabled: shouldHydrateFromEvent,
  });

  const existingComposition = useMemo(() => {
    if (existingCompositionParam && typeof existingCompositionParam === 'object') {
      return existingCompositionParam;
    }
    if (typeof existingCompositionParam === 'string') {
      try {
        const parsed = JSON.parse(existingCompositionParam);
        return parsed && typeof parsed === 'object' ? parsed : null;
      } catch (_error) {
        return null;
      }
    }

    const fromApi = eventFromApi?.composition;
    if (!fromApi) return null;
    if (typeof fromApi === 'string') {
      try {
        const parsed = JSON.parse(fromApi);
        return parsed && typeof parsed === 'object' ? parsed : null;
      } catch (_error) {
        return null;
      }
    }
    if (typeof fromApi === 'object') return fromApi;
    return null;
  }, [existingCompositionParam, eventFromApi?.composition]);

  const teamPlayers = useMemo(() => {
    if (Array.isArray(teamPlayersParam) && teamPlayersParam.length > 0) {
      return teamPlayersParam;
    }

    const rawPlayers = Array.isArray(eventFromApi?.team?.players) ? eventFromApi.team.players : [];
    return rawPlayers
      .map((player) => {
        const documentId = String(player?.documentId || player?.id || '').trim();
        if (!documentId) return null;
        return {
          avatar: player?.avatar || null,
          documentId,
          firstname: player?.firstname || '',
          id: documentId,
          lastname: player?.lastname || '',
          number: player?.number,
        };
      })
      .filter(Boolean);
  }, [eventFromApi?.team?.players, teamPlayersParam]);

  const sport = sportParam || 'football';
  const teamId = teamIdParam || eventFromApi?.team?.documentId || undefined;

  // State
  /** @type {[Set<string>, React.Dispatch<React.SetStateAction<Set<string>>>]} */
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [manualFirstname, setManualFirstname] = useState('');
  const [manualLastname, setManualLastname] = useState('');
  const [manualNumber, setManualNumber] = useState('');
  const [manualPlayers, setManualPlayers] = useState(/** @type {TacticalPlayer[]} */ ([]));
  const [bootstrappedFromComposition, setBootstrappedFromComposition] = useState(false);

  useEffect(() => {
    if (bootstrappedFromComposition) return;
    if (!existingComposition || typeof existingComposition !== 'object') return;

    const placements = Array.isArray(existingComposition?.placements)
      ? existingComposition.placements
      : [];
    const manual = Array.isArray(existingComposition?.manualPlayers)
      ? existingComposition.manualPlayers
      : [];

    const initialSet = new Set(
      placements
        .map((/** @type {{ playerId?: string }} */ placement) => String(placement?.playerId || '').trim())
        .filter(Boolean),
    );

    setSelectedIds(initialSet);
    setManualPlayers(manual);
    setBootstrappedFromComposition(true);
  }, [bootstrappedFromComposition, existingComposition]);

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
    teamPlayers.forEach((p) => {
      const id = p.id || p.documentId || '';
      if (!seenIds.has(id)) {
        seenIds.add(id);
        result.push(p);
      }
    });

    // Add manual players if not already in team players
    manualPlayers.forEach((p) => {
      const id = p.id || p.documentId || '';
      if (!seenIds.has(id)) {
        seenIds.add(id);
        result.push(p);
      }
    });

    return result;
  }, [teamPlayers, manualPlayers]);

  // Filtered by search
  const filteredPlayers = useMemo(() => {
    if (!searchQuery.trim()) return allPlayers;
    const q = searchQuery.toLowerCase();
    return allPlayers.filter((/** @type {TacticalPlayer} */ p) => p.firstname?.toLowerCase().includes(q)
      || p.lastname?.toLowerCase().includes(q)
      || String(p.number || '').includes(q));
  }, [allPlayers, searchQuery]);

  // Toggle selection
  const toggleSelection = useCallback((/** @type {string} */ playerId) => {
    setSelectedIds((prev) => {
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
    setSelectedIds(new Set(allPlayers.map((p) => p.id || p.documentId || '')));
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
      avatar: null,
      documentId: `manual_${Date.now()}`,
      firstname: manualFirstname.trim(),
      id: `manual_${Date.now()}`,
      isManual: true,
      lastname: manualLastname.trim(),
      number: manualNumber.trim() || undefined,
    };

    setManualPlayers((prev) => [...prev, newPlayer]);
    setSelectedIds((prev) => new Set([newPlayer.id, ...prev])); // Auto-select
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
      setManualPlayers((prev) => prev.map((p) => ((p.id || p.documentId) === playerId
        ? {
          ...p, firstname: editFirstname.trim(), lastname: editLastname.trim(), number: editNumber.trim() || undefined,
        }
        : p)));
    } else if (editNumber.trim()) {
      setNumberOverrides((prev) => ({
        ...prev,
        [playerId]: editNumber.trim(),
      }));
    } else {
      // Remove override if empty
      setNumberOverrides((prev) => {
        const next = { ...prev };
        delete next[playerId];
        return next;
      });
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
          { style: 'cancel', text: 'Annuler' },
          {
            onPress: () => {
              setManualPlayers((prev) => prev.filter((p) => (p.id || p.documentId) !== playerId));
              setSelectedIds((prev) => {
                const next = new Set(prev);
                next.delete(playerId);
                return next;
              });
              setEditModalVisible(false);
              setEditingPlayer(null);
            },
            style: 'destructive',
            text: 'Supprimer',
          },
        ],
      );
    }
  }, [editingPlayer]);

  // Navigate to Board
  const handleValidate = useCallback(() => {
    if (selectedIds.size === 0) {
      Alert.alert('Attention', 'Sélectionnez au moins un joueur');
      return;
    }

    const selectedPlayers = allPlayers.filter((p) => selectedIds.has(p.id || '') || selectedIds.has(p.documentId || ''));

    // @ts-ignore
    navigation.navigate('TacticalBoardV2', {
      eventId,
      existingComposition, // Pass through for loading positions
      selectedPlayers,
      sport,
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
    let rawAvatarUrl = null;
    if (!isManualPlayer) {
      rawAvatarUrl = typeof item.avatar === 'string' ? item.avatar : item.avatar?.url;
    }
    const avatarUri = rawAvatarUrl ? getImageUrl(rawAvatarUrl) : null;

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onLongPress={() => handleEditPlayer(item)}
        onPress={() => toggleSelection(playerId)}
        style={[
          styles.playerRow,
          {
            backgroundColor: isSelected ? `${Colors.primary500}20` : Colors.neutral800,
            borderColor: isSelected ? Colors.primary500 : Colors.neutral700,
          },
        ]}
      >
        {/* Checkbox */}
        <View style={[
          styles.checkbox,
          {
            backgroundColor: isSelected ? Colors.primary500 : 'transparent',
            borderColor: isSelected ? Colors.primary500 : Colors.neutral300,
          },
        ]}
        >
          {isSelected && <Text style={styles.checkmark}>✓</Text>}
        </View>

        {/* Avatar - Initials for manual players */}
        <View style={[styles.avatar, { backgroundColor: isManualPlayer ? `${Colors.primary500}40` : Colors.neutral700 }]}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
          ) : (
            <Text style={[styles.avatarInitials, { color: isManualPlayer ? Colors.primary500 : Colors.neutral00 }]}>{initials}</Text>
          )}
        </View>

        {/* Info */}
        <View style={styles.playerInfo}>
          <Text style={[Fonts.p1, { color: Colors.neutral00, fontWeight: '600' }]}>
            {item.firstname}
            {' '}
            {item.lastname}
          </Text>
          {displayNumber && (
            <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
              N°
              {displayNumber}
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
          hitSlop={{
            bottom: 10, left: 10, right: 10, top: 10,
          }}
          onPress={() => handleEditPlayer(item)}
          style={[styles.editBtn, { backgroundColor: Colors.neutral700 }]}
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
          onChangeText={setSearchQuery}
          placeholder="Rechercher..."
          placeholderTextColor={Colors.neutral300}
          style={[styles.searchInput, { backgroundColor: Colors.neutral800, borderColor: Colors.neutral700, color: Colors.neutral00 }]}
          value={searchQuery}
        />
      </View>

      {/* Quick Actions */}
      <View style={[styles.actionsRow, Spaces.paddingHorizontal[24]]}>
        <TouchableOpacity onPress={selectAll} style={[styles.actionBtn, { backgroundColor: Colors.neutral800 }]}>
          <Text style={[Fonts.p3, { color: Colors.primary500, fontWeight: '600' }]}>Tout sélectionner</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={clearSelection} style={[styles.actionBtn, { backgroundColor: Colors.neutral800 }]}>
          <Text style={[Fonts.p3, { color: Colors.neutral300, fontWeight: '600' }]}>Effacer</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setModalVisible(true)} style={[styles.actionBtn, { backgroundColor: Colors.primary500 }]}>
          <Text style={[Fonts.p3, { color: '#FFF', fontWeight: '600' }]}>+ Ajouter</Text>
        </TouchableOpacity>
      </View>

      {/* Selection Count */}
      <View style={[Spaces.paddingHorizontal[24], Spaces.paddingTop[12], Spaces.paddingBottom[8]]}>
        <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>
          {selectedIds.size}
          {' '}
          joueur
          {selectedIds.size > 1 ? 's' : ''}
          {' '}
          sélectionné
          {selectedIds.size > 1 ? 's' : ''}
        </Text>
      </View>

      {/* Player List */}
      <FlatList
        contentContainerStyle={[Spaces.paddingHorizontal[24], styles.listContent]}
        data={filteredPlayers}
        keyExtractor={(item) => String(item.id || item.documentId || Math.random())}
        ListEmptyComponent={(
          <View style={styles.emptyState}>
            <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>
              {searchQuery ? 'Aucun résultat' : 'Aucun joueur dans l\'équipe'}
            </Text>
          </View>
        )}
        renderItem={renderPlayer}
        showsVerticalScrollIndicator={false}
      />

      {/* Footer */}
      <View style={[styles.footer, { backgroundColor: Colors.neutral900, borderTopColor: Colors.neutral700 }]}>
        <Button
          disabled={selectedIds.size === 0}
          onPress={handleValidate}
          title={`Valider (${selectedIds.size})`}
          variant="Primary"
        />
      </View>

      {/* Add Manual Player Modal */}
      <Modal animationType="fade" onRequestClose={() => setModalVisible(false)} transparent visible={modalVisible}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: Colors.neutral800 }]}>
            <Text style={[Fonts.h3Bold, { color: Colors.neutral00, marginBottom: 20, textAlign: 'center' }]}>
              Ajouter un joueur
            </Text>

            <TextInput
              autoFocus
              onChangeText={setManualFirstname}
              placeholder="Prénom *"
              placeholderTextColor={Colors.neutral300}
              style={[styles.input, { backgroundColor: Colors.neutral900, borderColor: Colors.neutral700, color: Colors.neutral00 }]}
              value={manualFirstname}
            />

            <TextInput
              onChangeText={setManualLastname}
              placeholder="Nom *"
              placeholderTextColor={Colors.neutral300}
              style={[styles.input, { backgroundColor: Colors.neutral900, borderColor: Colors.neutral700, color: Colors.neutral00 }]}
              value={manualLastname}
            />

            <TextInput
              keyboardType="number-pad"
              maxLength={2}
              onChangeText={setManualNumber}
              placeholder="Numéro (optionnel)"
              placeholderTextColor={Colors.neutral300}
              style={[styles.input, { backgroundColor: Colors.neutral900, borderColor: Colors.neutral700, color: Colors.neutral00 }]}
              value={manualNumber}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={[styles.modalBtn, { backgroundColor: Colors.neutral700 }]}>
                <Text style={[Fonts.p1, { color: Colors.neutral00, fontWeight: '600' }]}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleAddManualPlayer} style={[styles.modalBtn, { backgroundColor: Colors.primary500 }]}>
                <Text style={[Fonts.p1, { color: '#FFF', fontWeight: '700' }]}>Ajouter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Player Modal */}
      <Modal animationType="fade" onRequestClose={() => setEditModalVisible(false)} transparent visible={editModalVisible}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: Colors.neutral800 }]}>
            <Text style={[Fonts.h3Bold, { color: Colors.neutral00, marginBottom: 20, textAlign: 'center' }]}>
              {editingPlayer?.isManual || String(editingPlayer?.id || '').startsWith('manual_')
                ? 'Modifier le joueur'
                : 'Modifier le numéro'}
            </Text>

            {/* Only show name fields for manual players */}
            {(editingPlayer?.isManual || String(editingPlayer?.id || '').startsWith('manual_')) && (
              <>
                <TextInput
                  onChangeText={setEditFirstname}
                  placeholder="Prénom"
                  placeholderTextColor={Colors.neutral300}
                  style={[styles.input, { backgroundColor: Colors.neutral900, borderColor: Colors.neutral700, color: Colors.neutral00 }]}
                  value={editFirstname}
                />

                <TextInput
                  onChangeText={setEditLastname}
                  placeholder="Nom"
                  placeholderTextColor={Colors.neutral300}
                  style={[styles.input, { backgroundColor: Colors.neutral900, borderColor: Colors.neutral700, color: Colors.neutral00 }]}
                  value={editLastname}
                />
              </>
            )}

            <TextInput
              keyboardType="number-pad"
              maxLength={2}
              onChangeText={setEditNumber}
              placeholder="Numéro"
              placeholderTextColor={Colors.neutral300}
              style={[styles.input, { backgroundColor: Colors.neutral900, borderColor: Colors.neutral700, color: Colors.neutral00 }]}
              value={editNumber}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setEditModalVisible(false)} style={[styles.modalBtn, { backgroundColor: Colors.neutral700 }]}>
                <Text style={[Fonts.p1, { color: Colors.neutral00, fontWeight: '600' }]}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveEdit} style={[styles.modalBtn, { backgroundColor: Colors.primary500 }]}>
                <Text style={[Fonts.p1, { color: '#FFF', fontWeight: '700' }]}>Enregistrer</Text>
              </TouchableOpacity>
            </View>

            {/* Delete button for manual players */}
            {(editingPlayer?.isManual || String(editingPlayer?.id || '').startsWith('manual_')) && (
              <TouchableOpacity
                onPress={handleDeletePlayer}
                style={[styles.deleteBtn, { borderColor: Colors.error500 }]}
              >
                <Text style={[Fonts.p1, { color: Colors.error500, fontWeight: '600' }]}>Supprimer ce joueur</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  actionBtn: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 12,
  },
  avatar: {
    alignItems: 'center',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
    width: 44,
  },
  avatarImage: {
    borderRadius: 22,
    height: 44,
    width: 44,
  },
  avatarInitials: {
    fontSize: 14,
    fontWeight: '700',
  },
  checkbox: {
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 2,
    height: 24,
    justifyContent: 'center',
    marginRight: 12,
    width: 24,
  },
  checkmark: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  footer: {
    borderTopWidth: 1,
    padding: 16,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingRight: 16,
    paddingVertical: 8,
  },
  headerSpacer: {
    width: 44,
  },
  listContent: {
    paddingBottom: 20,
  },
  playerInfo: {
    flex: 1,
  },
  playerRow: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 8,
    padding: 12,
  },
  searchInput: {
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  // Modal
  deleteBtn: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 16,
    paddingVertical: 12,
  },
  editBtn: {
    alignItems: 'center',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 16,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  modalBtn: {
    alignItems: 'center',
    borderRadius: 10,
    flex: 1,
    paddingVertical: 14,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalContent: {
    borderRadius: 20,
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

export default TacticalSelection;
