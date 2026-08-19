// @ts-nocheck
/* eslint-disable max-len, perfectionist/sort-imports, perfectionist/sort-named-imports, no-nested-ternary, react/no-array-index-key, perfectionist/sort-objects, react/no-unescaped-entities, react-hooks/exhaustive-deps */
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  ImageBackground,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  runOnJS,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
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
import DraggableToken, { GHOST_TOKEN_SIZE } from '@/components/tactical/DraggableToken';

import {
  MAX_COMPOSITION_TEAMS,
  buildCompositionPlayerMap,
  buildDraftPayloadFromPack,
  buildPublishedBranchesFromPack,
  buildTeamEntryFromPreset,
  getAssignedPlayerIdsFromPack,
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

// D42 — UNE SEULE liste vide, partagee par tous les parametres de route absents.
//
// Ce n'est pas une micro-optimisation, c'est un correctif : ecrire `= []` dans la
// destructuration fabrique un tableau NEUF a chaque rendu. Ces tableaux sont des
// dependances de useMemo qui alimentent `initialPack`, lui-meme dependance d'un
// useEffect qui appelle `setDraftPack` : le pack changeait d'identite a chaque
// rendu, donc l'effet re-tirait, donc l'ecran se re-rendait, sans fin.
//
// MESURE (sonde du 2026-08-08, compteur de rendus au montage) :
//   - ni `availablePresets` ni `selectedPlayers` en params (ce qu'envoie
//     EventDetails)                                        -> 402 rendus, jamais stable
//   - `selectedPlayers` seul (ce qu'envoie TacticalSelection) -> 402 rendus, jamais stable
//   - aucun preset du tout (sport sans formation)             -> 402 rendus, jamais stable
//   - les deux fournis et stables                             -> 2 rendus
// Aucun appelant ne fournit `availablePresets` : le fil JS etait donc sature sur
// TOUS les chemins d'ouverture, ce qui gele les gestes (le glisser-deposer
// compris) alors que l'ecran reste affiche.
const EMPTY_PARAM_LIST = Object.freeze([]);

// Les deux temps de la composition. Valeurs LOCALES a l'ecran : elles ne sont ni
// enregistrees ni envoyees au serveur.
const STEP_PLAYERS = 'players';
const STEP_FIELD = 'field';

const clampPercent = (value) => Math.max(0, Math.min(100, Number(value) || 0));

// Ghost (jeton fantôme qui suit le doigt pendant le drag).
const DRAG_SPRING = { damping: 18, stiffness: 220 };
// Rayon d'accroche (en % de terrain) au poste libre le plus proche en mode « sur postes ».
const SNAP_RADIUS = 14;

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
    return "Tu n'es pas autorise à gérer cette composition.";
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
  fieldNodeRef = undefined,
  isReadOnly,
  makeDragGesture = null,
  onFieldLayout = undefined,
  onPressPlacement,
  onPressSlot,
  playerMap,
  selectedPlayerId,
  team,
}) => {
  const slots = Array.isArray(team?.slots) ? team.slots : [];
  const placements = Array.isArray(team?.placements) ? team.placements : [];
  const occupiedSlotIds = new Set(placements.map((entry) => entry?.slotId).filter(Boolean));

  return (
    // Wrapper mesurable (measureInWindow) : c'est ce rectangle qui sert à calculer
    // où le doigt lâche le joueur pendant un drag.
    <View collapsable={false} onLayout={onFieldLayout} ref={fieldNodeRef} style={styles.fieldSurface}>
      <RenderedTacticalField sport={team?.sportContext || 'football'} style={styles.fieldFill}>
        {/* Postes vides = repères de la formation (cibles du mode « sur postes »). */}
        {slots.filter((slot) => !occupiedSlotIds.has(slot?.slotId)).map((slot) => (
          <TouchableOpacity
            accessibilityLabel={slot?.label || 'Poste'}
            activeOpacity={isReadOnly ? 1 : 0.82}
            disabled={isReadOnly}
            key={`slot-${slot?.slotId || slot?.slotKey}`}
            onPress={() => onPressSlot(team?.id, slot?.slotId)}
            style={[
              styles.slotGhost,
              {
                borderColor: `${Colors.neutral00}45`,
                left: `${clampPercent(slot?.positionX)}%`,
                top: `${clampPercent(slot?.positionY)}%`,
              },
            ]}
          >
            <Text numberOfLines={1} style={[Fonts.p4, { color: `${Colors.neutral00}CC`, textAlign: 'center' }]}>
              {slot?.label}
            </Text>
          </TouchableOpacity>
        ))}

        {/* Joueurs placés = rendus à LEUR position réelle (x/y), sur poste OU libre. */}
        {placements.map((placement) => {
          const player = playerMap.get(String(placement?.playerId || ''));
          if (!player) return null;
          const isSelectedPlayer = selectedPlayerId && String(selectedPlayerId) === String(placement?.playerId || '');

          const token = (
            <TouchableOpacity
              accessibilityLabel={getCompositionPlayerLabel(player)}
              activeOpacity={isReadOnly ? 1 : 0.82}
              disabled={isReadOnly}
              onPress={() => onPressPlacement(team?.id, placement?.playerId)}
              style={[
                styles.slotBubble,
                {
                  backgroundColor: `${Colors.primary500}D9`,
                  borderColor: isSelectedPlayer ? Colors.gold500 : Colors.primary100,
                  left: `${clampPercent(placement?.positionX)}%`,
                  top: `${clampPercent(placement?.positionY)}%`,
                },
              ]}
            >
              <Text numberOfLines={1} style={[Fonts.p4Bold, { color: Colors.neutral00, textAlign: 'center' }]}>
                {getCompositionPlayerInitials(player)}
              </Text>
              <Text numberOfLines={1} style={[Fonts.p4, { color: Colors.neutral00, opacity: 0.92, textAlign: 'center' }]}>
                {player?.number != null && player?.number !== '' ? `#${player.number}` : 'Attribue'}
              </Text>
            </TouchableOpacity>
          );

          if (isReadOnly || !makeDragGesture) {
            return <View key={`placed-${placement?.playerId}`}>{token}</View>;
          }
          return (
            <GestureDetector gesture={makeDragGesture(player, team?.id)} key={`placed-${placement?.playerId}`}>
              {token}
            </GestureDetector>
          );
        })}
      </RenderedTacticalField>
    </View>
  );
};

