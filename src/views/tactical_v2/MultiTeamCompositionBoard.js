// @ts-nocheck
/* eslint-disable jsdoc/require-returns, max-len, perfectionist/sort-imports, react/jsx-one-expression-per-line, perfectionist/sort-named-imports, no-nested-ternary, react/no-array-index-key, perfectionist/sort-objects, react/no-unescaped-entities, react-hooks/exhaustive-deps */
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Alert,
  ImageBackground,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useAuth from '@/domains/auth/useAuth';
import { extractSubscriptionDecisionFromError } from '@/domains/subscription/subscriptionDecision';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import SubscriptionPaywallSheet from '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet';
import RenderedTacticalField from '@/components/tactical/RenderedTacticalField';

import { RouteNames } from '@/navigation/routeNames';

import {
  generateEventCompositionDraft,
  publishEventConvocation,
  saveEventCompositionDraft,
} from '@/services/event/eventService';

import {
  MAX_COMPOSITION_TEAMS,
  buildCompositionPlayerMap,
  buildDraftPayloadFromPack,
  buildPublishedBranchesFromPack,
  buildTeamEntryFromPreset,
  getCompositionPlayerId,
  getCompositionPlayerInitials,
  getCompositionPlayerLabel,
  getReservePlayersForPack,
  inferIsMultiTeamComposition,
  normalizeAvailablePresets,
  normalizeMultiTeamPack,
  replaceTeamPreset,
  sanitizeCompositionText,
} from './multiTeamCompositionUtils';

const FIELD_HEIGHT = 280;
const FIELD_SLOT_WIDTH = 78;
const FIELD_SLOT_HEIGHT = 52;

const byLabel = (left, right) => getCompositionPlayerLabel(left).localeCompare(getCompositionPlayerLabel(right), 'fr');

const getWindowObject = () => (typeof window !== 'undefined' ? window : null);

const showAlert = (title, message, buttons = null) => {
  if (Platform.OS === 'web') {
    const browserWindow = getWindowObject();
    if (Array.isArray(buttons) && buttons.length > 0) {
      const confirmAction = buttons.find((button) => button?.style !== 'cancel' && typeof button?.onPress === 'function');
      const cancelAction = buttons.find((button) => button?.style === 'cancel');
      const accepted = browserWindow?.confirm?.([title, message].filter(Boolean).join('\n\n'));
      if (accepted) {
        confirmAction?.onPress?.();
      } else {
        cancelAction?.onPress?.();
      }
      return;
    }
    browserWindow?.alert?.([title, message].filter(Boolean).join('\n\n'));
    return;
  }

  Alert.alert(title, message, buttons || undefined);
};

const getErrorMessage = (error, fallbackMessage) => {
  const status = error?.response?.status || error?.status;
  const apiMessage = error?.response?.data?.error?.message
    || error?.response?.data?.message
    || error?.message;

  if (status === 403) {
    return "Vous n'etes pas autorise a gerer cette composition.";
  }

  if (typeof apiMessage === 'string' && apiMessage.trim()) {
    return sanitizeCompositionText(apiMessage);
  }

  return fallbackMessage;
};

const syncPresetKeys = (teamCount, presets, currentKeys = []) => {
  const fallbackKey = presets[0]?.key || null;
  return Array.from({ length: teamCount }, (_, index) => currentKeys[index] || fallbackKey).filter(Boolean);
};

const getNextTeamIndex = (teams = []) => {
  const maxIndex = teams.reduce((best, team) => {
    const match = String(team?.id || '').match(/(\d+)$/);
    const value = Number(match?.[1] || 0);
    return Number.isFinite(value) && value > best ? value : best;
  }, 0);
  return maxIndex + 1;
};

const renderFieldSlots = ({
  Colors,
  Fonts,
  isReadOnly,
  onPressSlot,
  playerMap,
  selectedPlayerId,
  team,
}) => (
  <RenderedTacticalField sport={team?.sportContext || 'football'} style={styles.fieldSurface}>
    {(Array.isArray(team?.slots) ? team.slots : []).map((slot) => {
      const placement = (Array.isArray(team?.placements) ? team.placements : []).find((entry) => entry?.slotId === slot?.slotId) || null;
      const player = placement ? playerMap.get(String(placement.playerId || '')) : null;
      const hasPlayer = Boolean(player);
      const isSelectedPlayer = selectedPlayerId && String(selectedPlayerId) === String(placement?.playerId || '');
      const left = `${Math.max(0, Math.min(100, Number(slot?.positionX || 0)))}%`;
      const top = `${Math.max(0, Math.min(100, Number(slot?.positionY || 0)))}%`;

      return (
        <TouchableOpacity
          accessibilityLabel={slot?.label || 'Poste'}
          activeOpacity={isReadOnly ? 1 : 0.82}
          disabled={isReadOnly}
          key={slot?.slotId || slot?.slotKey}
          onPress={() => onPressSlot(team?.id, slot?.slotId)}
          style={[
            styles.slotBubble,
            {
              backgroundColor: hasPlayer ? `${Colors.primary500}D9` : `${Colors.primary900}D0`,
              borderColor: hasPlayer
                ? (isSelectedPlayer ? Colors.gold500 : Colors.primary100)
                : `${Colors.neutral00}30`,
              left,
              top,
            },
          ]}
        >
          <Text numberOfLines={1} style={[Fonts.p4Bold, { color: Colors.neutral00, textAlign: 'center' }]}>
            {hasPlayer ? getCompositionPlayerInitials(player) : slot?.label}
          </Text>
          {hasPlayer ? (
            <Text numberOfLines={1} style={[Fonts.p5 || Fonts.p4, { color: Colors.neutral00, opacity: 0.92, textAlign: 'center' }]}>
              {player?.number != null && player?.number !== '' ? `#${player.number}` : 'Attribue'}
            </Text>
          ) : null}
        </TouchableOpacity>
      );
    })}
  </RenderedTacticalField>
);

