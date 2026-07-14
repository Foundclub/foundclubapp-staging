/* eslint-disable jsdoc/require-returns, max-len, no-console, no-nested-ternary, perfectionist/sort-objects, react/jsx-one-expression-per-line, react/no-unescaped-entities */
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
  Dimensions,
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import {
  Gesture, GestureDetector, GestureHandlerRootView, ScrollView,
} from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedRef,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useAuth from '@/domains/auth/useAuth';
import { emitGuidanceAction } from '@/domains/guidance/guidanceRuntime';
import { extractSubscriptionDecisionFromError } from '@/domains/subscription/subscriptionDecision';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import SubscriptionPaywallSheet from '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet';
import RenderedTacticalField from '@/components/tactical/RenderedTacticalField';

import { RouteNames } from '@/navigation/routeNames';

import {
  publishEventConvocation,
  saveEventCompositionDraft,
} from '@/services/event/eventService';
import {
  deleteTeamDefaultComposition,
  saveTeamDefaultComposition,
} from '@/services/team/teamService';

import {
  getTacticalFieldAspectRatio,
} from '@/utils/tacticalField';

import { useTour } from '@/context/TourContext';
// eslint-disable-next-line perfectionist/sort-imports
import DraggableToken from './DraggableToken';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

// Spring config
const SPRING_CONFIG = {
  damping: 18,
  mass: 0.8,
  stiffness: 200,
};

// Token dimensions (for precise centering)
const GHOST_TOKEN_WIDTH = 70;
const GHOST_TOKEN_HEIGHT = 88;
const FIELD_TOKEN_WIDTH = 58;
const FIELD_TOKEN_HEIGHT = 72;
const PANEL_COLLAPSED_HEIGHT = 64;
const PANEL_BENCH_HEIGHT = 276;

// Distance minimale (en % du terrain) entre un joueur auto-placé et un point occupé.
const GUIDED_AUTO_MIN_DISTANCE = 12;

/**
 * Positions automatiques (pourcentages terrain) pour la simulation guidée :
 * grille de lignes réparties de la défense à l'attaque, en évitant les points
 * déjà occupés (le board legacy n'a pas de structure de slots).
 * @param {number} count
 * @param {{ x: number; y: number }[]} occupied
 * @returns {{ x: number; y: number }[]}
 */
const buildGuidedAutoPositions = (count, occupied = []) => {
  if (count <= 0) return [];
  const perRow = 4;
  const rowCount = Math.max(2, Math.ceil((count + occupied.length) / perRow) + 1);
  const candidates = [];
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const y = 18 + ((rowIndex * 64) / (rowCount - 1));
    for (let columnIndex = 0; columnIndex < perRow; columnIndex += 1) {
      candidates.push({ x: 14 + ((columnIndex * 72) / (perRow - 1)), y });
    }
  }
  const freeCandidates = candidates.filter((candidate) => occupied.every((point) => (
    Math.hypot(candidate.x - point.x, candidate.y - point.y) >= GUIDED_AUTO_MIN_DISTANCE
  )));
  const pool = freeCandidates.length >= count ? freeCandidates : candidates;
  return pool.slice(0, count);
};

const normalizeMatchLabel = (value) => {
  const label = String(value || '').trim();
  if (!label) return '';

  const vsMatch = label.match(/\bVS\b.*$/i);
  if (vsMatch?.[0]) {
    return `Match ${vsMatch[0].trim()}`;
  }

  return label.replace(/^Match externe synchronisé.*?-\s*/i, 'Match ');
};

