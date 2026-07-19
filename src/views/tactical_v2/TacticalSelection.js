/* eslint-disable jsdoc/require-returns, max-len, no-nested-ternary, perfectionist/sort-imports, perfectionist/sort-objects, react/jsx-indent, react/jsx-one-expression-per-line, react/no-unescaped-entities */
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import ScreenContainer from '@/components/templates/ScreenContainer';
import { RouteNames } from '@/navigation/routeNames';

import { useGetEvent, useGetEventTeamComposition } from '@/services/event/eventQueries';
import { useGetTeamDefaultComposition } from '@/services/team/teamQueries';

import { getImageUrl } from '@/utils/imageUrl';

/**
 * @typedef {import('./types').TacticalPlayer} TacticalPlayer
 */

const normalizeMatchLabel = (value) => {
  const label = String(value || '').trim();
  if (!label) return '';

  const vsMatch = label.match(/\bVS\b.*$/i);
  if (vsMatch?.[0]) {
    return `Match ${vsMatch[0].trim()}`;
  }

  return label.replace(/^Match externe synchronisé.*?-\s*/i, 'Match ');
};

/**
 * TacticalSelection - Step 1: Select players for the composition
 * Displays team players with checkboxes for multi-selection
 */
function TacticalSelection() {
  const {
    ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();

  // Get players from navigation params
  /** @type {{players?: TacticalPlayer[], eventId?: string, sport?: string, existingComposition?: any, teamId?: string, editorMode?: 'event' | 'team-default', bootstrapComposition?: any, editorSource?: string, editorSourceLabel?: string, teamName?: string, eventName?: string, eventKind?: 'match' | 'detection', eventTypeLabel?: string | null}} */
  const params = route.params || {};
  const {
    bootstrapComposition: bootstrapCompositionParam = null,
    editorMode = 'event',
    eventKind = 'match',
    eventTypeLabel = null,
    editorSource = null,
    editorSourceLabel = null,
    eventName = '',
    eventId,
    existingComposition: existingCompositionParam,
    players: teamPlayersParam = [],
    sport: sportParam = 'football',
    teamId: teamIdParam,
    teamName = '',
  } = params;
  const isTeamDefaultMode = editorMode === 'team-default';

  const shouldHydrateFromEvent = !isTeamDefaultMode
    && Boolean(eventId)
    && (!Array.isArray(teamPlayersParam) || teamPlayersParam.length === 0);

  const {
    data: eventFromApi,
    isFetching: isEventFetching,
  } = useGetEvent(eventId || '', {
    enabled: shouldHydrateFromEvent,
  });

  const {
    data: teamCompositionPayload,
    isFetching: isCompositionFetching,
  } = useGetEventTeamComposition(
    eventId || '',
    teamIdParam || undefined,
    {
      enabled: Boolean(eventId) && !isTeamDefaultMode,
    },
  );

  const {
    data: teamDefaultCompositionPayload,
    isFetching: isDefaultCompositionFetching,
  } = useGetTeamDefaultComposition(
    teamIdParam || '',
    {
      enabled: Boolean(teamIdParam) && isTeamDefaultMode,
    },
  );

  const resolvedTeamId = useMemo(
    () => teamDefaultCompositionPayload?.team?.documentId
      || teamCompositionPayload?.team?.documentId
      || teamIdParam
      || eventFromApi?.team?.documentId
      || undefined,
    [
      eventFromApi?.team?.documentId,
      teamCompositionPayload?.team?.documentId,
      teamDefaultCompositionPayload?.team?.documentId,
      teamIdParam,
    ],
  );

  const existingComposition = useMemo(() => {
    if (isTeamDefaultMode) {
      return teamDefaultCompositionPayload?.composition || bootstrapCompositionParam || null;
    }

    // Regle de priorite (mode evenement) :
    // 1. Une composition explicite recue en params (existingComposition) represente
    //    l'etat local du board (potentiellement non sauvegarde), par exemple au retour
    //    de "Modifier les joueurs". Elle prime TOUJOURS sur le brouillon serveur,
    //    sinon la selection locale du coach serait ecrasee silencieusement par le fetch.
    // 2. A defaut, le brouillon serveur.
    // 3. Sinon, la composition de bootstrap (favori d'equipe / dernier match).
    const explicitComposition = (() => {
      if (existingCompositionParam && typeof existingCompositionParam === 'object') {
        if (existingCompositionParam?.schemaVersion === 2 && existingCompositionParam?.byTeam) {
          const byTeamDraft = existingCompositionParam?.byTeam?.[resolvedTeamId || '']?.draft;
          return byTeamDraft && typeof byTeamDraft === 'object' ? byTeamDraft : null;
        }
        return existingCompositionParam;
      }
      if (typeof existingCompositionParam === 'string') {
        try {
          const parsed = JSON.parse(existingCompositionParam);
          if (parsed && typeof parsed === 'object' && parsed?.schemaVersion === 2 && parsed?.byTeam) {
            const byTeamDraft = parsed?.byTeam?.[resolvedTeamId || '']?.draft;
            return byTeamDraft && typeof byTeamDraft === 'object' ? byTeamDraft : null;
          }
          return parsed && typeof parsed === 'object' ? parsed : null;
        } catch (_error) {
          return null;
        }
      }
      return null;
    })();

    if (explicitComposition) {
      return explicitComposition;
    }

    if (teamCompositionPayload?.draft && typeof teamCompositionPayload.draft === 'object') {
      return teamCompositionPayload.draft;
    }

    if (bootstrapCompositionParam && typeof bootstrapCompositionParam === 'object') {
      return bootstrapCompositionParam;
    }

    return null;
  }, [
    bootstrapCompositionParam,
    existingCompositionParam,
    isTeamDefaultMode,
    resolvedTeamId,
    teamCompositionPayload?.draft,
    teamDefaultCompositionPayload?.composition,
  ]);

  const teamPlayers = useMemo(() => {
    if (Array.isArray(teamPlayersParam) && teamPlayersParam.length > 0) {
      return teamPlayersParam;
    }

    const candidateTeams = [
      eventFromApi?.team,
      ...(Array.isArray(eventFromApi?.invitedTeams) ? eventFromApi.invitedTeams : []),
    ].filter(Boolean);
    const matchedTeam = candidateTeams.find((team) => team?.documentId === resolvedTeamId)
      || eventFromApi?.team;
    const rawPlayers = Array.isArray(matchedTeam?.players) ? matchedTeam.players : [];
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
  }, [eventFromApi?.invitedTeams, eventFromApi?.team, resolvedTeamId, teamPlayersParam]);

  const sport = sportParam || 'football';
  const teamId = resolvedTeamId;
  const readableEventName = useMemo(() => normalizeMatchLabel(eventName), [eventName]);
  const isResolvingTeam = !isTeamDefaultMode
    && Boolean(eventId)
    && !teamId
    && (isEventFetching || isCompositionFetching);
  const isTeamResolutionBlocked = !isTeamDefaultMode && Boolean(eventId) && !teamId && !isResolvingTeam;
  const sourceLabel = useMemo(() => {
    if (isTeamDefaultMode) return "Favori d'équipe";
    if (teamCompositionPayload?.draft) return 'Brouillon';
    return editorSourceLabel
      || (editorSource === 'default_composition'
        ? "Favori d'équipe"
        : editorSource === 'last_match'
          ? 'Dernier match'
          : null);
  }, [editorSource, editorSourceLabel, isTeamDefaultMode, teamCompositionPayload?.draft]);

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

    // Supporte les deux formats de composition :
    // - legacy (v1/v2) : placements a plat + selectedPlayerIds
    // - multi-equipes (v3) : placements par equipe + reservePlayerIds
    const placements = Array.isArray(existingComposition?.placements)
      ? existingComposition.placements
      : (Array.isArray(existingComposition?.teams)
        ? existingComposition.teams.flatMap((/** @type {{ placements?: any[] }} */ team) => (Array.isArray(team?.placements) ? team.placements : []))
        : []);
    const manual = Array.isArray(existingComposition?.manualPlayers)
      ? existingComposition.manualPlayers
      : [];

    const selectedPlayerIds = [
      ...(Array.isArray(existingComposition?.selectedPlayerIds)
        ? existingComposition.selectedPlayerIds
        : []),
      ...(Array.isArray(existingComposition?.reservePlayerIds)
        ? existingComposition.reservePlayerIds
        : []),
    ];
    const selectedFromPlacements = placements
      .map((/** @type {{ playerId?: string }} */ placement) => String(placement?.playerId || '').trim())
      .filter(Boolean);
    const initialSet = new Set([
      ...selectedFromPlacements,
      ...selectedPlayerIds.map((value) => String(value || '').trim()).filter(Boolean),
    ]);

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
    if (isTeamDefaultMode) {
      Alert.alert('Indisponible', "Le favori d'équipe ne peut contenir que les joueurs de l'équipe.");
      return;
    }

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
  }, [isTeamDefaultMode, manualFirstname, manualLastname, manualNumber]);

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
    if (isResolvingTeam) {
      Alert.alert('Patiente', "On termine d'identifier l'équipe concernée.");
      return;
    }

    if (!teamId) {
      Alert.alert('Erreur', "Impossible d'identifier l'équipe pour cette composition.");
      return;
    }

    if (selectedIds.size === 0) {
      Alert.alert('Attention', 'Sélectionnez au moins un joueur');
      return;
    }

    const selectedPlayers = allPlayers.filter((p) => selectedIds.has(p.id || '') || selectedIds.has(p.documentId || ''));

    // @ts-ignore
    navigation.navigate(RouteNames.TacticalBoardV2, {
      editorMode,
      eventKind,
      eventTypeLabel,
      editorSource,
      editorSourceLabel: sourceLabel,
      eventId,
      eventName: readableEventName || eventName,
      existingComposition, // Pass through for loading positions
      selectedPlayers,
      sport,
      teamDefaultComposition: teamDefaultCompositionPayload || null,
      teamComposition: teamCompositionPayload || null,
      teamId,
      teamName,
    });
  }, [
    editorMode,
    eventKind,
    eventTypeLabel,
    editorSource,
    selectedIds,
    allPlayers,
    eventId,
    eventName,
    sport,
    existingComposition,
    sourceLabel,
    readableEventName,
    teamDefaultCompositionPayload,
    teamCompositionPayload,
    teamId,
    teamName,
    navigation,
    isResolvingTeam,
  ]);

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
            // Sur le fond primary500 a 25 % pose sur neutral800 : primary500 = 4,10:1
            // (sous AA), primary200 = 6,79:1.
            <Text style={[styles.avatarInitials, { color: isManualPlayer ? Colors.primary200 : Colors.neutral00 }]}>{initials}</Text>
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
          <Text style={{ color: Colors.neutral00, fontSize: 13 }}>✎</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }, [selectedIds, Colors, Fonts, toggleSelection, handleEditPlayer, numberOverrides]);

  const footerBottomInset = Math.max(insets.bottom, 12);
  const stickyFooterHeight = 84 + footerBottomInset;

  return (
    <ScreenContainer bgImage="bg2" style={[{ paddingHorizontal: 0 }]}>
      {/* Header */}
      <View style={styles.header}>
        <HeaderBackButton onPress={() => navigation.goBack()} />
        <Text style={[Fonts.h3Bold, { color: Colors.neutral00 }]}>
          {isTeamDefaultMode ? "Favori d'équipe" : 'Sélection des joueurs'}
        </Text>
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
        {/* actionBtn est rendu a 34px : on garde le visuel, on complete la zone de clic
            jusqu'a 44px via hitSlop (decision Adel, cf. THEME.md). */}
        <TouchableOpacity
          accessibilityLabel="Tout sélectionner"
          accessibilityRole="button"
          hitSlop={ApplicationStyle.hitSlop.min44From32}
          onPress={selectAll}
          style={[styles.actionBtn, { backgroundColor: Colors.primary700 }]}
        >
          <Text style={[Fonts.p3, { color: Colors.primary500, fontWeight: '600' }]}>Tout sélectionner</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityLabel="Effacer la sélection"
          accessibilityRole="button"
          hitSlop={ApplicationStyle.hitSlop.min44From32}
          onPress={clearSelection}
          style={[styles.actionBtn, { backgroundColor: Colors.primary700 }]}
        >
          <Text style={[Fonts.p3, { color: Colors.primary100, fontWeight: '600' }]}>Effacer</Text>
        </TouchableOpacity>
        {!isTeamDefaultMode ? (
          <TouchableOpacity
            accessibilityLabel="Ajouter un joueur"
            accessibilityRole="button"
            hitSlop={ApplicationStyle.hitSlop.min44From32}
            onPress={() => setModalVisible(true)}
            style={[styles.actionBtn, { backgroundColor: Colors.primary500 }]}
          >
            {/* Encre unique sur primary500 : '#FFF' = 2,40:1, primary900 = 7,96:1. */}
            <Text style={[Fonts.p3, { color: Colors.primary900, fontWeight: '600' }]}>+ Ajouter</Text>
          </TouchableOpacity>
        ) : null}
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
        {teamName ? (
          <Text style={[Fonts.p3, { color: Colors.primary100, marginTop: 6 }]}>
            Équipe : {teamName}
          </Text>
        ) : null}
        {readableEventName ? (
          <Text style={[Fonts.p3, { color: Colors.neutral300, marginTop: 4 }]}>
            {readableEventName}
          </Text>
        ) : null}
        {sourceLabel ? (
          <Text style={[Fonts.p3, { color: Colors.primary500, marginTop: 4 }]}>
            Base : {sourceLabel}
          </Text>
        ) : null}
        {teamCompositionPayload?.draft?.updatedAt ? (
          <Text style={[Fonts.p3, { color: Colors.neutral300, marginTop: 6 }]}>
            Brouillon mis à jour le
            {' '}
            {new Date(teamCompositionPayload.draft.updatedAt).toLocaleString('fr-FR')}
          </Text>
        ) : null}
        {teamCompositionPayload?.published?.publishedAt ? (
          <Text style={[Fonts.p3, { color: Colors.primary500, marginTop: 4 }]}>
            Convocation publiée (v
            {Number(teamCompositionPayload?.published?.version || 1)}
            ) le
            {' '}
            {new Date(teamCompositionPayload.published.publishedAt).toLocaleString('fr-FR')}
          </Text>
        ) : null}
        {isTeamDefaultMode && isDefaultCompositionFetching ? (
          <Text style={[Fonts.p3, { color: Colors.neutral300, marginTop: 4 }]}>
            Chargement du favori d'équipe...
          </Text>
        ) : null}
        {isResolvingTeam ? (
          <Text style={[Fonts.p3, { color: Colors.neutral300, marginTop: 4 }]}>
            Chargement de l'équipe concernée...
          </Text>
        ) : null}
        {isTeamResolutionBlocked ? (
          <Text style={[Fonts.p3, { color: Colors.danger500, marginTop: 4 }]}>
            Impossible d'identifier l'équipe de ce match.
          </Text>
        ) : null}
      </View>

      {/* Player List */}
      <View style={styles.listSection}>
        <FlatList
          contentContainerStyle={[
            Spaces.paddingHorizontal[24],
            styles.listContent,
            { paddingBottom: stickyFooterHeight + 16 },
          ]}
          data={filteredPlayers}
          keyExtractor={(item, index) => String(item.id || item.documentId || `player_${index}`)}
          ListEmptyComponent={(
            <View style={styles.emptyState}>
              <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>
              {searchQuery ? 'Aucun résultat' : "Aucun joueur dans l'équipe"}
              </Text>
            </View>
          )}
          renderItem={renderPlayer}
          showsVerticalScrollIndicator={false}
          style={styles.list}
        />
      </View>

      {/* Footer */}
      <View
        style={[
          styles.footer,
          {
            backgroundColor: Colors.neutral900,
            borderColor: Colors.neutral700,
            bottom: footerBottomInset,
          },
        ]}
      >
        <Button
          disabled={selectedIds.size === 0 || isResolvingTeam || isTeamResolutionBlocked}
          onPress={handleValidate}
          title={isResolvingTeam
            ? "Chargement de l'équipe..."
            : isTeamDefaultMode
              ? `Continuer (${selectedIds.size})`
              : `Valider (${selectedIds.size})`}
          variant="Primary"
        />
      </View>

      {/* Add Manual Player Modal */}
      <Modal animationType="fade" onRequestClose={() => setModalVisible(false)} transparent visible={modalVisible && !isTeamDefaultMode}>
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
              <TouchableOpacity
                accessibilityLabel="Ajouter"
                accessibilityRole="button"
                onPress={handleAddManualPlayer}
                style={[styles.modalBtn, { backgroundColor: Colors.primary500 }]}
              >
                {/* Encre unique sur primary500 : '#FFF' = 2,40:1, primary900 = 7,96:1. */}
                <Text style={[Fonts.p1, { color: Colors.primary900, fontWeight: '700' }]}>Ajouter</Text>
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
              <TouchableOpacity
                accessibilityLabel="Enregistrer"
                accessibilityRole="button"
                onPress={handleSaveEdit}
                style={[styles.modalBtn, { backgroundColor: Colors.primary500 }]}
              >
                {/* Encre unique sur primary500 : '#FFF' = 2,40:1, primary900 = 7,96:1. */}
                <Text style={[Fonts.p1, { color: Colors.primary900, fontWeight: '700' }]}>Enregistrer</Text>
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
    borderRadius: 22,
    borderWidth: 1,
    elevation: 10,
    left: 24,
    padding: 14,
    position: 'absolute',
    right: 24,
    shadowColor: '#000',
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
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
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 20,
  },
  listSection: {
    flex: 1,
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