function MultiTeamCompositionBoard({ routeParams = null }) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Images,
    Spaces,
  } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const queryClient = useQueryClient();
  const { clubVerificationSummary, userData } = useAuth();
  const params = routeParams || route?.params || {};
  const {
    aggregateBranches = [],
    availablePresets: availablePresetsParam = [],
    canEdit = false,
    compositionIntent = null,
    editorSourceLabel = null,
    eventId,
    eventName = '',
    existingComposition = null,
    players = [],
    readOnly = false,
    selectedPlayers = [],
    sport = 'football',
    teamComposition = null,
    teamId,
    teamName = '',
  } = params;

  const availablePresets = useMemo(
    () => normalizeAvailablePresets(teamComposition?.availablePresets || availablePresetsParam),
    [availablePresetsParam, teamComposition?.availablePresets],
  );
  // Selection explicite de joueurs transmise par TacticalSelection (etape "Modifier les joueurs").
  // Invariant : quand elle est fournie, elle definit exactement la liste des joueurs affectables
  // et prime sur teamComposition.eligiblePlayers / params.players, sinon la selection cochee
  // par le coach serait perdue au retour sur ce board.
  const explicitSelectedPlayers = useMemo(
    () => (Array.isArray(selectedPlayers) ? selectedPlayers.filter(Boolean) : []),
    [selectedPlayers],
  );
  const hasExplicitSelection = explicitSelectedPlayers.length > 0;
  const editablePlayers = useMemo(
    () => {
      if (hasExplicitSelection) {
        return explicitSelectedPlayers;
      }
      return Array.isArray(teamComposition?.eligiblePlayers) && teamComposition.eligiblePlayers.length > 0
        ? teamComposition.eligiblePlayers
        : Array.isArray(players) ? players : [];
    },
    [explicitSelectedPlayers, hasExplicitSelection, players, teamComposition?.eligiblePlayers],
  );
  const initialPackSource = useMemo(
    () => existingComposition
      || teamComposition?.draft
      || teamComposition?.published
      || teamComposition?.bootstrap?.composition
      || null,
    [existingComposition, teamComposition?.bootstrap?.composition, teamComposition?.draft, teamComposition?.published],
  );
  const initialPack = useMemo(
    () => {
      const normalizedPack = normalizeMultiTeamPack(initialPackSource, {
        availablePresets,
        sportContext: initialPackSource?.sportContext || sport,
      });
      if (!hasExplicitSelection) {
        return normalizedPack;
      }

      // Avec une selection explicite, on restreint le pack aux joueurs selectionnes
      // (+ joueurs manuels deja presents dans le pack) : deselectionner un joueur
      // retire aussi ses placements et sa place en reserve, comme sur le board legacy.
      const allowedIds = new Set([
        ...explicitSelectedPlayers.map((player) => getCompositionPlayerId(player)),
        ...(Array.isArray(normalizedPack?.manualPlayers) ? normalizedPack.manualPlayers : [])
          .map((player) => getCompositionPlayerId(player)),
      ].filter(Boolean));

      return {
        ...normalizedPack,
        reservePlayerIds: (Array.isArray(normalizedPack?.reservePlayerIds) ? normalizedPack.reservePlayerIds : [])
          .filter((playerId) => allowedIds.has(playerId)),
        reserveSnapshotPlayers: (Array.isArray(normalizedPack?.reserveSnapshotPlayers) ? normalizedPack.reserveSnapshotPlayers : [])
          .filter((player) => allowedIds.has(getCompositionPlayerId(player))),
        teams: (Array.isArray(normalizedPack?.teams) ? normalizedPack.teams : []).map((team) => ({
          ...team,
          placements: (Array.isArray(team?.placements) ? team.placements : [])
            .filter((placement) => allowedIds.has(String(placement?.playerId || ''))),
        })),
      };
    },
    [availablePresets, explicitSelectedPlayers, hasExplicitSelection, initialPackSource, sport],
  );
  const resolvedReadOnlyBranches = useMemo(() => {
    if (Array.isArray(aggregateBranches) && aggregateBranches.length > 0) {
      return aggregateBranches;
    }

    if (readOnly && existingComposition && inferIsMultiTeamComposition(params)) {
      return buildPublishedBranchesFromPack(existingComposition, teamName);
    }

    return [];
  }, [aggregateBranches, existingComposition, params, readOnly, teamName]);

  const [draftPack, setDraftPack] = useState(initialPack);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [subscriptionPaywallDecision, setSubscriptionPaywallDecision] = useState(null);
  const [autoTeamCount, setAutoTeamCount] = useState(Math.max(1, initialPack?.teams?.length || 1));
  const [autoPresetKeys, setAutoPresetKeys] = useState(
    syncPresetKeys(Math.max(1, initialPack?.teams?.length || 1), availablePresets, initialPack?.teams?.map((team) => team?.presetKey)),
  );
  const [showAutoSetup, setShowAutoSetup] = useState(Boolean(
    !readOnly
      && canEdit
      && compositionIntent === 'auto'
      && !teamComposition?.draft,
  ));

  useEffect(() => {
    setDraftPack(initialPack);
  }, [initialPack]);

  useEffect(() => {
    const nextTeamCount = Math.max(1, initialPack?.teams?.length || 1);
    setAutoTeamCount(nextTeamCount);
    setAutoPresetKeys(syncPresetKeys(nextTeamCount, availablePresets, initialPack?.teams?.map((team) => team?.presetKey)));
  }, [availablePresets, initialPack]);

  useEffect(() => {
    setShowAutoSetup(Boolean(
      !readOnly
        && canEdit
        && compositionIntent === 'auto'
        && !teamComposition?.draft,
    ));
  }, [canEdit, compositionIntent, readOnly, teamComposition?.draft]);

  const allPlayers = useMemo(
    () => Array.from(buildCompositionPlayerMap([
      ...editablePlayers,
      ...(Array.isArray(draftPack?.manualPlayers) ? draftPack.manualPlayers : []),
      ...(Array.isArray(draftPack?.reserveSnapshotPlayers) ? draftPack.reserveSnapshotPlayers : []),
    ]).values()).sort(byLabel),
    [draftPack?.manualPlayers, draftPack?.reserveSnapshotPlayers, editablePlayers],
  );
  const playerMap = useMemo(() => buildCompositionPlayerMap(allPlayers), [allPlayers]);
  const reservePlayers = useMemo(
    () => getReservePlayersForPack(draftPack, allPlayers).sort(byLabel),
    [allPlayers, draftPack],
  );
  const hasKnownPlayers = allPlayers.length > 0;
  const selectedPlayer = useMemo(
    () => playerMap.get(String(selectedPlayerId || '')) || null,
    [playerMap, selectedPlayerId],
  );

  const invalidateQueries = useCallback(async () => {
    if (!eventId) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['event', eventId] }),
      queryClient.invalidateQueries({ queryKey: ['eventComposition', eventId] }),
      queryClient.invalidateQueries({ queryKey: ['eventConvocation', eventId] }),
      queryClient.invalidateQueries({ queryKey: ['events'] }),
    ]);
  }, [eventId, queryClient]);

  const updateDraftPack = useCallback((updater) => {
    setDraftPack((current) => {
      const nextValue = typeof updater === 'function' ? updater(current) : updater;
      return normalizeMultiTeamPack(nextValue, {
        availablePresets,
        sportContext: nextValue?.sportContext || current?.sportContext || sport,
      });
    });
  }, [availablePresets, sport]);

  const detachPlayerEverywhere = useCallback((teams, playerId) => (
    teams.map((team) => ({
      ...team,
      placements: (Array.isArray(team?.placements) ? team.placements : []).filter((placement) => String(placement?.playerId || '') !== String(playerId || '')),
    }))
  ), []);

  const handleReservePress = useCallback((playerId) => {
    if (readOnly || !playerId) return;
    setSelectedPlayerId((current) => (String(current || '') === String(playerId) ? '' : String(playerId)));
  }, [readOnly]);

  const handleSlotPress = useCallback((targetTeamId, targetSlotId) => {
    if (readOnly || !targetTeamId || !targetSlotId) return;

    updateDraftPack((currentPack) => {
      const teams = Array.isArray(currentPack?.teams) ? currentPack.teams : [];
      const currentTeam = teams.find((team) => team?.id === targetTeamId) || null;
      const currentPlacement = (Array.isArray(currentTeam?.placements) ? currentTeam.placements : [])
        .find((placement) => placement?.slotId === targetSlotId) || null;

      if (!selectedPlayerId) {
        if (!currentPlacement?.playerId) {
          return currentPack;
        }

        setSelectedPlayerId(String(currentPlacement.playerId));
        return {
          ...currentPack,
          teams: teams.map((team) => (
            team?.id !== targetTeamId
              ? team
              : {
                ...team,
                placements: (Array.isArray(team?.placements) ? team.placements : [])
                  .filter((placement) => placement?.slotId !== targetSlotId),
              }
          )),
        };
      }

      const nextTeams = detachPlayerEverywhere(teams, selectedPlayerId).map((team) => {
        if (team?.id !== targetTeamId) return team;
        const slot = (Array.isArray(team?.slots) ? team.slots : []).find((entry) => entry?.slotId === targetSlotId) || null;
        const keptPlacements = (Array.isArray(team?.placements) ? team.placements : [])
          .filter((placement) => placement?.slotId !== targetSlotId);
        return {
          ...team,
          placements: [
            ...keptPlacements,
            {
              playerId: String(selectedPlayerId),
              positionX: Number(slot?.positionX || 50),
              positionY: Number(slot?.positionY || 50),
              slotId: targetSlotId,
            },
          ],
        };
      });

      setSelectedPlayerId('');
      return {
        ...currentPack,
        teams: nextTeams,
      };
    });
  }, [detachPlayerEverywhere, readOnly, selectedPlayerId, updateDraftPack]);

  const handleRenameTeam = useCallback((teamIdToRename, nextName) => {
    if (readOnly) return;
    updateDraftPack((currentPack) => ({
      ...currentPack,
      teams: (Array.isArray(currentPack?.teams) ? currentPack.teams : []).map((team) => (
        team?.id === teamIdToRename
          ? {
            ...team,
            name: nextName,
          }
          : team
      )),
    }));
  }, [readOnly, updateDraftPack]);

  const handleAddTeam = useCallback(() => {
    if (readOnly) return;
    updateDraftPack((currentPack) => {
      const currentTeams = Array.isArray(currentPack?.teams) ? currentPack.teams : [];
      if (currentTeams.length >= MAX_COMPOSITION_TEAMS) {
        showAlert('Limite atteinte', `Tu peux creer jusqu'a ${MAX_COMPOSITION_TEAMS} equipes dans une meme composition.`);
        return currentPack;
      }

      const nextIndex = getNextTeamIndex(currentTeams);
      const basePreset = availablePresets[currentTeams.length] || availablePresets[0] || null;
      return {
        ...currentPack,
        mode: 'manual',
        teams: [
          ...currentTeams,
          buildTeamEntryFromPreset(basePreset, nextIndex - 1, currentPack?.sportContext || sport, `Equipe ${nextIndex}`, `team_${nextIndex}`),
        ],
      };
    });
  }, [availablePresets, readOnly, sport, updateDraftPack]);

  const handleRemoveTeam = useCallback((teamIdToRemove) => {
    if (readOnly) return;

    const currentTeamCount = Array.isArray(draftPack?.teams) ? draftPack.teams.length : 0;
    if (currentTeamCount <= 1) {
      showAlert('Equipe requise', 'Il doit rester au moins une equipe dans cette composition.');
      return;
    }

    showAlert(
      'Supprimer cette equipe ?',
      'Les joueurs deja places dans cette equipe repasseront automatiquement dans les remplacants.',
      [
        { style: 'cancel', text: 'Annuler' },
        {
          onPress: () => updateDraftPack((currentPack) => ({
            ...currentPack,
            teams: (Array.isArray(currentPack?.teams) ? currentPack.teams : []).filter((team) => team?.id !== teamIdToRemove),
          })),
          text: 'Supprimer',
        },
      ],
    );
  }, [draftPack?.teams, readOnly, updateDraftPack]);

  const cyclePreset = useCallback((teamIdToUpdate, direction) => {
    if (readOnly || availablePresets.length === 0) return;

    updateDraftPack((currentPack) => ({
      ...currentPack,
      teams: (Array.isArray(currentPack?.teams) ? currentPack.teams : []).map((team) => {
        if (team?.id !== teamIdToUpdate) return team;
        const currentIndex = Math.max(0, availablePresets.findIndex((preset) => preset.key === team?.presetKey));
        const nextIndex = (currentIndex + direction + availablePresets.length) % availablePresets.length;
        return replaceTeamPreset(team, availablePresets[nextIndex]);
      }),
    }));
  }, [availablePresets, readOnly, updateDraftPack]);

  const handleSaveDraft = useCallback(async () => {
    if (readOnly || !eventId || !teamId) return;

    setIsSaving(true);
    try {
      const response = await saveEventCompositionDraft(eventId, {
        draft: buildDraftPayloadFromPack(draftPack, allPlayers),
        teamId,
      });
      if (response?.draft) {
        setDraftPack(normalizeMultiTeamPack(response.draft, {
          availablePresets: response?.availablePresets || availablePresets,
          sportContext: response?.draft?.sportContext || draftPack?.sportContext || sport,
        }));
      }
      await invalidateQueries();
      showAlert('Succes', 'Brouillon de composition enregistre.');
    } catch (error) {
      const subscriptionDecision = extractSubscriptionDecisionFromError(error);
      if (subscriptionDecision) {
        setSubscriptionPaywallDecision(subscriptionDecision);
        return;
      }
      showAlert('Erreur', getErrorMessage(error, 'Impossible d\'enregistrer ce brouillon.'));
    } finally {
      setIsSaving(false);
    }
  }, [allPlayers, availablePresets, draftPack, eventId, invalidateQueries, readOnly, sport, teamId]);

  const handlePublish = useCallback(async () => {
    if (readOnly || !eventId || !teamId) return;

    setIsPublishing(true);
    try {
      await saveEventCompositionDraft(eventId, {
        draft: buildDraftPayloadFromPack(draftPack, allPlayers),
        teamId,
      });
      const response = await publishEventConvocation(eventId, { teamId });
      if (response?.published) {
        setDraftPack(normalizeMultiTeamPack(response.published, {
          availablePresets,
          sportContext: response?.published?.sportContext || draftPack?.sportContext || sport,
        }));
      }
      await invalidateQueries();
      showAlert('Succes', 'Composition d\'equipes publiee.', [
        {
          onPress: () => navigation.navigate(RouteNames.EventDetails, { eventId }),
          text: 'OK',
        },
      ]);
    } catch (error) {
      const subscriptionDecision = extractSubscriptionDecisionFromError(error);
      if (subscriptionDecision) {
        setSubscriptionPaywallDecision(subscriptionDecision);
        return;
      }
      showAlert('Erreur', getErrorMessage(error, 'Impossible de publier cette composition.'));
    } finally {
      setIsPublishing(false);
    }
  }, [allPlayers, availablePresets, draftPack, eventId, invalidateQueries, navigation, readOnly, sport, teamId]);

  const handleGenerateAuto = useCallback(async () => {
    if (!eventId || !teamId) return;
    if (availablePresets.length === 0) {
      showAlert('Preset requis', 'Aucun preset n\'est disponible pour ce sport. Passe en mode manuel.');
      return;
    }

    setIsSaving(true);
    try {
      const response = await generateEventCompositionDraft(eventId, {
        teamCount: autoTeamCount,
        teamId,
        teamPresets: autoPresetKeys.slice(0, autoTeamCount).map((presetKey) => ({ presetKey })),
      });
      const nextPresets = response?.availablePresets || availablePresets;
      setDraftPack(normalizeMultiTeamPack(response?.draft, {
        availablePresets: nextPresets,
        sportContext: response?.draft?.sportContext || sport,
      }));
      setSelectedPlayerId('');
      setShowAutoSetup(false);
      await invalidateQueries();
      showAlert('Succes', 'Brouillon genere automatiquement. Tu peux maintenant ajuster les equipes a la main.');
    } catch (error) {
      const subscriptionDecision = extractSubscriptionDecisionFromError(error);
      if (subscriptionDecision) {
        setSubscriptionPaywallDecision(subscriptionDecision);
        return;
      }
      showAlert('Erreur', getErrorMessage(error, 'Impossible de generer cette composition automatiquement.'));
    } finally {
      setIsSaving(false);
    }
  }, [autoPresetKeys, autoTeamCount, availablePresets, eventId, invalidateQueries, sport, teamId]);

  const headerTitle = readOnly ? 'Composition d\'equipes' : 'Edition composition d\'equipes';
  const contextLabel = teamName || eventName || 'Evenement';
  const viewerBranchCount = resolvedReadOnlyBranches.length;

  return (
    <ImageBackground
      resizeMode="cover"
      source={Images.bg1}
      style={[Alignments.fill, { paddingTop: insets.top + 8 }]}
    >
      <View style={[styles.header, Spaces.paddingHorizontal[16]]}>
        <View style={styles.headerBackButtonContainer}>
          <HeaderBackButton onPress={() => navigation.goBack()} />
        </View>
        <View style={styles.headerCenter}>
          <Text style={[Fonts.h3Bold, Fonts.neutral00, styles.headerTitle]}>
            {headerTitle}
          </Text>
          <Text numberOfLines={1} style={[Fonts.p2, Fonts.primary100, styles.headerSubtitle]}>
            {contextLabel}
          </Text>
          <View style={styles.headerMetaRow}>
            <View style={[styles.headerPill, { backgroundColor: `${Colors.primary500}18`, borderColor: `${Colors.primary500}55` }]}>
              <Text style={[Fonts.p4Bold, { color: Colors.primary500 }]}>
                {readOnly ? 'Publication' : (draftPack?.mode === 'auto' ? 'Auto + manuel' : 'Manuel')}
              </Text>
            </View>
            {!readOnly ? (
              <View style={[styles.headerPill, { backgroundColor: `${Colors.neutral00}10`, borderColor: `${Colors.neutral00}22` }]}>
                <Text style={[Fonts.p4Bold, { color: Colors.neutral00 }]}>
                  {(Array.isArray(draftPack?.teams) ? draftPack.teams.length : 0)}
                  {' '}
                  equipe(s)
                </Text>
              </View>
            ) : (
              <View style={[styles.headerPill, { backgroundColor: `${Colors.neutral00}10`, borderColor: `${Colors.neutral00}22` }]}>
                <Text style={[Fonts.p4Bold, { color: Colors.neutral00 }]}>
                  {viewerBranchCount}
                  {' '}
                  branche(s)
                </Text>
              </View>
            )}
            {editorSourceLabel ? (
              <View style={[styles.headerPill, { backgroundColor: `${Colors.primary300}16`, borderColor: `${Colors.primary300}40` }]}>
                <Text style={[Fonts.p4Bold, { color: Colors.primary100 }]}>
                  {editorSourceLabel}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 24, 32) }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[Spaces.paddingHorizontal[16], Spaces.gap[16]]}>
          {readOnly ? (
            <>
              {resolvedReadOnlyBranches.length === 0 ? (
                <View
                  style={[
                    ApplicationStyle.card,
                    ApplicationStyle.borderRadius24,
                    Spaces.padding[20],
                    {
                      backgroundColor: Colors.primary900,
                      borderColor: `${Colors.primary500}44`,
                      borderWidth: 1,
                    },
                  ]}
                >
                  <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Aucune composition publiee</Text>
                  <Text style={[Fonts.p2, Fonts.neutral300, { marginTop: 8 }]}>
                    Le coach n a pas encore publie de composition pour cet evenement.
                  </Text>
                </View>
              ) : null}

              {resolvedReadOnlyBranches.length > 0 ? (
                <View
                  style={[
                    ApplicationStyle.card,
                    ApplicationStyle.borderRadius24,
                    Spaces.padding[18],
                    {
                      backgroundColor: Colors.primary900,
                      borderColor: `${Colors.primary500}30`,
                      borderWidth: 1,
                    },
                  ]}
                >
                  <Text style={[Fonts.p3, Fonts.neutral300]}>
                    Les places encore libres restent visibles et seront completees automatiquement quand de nouveaux joueurs acceptes arriveront.
                  </Text>
                </View>
              ) : null}

              {resolvedReadOnlyBranches.map((branch, branchIndex) => {
                const published = normalizeMultiTeamPack(branch?.published, {
                  availablePresets,
                  sportContext: branch?.published?.sportContext || sport,
                });
                const branchPlayerMap = buildCompositionPlayerMap([
                  ...(Array.isArray(branch?.published?.snapshotPlayers) ? branch.published.snapshotPlayers : []),
                  ...(Array.isArray(branch?.published?.reserveSnapshotPlayers) ? branch.published.reserveSnapshotPlayers : []),
                ]);
                const branchReservePlayers = getReservePlayersForPack(published, Array.from(branchPlayerMap.values())).sort(byLabel);
                const highlightedTeamEntryIds = Array.isArray(branch?.viewer?.teamEntryIds) ? branch.viewer.teamEntryIds : [];

                return (
                  <View
                    key={`${branch?.team?.documentId || 'branch'}_${branchIndex}`}
                    style={[
                      ApplicationStyle.card,
                      ApplicationStyle.borderRadius24,
                      Spaces.padding[18],
                      Spaces.gap[14],
                      {
                        backgroundColor: Colors.primary900,
                        borderColor: `${Colors.primary500}38`,
                        borderWidth: 1,
                      },
                    ]}
                  >
                    <View style={[Spaces.gap[4]]}>
                      <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
                        {branch?.team?.name || `Branche ${branchIndex + 1}`}
                      </Text>
                      <Text style={[Fonts.p3, Fonts.neutral300]}>
                        {branch?.published?.publishedAt
                          ? `Publie le ${new Date(branch.published.publishedAt).toLocaleString('fr-FR')}`
                          : "Composition d'equipes publiee"}
                      </Text>
                      {branch?.viewer?.inReserve ? (
                        <Text style={[Fonts.p3, { color: Colors.gold500 }]}>
                          Tu figures actuellement dans les remplacants / en attente.
                        </Text>
                      ) : null}
                    </View>

                    {(Array.isArray(published?.teams) ? published.teams : []).map((team, teamIndex) => {
                      const isViewerTeam = highlightedTeamEntryIds.includes(team?.id);
                      return (
                        <View
                          key={team?.id || `team_${teamIndex + 1}`}
                          style={[
                            ApplicationStyle.borderRadius24,
                            Spaces.padding[16],
                            Spaces.gap[12],
                            {
                              backgroundColor: isViewerTeam ? `${Colors.primary500}14` : Colors.neutral800,
                              borderColor: isViewerTeam ? `${Colors.primary500}55` : `${Colors.neutral00}10`,
                              borderWidth: 1,
                            },
                          ]}
                        >
                          <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter]}>
                            <View style={{ flex: 1, paddingRight: 12 }}>
                              <Text style={[Fonts.h4Bold, Fonts.neutral00]}>{team?.name || `Equipe ${teamIndex + 1}`}</Text>
                              <Text style={[Fonts.p4, Fonts.neutral300]}>
                                {team?.presetLabel || 'Composition libre'}
                              </Text>
                            </View>
                            {isViewerTeam ? (
                              <View style={[styles.badge, { backgroundColor: `${Colors.primary500}24`, borderColor: `${Colors.primary500}55` }]}>
                                <Text style={[Fonts.p4Bold, { color: Colors.primary500 }]}>Mon equipe</Text>
                              </View>
                            ) : null}
                          </View>

                          {renderFieldSlots({
                            Colors,
                            Fonts,
                            isReadOnly: true,
                            onPressSlot: () => {},
                            playerMap: branchPlayerMap,
                            selectedPlayerId: '',
                            team,
                          })}

                          <View style={Spaces.gap[8]}>
                            {(Array.isArray(team?.slots) ? team.slots : []).map((slot) => {
                              const placement = (Array.isArray(team?.placements) ? team.placements : []).find((entry) => entry?.slotId === slot?.slotId) || null;
                              const player = placement ? branchPlayerMap.get(String(placement.playerId || '')) : null;
                              return (
                                <View
                                  key={slot?.slotId || slot?.slotKey}
                                  style={[styles.listRow, { borderColor: `${Colors.neutral00}12`, backgroundColor: `${Colors.neutral00}04` }]}
                                >
                                  <Text style={[Fonts.p3Bold, Fonts.neutral00, { flex: 1 }]}>
                                    {slot?.label}
                                  </Text>
                                  <Text style={[Fonts.p3, { color: player ? Colors.primary100 : Colors.neutral300, flex: 1.2, textAlign: 'right' }]}>
                                    {player ? getCompositionPlayerLabel(player) : 'Libre'}
                                  </Text>
                                </View>
                              );
                            })}
                          </View>
                        </View>
                      );
                    })}

                    <View style={Spaces.gap[8]}>
                      <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Remplacants / en attente</Text>
                      {branchReservePlayers.length === 0 ? (
                        <Text style={[Fonts.p3, Fonts.neutral300]}>Aucun joueur non affecte.</Text>
                      ) : (
                        <View style={styles.chipRow}>
                          {branchReservePlayers.map((player) => (
                            <View
                              key={getCompositionPlayerId(player)}
                              style={[styles.playerChip, { backgroundColor: `${Colors.neutral00}08`, borderColor: `${Colors.neutral00}16` }]}
                            >
                              <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
                                {getCompositionPlayerLabel(player)}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </>
          ) : (
            <>
              <View
                style={[
                  ApplicationStyle.card,
                  ApplicationStyle.borderRadius24,
                  Spaces.padding[18],
                  Spaces.gap[12],
                  {
                    backgroundColor: Colors.primary900,
                    borderColor: `${Colors.primary500}38`,
                    borderWidth: 1,
                  },
                ]}
              >
                <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Composition d'equipes</Text>
                <Text style={[Fonts.p2, Fonts.neutral300]}>
                  {showAutoSetup
                    ? "Choisis le nombre d'equipes et le preset de chacune, puis genere un brouillon."
                    : "Selectionne un joueur depuis les remplacants, puis touche un poste pour l'attribuer. Touche un joueur deja place pour le deplacer."}
                </Text>
                <Text style={[Fonts.p3, Fonts.neutral300]}>
                  Les postes encore libres peuvent rester vides: ils seront completes automatiquement quand de nouveaux joueurs acceptes arriveront.
                </Text>

                <View style={[Alignments.row, { flexWrap: 'wrap' }, Spaces.gap[10]]}>
                  <Button
                    isLoading={isSaving}
                    onPress={handleSaveDraft}
                    title="Sauvegarder"
                    variant="Secondary"
                  />
                  <Button
                    disabled={isSaving}
                    isLoading={isPublishing}
                    onPress={handlePublish}
                    title="Publier"
                    variant="Primary"
                  />
                  {availablePresets.length > 0 ? (
                    <Button
                      disabled={isPublishing || isSaving}
                      onPress={() => setShowAutoSetup((current) => !current)}
                      title={showAutoSetup ? 'Fermer auto' : 'Generation auto'}
                      variant="Secondary"
                    />
                  ) : null}
                  {!showAutoSetup ? (
                    <Button
                      disabled={isPublishing || isSaving}
                      onPress={handleAddTeam}
                      title="Ajouter une equipe"
                      variant="Secondary"
                    />
                  ) : null}
                </View>
              </View>

              {showAutoSetup ? (
                <View
                  style={[
                    ApplicationStyle.card,
                    ApplicationStyle.borderRadius24,
                    Spaces.padding[18],
                    Spaces.gap[14],
                    {
                      backgroundColor: Colors.primary900,
                      borderColor: `${Colors.gold500}38`,
                      borderWidth: 1,
                    },
                  ]}
                >
                  <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Generation automatique</Text>

                  <View style={[styles.stepperRow, { borderColor: `${Colors.neutral00}12`, backgroundColor: Colors.neutral800 }]}>
                    <TouchableOpacity
                      activeOpacity={0.82}
                      onPress={() => setAutoTeamCount((current) => Math.max(1, current - 1))}
                      style={[styles.stepperButton, { borderColor: `${Colors.neutral00}14` }]}
                    >
                      <Text style={[Fonts.h4Bold, { color: Colors.primary100 }]}>-</Text>
                    </TouchableOpacity>
                    <View style={styles.stepperValue}>
                      <Text style={[Fonts.h3Bold, Fonts.neutral00]}>{autoTeamCount}</Text>
                      <Text style={[Fonts.p4, Fonts.neutral300]}>equipes</Text>
                    </View>
                    <TouchableOpacity
                      activeOpacity={0.82}
                      onPress={() => setAutoTeamCount((current) => Math.min(MAX_COMPOSITION_TEAMS, current + 1))}
                      style={[styles.stepperButton, { borderColor: `${Colors.neutral00}14` }]}
                    >
                      <Text style={[Fonts.h4Bold, { color: Colors.primary100 }]}>+</Text>
                    </TouchableOpacity>
                  </View>

                  {Array.from({ length: autoTeamCount }, (_, index) => {
                    const selectedKey = autoPresetKeys[index] || availablePresets[0]?.key || null;
                    const presetIndex = Math.max(0, availablePresets.findIndex((preset) => preset.key === selectedKey));
                    const preset = availablePresets[presetIndex] || availablePresets[0] || null;
                    return (
                      <View
                        key={`auto_team_${index + 1}`}
                        style={[styles.listRow, { backgroundColor: Colors.neutral800, borderColor: `${Colors.neutral00}12`, paddingVertical: 14 }]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[Fonts.p3Bold, Fonts.neutral00]}>{`Equipe ${index + 1}`}</Text>
                          <Text style={[Fonts.p4, Fonts.neutral300]}>{preset?.label || 'Aucun preset'}</Text>
                        </View>
                        <View style={[Alignments.row, Spaces.gap[8]]}>
                          <Button
                            onPress={() => setAutoPresetKeys((current) => {
                              const next = syncPresetKeys(autoTeamCount, availablePresets, current);
                              if (availablePresets.length <= 1) return next;
                              const nextIndex = (presetIndex - 1 + availablePresets.length) % availablePresets.length;
                              next[index] = availablePresets[nextIndex]?.key || next[index];
                              return [...next];
                            })}
                            size="sm"
                            title="<"
                            variant="Secondary"
                          />
                          <Button
                            onPress={() => setAutoPresetKeys((current) => {
                              const next = syncPresetKeys(autoTeamCount, availablePresets, current);
                              if (availablePresets.length <= 1) return next;
                              const nextIndex = (presetIndex + 1) % availablePresets.length;
                              next[index] = availablePresets[nextIndex]?.key || next[index];
                              return [...next];
                            })}
                            size="sm"
                            title=">"
                            variant="Secondary"
                          />
                        </View>
                      </View>
                    );
                  })}

                  <Button
                    isLoading={isSaving}
                    onPress={handleGenerateAuto}
                    title="Generer le brouillon"
                    variant="Primary"
                  />
                </View>
              ) : null}

              <View
                style={[
                  ApplicationStyle.card,
                  ApplicationStyle.borderRadius24,
                  Spaces.padding[18],
                  Spaces.gap[12],
                  {
                    backgroundColor: Colors.primary900,
                    borderColor: selectedPlayer ? `${Colors.primary500}44` : `${Colors.neutral00}12`,
                    borderWidth: 1,
                  },
                ]}
              >
                <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter]}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Remplacants / en attente</Text>
                    <Text style={[Fonts.p3, Fonts.neutral300]}>
                      {selectedPlayer
                        ? `${getCompositionPlayerLabel(selectedPlayer)} est selectionne. Touche maintenant un poste pour l'affecter.`
                        : 'Touche un joueur pour le selectionner, puis touche un poste sur une equipe.'}
                    </Text>
                  </View>
                  {selectedPlayer ? (
                    <Button
                      onPress={() => setSelectedPlayerId('')}
                      size="sm"
                      title="Annuler"
                      variant="Secondary"
                    />
                  ) : null}
                </View>

                {reservePlayers.length === 0 ? (
                  <Text style={[Fonts.p3, Fonts.neutral300]}>
                    {hasKnownPlayers
                      ? 'Tous les joueurs sont deja affectes a une equipe.'
                      : 'Aucun joueur disponible pour le moment. Tu peux quand meme creer les equipes et laisser les postes libres.'}
                  </Text>
                ) : (
                  <View style={styles.chipRow}>
                    {reservePlayers.map((player) => {
                      const playerId = getCompositionPlayerId(player);
                      const isSelected = String(selectedPlayerId || '') === String(playerId);
                      return (
                        <TouchableOpacity
                          activeOpacity={0.82}
                          key={playerId}
                          onPress={() => handleReservePress(playerId)}
                          style={[
                            styles.playerChip,
                            {
                              backgroundColor: isSelected ? `${Colors.primary500}22` : `${Colors.neutral00}08`,
                              borderColor: isSelected ? `${Colors.primary500}66` : `${Colors.neutral00}16`,
                            },
                          ]}
                        >
                          <Text style={[Fonts.p3Bold, { color: isSelected ? Colors.primary100 : Colors.neutral00 }]}>
                            {getCompositionPlayerLabel(player)}
                          </Text>
                          {player?.participantSource ? (
                            <Text style={[Fonts.p5 || Fonts.p4, { color: isSelected ? Colors.primary100 : Colors.neutral300 }]}>
                              {player.participantSource === 'external_participant' ? 'Externe' : 'Equipe'}
                            </Text>
                          ) : null}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>

              {(Array.isArray(draftPack?.teams) ? draftPack.teams : []).map((team, teamIndex) => (
                <View
                  key={team?.id || `team_${teamIndex + 1}`}
                  style={[
                    ApplicationStyle.card,
                    ApplicationStyle.borderRadius24,
                    Spaces.padding[18],
                    Spaces.gap[14],
                    {
                      backgroundColor: Colors.primary900,
                      borderColor: `${Colors.primary500}30`,
                      borderWidth: 1,
                    },
                  ]}
                >
                  <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[10]]}>
                    <TextInput
                      onChangeText={(value) => handleRenameTeam(team?.id, value)}
                      placeholder={`Equipe ${teamIndex + 1}`}
                      placeholderTextColor={Colors.neutral300}
                      style={[
                        Fonts.h4Bold,
                        {
                          backgroundColor: Colors.neutral800,
                          borderColor: `${Colors.neutral00}12`,
                          borderRadius: 14,
                          borderWidth: 1,
                          color: Colors.neutral00,
                          flex: 1,
                          paddingHorizontal: 14,
                          paddingVertical: 12,
                        },
                      ]}
                      value={team?.name || ''}
                    />
                    <Button
                      disabled={(Array.isArray(draftPack?.teams) ? draftPack.teams.length : 0) <= 1}
                      onPress={() => handleRemoveTeam(team?.id)}
                      size="sm"
                      title="Suppr."
                      variant="Secondary"
                    />
                  </View>

                  {availablePresets.length > 0 ? (
                    <View style={[styles.listRow, { backgroundColor: Colors.neutral800, borderColor: `${Colors.neutral00}12` }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[Fonts.p3Bold, Fonts.neutral00]}>Preset</Text>
                        <Text style={[Fonts.p4, Fonts.neutral300]}>{team?.presetLabel || 'Composition libre'}</Text>
                      </View>
                      <View style={[Alignments.row, Spaces.gap[8]]}>
                        <Button onPress={() => cyclePreset(team?.id, -1)} size="sm" title="<" variant="Secondary" />
                        <Button onPress={() => cyclePreset(team?.id, 1)} size="sm" title=">" variant="Secondary" />
                      </View>
                    </View>
                  ) : null}

                  {renderFieldSlots({
                    Colors,
                    Fonts,
                    isReadOnly: false,
                    onPressSlot: handleSlotPress,
                    playerMap,
                    selectedPlayerId,
                    team,
                  })}

                  <View style={Spaces.gap[8]}>
                    {(Array.isArray(team?.slots) ? team.slots : []).map((slot) => {
                      const placement = (Array.isArray(team?.placements) ? team.placements : []).find((entry) => entry?.slotId === slot?.slotId) || null;
                      const player = placement ? playerMap.get(String(placement.playerId || '')) : null;
                      return (
                        <TouchableOpacity
                          activeOpacity={0.82}
                          key={slot?.slotId || slot?.slotKey}
                          onPress={() => handleSlotPress(team?.id, slot?.slotId)}
                          style={[styles.listRow, { backgroundColor: Colors.neutral800, borderColor: `${Colors.neutral00}12` }]}
                        >
                          <Text style={[Fonts.p3Bold, Fonts.neutral00, { flex: 1 }]}>
                            {slot?.label}
                          </Text>
                          <Text style={[Fonts.p3, { color: player ? Colors.primary100 : Colors.neutral300, flex: 1.2, textAlign: 'right' }]}>
                            {player ? getCompositionPlayerLabel(player) : 'Libre'}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}
            </>
          )}
        </View>
      </ScrollView>
      <SubscriptionPaywallSheet
        close={() => setSubscriptionPaywallDecision(null)}
        clubDocumentId={
          clubVerificationSummary?.clubDocumentId
          || userData?.club?.documentId
          || null
        }
        decision={subscriptionPaywallDecision}
        isVisible={Boolean(subscriptionPaywallDecision)}
        navigation={navigation}
      />
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  fieldSurface: {
    alignSelf: 'stretch',
    borderRadius: 18,
    height: FIELD_HEIGHT,
    overflow: 'hidden',
    width: '100%',
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 18,
  },
  headerBackButtonContainer: {
    paddingTop: 6,
  },
  headerCaption: {
    textAlign: 'center',
  },
  headerCenter: {
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  headerMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  headerPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  headerSubtitle: {
    textAlign: 'center',
  },
  headerTitle: {
    textAlign: 'center',
  },
  listRow: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  playerChip: {
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  slotBubble: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    height: FIELD_SLOT_HEIGHT,
    justifyContent: 'center',
    marginLeft: -(FIELD_SLOT_WIDTH / 2),
    marginTop: -(FIELD_SLOT_HEIGHT / 2),
    paddingHorizontal: 8,
    position: 'absolute',
    width: FIELD_SLOT_WIDTH,
  },
  stepperButton: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  stepperRow: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
  },
  stepperValue: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
  },
});

export default MultiTeamCompositionBoard;