const serializeCompositionState = (payload, mode = 'event') => {
  const safePayload = payload || {};
  const placements = (Array.isArray(safePayload.placements) ? safePayload.placements : [])
    .map((placement) => ({
      playerId: String(placement?.playerId || '').trim(),
      positionX: Number(placement?.positionX ?? 0),
      positionY: Number(placement?.positionY ?? 0),
    }))
    .filter((placement) => placement.playerId)
    .sort((a, b) => a.playerId.localeCompare(b.playerId, 'fr'));

  const selectedPlayerIds = Array.from(
    new Set(
      (Array.isArray(safePayload.selectedPlayerIds) ? safePayload.selectedPlayerIds : [])
        .map((value) => String(value || '').trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b, 'fr'));

  if (mode === 'team-default') {
    return JSON.stringify({
      placements,
      selectedPlayerIds,
      sportContext: String(safePayload.sportContext || ''),
    });
  }

  const manualPlayers = (Array.isArray(safePayload.manualPlayers) ? safePayload.manualPlayers : [])
    .map((player) => ({
      firstname: String(player?.firstname || '').trim(),
      id: String(player?.documentId || player?.id || '').trim(),
      lastname: String(player?.lastname || '').trim(),
      number: String(player?.number || '').trim(),
    }))
    .filter((player) => player.id)
    .sort((a, b) => a.id.localeCompare(b.id, 'fr'));

  return JSON.stringify({
    manualPlayers,
    placements,
    selectedPlayerIds,
    sportContext: String(safePayload.sportContext || ''),
  });
};

/**
 * @typedef {import('./types').TacticalPlayer} TacticalPlayer
 * @typedef {import('./types').FieldPlayer} FieldPlayer
 */

/**
 * TacticalBoard V2 - Overlay pattern for reliable drag & drop
 */
function TacticalBoard() {
  const {
    Alignments, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const queryClient = useQueryClient();
  const { clubVerificationSummary, userData } = useAuth();
  const skipUnsavedPromptRef = useRef(false);

  // Get params
  /** @type {{selectedPlayers?: TacticalPlayer[], players?: any[], eventId?: string, eventName?: string, sport?: string, existingComposition?: any, teamId?: string, teamName?: string, readOnly?: boolean, canEdit?: boolean, manualPlayers?: any[], selectedPlayerIds?: string[], teamComposition?: any, teamDefaultComposition?: any, editorMode?: 'event' | 'team-default', editorSource?: string, editorSourceLabel?: string, eventKind?: 'match' | 'detection', eventTypeLabel?: string | null, simulationMode?: boolean}} */
  const params = route.params || {};
  const {
    canEdit = false,
    editorMode = 'event',
    editorSource = null,
    editorSourceLabel = null,
    eventId,
    eventKind = 'match',
    eventName = '',
    eventTypeLabel = null,
    existingComposition,
    manualPlayers = [],
    players = [],
    readOnly = false,
    selectedPlayers = [],
    selectedPlayerIds: selectedPlayerIdsParam = [],
    simulationMode = false,
    sport = 'football',
    teamDefaultComposition = null,
    teamComposition = null,
    teamId,
    teamName = '',
  } = params;
  const isTeamDefaultMode = editorMode === 'team-default';
  const isDetectionEvent = eventKind === 'detection';

  // === TOUR GUIDÉ (étape « Préparer une composition ») ===
  // Actif uniquement en simulation quand l'étape coach_composition est en cours.
  // Phase 'drag' : banc illuminé, l'utilisateur dépose un premier joueur ;
  // phase 'publish' : le reste du banc est auto-placé, bouton Publier illuminé.
  const { currentStep: tourCurrentStep } = useTour();
  const isGuidedComposition = Boolean(simulationMode && tourCurrentStep?.id === 'coach_composition');
  const [guidedPhase, setGuidedPhase] = useState(/** @type {'drag' | 'publish'} */ ('drag'));
  const showGuidedBenchHighlight = isGuidedComposition && guidedPhase === 'drag';
  const showGuidedPublishHighlight = isGuidedComposition && guidedPhase === 'publish';

  // Use poolPlayers for reconstruction (selectedPlayers from editor, players from viewer)
  const poolPlayers = useMemo(() => {
    const base = selectedPlayers.length > 0 ? selectedPlayers : players;
    // Include manual players from composition
    const manuals = existingComposition?.manualPlayers || manualPlayers || [];
    const baseIds = new Set(base.map((/** @type {TacticalPlayer} */ p) => p.id || p.documentId));
    const uniqueManuals = manuals.filter((/** @type {TacticalPlayer} */ m) => !baseIds.has(m.id || m.documentId));
    return [...base, ...uniqueManuals];
  }, [selectedPlayers, players, existingComposition, manualPlayers]);

  // DEBUG: Log reconstruction data
  // Initialize players from existing composition
  const { initialBenchPlayers, initialFieldPlayers } = useMemo(() => {
    if (existingComposition?.placements?.length) {
      // Build field players from composition with FULL player data
      const fieldFromCompo = existingComposition.placements
        .map((/** @type {{ playerId?: string; positionX?: number; positionY?: number }} */ p) => {
          const original = poolPlayers.find((sp) => (sp.id === p.playerId) || (sp.documentId === p.playerId));
          if (!original) return null;
          return {
            ...original,
            documentId: original.documentId || p.playerId,
            id: original.id || p.playerId,
            x: p.positionX,
            y: p.positionY,
          };
        })
        .filter((/** @type {FieldPlayer | null} */ p) => Boolean(p));

      // Players not in composition go to bench
      const placedIds = new Set(fieldFromCompo.map((/** @type {any} */ fp) => fp.id || fp.documentId));
      const benchFromCompo = poolPlayers.filter((/** @type {TacticalPlayer} */ p) => {
        const id = p.id || p.documentId;
        return !placedIds.has(id);
      });

      return {
        initialBenchPlayers: benchFromCompo,
        initialFieldPlayers: fieldFromCompo,
      };
    }

    // No existing composition - all players on bench
    return {
      initialBenchPlayers: poolPlayers,
      initialFieldPlayers: [],
    };
  }, [existingComposition, poolPlayers]);

  // Field ref using Reanimated for UI Thread measurements
  const fieldRef = useAnimatedRef();

  // Field dimensions in SharedValues for worklet access
  const fieldX = useSharedValue(0);
  const fieldY = useSharedValue(0);
  const fieldW = useSharedValue(300);
  const fieldH = useSharedValue(450);

  // Also keep React state for rendering positioned players
  const [fieldRect, setFieldRect] = useState({
    height: 450, width: 300, x: 0, y: 0,
  });

  // === STATE ===
  // Bench players (not placed on field)
  const [benchPlayers, setBenchPlayers] = useState(/** @type {TacticalPlayer[]} */ (initialBenchPlayers));

  // Field players (placed on field) - { id, x, y } where x,y are percentages
  const [fieldPlayers, setFieldPlayers] = useState(/** @type {FieldPlayer[]} */ (initialFieldPlayers));

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
  const [isPublishing, setIsPublishing] = useState(false);
  const [subscriptionPaywallDecision, setSubscriptionPaywallDecision] = useState(null);
  const [compositionMeta, setCompositionMeta] = useState(isTeamDefaultMode ? teamDefaultComposition : teamComposition);
  const [activePanel, setActivePanel] = useState(/** @type {'bench' | 'actions'} */ ('bench'));
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const panelHeight = useSharedValue(PANEL_COLLAPSED_HEIGHT);
  const panelDragStartHeight = useSharedValue(PANEL_COLLAPSED_HEIGHT);

  // Anneau lumineux pulsé du tour guidé (même pattern visuel que HomeActionCard).
  const guidedPulseOpacity = useSharedValue(0.35);
  useEffect(() => {
    if (!isGuidedComposition) return undefined;
    guidedPulseOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 700 }),
        withTiming(0.35, { duration: 700 }),
      ),
      -1,
      false,
    );
    return () => {
      cancelAnimation(guidedPulseOpacity);
      guidedPulseOpacity.value = 0.35;
    };
  }, [guidedPulseOpacity, isGuidedComposition]);
  const guidedPulseStyle = useAnimatedStyle(() => ({
    opacity: guidedPulseOpacity.value,
  }));

  // Tour guidé : ouvre automatiquement le panneau visé par la phase courante
  // (banc pour le premier drag, actions pour la publication simulée).
  useEffect(() => {
    if (!isGuidedComposition) return;
    setActivePanel(guidedPhase === 'publish' ? 'actions' : 'bench');
    setIsPanelOpen(true);
  }, [guidedPhase, isGuidedComposition]);

  // Sport specific
  const aspectRatio = getTacticalFieldAspectRatio(sport);

  // Calculate field dimensions - maximize space
  const fieldWidth = SCREEN_WIDTH - 28;
  let fieldHeightRatio = 0.76;
  if (readOnly) {
    fieldHeightRatio = 0.79;
  } else if (isTeamDefaultMode) {
    fieldHeightRatio = 0.77;
  }
  const fieldHeight = Math.min(
    fieldWidth * aspectRatio,
    SCREEN_HEIGHT * fieldHeightRatio,
  );

  const formatDateTime = useCallback(
    (value) => (value ? new Date(value).toLocaleString('fr-FR') : null),
    [],
  );

  let headerTitle = "Composition d'équipe";
  if (isTeamDefaultMode) {
    headerTitle = "Favori d'équipe";
  } else if (readOnly) {
    headerTitle = 'Composition publiée';
  }

  let headerModeLabel = 'Édition';
  if (isTeamDefaultMode) {
    headerModeLabel = "Favori d'équipe";
  } else if (readOnly) {
    headerModeLabel = 'Lecture seule';
  }

  const readableEventName = useMemo(() => normalizeMatchLabel(eventName), [eventName]);
  const contextTitle = teamName || readableEventName || 'Match';
  const contextSubtitle = teamName && readableEventName && teamName !== readableEventName
    ? readableEventName
    : null;

  const playersPlacedCount = fieldPlayers.length;
  const totalPlayersCount = fieldPlayers.length + benchPlayers.length;
  let primaryActionTitle = "Publier la composition d'equipe";
  if (isTeamDefaultMode) {
    primaryActionTitle = isSaving ? 'Enregistrement...' : 'Enregistrer le favori';
  } else if (isPublishing) {
    primaryActionTitle = 'Publication...';
  }

  const resolvedHeaderTitle = (() => {
    if (isTeamDefaultMode) return headerTitle;
    if (readOnly) {
      return isDetectionEvent ? "Composition d'equipe detection publiee" : headerTitle;
    }
    return isDetectionEvent ? "Composition d'equipe detection" : headerTitle;
  })();

  const resolvedHeaderModeLabel = isTeamDefaultMode
    ? headerModeLabel
    : readOnly
      ? headerModeLabel
      : 'Edition';

  const resolvedContextTitle = (() => {
    const explicitTypeLabel = String(eventTypeLabel || '').trim();
    if (teamName || readableEventName) {
      return contextTitle;
    }
    if (isDetectionEvent) {
      return explicitTypeLabel || 'Detection';
    }
    return contextTitle;
  })();

  const resolvedPrimaryActionTitle = (
    !isTeamDefaultMode && !isPublishing && isDetectionEvent
      ? "Publier la composition d'equipe detection"
      : primaryActionTitle
  );

  let actionsPanelHeight = 452;
  if (readOnly) {
    actionsPanelHeight = 222;
  } else if (isTeamDefaultMode) {
    actionsPanelHeight = 346;
  }

  const selectionSource = isTeamDefaultMode ? 'default_composition' : 'draft';
  const selectionSourceLabel = isTeamDefaultMode ? "Favori d'équipe" : 'Brouillon';
  const saveDraftLabel = isSaving ? 'Sauvegarde...' : 'Sauvegarder ce brouillon';
  const teamModelLabel = isTeamDefaultMode ? 'Enregistrer le favori' : 'Mettre cette composition en favori';

  const statusCard = useMemo(() => {
    if (isTeamDefaultMode) {
      if (compositionMeta?.composition?.updatedAt) {
        return {
          accent: Colors.primary500,
          eyebrow: 'Favori actif',
          lines: [
            `Dernière mise à jour le ${formatDateTime(compositionMeta.composition.updatedAt)}`,
            'Tu peux le réutiliser comme base sur les prochains matchs.',
          ],
          title: 'Composition favorite enregistrée',
        };
      }

      return {
        accent: Colors.primary300,
        eyebrow: 'Favori',
        lines: [
          'Place les joueurs sur le terrain puis enregistre ce favori pour repartir plus vite ensuite.',
        ],
        title: "Prépare un favori pour l'équipe",
      };
    }

    if (readOnly) {
      return {
        accent: Colors.primary500,
        eyebrow: `Publiée v${Number(compositionMeta?.published?.version || 1)}`,
        lines: [
          compositionMeta?.published?.publishedAt
            ? `Publication le ${formatDateTime(compositionMeta.published.publishedAt)}`
            : 'Cette version est celle visible par les joueurs.',
          canEdit
            ? 'Tu peux la modifier pour préparer une nouvelle version sans écraser immédiatement la version publiée.'
            : 'Les joueurs ne voient jamais les brouillons intermédiaires.',
        ].filter(Boolean),
        title: 'Composition actuellement publiée',
      };
    }

    if (compositionMeta?.draft?.updatedAt && compositionMeta?.published?.publishedAt) {
      return {
        accent: Colors.primary500,
        eyebrow: 'Brouillon en cours',
        lines: [
          `Dernière sauvegarde le ${formatDateTime(compositionMeta.draft.updatedAt)}`,
          `Version visible: v${Number(compositionMeta?.published?.version || 1)} publiée le ${formatDateTime(compositionMeta.published.publishedAt)}`,
        ],
        title: "Des changements attendent d'être publiés",
      };
    }

    if (compositionMeta?.draft?.updatedAt) {
      return {
        accent: Colors.primary300,
        eyebrow: 'Brouillon',
        lines: [
          `Dernière sauvegarde le ${formatDateTime(compositionMeta.draft.updatedAt)}`,
          "Publie quand la composition est prête pour l'équipe.",
        ],
        title: 'Brouillon enregistré',
      };
    }

    if (compositionMeta?.published?.publishedAt) {
      return {
        accent: Colors.primary500,
        eyebrow: `Publiée v${Number(compositionMeta?.published?.version || 1)}`,
        lines: [
          `Publication le ${formatDateTime(compositionMeta.published.publishedAt)}`,
          'Tu peux repartir de cette version pour préparer la suite.',
        ],
        title: 'Une version est déjà publiée',
      };
    }

    return {
      accent: Colors.primary300,
      eyebrow: 'Nouvelle composition',
      lines: [
        'Place les joueurs sur le terrain, complète le banc puis enregistre ou publie quand tout est prêt.',
      ],
      title: 'Commence par organiser ton équipe',
    };
  }, [Colors.primary300, Colors.primary500, canEdit, compositionMeta, formatDateTime, isTeamDefaultMode, readOnly]);

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
            setFieldRect({
              height, width, x, y,
            });
          }
        });
      } catch (e) {
        console.warn('[TacticalBoard] Measure failed:', e);
      }
    }, 100);
  }, [fieldRef, fieldX, fieldY, fieldW, fieldH]);

  // Get player by ID from pool (includes team players + manual players)
  const getPlayerById = useCallback((/** @type {string} */ id) => poolPlayers.find((p) => (p.id || p.documentId) === id), [poolPlayers]);

  // Tour guidé : après le premier dépôt manuel, place automatiquement le reste
  // du banc sur des positions libres puis passe à la phase « publication ».
  const autoPlaceRemainingBenchPlayers = useCallback((/** @type {string} */ droppedPlayerId, /** @type {{ x: number; y: number }} */ droppedPosition) => {
    const remainingPlayers = benchPlayers.filter((player) => (player.id || player.documentId) !== droppedPlayerId);
    if (remainingPlayers.length > 0) {
      const autoPositions = buildGuidedAutoPositions(remainingPlayers.length, [droppedPosition]);
      setFieldPlayers((/** @type {FieldPlayer[]} */ prev) => {
        const placedIds = new Set(prev.map((player) => player.id || player.documentId));
        const additions = remainingPlayers
          .filter((player) => !placedIds.has(player.id || player.documentId))
          .map((player, index) => ({
            ...player,
            id: player.id || player.documentId,
            x: autoPositions[index]?.x ?? 50,
            y: autoPositions[index]?.y ?? 50,
          }));
        return [...prev, ...additions];
      });
      setBenchPlayers([]);
    }
    setGuidedPhase('publish');
  }, [benchPlayers]);

  // === DRAG HANDLERS ===

  // Start drag from bench
  const startDragFromBench = useCallback((/** @type {TacticalPlayer | undefined} */ player, /** @type {number | undefined} */ pageX, /** @type {number | undefined} */ pageY) => {
    if (!player || typeof pageX !== 'number' || typeof pageY !== 'number') return;
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
  const startDragFromField = useCallback((/** @type {string | undefined} */ playerId, /** @type {number | undefined} */ pageX, /** @type {number | undefined} */ pageY) => {
    if (!playerId || typeof pageX !== 'number' || typeof pageY !== 'number') return;
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
  const updateDragPosition = useCallback((/** @type {number | undefined} */ pageX, /** @type {number | undefined} */ pageY) => {
    if (typeof pageX !== 'number' || typeof pageY !== 'number') return;
    ghostX.value = pageX - GHOST_TOKEN_WIDTH / 2;
    ghostY.value = pageY - GHOST_TOKEN_HEIGHT / 2;
  }, [ghostX, ghostY]);

  // End drag - use SharedValues for precise coordinates
  const endDrag = useCallback((/** @type {number | undefined} */ pageX, /** @type {number | undefined} */ pageY) => {
    if (!activeDragPlayer || typeof pageX !== 'number' || typeof pageY !== 'number') return;

    const playerId = activeDragPlayer.id || activeDragPlayer.documentId || '';

    // Use current SharedValue values for precision
    const fx = fieldX.value;
    const fy = fieldY.value;
    const fw = fieldW.value;
    const fh = fieldH.value;

    // Check if dropped on field
    const isOnField = (
      pageX >= fx
      && pageX <= fx + fw
      && pageY >= fy
      && pageY <= fy + fh
    );

    if (isOnField) {
      // Simple: store finger position as percentage (no offsets)
      const posX = ((pageX - fx) / fw) * 100;
      const posY = ((pageY - fy) / fh) * 100;

      // Clamp to valid range
      const clampedX = Math.max(5, Math.min(95, posX));
      const clampedY = Math.max(5, Math.min(95, posY));

      // Update field players - store full player data with coordinates
      setFieldPlayers((/** @type {FieldPlayer[]} */ prev) => {
        const filtered = prev.filter((/** @type {FieldPlayer} */ p) => (p.id || p.documentId) !== playerId);
        // Get full player data
        const fullPlayer = getPlayerById(playerId) || activeDragPlayer;
        if (!fullPlayer) return prev;
        return [...filtered, {
          ...fullPlayer, id: playerId, x: clampedX, y: clampedY,
        }];
      });

      // Remove from bench if coming from bench
      if (dragSource === 'bench') {
        setBenchPlayers((/** @type {TacticalPlayer[]} */ prev) => prev.filter((p) => (p.id || p.documentId) !== playerId));

        // Tour guidé : le premier dépôt déclenche l'auto-placement du reste du banc.
        if (isGuidedComposition && guidedPhase === 'drag') {
          autoPlaceRemainingBenchPlayers(playerId, { x: clampedX, y: clampedY });
        }
      }
    } else if (dragSource === 'field') {
      // Dropped outside field - return to bench
      setFieldPlayers((/** @type {FieldPlayer[]} */ prev) => prev.filter((p) => p.id !== playerId));
      setBenchPlayers((/** @type {TacticalPlayer[]} */ prev) => {
        // Check if already in bench
        const exists = prev.some((p) => (p.id || p.documentId) === playerId);
        if (exists) return prev;
        const player = getPlayerById(playerId);
        return player ? [...prev, player] : prev;
      });
      // If from bench and dropped outside, do nothing (player stays in bench)
    }

    // Reset drag state
    ghostScale.value = withSpring(0, SPRING_CONFIG);
    ghostOpacity.value = withTiming(0, { duration: 150 });
    dropZoneActive.value = 0;
    setActiveDragPlayer(null);
    setDragSource(null);
  }, [activeDragPlayer, autoPlaceRemainingBenchPlayers, dragSource, getPlayerById, guidedPhase, isGuidedComposition, fieldX, fieldY, fieldW, fieldH, ghostScale, ghostOpacity, dropZoneActive]);

  // === GESTURE HANDLERS ===

  // Create pan gesture for bench player
  const createBenchPanGesture = useCallback((/** @type {TacticalPlayer} */ player) => Gesture.Pan()
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
    }), [startDragFromBench, updateDragPosition, endDrag]);

  // Create pan gesture for field player
  const createFieldPanGesture = useCallback((/** @type {string} */ playerId) => Gesture.Pan()
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
    }), [startDragFromField, updateDragPosition, endDrag]);
  const invalidateCompositionQueries = useCallback(() => {
    if (!eventId) return;
    queryClient.invalidateQueries({ queryKey: ['event', eventId] });
    queryClient.invalidateQueries({ queryKey: ['eventComposition', eventId] });
    queryClient.invalidateQueries({ queryKey: ['eventConvocation', eventId] });
  }, [eventId, queryClient]);

  const getCompositionErrorMessage = useCallback((error, fallbackMessage) => {
    const status = error?.response?.status || error?.status;
    const apiMessage = error?.response?.data?.error?.message
      || error?.response?.data?.message
      || error?.message;

    if (status === 403) {
      return "Vous n'êtes pas autorisé à gérer la composition pour cette équipe.";
    }

    if (typeof apiMessage === 'string' && apiMessage.trim()) {
      return apiMessage.trim();
    }

    return fallbackMessage;
  }, []);

  const buildDraftPayload = useCallback(() => {
    const allCurrentPlayers = [...fieldPlayers, ...benchPlayers];
    const extractedManualPlayers = allCurrentPlayers
      .filter((/** @type {TacticalPlayer | FieldPlayer} */ p) => p.isManual || (p.id && String(p.id).startsWith('manual_')) || (p.documentId && String(p.documentId).startsWith('manual_')))
      .map((/** @type {TacticalPlayer | FieldPlayer} */ p) => {
        const resolvedId = p.documentId || p.id;
        return {
          avatar: p.avatar || null,
          documentId: resolvedId,
          firstname: p.firstname,
          id: resolvedId,
          isManual: true,
          lastname: p.lastname,
          number: p.number,
        };
      });

    const placements = fieldPlayers.map((/** @type {FieldPlayer} */ fp) => ({
      playerId: fp.documentId || fp.id,
      positionX: fp.x,
      positionY: fp.y,
    }));

    const selectedPlayerIds = Array.from(
      new Set([
        ...allCurrentPlayers.map((p) => p.documentId || p.id).filter(Boolean),
        ...selectedPlayerIdsParam,
      ].map((value) => String(value))),
    );

    return {
      manualPlayers: extractedManualPlayers,
      placements,
      selectedPlayerIds,
      sportContext: sport,
    };
  }, [benchPlayers, fieldPlayers, selectedPlayerIdsParam, sport]);

  const buildTemplatePayload = useCallback(() => {
    const teamPlayerIds = new Set(
      poolPlayers
        .filter((player) => !(player?.isManual || String(player?.id || player?.documentId || '').startsWith('manual_')))
        .map((player) => String(player?.documentId || player?.id || '').trim())
        .filter(Boolean),
    );

    const placements = fieldPlayers
      .filter((player) => teamPlayerIds.has(String(player?.documentId || player?.id || '').trim()))
      .map((player) => ({
        playerId: player.documentId || player.id,
        positionX: player.x,
        positionY: player.y,
      }));

    const selectedPlayerIds = Array.from(new Set([
      ...benchPlayers
        .filter((player) => teamPlayerIds.has(String(player?.documentId || player?.id || '').trim()))
        .map((player) => String(player.documentId || player.id)),
      ...placements.map((placement) => String(placement.playerId || '')),
    ].filter(Boolean)));

    return {
      placements,
      selectedPlayerIds,
      sportContext: sport,
    };
  }, [benchPlayers, fieldPlayers, poolPlayers, sport]);

  const savedComparableState = useMemo(() => {
    if (readOnly) return null;

    if (isTeamDefaultMode) {
      return serializeCompositionState(
        compositionMeta?.composition || teamDefaultComposition?.composition || existingComposition || null,
        'team-default',
      );
    }

    return serializeCompositionState(
      compositionMeta?.draft || existingComposition || null,
      'event',
    );
  }, [
    compositionMeta?.composition,
    compositionMeta?.draft,
    existingComposition,
    isTeamDefaultMode,
    readOnly,
    teamDefaultComposition?.composition,
  ]);

  const currentComparableState = useMemo(
    () => serializeCompositionState(
      isTeamDefaultMode ? buildTemplatePayload() : buildDraftPayload(),
      isTeamDefaultMode ? 'team-default' : 'event',
    ),
    [buildDraftPayload, buildTemplatePayload, isTeamDefaultMode],
  );

  const hasUnsavedChanges = useMemo(
    () => !readOnly && currentComparableState !== savedComparableState,
    [currentComparableState, readOnly, savedComparableState],
  );

  const openSelectionEditor = useCallback((source = editorSource, sourceLabel = editorSourceLabel) => {
    // @ts-ignore
    navigation.navigate(RouteNames.TacticalSelectionV2, {
      bootstrapComposition: null,
      editorMode,
      editorSource: source || null,
      editorSourceLabel: sourceLabel || null,
      eventId,
      eventKind,
      eventName,
      eventTypeLabel,
      existingComposition: buildDraftPayload(),
      players: poolPlayers,
      sport,
      teamId,
      teamName,
    });
  }, [
    buildDraftPayload,
    editorMode,
    eventKind,
    editorSource,
    editorSourceLabel,
    eventId,
    eventName,
    eventTypeLabel,
    navigation,
    poolPlayers,
    sport,
    teamId,
    teamName,
  ]);

  const openBoardEditorFromCurrentState = useCallback((source = 'draft', sourceLabel = 'Brouillon') => {
    // @ts-ignore
    navigation.navigate(RouteNames.TacticalBoardV2, {
      canEdit: false,
      editorMode,
      editorSource: source,
      editorSourceLabel: sourceLabel,
      eventId,
      eventKind,
      eventName,
      eventTypeLabel,
      existingComposition: buildDraftPayload(),
      players: poolPlayers,
      readOnly: false,
      sport,
      teamComposition: compositionMeta || null,
      teamId,
      teamName,
    });
  }, [
    buildDraftPayload,
    compositionMeta,
    editorMode,
    eventKind,
    eventId,
    eventName,
    eventTypeLabel,
    navigation,
    poolPlayers,
    sport,
    teamId,
    teamName,
  ]);

  // En mode apercu (simulation guidee), aucune ecriture serveur: on informe simplement l'utilisateur.
  const notifySimulationAction = useCallback(() => {
    Alert.alert(
      'Mode apercu',
      'Ceci est un apercu — publie tes vraies compos depuis un evenement.',
    );
  }, []);

  const handleSave = useCallback(async (options = {}) => {
    if (simulationMode) {
      notifySimulationAction();
      return false;
    }
    const normalizedOptions = options && typeof options === 'object' && !('nativeEvent' in options) ? options : {};
    const { showSuccess = true } = normalizedOptions;

    setIsSaving(true);
    try {
      if (isTeamDefaultMode) {
        if (!teamId) {
          Alert.alert('Erreur', "Impossible d'identifier l'équipe concernée.");
          return false;
        }

        const response = await saveTeamDefaultComposition(teamId, {
          composition: buildTemplatePayload(),
        });
        setCompositionMeta(response || null);
        queryClient.invalidateQueries({ queryKey: ['teamDefaultComposition', teamId] });
        queryClient.invalidateQueries({ queryKey: ['team', teamId] });
        if (showSuccess) {
          Alert.alert('Succès', 'Composition favorite enregistrée.');
        }
        return true;
      }

      if (!eventId || !teamId) {
        Alert.alert('Erreur', "Impossible d'identifier l'équipe ou l'événement concerné.");
        return false;
      }

      const draftPayload = buildDraftPayload();
      const response = await saveEventCompositionDraft(eventId, {
        draft: draftPayload,
        teamId,
      });
      setCompositionMeta(response || null);
      invalidateCompositionQueries();
      if (showSuccess) {
        Alert.alert('Succès', 'Brouillon enregistré.');
      }
      return true;
    } catch (error) {
      const subscriptionDecision = extractSubscriptionDecisionFromError(error);
      if (subscriptionDecision) {
        setSubscriptionPaywallDecision(subscriptionDecision);
        return false;
      }
      console.error('Save draft error:', error);
      Alert.alert('Erreur', getCompositionErrorMessage(error, "Impossible d'enregistrer le brouillon."));
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [
    buildDraftPayload,
    buildTemplatePayload,
    eventId,
    getCompositionErrorMessage,
    invalidateCompositionQueries,
    isTeamDefaultMode,
    notifySimulationAction,
    queryClient,
    simulationMode,
    teamId,
  ]);

  const confirmExitWithUnsavedChanges = useCallback((onDiscard) => {
    const saveLabel = isTeamDefaultMode ? 'Enregistrer le favori' : 'Sauvegarder le brouillon';
    const message = isTeamDefaultMode
      ? "Tu as des modifications non enregistrées sur le favori d'équipe. Tu peux l'enregistrer avant de quitter, ou fermer sans enregistrer."
      : 'Tu as des modifications non enregistrées sur cette composition. Tu peux sauvegarder le brouillon avant de quitter, ou fermer sans enregistrer.';

    Alert.alert(
      'Quitter sans enregistrer ?',
      message,
      [
        { style: 'cancel', text: 'Annuler' },
        {
          onPress: onDiscard,
          style: 'destructive',
          text: 'Quitter sans enregistrer',
        },
        {
          onPress: async () => {
            const didSave = await handleSave({ showSuccess: false });
            if (didSave) {
              onDiscard();
            }
          },
          text: saveLabel,
        },
      ],
    );
  }, [handleSave, isTeamDefaultMode]);

  const leaveWithoutUnsavedPrompt = useCallback((action) => {
    skipUnsavedPromptRef.current = true;
    navigation.dispatch(action);
  }, [navigation]);

  const handlePublish = useCallback(async () => {
    if (simulationMode) {
      // Signal métier pour le tour guidé (étape coach_composition) : la
      // publication reste simulée, rien n'est écrit côté serveur.
      emitGuidanceAction('composition.simulated.published');
      notifySimulationAction();
      return;
    }

    if (isTeamDefaultMode) {
      return;
    }

    if (!eventId || !teamId) {
      Alert.alert('Erreur', "Impossible d'identifier l'équipe ou l'événement concerné.");
      return;
    }

    setIsPublishing(true);
    try {
      const draftPayload = buildDraftPayload();
      const latestDraft = await saveEventCompositionDraft(eventId, {
        draft: draftPayload,
        teamId,
      });
      const published = await publishEventConvocation(eventId, { teamId });
      setCompositionMeta({
        ...(latestDraft || {}),
        ...(published || {}),
      });
      invalidateCompositionQueries();
      Alert.alert('Succès', "Composition d'equipe publiee.", [
        { onPress: () => /** @type {any} */ (navigation).navigate(RouteNames.EventDetails, { eventId }), text: 'OK' },
      ]);
    } catch (error) {
      const subscriptionDecision = extractSubscriptionDecisionFromError(error);
      if (subscriptionDecision) {
        setSubscriptionPaywallDecision(subscriptionDecision);
        return;
      }
      console.error('Publish convocation error:', error);
      Alert.alert('Erreur', getCompositionErrorMessage(error, "Impossible de publier la composition d'equipe."));
    } finally {
      setIsPublishing(false);
    }
  }, [buildDraftPayload, eventId, getCompositionErrorMessage, invalidateCompositionQueries, isTeamDefaultMode, navigation, notifySimulationAction, simulationMode, teamId]);

  const handleSaveAsTeamDefault = useCallback(async () => {
    if (!teamId) {
      Alert.alert('Erreur', "Impossible d'identifier l'équipe.");
      return;
    }

    setIsSaving(true);
    try {
      const response = await saveTeamDefaultComposition(teamId, {
        composition: buildTemplatePayload(),
      });
      if (isTeamDefaultMode) {
        setCompositionMeta(response || null);
      }
      queryClient.invalidateQueries({ queryKey: ['teamDefaultComposition', teamId] });
      queryClient.invalidateQueries({ queryKey: ['team', teamId] });
      Alert.alert('Succès', "Cette composition a été enregistrée comme favori d'équipe.");
    } catch (error) {
      Alert.alert('Erreur', getCompositionErrorMessage(error, "Impossible d'enregistrer le favori d'équipe."));
    } finally {
      setIsSaving(false);
    }
  }, [buildTemplatePayload, getCompositionErrorMessage, isTeamDefaultMode, queryClient, teamId]);

  const handleDeleteTeamDefault = useCallback(async () => {
    if (!teamId) {
      Alert.alert('Erreur', "Impossible d'identifier l'équipe.");
      return;
    }

    Alert.alert(
      'Retirer le favori',
      "Cette action retire le favori d'équipe.",
      [
        { style: 'cancel', text: 'Annuler' },
        {
          onPress: async () => {
            try {
              const response = await deleteTeamDefaultComposition(teamId);
              setCompositionMeta(response || null);
              setFieldPlayers([]);
              setBenchPlayers(poolPlayers.filter((player) => !(player?.isManual || String(player?.id || player?.documentId || '').startsWith('manual_'))));
              queryClient.invalidateQueries({ queryKey: ['teamDefaultComposition', teamId] });
              queryClient.invalidateQueries({ queryKey: ['team', teamId] });
              Alert.alert('Succès', "Favori d'équipe supprimé.");
            } catch (error) {
              Alert.alert('Erreur', getCompositionErrorMessage(error, "Impossible de supprimer le favori d'équipe."));
            }
          },
          style: 'destructive',
          text: 'Supprimer',
        },
      ],
    );
  }, [getCompositionErrorMessage, poolPlayers, queryClient, teamId]);

  // === ANIMATED STYLES ===
  const dropZoneStyle = useAnimatedStyle(() => {
    'worklet';

    return {
      opacity: withTiming(dropZoneActive.value ? 0.4 : 0, { duration: 200 }),
    };
  });

  useEffect(() => {
    let nextHeight = PANEL_COLLAPSED_HEIGHT;
    if (isPanelOpen && activePanel === 'bench') {
      nextHeight = PANEL_BENCH_HEIGHT;
    } else if (isPanelOpen && activePanel === 'actions') {
      nextHeight = actionsPanelHeight;
    }

    panelHeight.value = withTiming(nextHeight, { duration: 220 });
  }, [activePanel, actionsPanelHeight, isPanelOpen, panelHeight]);

  const panelAnimatedStyle = useAnimatedStyle(() => ({
    height: panelHeight.value,
  }));

  const openPanel = useCallback((panel) => {
    setActivePanel(panel);
    setIsPanelOpen(true);
  }, []);

  const togglePanel = useCallback((panel) => {
    setActivePanel((current) => {
      if (current === panel) {
        setIsPanelOpen((wasOpen) => !wasOpen);
        return current;
      }

      setIsPanelOpen(true);
      return panel;
    });
  }, []);

  const closePanel = useCallback(() => {
    setIsPanelOpen(false);
  }, []);

  useEffect(() => navigation.addListener('beforeRemove', (event) => {
    if (skipUnsavedPromptRef.current || simulationMode || !hasUnsavedChanges || isSaving || isPublishing) {
      return;
    }

    event.preventDefault();
    confirmExitWithUnsavedChanges(() => leaveWithoutUnsavedPrompt(event.data.action));
  }), [confirmExitWithUnsavedChanges, hasUnsavedChanges, isPublishing, isSaving, leaveWithoutUnsavedPrompt, navigation, simulationMode]);

  const panelPanGesture = useMemo(
    () => Gesture.Pan()
      .activeOffsetY([-8, 8])
      .failOffsetX([-24, 24])
      .onBegin(() => {
        panelDragStartHeight.value = panelHeight.value;
      })
      .onUpdate((gestureEvent) => {
        const maxHeight = Math.max(PANEL_BENCH_HEIGHT, actionsPanelHeight);
        const nextHeight = panelDragStartHeight.value - gestureEvent.translationY;
        const clampedHeight = Math.max(PANEL_COLLAPSED_HEIGHT, Math.min(maxHeight, nextHeight));
        panelHeight.value = clampedHeight;
      })
      .onEnd(() => {
        const currentHeight = panelHeight.value;
        const collapsedDistance = Math.abs(currentHeight - PANEL_COLLAPSED_HEIGHT);
        const benchDistance = Math.abs(currentHeight - PANEL_BENCH_HEIGHT);
        const actionsDistance = Math.abs(currentHeight - actionsPanelHeight);

        let nextPanel = activePanel;
        let targetHeight = PANEL_COLLAPSED_HEIGHT;
        let shouldOpen = false;

        if (benchDistance <= collapsedDistance && benchDistance <= actionsDistance) {
          nextPanel = 'bench';
          targetHeight = PANEL_BENCH_HEIGHT;
          shouldOpen = true;
        } else if (actionsDistance <= collapsedDistance && actionsDistance <= benchDistance) {
          nextPanel = 'actions';
          targetHeight = actionsPanelHeight;
          shouldOpen = true;
        }

        panelHeight.value = withSpring(targetHeight, SPRING_CONFIG);
        runOnJS(setActivePanel)(nextPanel);
        runOnJS(setIsPanelOpen)(shouldOpen);
      }),
    [activePanel, actionsPanelHeight, panelDragStartHeight, panelHeight],
  );

  return (
    <GestureHandlerRootView style={Alignments.fill}>
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
              {resolvedHeaderTitle}
            </Text>
            <Text numberOfLines={1} style={[Fonts.p2, Fonts.primary100, styles.headerSubtitle]}>
              {resolvedContextTitle}
            </Text>
            {contextSubtitle ? (
              <Text numberOfLines={1} style={[Fonts.p3, { color: Colors.neutral300 }, styles.headerCaption]}>
                {contextSubtitle}
              </Text>
            ) : null}
            <View style={styles.headerMetaRow}>
              <View style={[styles.headerPill, { backgroundColor: `${Colors.primary500}18`, borderColor: `${Colors.primary500}55` }]}>
                <Text style={[Fonts.p4Bold, { color: Colors.primary500 }]}>
                  {resolvedHeaderModeLabel}
                </Text>
              </View>
              <View style={[styles.headerPill, { backgroundColor: `${Colors.primary300}16`, borderColor: `${Colors.primary300}40` }]}>
                <Text style={[Fonts.p4Bold, { color: Colors.primary100 }]}>
                  {playersPlacedCount}
                  /
                  {totalPlayersCount}
                  {' '}
                  placés
                </Text>
              </View>
              {editorSourceLabel ? (
                <View style={[styles.headerPill, { backgroundColor: `${Colors.neutral00}10`, borderColor: `${Colors.neutral00}22` }]}>
                  <Text style={[Fonts.p4Bold, { color: Colors.neutral00 }]}>
                    {editorSourceLabel}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {/* Field Area */}
        <View style={styles.fieldContainer}>
          <Animated.View
            onLayout={measureField}
            ref={fieldRef}
            style={[
              styles.field,
              {
                borderColor: `${Colors.primary500}40`,
                height: fieldHeight,
                width: fieldWidth,
              },
            ]}
          >
            <RenderedTacticalField sport={sport} style={StyleSheet.absoluteFillObject} />

            {/* Drop zone indicator */}
            <Animated.View style={[styles.dropZoneIndicator, { borderColor: Colors.primary500 }, dropZoneStyle]} />

            {/* Placed players */}
            {fieldPlayers.map((/** @type {FieldPlayer} */ fp) => {
              if (!fp.firstname && !fp.lastname && !fp.id) return null;

              const pixelX = (fp.x / 100) * fieldRect.width;
              const pixelY = (fp.y / 100) * fieldRect.height;
              const left = pixelX - FIELD_TOKEN_WIDTH / 2;
              const top = pixelY - FIELD_TOKEN_HEIGHT / 2;

              const playerId = fp.id || fp.documentId;
              if (!playerId) return null;
              const isDragging = activeDragPlayer && (activeDragPlayer.id || activeDragPlayer.documentId) === playerId;

              const panGesture = createFieldPanGesture(playerId);

              return (
                <GestureDetector gesture={panGesture} key={playerId}>
                  <View style={[styles.fieldPlayerWrapper, { left, opacity: isDragging ? 0 : 1, top }]}>
                    <DraggableToken isOnField player={fp} />
                  </View>
                </GestureDetector>
              );
            })}

            {fieldPlayers.length === 0 ? (
              <View style={[styles.fieldEmptyState, { backgroundColor: `${Colors.primary900}88`, borderColor: `${Colors.primary500}44` }]}>
                <Text style={[Fonts.p2Bold, { color: Colors.neutral00, textAlign: 'center' }]}>
                  {isDetectionEvent ? 'Place les joueurs convoques sur le terrain' : 'Place tes titulaires sur le terrain'}
                </Text>
                <Text style={[Fonts.p4, { color: Colors.primary100, textAlign: 'center' }]}>
                  Maintiens un joueur du banc puis glisse-le vers sa position.
                </Text>
              </View>
            ) : null}
          </Animated.View>
        </View>

        {/* Bottom Control Panel */}
        <Animated.View
          style={[
            styles.panelSheet,
            panelAnimatedStyle,
            {
              backgroundColor: Colors.primary900,
              borderColor: `${Colors.primary500}44`,
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}
        >
          {showGuidedBenchHighlight ? (
            <Animated.View
              pointerEvents="none"
              style={[styles.guidedPulseRing, { borderColor: Colors.primary500 }, guidedPulseStyle]}
            />
          ) : null}
          <GestureDetector gesture={panelPanGesture}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => (isPanelOpen ? closePanel() : openPanel(activePanel || 'bench'))}
              style={styles.panelHandleTouch}
            >
              <View style={[styles.panelHandle, { backgroundColor: `${Colors.neutral00}55` }]} />
            </TouchableOpacity>
          </GestureDetector>

          <View style={styles.panelHeader}>
            <View style={styles.panelTabsRow}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => togglePanel('bench')}
                style={[
                  styles.panelTab,
                  isPanelOpen && activePanel === 'bench' && { backgroundColor: `${Colors.primary500}20`, borderColor: `${Colors.primary500}55` },
                ]}
              >
                <Text style={[Fonts.p4Bold, { color: isPanelOpen && activePanel === 'bench' ? Colors.primary500 : Colors.neutral00 }]}>
                  Banc
                </Text>
                <View style={[styles.panelTabCount, { backgroundColor: `${Colors.primary500}22` }]}>
                  <Text style={[Fonts.p4Bold, { color: Colors.primary500 }]}>{benchPlayers.length}</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => togglePanel('actions')}
                style={[
                  styles.panelTab,
                  isPanelOpen && activePanel === 'actions' && { backgroundColor: `${Colors.primary500}20`, borderColor: `${Colors.primary500}55` },
                ]}
              >
                <Text style={[Fonts.p4Bold, { color: isPanelOpen && activePanel === 'actions' ? Colors.primary500 : Colors.neutral00 }]}>
                  Actions
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={isPanelOpen ? closePanel : () => openPanel('actions')}
              style={styles.panelCloseButton}
            >
              <Text style={[Fonts.p4Bold, { color: Colors.primary100 }]}>
                {isPanelOpen ? 'Fermer' : 'Ouvrir'}
              </Text>
            </TouchableOpacity>
          </View>

          {isPanelOpen && activePanel === 'bench' ? (
            <View style={styles.panelContent}>
              {showGuidedBenchHighlight ? (
                <View style={[styles.guidedHint, { backgroundColor: 'rgba(4,31,44,0.97)', borderColor: `${Colors.primary500}59` }]}>
                  <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
                    Fais glisser un joueur sur le terrain
                  </Text>
                </View>
              ) : (
                <Text style={[Fonts.p4, { color: Colors.primary100 }]}>
                  Maintiens un joueur puis glisse-le sur le terrain.
                </Text>
              )}

              {benchPlayers.length > 0 ? (
                <ScrollView
                  contentContainerStyle={styles.benchScroll}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                >
                  {benchPlayers.map((/** @type {TacticalPlayer} */ player) => {
                    const playerId = player.id || player.documentId || '';
                    const isDragging = activeDragPlayer && (activeDragPlayer.id || activeDragPlayer.documentId) === playerId;
                    const panGesture = createBenchPanGesture(player);

                    return (
                      <GestureDetector gesture={panGesture} key={playerId}>
                        <View style={{ opacity: isDragging ? 0.3 : 1 }}>
                          <DraggableToken player={player} />
                        </View>
                      </GestureDetector>
                    );
                  })}
                </ScrollView>
              ) : (
                <View style={[styles.emptyBench, { backgroundColor: `${Colors.primary700}55`, borderColor: `${Colors.primary500}22` }]}>
                  <Text style={[Fonts.p3Bold, { color: Colors.neutral00, textAlign: 'center' }]}>Tous les joueurs sélectionnés sont déjà placés.</Text>
                  <Text style={[Fonts.p4, { color: Colors.primary100, textAlign: 'center' }]}>
                    Appuie sur + Ajouter si tu veux compléter la sélection sans revenir en arrière.
                  </Text>
                  {!readOnly ? (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => openSelectionEditor(selectionSource, selectionSourceLabel)}
                      style={[styles.emptyBenchAddButton, { backgroundColor: `${Colors.primary500}18`, borderColor: `${Colors.primary500}44` }]}
                    >
                      <Text style={[Fonts.p4Bold, { color: Colors.primary500 }]}>+ Ajouter un joueur</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              )}
            </View>
          ) : null}

          {isPanelOpen && activePanel === 'actions' ? (
            <ScrollView
              contentContainerStyle={styles.actionsScroll}
              showsVerticalScrollIndicator={false}
            >
              <View style={[styles.statusCard, { backgroundColor: `${Colors.primary700}45`, borderColor: `${statusCard.accent}33` }]}>
                <View style={styles.statusCardHeader}>
                  <Text style={[Fonts.p4Bold, { color: statusCard.accent }]}>
                    {statusCard.eyebrow}
                  </Text>
                  <View style={[styles.statusDot, { backgroundColor: statusCard.accent }]} />
                </View>
                <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }, styles.statusCardTitle]}>
                  {statusCard.title}
                </Text>
                <View style={styles.statusMetaContainer}>
                  {statusCard.lines.map((line) => (
                    <Text key={`${statusCard.eyebrow}-${line}`} style={[Fonts.p4, { color: Colors.primary100 }]}>
                      {line}
                    </Text>
                  ))}
                </View>
              </View>

              {readOnly && canEdit ? (
                <View style={styles.footerPrimaryAction}>
                  <Button
                    onPress={() => openBoardEditorFromCurrentState('published', 'Composition publiée')}
                    title="Modifier la composition"
                    variant="Primary"
                  />
                </View>
              ) : null}

              {!readOnly ? (
                <>
                  {showGuidedPublishHighlight ? (
                    <View style={[styles.guidedHint, { backgroundColor: 'rgba(4,31,44,0.97)', borderColor: `${Colors.primary500}59` }]}>
                      <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
                        Publie ta compo
                      </Text>
                    </View>
                  ) : null}
                  <View style={styles.footerPrimaryAction}>
                    <Button
                      disabled={isSaving || isPublishing}
                      onPress={isTeamDefaultMode ? handleSave : handlePublish}
                      title={resolvedPrimaryActionTitle}
                      variant="Primary"
                    />
                    {showGuidedPublishHighlight ? (
                      <Animated.View
                        pointerEvents="none"
                        style={[styles.guidedButtonRing, { borderColor: Colors.primary500 }, guidedPulseStyle]}
                      />
                    ) : null}
                  </View>

                  <View style={styles.footerTertiaryAction}>
                    <Button
                      disabled={isSaving || isPublishing}
                      onPress={() => openSelectionEditor(editorSource || 'draft', editorSourceLabel || 'Brouillon')}
                      title="Modifier les joueurs"
                      variant="Secondary"
                    />
                  </View>

                  {!isTeamDefaultMode ? (
                    <View style={styles.footerTertiaryAction}>
                      <Button
                        disabled={isSaving || isPublishing}
                        onPress={handleSave}
                        title={saveDraftLabel}
                        variant="Secondary"
                      />
                    </View>
                  ) : null}

                  {!isTeamDefaultMode ? (
                    <View style={styles.footerTertiaryAction}>
                      <Button
                        disabled={isSaving || isPublishing || !teamId}
                        onPress={handleSaveAsTeamDefault}
                        title={teamModelLabel}
                        variant="Secondary"
                      />
                    </View>
                  ) : null}

                  {isTeamDefaultMode && compositionMeta?.composition ? (
                    <View style={styles.footerTertiaryAction}>
                      <Button
                        disabled={isSaving || isPublishing}
                        onPress={handleDeleteTeamDefault}
                        title="Retirer le favori"
                        variant="Secondary"
                      />
                    </View>
                  ) : null}

                  {!isTeamDefaultMode ? (
                    <View style={[styles.actionsHintCard, { backgroundColor: `${Colors.primary700}30`, borderColor: `${Colors.primary500}22` }]}>
                      <Text style={[Fonts.p4Bold, { color: Colors.neutral00 }]}>A quoi servent ces deux sauvegardes ?</Text>
                      <Text style={[Fonts.p4, { color: Colors.primary100 }]}>
                        Brouillon : garde tes changements prives pour {isDetectionEvent ? 'cette detection' : 'ce match'}, sans les publier.
                      </Text>
                      <Text style={[Fonts.p4, { color: Colors.primary100 }]}>
                        Favori d'equipe : reutilise cette composition comme base de depart sur les prochains evenements.
                      </Text>
                    </View>
                  ) : null}
                </>
              ) : null}
            </ScrollView>
          ) : null}
        </Animated.View>

        {/* Ghost Token Overlay */}
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {activeDragPlayer && (
            <DraggableToken
              isGhost
              opacity={ghostOpacity}
              player={activeDragPlayer}
              scale={ghostScale}
              translateX={ghostX}
              translateY={ghostY}
            />
          )}
        </View>
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
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  actionsHintCard: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  actionsScroll: {
    gap: 10,
    paddingBottom: 2,
  },
  benchScroll: {
    alignItems: 'center',
    minHeight: 104,
    paddingBottom: 6,
    paddingHorizontal: 0,
  },
  dropZoneIndicator: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    borderStyle: 'dashed',
    borderWidth: 3,
    margin: 6,
  },
  emptyBench: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    justifyContent: 'center',
    minHeight: 108,
    paddingHorizontal: 20,
    paddingVertical: 16,
    width: '100%',
  },
  emptyBenchAddButton: {
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  field: {
    borderRadius: 24,
    borderWidth: 1.5,
    elevation: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
  },
  fieldContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-start',
    paddingBottom: 8,
    paddingHorizontal: 12,
    paddingTop: 0,
  },
  fieldEmptyState: {
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: 18,
    borderWidth: 1,
    bottom: 20,
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    position: 'absolute',
    width: '78%',
  },
  fieldPlayerWrapper: {
    position: 'absolute',
  },
  footer: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 10,
    marginHorizontal: 12,
    marginTop: 10,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  footerPrimaryAction: {
    marginTop: 2,
  },
  footerSecondaryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  footerTertiaryAction: {
    marginTop: 2,
  },
  guidedButtonRing: {
    borderRadius: 14,
    borderWidth: 2.5,
    bottom: -3,
    left: -3,
    position: 'absolute',
    right: -3,
    top: -3,
  },
  guidedHint: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  guidedPulseRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    borderWidth: 2.5,
    zIndex: 5,
  },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 82,
    paddingVertical: 6,
    position: 'relative',
  },
  headerBackButtonContainer: {
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    top: 0,
    zIndex: 10,
  },
  headerCaption: {
    textAlign: 'center',
  },
  headerCenter: {
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 60,
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
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  headerSubtitle: {
    textAlign: 'center',
  },
  headerTitle: {
    textAlign: 'center',
  },
  panelCloseButton: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  panelContent: {
    gap: 10,
    paddingTop: 10,
  },
  panelHandle: {
    borderRadius: 999,
    height: 4,
    width: 44,
  },
  panelHandleTouch: {
    alignItems: 'center',
    paddingBottom: 6,
    paddingTop: 2,
  },
  panelHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  panelSheet: {
    borderRadius: 24,
    borderWidth: 1,
    bottom: 10,
    left: 12,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingTop: 8,
    position: 'absolute',
    right: 12,
  },
  panelTab: {
    alignItems: 'center',
    borderColor: 'transparent',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  panelTabCount: {
    alignItems: 'center',
    borderRadius: 999,
    justifyContent: 'center',
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  panelTabsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  statusCard: {
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  statusCardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statusCardTitle: {
    lineHeight: 24,
  },
  statusDot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  statusMetaContainer: {
    gap: 4,
  },
});

export default TacticalBoard;