/**
 *
 * @param root0
 * @param root0.routeParams
 */
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
    aggregateBranches = EMPTY_PARAM_LIST,
    availablePresets: availablePresetsParam = EMPTY_PARAM_LIST,
    canEdit = false,
    compositionIntent = null,
    editorSourceLabel = null,
    eventId,
    eventKind = null,
    eventName = '',
    existingComposition = null,
    players = EMPTY_PARAM_LIST,
    readOnly = false,
    selectedPlayers = EMPTY_PARAM_LIST,
    sport = 'football',
    teamComposition = null,
    teamId,
    teamName = '',
  } = params;

  // D44 — un MATCH, c'est UNE equipe. Une DETECTION, c'est plusieurs equipes
  // qu'on peut faire remplir automatiquement : deux systemes differents.
  //
  // `eventKind` ('match' | 'detection') descend depuis EventDetails et arrivait
  // deja jusqu'ici — personne ne le lisait. Sans lui, la generation automatique
  // et l'ajout d'equipe s'affichaient des que `availablePresets` n'etait pas
  // vide, or cette liste ne parle QUE du sport (le football a 3 schemas). Tout
  // match de football montrait donc les commandes de la detection.
  //
  // TYPE INCONNU = ON NE RETIRE RIEN. On ne cache que sur un 'match' DIT. Une
  // commande de trop se voit et se corrige ; une commande absente enferme un
  // coach sans qu'il puisse rien y faire depuis l'ecran.
  const isSingleTeamEvent = eventKind === 'match';
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

  // D42 — la convocation deja enregistree, s'il y en a une.
  //
  // Le pack ne sait dire QUI est convoque que s'il a deja ete enregistre : ses
  // `reservePlayerIds` et ses placements sont alors la liste exacte. Un pack
  // vierge ne dit rien du tout -> personne n'est ecarte, tout le monde est
  // convoque, ce qui est le comportement d'avant ce lot.
  const initialExcludedPlayerIds = useMemo(() => {
    const packPlayerIds = new Set([
      ...(Array.isArray(initialPack?.reservePlayerIds) ? initialPack.reservePlayerIds : []),
      ...getAssignedPlayerIdsFromPack(initialPack),
    ]);
    if (packPlayerIds.size === 0) return new Set();

    return new Set(
      editablePlayers
        .map((player) => getCompositionPlayerId(player))
        .filter((playerId) => playerId && !packPlayerIds.has(playerId)),
    );
  }, [editablePlayers, initialPack]);

  const [draftPack, setDraftPack] = useState(initialPack);
  const [excludedPlayerIds, setExcludedPlayerIds] = useState(initialExcludedPlayerIds);
  const [compositionStep, setCompositionStep] = useState(STEP_PLAYERS);
  const [isManualPlayerModalVisible, setIsManualPlayerModalVisible] = useState(false);
  const [manualFirstname, setManualFirstname] = useState('');
  const [manualLastname, setManualLastname] = useState('');
  const [manualNumber, setManualNumber] = useState('');
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [subscriptionPaywallDecision, setSubscriptionPaywallDecision] = useState(null);
  const [autoTeamCount, setAutoTeamCount] = useState(Math.max(1, initialPack?.teams?.length || 1));
  const [autoPresetKeys, setAutoPresetKeys] = useState(
    syncPresetKeys(Math.max(1, initialPack?.teams?.length || 1), availablePresets, initialPack?.teams?.map((team) => team?.presetKey)),
  );
  // D44 : `isSingleTeamEvent` est teste ICI, a la source, et pas seulement sur le
  // bouton. Un appelant qui demanderait « auto » sur un match ouvrirait sinon un
  // panneau que plus rien ne permet de refermer.
  const [showAutoSetup, setShowAutoSetup] = useState(Boolean(
    !readOnly
      && canEdit
      && !isSingleTeamEvent
      && compositionIntent === 'auto'
      && !teamComposition?.draft,
  ));

  useEffect(() => {
    setDraftPack(initialPack);
  }, [initialPack]);

  useEffect(() => {
    setExcludedPlayerIds(initialExcludedPlayerIds);
  }, [initialExcludedPlayerIds]);

  useEffect(() => {
    const nextTeamCount = Math.max(1, initialPack?.teams?.length || 1);
    setAutoTeamCount(nextTeamCount);
    setAutoPresetKeys(syncPresetKeys(nextTeamCount, availablePresets, initialPack?.teams?.map((team) => team?.presetKey)));
  }, [availablePresets, initialPack]);

  useEffect(() => {
    setShowAutoSetup(Boolean(
      !readOnly
        && canEdit
        && !isSingleTeamEvent
        && compositionIntent === 'auto'
        && !teamComposition?.draft,
    ));
  }, [canEdit, compositionIntent, isSingleTeamEvent, readOnly, teamComposition?.draft]);

  // Tous les joueurs que l'ecran connait, convoques ou non : c'est la liste du
  // temps 1 (« Qui joue ? »).
  const knownPlayers = useMemo(
    () => Array.from(buildCompositionPlayerMap([
      ...editablePlayers,
      ...(Array.isArray(draftPack?.manualPlayers) ? draftPack.manualPlayers : []),
      ...(Array.isArray(draftPack?.reserveSnapshotPlayers) ? draftPack.reserveSnapshotPlayers : []),
    ]).values()).sort(byLabel),
    [draftPack?.manualPlayers, draftPack?.reserveSnapshotPlayers, editablePlayers],
  );
  // Les convoques. Tout l'aval (banc, terrain, charge envoyee au serveur) ne
  // travaille QUE sur eux : decocher un joueur au temps 1 le retire du banc, du
  // terrain, et de `reservePlayerIds` a l'enregistrement.
  const allPlayers = useMemo(
    () => knownPlayers.filter((player) => !excludedPlayerIds.has(getCompositionPlayerId(player))),
    [excludedPlayerIds, knownPlayers],
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

  // === TEMPS 1 — « Qui joue ? » : on convoque, on ecarte, on ajoute ===

  const toggleConvokedPlayer = useCallback((playerId) => {
    const targetPlayerId = String(playerId || '');
    if (readOnly || !targetPlayerId) return;

    const willBeExcluded = !excludedPlayerIds.has(targetPlayerId);
    setExcludedPlayerIds((current) => {
      const next = new Set(current);
      if (willBeExcluded) next.add(targetPlayerId);
      else next.delete(targetPlayerId);
      return next;
    });

    if (!willBeExcluded) return;

    // Un joueur ecarte quitte AUSSI le terrain : sinon son jeton resterait pose
    // alors qu'il ne fait plus partie de la composition.
    if (String(selectedPlayerId || '') === targetPlayerId) setSelectedPlayerId('');
    updateDraftPack((currentPack) => ({
      ...currentPack,
      reservePlayerIds: (Array.isArray(currentPack?.reservePlayerIds) ? currentPack.reservePlayerIds : [])
        .filter((entryId) => String(entryId || '') !== targetPlayerId),
      teams: detachPlayerEverywhere(Array.isArray(currentPack?.teams) ? currentPack.teams : [], targetPlayerId),
    }));
  }, [detachPlayerEverywhere, excludedPlayerIds, readOnly, selectedPlayerId, updateDraftPack]);

  const handleConvokeEveryone = useCallback(() => {
    if (readOnly) return;
    setExcludedPlayerIds(new Set());
  }, [readOnly]);

  const handleConvokeNobody = useCallback(() => {
    if (readOnly) return;
    setExcludedPlayerIds(new Set(
      knownPlayers.map((player) => getCompositionPlayerId(player)).filter(Boolean),
    ));
    setSelectedPlayerId('');
    updateDraftPack((currentPack) => ({
      ...currentPack,
      reservePlayerIds: [],
      teams: (Array.isArray(currentPack?.teams) ? currentPack.teams : [])
        .map((team) => ({ ...team, placements: [] })),
    }));
  }, [knownPlayers, readOnly, updateDraftPack]);

  const handleAddManualPlayer = useCallback(() => {
    const firstname = manualFirstname.trim();
    const lastname = manualLastname.trim();
    if (!firstname || !lastname) {
      showAlert('Erreur', 'Prénom et nom requis.');
      return;
    }

    // Meme forme que celle produite par TacticalSelection : un identifiant unique
    // partage par `id` et `documentId`, marque `isManual`. C'est exactement ce
    // que le serveur recoit deja par l'autre chemin, rien de neuf ne circule.
    const manualPlayerId = `manual_${Date.now()}`;
    updateDraftPack((currentPack) => ({
      ...currentPack,
      manualPlayers: [
        ...(Array.isArray(currentPack?.manualPlayers) ? currentPack.manualPlayers : []),
        {
          avatar: null,
          documentId: manualPlayerId,
          firstname,
          id: manualPlayerId,
          isManual: true,
          lastname,
          number: manualNumber.trim() || undefined,
        },
      ],
    }));
    setExcludedPlayerIds((current) => {
      const next = new Set(current);
      next.delete(manualPlayerId);
      return next;
    });
    setManualFirstname('');
    setManualLastname('');
    setManualNumber('');
    setIsManualPlayerModalVisible(false);
  }, [manualFirstname, manualLastname, manualNumber, updateDraftPack]);

  const handleGoToField = useCallback(() => setCompositionStep(STEP_FIELD), []);
  const handleGoToPlayers = useCallback(() => setCompositionStep(STEP_PLAYERS), []);
  const handleHeaderBack = useCallback(() => {
    // Au temps 2, la fleche de l'entete revient au temps 1 — elle ne quitte pas
    // l'ecran, sinon la selection de joueurs serait perdue par surprise.
    if (!readOnly && compositionStep === STEP_FIELD) {
      setCompositionStep(STEP_PLAYERS);
      return;
    }
    navigation.goBack();
  }, [compositionStep, navigation, readOnly]);

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

  // Taper un joueur déjà placé : on le « prend en main » (retiré du terrain, remis en
  // réserve) et on le sélectionne, prêt à être reposé sur un poste ou (bientôt) glissé.
  const handlePlacementPress = useCallback((targetTeamId, playerId) => {
    if (readOnly || !playerId) return;
    updateDraftPack((currentPack) => ({
      ...currentPack,
      teams: detachPlayerEverywhere(Array.isArray(currentPack?.teams) ? currentPack.teams : [], playerId),
    }));
    setSelectedPlayerId(String(playerId));
  }, [detachPlayerEverywhere, readOnly, updateDraftPack]);

  // === DRAG & DROP (glisser un joueur du banc ou du terrain vers un terrain) ===
  const ghostX = useSharedValue(0);
  const ghostY = useSharedValue(0);
  const ghostScale = useSharedValue(0);
  const ghostOpacity = useSharedValue(0);
  const [activeDragPlayer, setActiveDragPlayer] = useState(null);
  // Références natives des terrains (par équipe) + leurs rectangles mesurés en fenêtre.
  const fieldNodeRefs = useRef({});
  const fieldMeasuresRef = useRef({});

  const registerFieldNode = useCallback((teamEntryId) => (node) => {
    if (node) fieldNodeRefs.current[teamEntryId] = node;
    else delete fieldNodeRefs.current[teamEntryId];
  }, []);

  const measureField = useCallback((teamEntryId) => {
    const node = fieldNodeRefs.current[teamEntryId];
    if (!node?.measureInWindow) return;
    node.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) {
        fieldMeasuresRef.current[teamEntryId] = {
          height, width, x, y,
        };
      }
    });
  }, []);

  const measureAllFields = useCallback(() => {
    setTimeout(() => {
      Object.keys(fieldNodeRefs.current).forEach((teamEntryId) => measureField(teamEntryId));
    }, 60);
  }, [measureField]);

  // 🧵 T01 — la position de l'apercu ne passe PLUS par le fil JS.
  // Meme defaut, meme correctif que `matchCallUp/MatchCompositionBoard.js` : voir
  // le commentaire detaille la-bas. Ici le glissement est en plus interdit en
  // lecture seule, et cette garde reste posee des le worklet.
  const clearDragPlayer = useCallback(() => {
    setActiveDragPlayer(null);
  }, []);

  const beginDrag = useCallback((player) => {
    if (readOnly || !player) return;
    measureAllFields();
    Vibration.vibrate(8);
    setActiveDragPlayer(player);
  }, [measureAllFields, readOnly]);

  const dropPlayerOnTeam = useCallback((playerId, targetTeamEntryId, xPct, yPct) => {
    updateDraftPack((currentPack) => {
      const teams = Array.isArray(currentPack?.teams) ? currentPack.teams : [];
      const detached = detachPlayerEverywhere(teams, playerId);
      const useSlots = currentPack?.placementMode !== 'free';
      const nextTeams = detached.map((team) => {
        if (team?.id !== targetTeamEntryId) return team;
        const slots = Array.isArray(team?.slots) ? team.slots : [];
        const placements = Array.isArray(team?.placements) ? team.placements : [];
        const occupied = new Set(placements.map((entry) => entry?.slotId).filter(Boolean));

        // Mode « sur postes » : on accroche au poste libre le plus proche (dans le rayon).
        let snappedSlot = null;
        if (useSlots) {
          let bestDist = Infinity;
          slots.forEach((slot) => {
            if (occupied.has(slot?.slotId)) return;
            const dx = clampPercent(slot?.positionX) - xPct;
            const dy = clampPercent(slot?.positionY) - yPct;
            const dist = Math.sqrt((dx * dx) + (dy * dy));
            if (dist < bestDist) {
              bestDist = dist;
              snappedSlot = slot;
            }
          });
          if (!snappedSlot || bestDist > SNAP_RADIUS) snappedSlot = null;
        }

        const placement = snappedSlot
          ? {
            playerId: String(playerId),
            positionX: clampPercent(snappedSlot.positionX),
            positionY: clampPercent(snappedSlot.positionY),
            slotId: snappedSlot.slotId,
          }
          : {
            playerId: String(playerId),
            positionX: xPct,
            positionY: yPct,
            slotId: null,
          };
        return { ...team, placements: [...placements, placement] };
      });
      return { ...currentPack, teams: nextTeams };
    });
  }, [detachPlayerEverywhere, updateDraftPack]);

  const returnPlayerToReserve = useCallback((playerId) => {
    updateDraftPack((currentPack) => ({
      ...currentPack,
      teams: detachPlayerEverywhere(Array.isArray(currentPack?.teams) ? currentPack.teams : [], playerId),
    }));
  }, [detachPlayerEverywhere, updateDraftPack]);

  const endDrag = useCallback((player, source, pageX, pageY) => {
    if (readOnly || !player || typeof pageX !== 'number' || typeof pageY !== 'number') return;
    const playerId = getCompositionPlayerId(player);
    if (!playerId) return;

    // Sur quel terrain a-t-on lâché le joueur ?
    let targetTeamId = null;
    let targetRect = null;
    Object.entries(fieldMeasuresRef.current).forEach(([teamEntryId, rect]) => {
      if (!rect) return;
      const inside = pageX >= rect.x && pageX <= rect.x + rect.width
        && pageY >= rect.y && pageY <= rect.y + rect.height;
      if (inside) {
        targetTeamId = teamEntryId;
        targetRect = rect;
      }
    });

    if (targetTeamId && targetRect) {
      const xPct = Math.max(4, Math.min(96, ((pageX - targetRect.x) / targetRect.width) * 100));
      const yPct = Math.max(5, Math.min(95, ((pageY - targetRect.y) / targetRect.height) * 100));
      dropPlayerOnTeam(playerId, targetTeamId, xPct, yPct);
      return;
    }

    // Lâché hors de tout terrain : si le joueur venait d'un terrain, il retourne au banc.
    if (source !== 'reserve') returnPlayerToReserve(playerId);
  }, [dropPlayerOnTeam, readOnly, returnPlayerToReserve]);

  // Fabrique un geste de drag pour un joueur (source = id d'équipe ou 'reserve').
  const createDragGesture = useCallback((player, source) => Gesture.Pan()
    .activateAfterLongPress(120)
    .minDistance(6)
    .onStart((event) => {
      'worklet';

      if (readOnly) return;
      ghostX.value = event.absoluteX - (GHOST_TOKEN_SIZE.width / 2);
      ghostY.value = event.absoluteY - (GHOST_TOKEN_SIZE.height / 2);
      ghostScale.value = withSpring(1, DRAG_SPRING);
      ghostOpacity.value = withTiming(1, { duration: 90 });
      runOnJS(beginDrag)(player);
    })
    .onUpdate((event) => {
      'worklet';

      if (readOnly) return;
      ghostX.value = event.absoluteX - (GHOST_TOKEN_SIZE.width / 2);
      ghostY.value = event.absoluteY - (GHOST_TOKEN_SIZE.height / 2);
    })
    .onEnd((event) => {
      'worklet';

      runOnJS(endDrag)(player, source, event.absoluteX, event.absoluteY);
    })
    .onFinalize(() => {
      'worklet';

      ghostScale.value = withSpring(0, DRAG_SPRING);
      ghostOpacity.value = withTiming(0, { duration: 140 });
      runOnJS(clearDragPlayer)();
    }), [
    beginDrag,
    clearDragPlayer,
    endDrag,
    ghostOpacity,
    ghostScale,
    ghostX,
    ghostY,
    readOnly,
  ]);

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
        showAlert('Limite atteinte', `Tu peux créer jusqu'a ${MAX_COMPOSITION_TEAMS} équipes dans une même composition.`);
        return currentPack;
      }

      const nextIndex = getNextTeamIndex(currentTeams);
      const basePreset = availablePresets[currentTeams.length] || availablePresets[0] || null;
      return {
        ...currentPack,
        mode: 'manual',
        teams: [
          ...currentTeams,
          buildTeamEntryFromPreset(basePreset, nextIndex - 1, currentPack?.sportContext || sport, `Équipe ${nextIndex}`, `team_${nextIndex}`),
        ],
      };
    });
  }, [availablePresets, readOnly, sport, updateDraftPack]);

  const handleRemoveTeam = useCallback((teamIdToRemove) => {
    if (readOnly) return;

    const currentTeamCount = Array.isArray(draftPack?.teams) ? draftPack.teams.length : 0;
    if (currentTeamCount <= 1) {
      showAlert('Équipe requise', 'Il doit rester au moins une équipe dans cette composition.');
      return;
    }

    showAlert(
      'Supprimer cette équipe ?',
      'Les joueurs déjà places dans cette équipe repasseront automatiquement dans les remplaçants.',
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
      showAlert('Succès', 'Brouillon de composition enregistre.');
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
      showAlert('Succès', 'Composition d\'équipes publiée.', [
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
      // La generation REMPLACE tout le pack : on emmene le coach voir le
      // resultat sur le terrain, c'est la seule facon de le verifier.
      setCompositionStep(STEP_FIELD);
      await invalidateQueries();
      showAlert('Succès', 'Brouillon génère automatiquement. Tu peux maintenant ajuster les équipes à la main.');
    } catch (error) {
      const subscriptionDecision = extractSubscriptionDecisionFromError(error);
      if (subscriptionDecision) {
        setSubscriptionPaywallDecision(subscriptionDecision);
        return;
      }
      showAlert('Erreur', getErrorMessage(error, 'Impossible de générer cette composition automatiquement.'));
    } finally {
      setIsSaving(false);
    }
  }, [autoPresetKeys, autoTeamCount, availablePresets, eventId, invalidateQueries, sport, teamId]);

  const isPlayersStep = !readOnly && compositionStep === STEP_PLAYERS;
  const isFieldStep = readOnly || compositionStep === STEP_FIELD;
  // D44 : sur un match on n'OFFRE plus de fabriquer une deuxieme equipe. Mais si
  // la composition en compte deja plusieurs — enregistree avant ce lot, ou par
  // une detection convertie — on garde le bouton : sans lui, un coach qui en
  // retire une par megarde ne pourrait plus jamais la remettre.
  const canAddTeam = !isSingleTeamEvent
    || (Array.isArray(draftPack?.teams) ? draftPack.teams.length : 0) > 1;
  const headerTitle = readOnly
    ? 'Composition d\'équipes'
    : (isPlayersStep ? 'Qui joue ?' : 'Où ils jouent');
  const contextLabel = teamName || eventName || 'Evenement';
  const viewerBranchCount = resolvedReadOnlyBranches.length;
  const convokedCount = allPlayers.length;

  return (
    <GestureHandlerRootView style={styles.rootFlex}>
      <ImageBackground
        resizeMode="cover"
        source={Images.bg1}
        style={[Alignments.fill, { paddingTop: insets.top + 8 }]}
      >
        <View style={[styles.header, Spaces.paddingHorizontal[16]]}>
          <View style={styles.headerBackButtonContainer}>
            <HeaderBackButton onPress={handleHeaderBack} />
          </View>
          <View style={styles.headerCenter}>
            <Text style={[Fonts.h3Bold, Fonts.neutral00, styles.headerTitle]}>
              {headerTitle}
            </Text>
            <Text numberOfLines={1} style={[Fonts.p2, Fonts.primary100, styles.headerSubtitle]}>
              {contextLabel}
            </Text>
            <View style={styles.headerMetaRow}>
              {!readOnly ? (
                <View style={[styles.headerPill, { backgroundColor: `${Colors.gold500}18`, borderColor: `${Colors.gold500}55` }]}>
                  <Text style={[Fonts.p4Bold, { color: Colors.gold500 }]}>
                    {isPlayersStep ? 'Étape 1 sur 2' : 'Étape 2 sur 2'}
                  </Text>
                </View>
              ) : null}
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
                      Spaces.padding[16],
                      {
                        backgroundColor: Colors.primary900,
                        borderColor: `${Colors.primary500}44`,
                        borderWidth: 1,
                      },
                    ]}
                  >
                    <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Aucune composition publiée</Text>
                    <Text style={[Fonts.p2, Fonts.neutral300, { marginTop: 8 }]}>
                      Le coach n a pas encore publie de composition pour cet événement.
                    </Text>
                  </View>
                ) : null}

                {resolvedReadOnlyBranches.length > 0 ? (
                  <View
                    style={[
                      ApplicationStyle.card,
                      ApplicationStyle.borderRadius24,
                      Spaces.padding[16],
                      {
                        backgroundColor: Colors.primary900,
                        borderColor: `${Colors.primary500}30`,
                        borderWidth: 1,
                      },
                    ]}
                  >
                    <Text style={[Fonts.p3, Fonts.neutral300]}>
                      Les places encore libres restent visibles et seront complétées automatiquement quand de nouveaux joueurs acceptes arriveront.
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
                        Spaces.padding[16],
                        Spaces.gap[12],
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
                            : "Composition d'équipes publiée"}
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
                                <Text style={[Fonts.h4Bold, Fonts.neutral00]}>{team?.name || `Équipe ${teamIndex + 1}`}</Text>
                                <Text style={[Fonts.p4, Fonts.neutral300]}>
                                  {team?.presetLabel || 'Composition libre'}
                                </Text>
                              </View>
                              {isViewerTeam ? (
                                <View style={[styles.badge, { backgroundColor: `${Colors.primary500}24`, borderColor: `${Colors.primary500}55` }]}>
                                  <Text style={[Fonts.p4Bold, { color: Colors.primary500 }]}>Mon équipe</Text>
                                </View>
                              ) : null}
                            </View>

                            {renderFieldSlots({
                              Colors,
                              Fonts,
                              isReadOnly: true,
                              onPressPlacement: () => {},
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
                        <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Remplaçants / en attente</Text>
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
            ) : null}

            {isPlayersStep ? (
              <>
                <View
                  style={[
                    ApplicationStyle.card,
                    ApplicationStyle.borderRadius24,
                    Spaces.padding[16],
                    Spaces.gap[12],
                    {
                      backgroundColor: Colors.primary900,
                      borderColor: `${Colors.primary500}38`,
                      borderWidth: 1,
                    },
                  ]}
                >
                  <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Qui joue ?</Text>
                  <Text style={[Fonts.p2, Fonts.neutral300]}>
                    {showAutoSetup
                      ? "Choisis le nombre d'équipes et le preset de chacune, puis génère un brouillon."
                      : "Coche les joueurs que tu convoques. Tu les placeras sur le terrain à l'étape suivante."}
                  </Text>
                  <Text style={[Fonts.p3, Fonts.primary100]}>
                    {convokedCount}
                    {' joueur(s) convoqué(s) sur '}
                    {knownPlayers.length}
                  </Text>

                  <View style={[Alignments.row, { flexWrap: 'wrap' }, Spaces.gap[8]]}>
                    <Button
                      onPress={handleConvokeEveryone}
                      size="sm"
                      title="Tout sélectionner"
                      variant="Secondary"
                    />
                    <Button
                      onPress={handleConvokeNobody}
                      size="sm"
                      title="Effacer"
                      variant="Secondary"
                    />
                    <Button
                      onPress={() => setIsManualPlayerModalVisible(true)}
                      size="sm"
                      title="Ajouter un joueur"
                      variant="Secondary"
                    />
                    {availablePresets.length > 0 && !isSingleTeamEvent ? (
                      <Button
                        disabled={isPublishing || isSaving}
                        onPress={() => setShowAutoSetup((current) => !current)}
                        size="sm"
                        title={showAutoSetup ? 'Fermer auto' : 'Génération auto'}
                        variant="Secondary"
                      />
                    ) : null}
                  </View>
                </View>

                <View
                  style={[
                    ApplicationStyle.card,
                    ApplicationStyle.borderRadius24,
                    Spaces.padding[16],
                    Spaces.gap[12],
                    {
                      backgroundColor: Colors.primary900,
                      borderColor: `${Colors.neutral00}12`,
                      borderWidth: 1,
                    },
                  ]}
                >
                  <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Joueurs disponibles</Text>
                  {knownPlayers.length === 0 ? (
                    <Text style={[Fonts.p3, Fonts.neutral300]}>
                      Aucun joueur disponible pour le moment. Ajoute-les à la main avec « Ajouter un joueur », ou passe à la suite et laisse les postes libres.
                    </Text>
                  ) : (
                    <View style={Spaces.gap[8]}>
                      {knownPlayers.map((player) => {
                        const convocationPlayerId = getCompositionPlayerId(player);
                        const isConvoked = !excludedPlayerIds.has(convocationPlayerId);
                        return (
                          <TouchableOpacity
                            accessibilityLabel={getCompositionPlayerLabel(player)}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: isConvoked }}
                            activeOpacity={0.82}
                            key={convocationPlayerId}
                            onPress={() => toggleConvokedPlayer(convocationPlayerId)}
                            style={[
                              styles.listRow,
                              {
                                backgroundColor: isConvoked ? `${Colors.primary500}18` : Colors.neutral800,
                                borderColor: isConvoked ? `${Colors.primary500}66` : `${Colors.neutral00}12`,
                              },
                            ]}
                          >
                            <View
                              style={[
                                styles.convocationMark,
                                {
                                  backgroundColor: isConvoked ? Colors.primary500 : 'transparent',
                                  borderColor: isConvoked ? Colors.primary500 : Colors.neutral300,
                                },
                              ]}
                            >
                              <Text style={[Fonts.p4Bold, { color: Colors.primary900 }]}>
                                {isConvoked ? '✓' : ' '}
                              </Text>
                            </View>
                            <Text style={[Fonts.p3Bold, Fonts.neutral00, { flex: 1 }]}>
                              {getCompositionPlayerLabel(player)}
                            </Text>
                            <Text style={[Fonts.p4, { color: isConvoked ? Colors.primary100 : Colors.neutral300 }]}>
                              {isConvoked ? 'Convoqué' : 'Écarté'}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>

                {showAutoSetup ? (
                  <View
                    style={[
                      ApplicationStyle.card,
                      ApplicationStyle.borderRadius24,
                      Spaces.padding[16],
                      Spaces.gap[12],
                      {
                        backgroundColor: Colors.primary900,
                        borderColor: `${Colors.gold500}38`,
                        borderWidth: 1,
                      },
                    ]}
                  >
                    <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Génération automatique</Text>

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
                        <Text style={[Fonts.p4, Fonts.neutral300]}>équipes</Text>
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
                            <Text style={[Fonts.p3Bold, Fonts.neutral00]}>{`Équipe ${index + 1}`}</Text>
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
                      title="Générer le brouillon"
                      variant="Primary"
                    />
                  </View>
                ) : null}

                <Button
                  disabled={isPublishing || isSaving}
                  onPress={handleGoToField}
                  title="Suivant"
                  variant="Primary"
                />
              </>
            ) : null}

            {isFieldStep && !readOnly ? (
              <>
                <View
                  style={[
                    ApplicationStyle.card,
                    ApplicationStyle.borderRadius24,
                    Spaces.padding[16],
                    Spaces.gap[12],
                    {
                      backgroundColor: Colors.primary900,
                      borderColor: `${Colors.primary500}38`,
                      borderWidth: 1,
                    },
                  ]}
                >
                  <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Où ils jouent</Text>
                  <Text style={[Fonts.p2, Fonts.neutral300]}>
                    Fais glisser un joueur des remplaçants vers le terrain : appui long, puis tu le déposes où tu veux. Tu peux aussi le sélectionner puis toucher un poste.
                  </Text>
                  <Text style={[Fonts.p3, Fonts.neutral300]}>
                    Les postes encore libres peuvent rester vides: ils seront completes automatiquement quand de nouveaux joueurs acceptes arriveront.
                  </Text>

                  <View style={[Alignments.row, { flexWrap: 'wrap' }, Spaces.gap[8]]}>
                    <Button
                      disabled={isPublishing || isSaving}
                      onPress={handleGoToPlayers}
                      title="Retour"
                      variant="Secondary"
                    />
                    {canAddTeam ? (
                      <Button
                        disabled={isPublishing || isSaving}
                        onPress={handleAddTeam}
                        title="Ajouter une équipe"
                        variant="Secondary"
                      />
                    ) : null}
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
                  </View>
                </View>

                <View
                  style={[
                    ApplicationStyle.card,
                    ApplicationStyle.borderRadius24,
                    Spaces.padding[16],
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
                      <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Remplaçants / en attente</Text>
                      <Text style={[Fonts.p3, Fonts.neutral300]}>
                        {selectedPlayer
                          ? `${getCompositionPlayerLabel(selectedPlayer)} est sélectionné. Touche maintenant un poste pour l'affecter.`
                          : 'Touche un joueur pour le sélectionner, puis touche un poste sur une équipe.'}
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
                        ? 'Tous les joueurs sont déjà affectes a une équipe.'
                        : 'Aucun joueur disponible pour le moment. Tu peux quand même créer les équipes et laisser les postes libres.'}
                    </Text>
                  ) : (
                    <View style={styles.chipRow}>
                      {reservePlayers.map((player) => {
                        const playerId = getCompositionPlayerId(player);
                        const isSelected = String(selectedPlayerId || '') === String(playerId);
                        const chip = (
                          <TouchableOpacity
                            accessibilityLabel={getCompositionPlayerLabel(player)}
                            activeOpacity={0.82}
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
                              <Text style={[Fonts.p4, { color: isSelected ? Colors.primary100 : Colors.neutral300 }]}>
                                {player.participantSource === 'external_participant' ? 'Externe' : 'Equipe'}
                              </Text>
                            ) : null}
                          </TouchableOpacity>
                        );
                        return (
                          <GestureDetector gesture={createDragGesture(player, 'reserve')} key={playerId}>
                            {chip}
                          </GestureDetector>
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
                      Spaces.padding[16],
                      Spaces.gap[12],
                      {
                        backgroundColor: Colors.primary900,
                        borderColor: `${Colors.primary500}30`,
                        borderWidth: 1,
                      },
                    ]}
                  >
                    <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
                      <TextInput
                        onChangeText={(value) => handleRenameTeam(team?.id, value)}
                        placeholder={`Équipe ${teamIndex + 1}`}
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
                      fieldNodeRef: registerFieldNode(team?.id),
                      isReadOnly: false,
                      makeDragGesture: createDragGesture,
                      onFieldLayout: () => measureField(team?.id),
                      onPressPlacement: handlePlacementPress,
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
            ) : null}
          </View>
        </ScrollView>
        <Modal
          animationType="fade"
          onRequestClose={() => setIsManualPlayerModalVisible(false)}
          transparent
          visible={isManualPlayerModalVisible && !readOnly}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: Colors.neutral800 }]}>
              <Text style={[Fonts.h4Bold, Fonts.neutral00, styles.headerTitle]}>
                Ajouter un joueur
              </Text>
              <TextInput
                onChangeText={setManualFirstname}
                placeholder="Prénom *"
                placeholderTextColor={Colors.neutral300}
                style={[styles.modalInput, { backgroundColor: Colors.neutral900, borderColor: `${Colors.neutral00}12`, color: Colors.neutral00 }]}
                value={manualFirstname}
              />
              <TextInput
                onChangeText={setManualLastname}
                placeholder="Nom *"
                placeholderTextColor={Colors.neutral300}
                style={[styles.modalInput, { backgroundColor: Colors.neutral900, borderColor: `${Colors.neutral00}12`, color: Colors.neutral00 }]}
                value={manualLastname}
              />
              <TextInput
                keyboardType="number-pad"
                maxLength={2}
                onChangeText={setManualNumber}
                placeholder="Numéro (optionnel)"
                placeholderTextColor={Colors.neutral300}
                style={[styles.modalInput, { backgroundColor: Colors.neutral900, borderColor: `${Colors.neutral00}12`, color: Colors.neutral00 }]}
                value={manualNumber}
              />
              <View style={[Alignments.row, Spaces.gap[8]]}>
                <Button
                  onPress={() => setIsManualPlayerModalVisible(false)}
                  title="Annuler"
                  variant="Secondary"
                />
                <Button
                  onPress={handleAddManualPlayer}
                  title="Ajouter"
                  variant="Primary"
                />
              </View>
            </View>
          </View>
        </Modal>
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

      {/* Jeton fantôme qui suit le doigt pendant le drag (au-dessus de tout).
          🧨 T01 — le calque reste monté : né avec `activeDragPlayer`, il
          apparaissait au coin haut-gauche le temps que le fil JS réponde.
          🧨 V03 — ET IL NE BOUGE PLUS. Il portait la position sans déclarer
          AUCUNE dimension : un calque sans boîte ne donne aucun repère au jeton
          absolu qu'il contient. On reprend le motif de `TacticalBoard.js` —
          calque plein écran immobile, et le JETON qui porte la position. */}
      <View pointerEvents="none" style={styles.dragGhostLayer}>
        {activeDragPlayer ? (
          <DraggableToken
            isGhost
            opacity={ghostOpacity}
            player={activeDragPlayer}
            scale={ghostScale}
            translateX={ghostX}
            translateY={ghostY}
          />
        ) : null}
      </View>
    </GestureHandlerRootView>
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
  convocationMark: {
    alignItems: 'center',
    borderRadius: 7,
    borderWidth: 2,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  modalContent: {
    borderRadius: 20,
    gap: 12,
    maxWidth: 340,
    padding: 24,
    width: '100%',
  },
  modalInput: {
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  modalOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  fieldSurface: {
    alignSelf: 'stretch',
    borderRadius: 18,
    height: FIELD_HEIGHT,
    overflow: 'hidden',
    width: '100%',
  },
  fieldFill: {
    flex: 1,
  },
  rootFlex: {
    flex: 1,
  },
  dragGhostLayer: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 9999,
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
  slotGhost: {
    alignItems: 'center',
    borderRadius: 12,
    borderStyle: 'dashed',
    borderWidth: 1.2,
    height: FIELD_SLOT_HEIGHT - 8,
    justifyContent: 'center',
    marginLeft: -((FIELD_SLOT_WIDTH - 10) / 2),
    marginTop: -((FIELD_SLOT_HEIGHT - 8) / 2),
    paddingHorizontal: 6,
    position: 'absolute',
    width: FIELD_SLOT_WIDTH - 10,
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
