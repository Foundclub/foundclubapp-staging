import { useNavigation, useRoute } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';

import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import LeagueCard from '@/components/atoms/league/LeagueCard';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import MatchFinalPosterModal from '@/components/organisms/league/MatchFinalPosterModal';
import ScreenContainer from '@/components/templates/ScreenContainer';
import LeagueStateView from '@/views/league/components/LeagueStateView';
import {
  buildLocalScoreFlow,
  formatScoreFlowCountdown,
} from '@/views/league/match/utils/scoreFlow';

import {
  fetchMatch,
  submitMatchScore,
} from '@/services/league/leagueMatchService';
import MatchmakingService from '@/services/league/MatchmakingService';
import { getAvailableSlots } from '@/services/teamSlot/teamSlotService';

import { areSameEntityId, getEntityDocumentId } from '@/utils/entityId';
import { getLocationCoordinates, normalizeRadius } from '@/utils/location';

/**
 * @typedef {{ uri: string, name: string, type: string, source: 'gallery' | 'camera' }} ProofPayload
 */

/**
 * @param {unknown} value
 * @returns {number | null}
 */
const parseScore = (value) => {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? null : parsed;
};

/**
 * @param {string | undefined | null} beforeStatus
 * @param {string | undefined | null} afterStatus
 * @returns {boolean}
 */
const hasForwardStatusProgression = (beforeStatus, afterStatus) => {
  /** @type {Record<string, string[]>} */
  const transitions = {
    disputed: ['valid'],
    pending_validation: ['valid', 'disputed'],
    scheduled: ['pending_validation', 'valid', 'disputed'],
  };

  if (!beforeStatus || !afterStatus || beforeStatus === afterStatus) {
    return false;
  }

  return Boolean(
    transitions[String(beforeStatus)]?.includes(String(afterStatus)),
  );
};

/**
 * @param {LeagueMatch | null} previousMatch
 * @param {LeagueMatch | null} refreshedMatch
 * @param {string | number | undefined | null} scoreA
 * @param {string | number | undefined | null} scoreB
 * @returns {boolean}
 */
const wasScorePersistedDespiteError = (
  previousMatch,
  refreshedMatch,
  scoreA,
  scoreB,
) => {
  if (!refreshedMatch) {
    return false;
  }

  const expectedA = parseScore(scoreA);
  const expectedB = parseScore(scoreB);
  if (expectedA === null || expectedB === null) {
    return false;
  }

  const finalA = parseScore(refreshedMatch.score_a);
  const finalB = parseScore(refreshedMatch.score_b);
  const hasMatchingFinalScore = finalA === expectedA && finalB === expectedB;

  const submissions = /** @type {Array<{ score_a?: string | number | null, score_b?: string | number | null }>} */ ([
    refreshedMatch.submitted_score_team_a,
    refreshedMatch.submitted_score_team_b,
  ].filter((submission) => Boolean(submission && typeof submission === 'object')));

  const hasMatchingSubmission = submissions.some((submission) => {
    if (!submission) {
      return false;
    }
    return (
      parseScore(submission.score_a) === expectedA
      && parseScore(submission.score_b) === expectedB
    );
  });

  const hasStatusProgression = hasForwardStatusProgression(
    previousMatch?.status,
    refreshedMatch.status,
  );

  return hasMatchingFinalScore || hasMatchingSubmission || hasStatusProgression;
};

const DISPUTE_TYPES = [
  { key: 'score_mismatch', label: 'Score contesté' },
  { key: 'no_show', label: 'No-show' },
  { key: 'incident', label: 'Incident terrain' },
];

const hasSubmissionPayload = (submission) => Boolean(
  submission
      && typeof submission === 'object'
      && (submission.score_a !== undefined || submission.score_b !== undefined),
);

const FINAL_RECAP_POLL_DELAYS_MS = [250, 500, 900, 1300, 1800];

const wait = (durationMs) => new Promise((resolve) => {
  setTimeout(resolve, durationMs);
});

const hasNumericRecapValue = (value) => Number.isFinite(Number(value));

/**
 * @param {unknown} value
 * @returns {string}
 */
const sanitizeScoreInput = (value) => {
  if (typeof value !== 'string') return '';
  return value.replace(/[^\d]/g, '').slice(0, 2);
};

/**
 * @param {any} asset
 * @param {'gallery' | 'camera'} source
 * @returns {ProofPayload | null}
 */
const buildProofPayloadFromAsset = (asset, source) => {
  if (!asset?.uri) return null;
  return {
    name: asset.fileName || `proof-${Date.now()}.jpg`,
    source,
    type: asset.type || 'image/jpeg',
    uri: asset.uri,
  };
};

/**
 *
 */
function EndMatchScreen() {
  const { Colors, Fonts } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const route = /** @type {any} */ (useRoute());
  const queryClient = useQueryClient();
  const { userData } = /** @type {{userData: User | null}} */ (useAuth());
  const matchId = route.params?.matchId ? String(route.params.matchId) : '';

  const [scoreA, setScoreA] = useState('0');
  const [scoreB, setScoreB] = useState('0');
  const [dispute, setDispute] = useState(false);
  const [proof, setProof] = useState(/** @type {ProofPayload | null} */ (null));
  const [disputeType, setDisputeType] = useState('score_mismatch');
  const [disputeComment, setDisputeComment] = useState('');
  const [finalPosterPayload, setFinalPosterPayload] = useState(null);

  const {
    data: matchData,
    error: matchError,
    isError: isMatchError,
    isLoading,
    refetch: refetchMatch,
  } = useQuery({
    enabled: Boolean(matchId),
    queryFn: () => fetchMatch(matchId),
    queryKey: ['league-match', matchId],
  });
  const match = /** @type {LeagueMatch | null} */ (matchData || null);

  const currentUserId = getEntityDocumentId(userData);
  const isCaptainA = areSameEntityId(
    getEntityDocumentId(match?.team_a?.captain),
    currentUserId,
  );
  const isCaptainB = areSameEntityId(
    getEntityDocumentId(match?.team_b?.captain),
    currentUserId,
  );
  const scoreFlow = useMemo(
    () => buildLocalScoreFlow(match, { isCaptainA, isCaptainB }),
    [isCaptainA, isCaptainB, match],
  );
  const isScoreSubmissionAllowed = Boolean(scoreFlow.canSubmit);
  const scoreSubmissionBlockReason = (() => {
    if (scoreFlow.state === 'locked_no_venue') {
      return "Le score est verrouillé tant qu'un terrain n'est pas confirmé.";
    }
    if (scoreFlow.state === 'locked_before_start') {
      return "Le score sera disponible à l'heure de début du match + 1 minute.";
    }
    return "Le score ne peut pas être saisi à ce stade. Vérifiez que l'heure de début du match est dépassée.";
  })();
  let ownSubmission = null;
  let opponentSubmission = null;
  if (isCaptainA) {
    ownSubmission = match?.submitted_score_team_a || null;
    opponentSubmission = match?.submitted_score_team_b || null;
  } else if (isCaptainB) {
    ownSubmission = match?.submitted_score_team_b || null;
    opponentSubmission = match?.submitted_score_team_a || null;
  }
  const hasOwnSubmission = hasSubmissionPayload(ownSubmission);
  const hasOpponentSubmission = hasSubmissionPayload(opponentSubmission);
  const opponentScoreA = parseScore(opponentSubmission?.score_a);
  const opponentScoreB = parseScore(opponentSubmission?.score_b);
  const [manualEntryEnabled, setManualEntryEnabled] = useState(true);
  const canShowManualForms = !hasOpponentSubmission || manualEntryEnabled || hasOwnSubmission;
  const shouldShowGuidedState = hasOpponentSubmission && !canShowManualForms;
  const scoreFlowCountdown = formatScoreFlowCountdown(scoreFlow.remainingSeconds);
  const leagueCardTextColor = Colors.primary500;
  const leagueAccentSurface = 'rgba(1, 179, 244, 0.12)';
  const leagueGoldSurface = 'rgba(255, 215, 0, 0.08)';
  let captainSideLabel = 'CAPITAINE';
  if (isCaptainA) captainSideLabel = 'DOMICILE';
  if (isCaptainB) captainSideLabel = 'EXTERIEUR';
  const heroStatusMeta = useMemo(() => {
    if (!isScoreSubmissionAllowed) {
      return {
        accentColor: Colors.warning500,
        helper:
          'Le score sera saisissable une fois la fenêtre de validation ouverte.',
        label: 'Fenêtre fermée',
      };
    }

    if (hasOpponentSubmission && !hasOwnSubmission) {
      return {
        accentColor: Colors.gold500,
        helper:
          'Le capitaine adverse a déjà proposé un score. Confirmez-le ou ouvrez un litige.',
        label: 'Score adverse reçu',
      };
    }

    if (hasOwnSubmission) {
      return {
        accentColor: Colors.success500,
        helper:
          'Votre dernière saisie est enregistrée. Vous pouvez encore la relire.',
        label: 'Saisie en cours',
      };
    }

    return {
      accentColor: Colors.primary500,
      helper:
        'Renseignez le score final puis validez ou ouvrez un litige si nécessaire.',
      label: 'Score à saisir',
    };
  }, [
    Colors.gold500,
    Colors.primary500,
    Colors.success500,
    Colors.warning500,
    hasOpponentSubmission,
    hasOwnSubmission,
    isScoreSubmissionAllowed,
  ]);

  useEffect(() => {
    if (hasOpponentSubmission && !hasOwnSubmission) {
      setManualEntryEnabled(false);
      return;
    }
    setManualEntryEnabled(true);
  }, [hasOpponentSubmission, hasOwnSubmission]);

  const getMyTeamFromMatch = () => {
    const currentActorId = String(getEntityDocumentId(userData) || '');
    if (!match || !currentActorId) return null;

    const isActorCaptainA = areSameEntityId(
      getEntityDocumentId(match?.team_a?.captain),
      currentActorId,
    );
    const isActorCaptainB = areSameEntityId(
      getEntityDocumentId(match?.team_b?.captain),
      currentActorId,
    );
    if (isActorCaptainA) return match.team_a;
    if (isActorCaptainB) return match.team_b;

    const inRosterA = (match?.team_a?.roster || []).some((member) => areSameEntityId(getEntityDocumentId(member), currentActorId));
    const inRosterB = (match?.team_b?.roster || []).some((member) => areSameEntityId(getEntityDocumentId(member), currentActorId));
    if (inRosterA) return match.team_a;
    if (inRosterB) return match.team_b;

    return null;
  };

  const relaunchSearchNow = async () => {
    const myTeam = getMyTeamFromMatch();
    if (!myTeam) {
      throw new Error("Impossible d'identifier votre squad.");
    }

    const teamId = getEntityDocumentId(myTeam);
    const homeBaseLocation = getLocationCoordinates(
      myTeam.home_base || myTeam.address,
    );
    const userLocation = getLocationCoordinates(userData?.location);
    const location = homeBaseLocation || userLocation;
    if (!location) {
      throw new Error(
        'Aucune localisation validée trouvée. Configurez la base de votre squad.',
      );
    }
    const homeBase = myTeam?.home_base && typeof myTeam.home_base === 'object'
      ? /** @type {{radius?: number}} */ (myTeam.home_base)
      : null;
    const radius = normalizeRadius(myTeam?.radius || homeBase?.radius, 20);
    const availableSlots = await getAvailableSlots(teamId);
    const selectedSlotIds = (availableSlots || [])
      .map((slot) => getEntityDocumentId(slot))
      .filter((id) => typeof id === 'string' && id.length > 0);

    if (selectedSlotIds.length === 0) {
      throw new Error('Aucun créneau disponible pour relancer une recherche.');
    }

    await MatchmakingService.triggerSearch(teamId, selectedSlotIds, {
      location,
      radius,
    });
    queryClient.invalidateQueries({ queryKey: ['league-matches'] });
  };

  const getFinalRecapForCurrentTeam = (sourceMatch) => {
    const automationMeta = sourceMatch?.automation_meta && typeof sourceMatch.automation_meta === 'object'
      ? sourceMatch.automation_meta
      : {};
    const recapByTeam = automationMeta.recap && typeof automationMeta.recap === 'object'
      ? automationMeta.recap
      : null;
    const finalRecapByTeam = automationMeta.final_recap && typeof automationMeta.final_recap === 'object'
      ? automationMeta.final_recap
      : null;
    const source = recapByTeam || finalRecapByTeam || {};
    return isCaptainB ? source.teamB : source.teamA;
  };

  const hasReadyFinalRecap = (sourceMatch) => {
    const recap = getFinalRecapForCurrentTeam(sourceMatch);
    return Boolean(
      recap
      && hasNumericRecapValue(recap.eloBefore)
      && hasNumericRecapValue(recap.eloAfter)
      && hasNumericRecapValue(recap.divisionBefore)
      && hasNumericRecapValue(recap.divisionAfter),
    );
  };

  const fetchMatchWithReadyFinalRecap = async (initialMatch, attemptIndex = 0) => {
    let sourceMatch = initialMatch || match;
    if (hasReadyFinalRecap(sourceMatch)) {
      return sourceMatch;
    }

    const delayMs = FINAL_RECAP_POLL_DELAYS_MS[attemptIndex];
    if (!delayMs) {
      return sourceMatch;
    }

    await wait(delayMs);
    sourceMatch = await fetchMatch(matchId);
    return fetchMatchWithReadyFinalRecap(sourceMatch, attemptIndex + 1);
  };

  const buildFinalPosterPayload = (sourceMatch) => {
    const recap = getFinalRecapForCurrentTeam(sourceMatch);
    const recapPending = !hasReadyFinalRecap(sourceMatch);
    return {
      finalStatus: 'valid',
      matchId,
      phase: 'valid',
      recap: recap || {
        myScore: isCaptainB ? sourceMatch?.score_b : sourceMatch?.score_a,
        opponentScore: isCaptainB ? sourceMatch?.score_a : sourceMatch?.score_b,
        scoreLabel: isCaptainB
          ? `${sourceMatch?.score_b ?? '-'}-${sourceMatch?.score_a ?? '-'}`
          : `${sourceMatch?.score_a ?? '-'}-${sourceMatch?.score_b ?? '-'}`,
      },
      recapPending,
    };
  };

  const showValidatedRecap = async (responseMatch = null) => {
    let sourceMatch = responseMatch || match;
    try {
      sourceMatch = await fetchMatchWithReadyFinalRecap(sourceMatch);
      queryClient.invalidateQueries({ queryKey: ['league-match', matchId] });
      queryClient.invalidateQueries({ queryKey: ['league-matches'] });
    } catch (_error) {
      sourceMatch = responseMatch || match;
    }
    setFinalPosterPayload(buildFinalPosterPayload(sourceMatch));
  };

  const submitMutation = useMutation({
    mutationFn: (
      /** @type {{scoreA: number, scoreB: number, dispute: boolean, proof: ProofPayload | null, disputeType: string | null, disputeComment: string | null}} */ data,
    ) => submitMatchScore(
      matchId,
      data.scoreA,
      data.scoreB,
      data.dispute,
      data.proof,
      {
        disputeComment: data.disputeComment,
        disputeType: data.disputeType,
      },
    ),
    onError: async (error, variables) => {
      console.error('[EndMatchScreen] Submit score failed:', error);

      try {
        const refreshedMatch = await fetchMatch(matchId);
        const recovered = wasScorePersistedDespiteError(
          match,
          refreshedMatch,
          variables?.scoreA,
          variables?.scoreB,
        );

        if (recovered) {
          queryClient.invalidateQueries({ queryKey: ['league-matches'] });
          queryClient.invalidateQueries({ queryKey: ['league-match', matchId] });
          const recoveredStatus = String(
            refreshedMatch?.status || '',
          ).toLowerCase();
          if (recoveredStatus === 'valid') {
            await showValidatedRecap(refreshedMatch);
          } else if (recoveredStatus === 'pending_validation') {
            Alert.alert(
              'Score enregistré',
              'Votre score est en attente de validation par le capitaine adverse.',
              [{ onPress: () => refetchMatch(), text: 'OK' }],
            );
          } else if (recoveredStatus === 'disputed') {
            Alert.alert(
              'Litige ouvert',
              'Le score a été enregistré mais est passé en litige.',
              [{ onPress: () => refetchMatch(), text: 'OK' }],
            );
          } else {
            Alert.alert('Score enregistré', 'Le score a été enregistré.', [
              { onPress: () => refetchMatch(), text: 'OK' },
            ]);
          }
          return;
        }
      } catch (refreshError) {
        console.error('[EndMatchScreen] Recovery check failed:', refreshError);
      }

      const apiError = /** @type {any} */ (error);
      const message = typeof error === 'string'
        ? error
        : apiError?.message || "Impossible d'envoyer le score.";
      Alert.alert('Erreur', message);
    },
    onSuccess: async (response) => {
      queryClient.invalidateQueries({ queryKey: ['league-matches'] });
      queryClient.invalidateQueries({ queryKey: ['league-match', matchId] });
      const finalStatus = String(response?.status || '').toLowerCase();
      if (finalStatus === 'valid') {
        await showValidatedRecap(response);
        return;
      }

      if (finalStatus === 'pending_validation') {
        Alert.alert(
          'Score enregistré',
          'Votre score est en attente de validation par le capitaine adverse.',
          [{ onPress: () => refetchMatch(), text: 'OK' }],
        );
        return;
      }

      if (finalStatus === 'disputed') {
        Alert.alert(
          'Litige ouvert',
          'Le score est maintenant en litige. Vous pourrez confirmer ou fournir des détails si besoin.',
          [{ onPress: () => refetchMatch(), text: 'OK' }],
        );
        return;
      }

      Alert.alert('Score enregistré', 'Le score a bien été envoyé.', [
        { onPress: () => refetchMatch(), text: 'OK' },
      ]);
    },
  });

  const isNoShowDispute = dispute && disputeType === 'no_show';
  let captureProofButtonTitle = 'Prendre une photo';
  if (isNoShowDispute) captureProofButtonTitle = 'Prendre une photo (caméra)';
  if (proof) captureProofButtonTitle = 'Preuve ajoutée';

  const handlePickProofFromGallery = async () => {
    /** @type {import('react-native-image-picker').ImageLibraryOptions} */
    const options = {
      mediaType: 'photo',
      quality: 0.7,
      selectionLimit: 1,
    };

    launchImageLibrary(options, (response) => {
      if (response.didCancel) {
        console.log('User cancelled image picker');
      } else if (response.errorCode) {
        console.log('ImagePicker Error: ', response.errorMessage);
        Alert.alert('Erreur', 'Impossible de sélectionner une image');
      } else if (response.assets && response.assets.length > 0) {
        const asset = response.assets[0];
        const nextProof = buildProofPayloadFromAsset(asset, 'gallery');
        if (nextProof) setProof(nextProof);
      }
    });
  };

  const handleCaptureProof = async () => {
    /** @type {import('react-native-image-picker').CameraOptions} */
    const options = {
      includeExtra: true,
      mediaType: 'photo',
      quality: 0.7,
      saveToPhotos: false,
    };

    launchCamera(options, (response) => {
      if (response.didCancel) {
        console.log('User cancelled camera');
      } else if (response.errorCode) {
        console.log('Camera Error: ', response.errorMessage);
        Alert.alert('Erreur', 'Impossible de prendre la photo');
      } else if (response.assets && response.assets.length > 0) {
        const asset = response.assets[0];
        const nextProof = buildProofPayloadFromAsset(asset, 'camera');
        if (nextProof) setProof(nextProof);
      }
    });
  };

  const handleSubmit = () => {
    if (!isScoreSubmissionAllowed) {
      Alert.alert('Action impossible', scoreSubmissionBlockReason);
      return;
    }
    if (!scoreA || !scoreB) {
      Alert.alert('Erreur', 'Veuillez saisir les scores.');
      return;
    }
    if (isNoShowDispute && proof?.source !== 'camera') {
      Alert.alert(
        'Erreur',
        'Pour un no-show, la preuve doit venir de la caméra.',
      );
      return;
    }

    submitMutation.mutate({
      dispute,
      disputeComment: dispute ? disputeComment?.trim() : null,
      disputeType: dispute ? disputeType : null,
      proof,
      scoreA: Number.parseInt(scoreA, 10),
      scoreB: Number.parseInt(scoreB, 10),
    });
  };

  const handleConfirmOpponentScore = () => {
    if (opponentScoreA === null || opponentScoreB === null) {
      Alert.alert('Information', 'Le score adverse est incomplet.');
      return;
    }
    submitMutation.mutate({
      dispute: false,
      disputeComment: null,
      disputeType: null,
      proof: null,
      scoreA: opponentScoreA,
      scoreB: opponentScoreB,
    });
  };

  const handleDisputeOpponentScore = () => {
    if (opponentScoreA !== null) setScoreA(String(opponentScoreA));
    if (opponentScoreB !== null) setScoreB(String(opponentScoreB));
    setManualEntryEnabled(true);
    setDispute(true);
    setDisputeType('score_mismatch');
  };

  const submitButtonTitle = (() => {
    if (submitMutation.isPending) return 'Envoi en cours...';
    if (hasOwnSubmission) return 'Corriger le score';
    return 'Valider le score';
  })();

  const handleScoreChange = (/** @type {(value: string) => void} */ setter) => (/** @type {string} */ value) => {
    setter(sanitizeScoreInput(value));
  };

  const incrementScore = (
    /** @type {string} */ score,
    /** @type {(value: string) => void} */ setter,
  ) => {
    const current = Number.parseInt(score || '0', 10);
    const next = Number.isNaN(current) ? 1 : Math.min(current + 1, 99);
    setter(String(next));
  };

  const decrementScore = (
    /** @type {string} */ score,
    /** @type {(value: string) => void} */ setter,
  ) => {
    const current = Number.parseInt(score || '0', 10);
    const next = Number.isNaN(current) ? 0 : Math.max(current - 1, 0);
    setter(String(next));
  };

  if (!matchId) {
    return (
      <LeagueStateView
        description="Aucun identifiant de match n'a été fourni pour ouvrir cette saisie de score."
        title="Match introuvable"
      />
    );
  }

  if (isLoading) {
    return (
      <LeagueStateView
        description="Nous chargeons les données du match avant la saisie du score."
        isLoading
        title="Chargement du match"
      />
    );
  }

  if (isMatchError) {
    return (
      <LeagueStateView
        actionLabel="Réessayer"
        description={matchError?.message || 'Impossible de charger ce match League.'}
        onAction={() => refetchMatch()}
        title="Chargement impossible"
      />
    );
  }

  if (!match) {
    return (
      <LeagueStateView
        description="Le match demandé est introuvable ou n'est plus accessible."
        title="Match introuvable"
      />
    );
  }

  const teamA = match?.team_a;
  const teamB = match?.team_b;
  const leagueSurface = {
    backgroundColor: 'rgba(10, 28, 43, 0.84)',
    borderColor: 'rgba(1, 179, 244, 0.24)',
  };

  return (
    <ScreenContainer bgImage="bg2" style={[styles.screenContainer]}>
      <SafeAreaView style={styles.container}>
        <View style={styles.headerBar}>
          <View style={styles.headerSide}>
            <HeaderBackButton
              borderColor="primary500"
              color="primary500"
              onPress={() => navigation.goBack()}
              style={styles.headerBackButton}
              withDefaultMargin={false}
            />
          </View>
          <Text style={[Fonts.h3, styles.headerTitle, { color: Colors.gold500 }]}>
            Saisir le score
          </Text>
          <View style={styles.headerSide} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <LeagueCard
            isGold
            style={[
              styles.heroCard,
              {
                backgroundColor: 'rgba(10, 28, 43, 0.92)',
                borderColor: `${heroStatusMeta.accentColor}45`,
              },
            ]}
          >
            <View style={styles.heroTopRow}>
              <View
                style={[
                  styles.heroContextPill,
                  {
                    backgroundColor: isCaptainA
                      ? leagueAccentSurface
                      : leagueGoldSurface,
                    borderColor: isCaptainA
                      ? 'rgba(1, 179, 244, 0.35)'
                      : 'rgba(255, 215, 0, 0.28)',
                  },
                ]}
              >
                <Text
                  style={[
                    Fonts.label,
                    { color: isCaptainA ? Colors.primary500 : Colors.gold500 },
                  ]}
                >
                  {captainSideLabel}
                </Text>
              </View>
              <View
                style={[
                  styles.heroStatusPill,
                  {
                    backgroundColor: `${heroStatusMeta.accentColor}18`,
                    borderColor: `${heroStatusMeta.accentColor}45`,
                  },
                ]}
              >
                <Text
                  style={[Fonts.label, { color: heroStatusMeta.accentColor }]}
                >
                  {heroStatusMeta.label}
                </Text>
              </View>
            </View>

            <View style={styles.heroMatchupRow}>
              <View style={styles.heroTeamBlock}>
                <TeamShield
                  initials={String(teamA?.name?.substring(0, 2) || '?')}
                  isGold
                  size={60}
                />
                <Text
                  numberOfLines={1}
                  style={[
                    Fonts.p2Bold,
                    styles.heroTeamName,
                    { color: Colors.neutral100 },
                  ]}
                >
                  {teamA?.name || 'Equipe A'}
                </Text>
              </View>

              <View
                style={[
                  styles.heroScoreCenter,
                  {
                    backgroundColor: 'rgba(1, 179, 244, 0.08)',
                    borderColor: 'rgba(1, 179, 244, 0.24)',
                  },
                ]}
              >
                <Text
                  style={[
                    Fonts.p4Bold,
                    { color: leagueCardTextColor, marginBottom: 6 },
                  ]}
                >
                  MATCH
                </Text>
                <Text style={[Fonts.h1Bold, { color: Colors.gold500 }]}>
                  {scoreA || '0'}
                  {' '}
                  -
                  {scoreB || '0'}
                </Text>
              </View>

              <View style={styles.heroTeamBlock}>
                <TeamShield
                  initials={String(teamB?.name?.substring(0, 2) || '?')}
                  isGold
                  size={60}
                />
                <Text
                  numberOfLines={1}
                  style={[
                    Fonts.p2Bold,
                    styles.heroTeamName,
                    { color: Colors.neutral100 },
                  ]}
                >
                  {teamB?.name || 'Equipe B'}
                </Text>
              </View>
            </View>

            <Text
              style={[
                Fonts.p3,
                styles.introText,
                { color: leagueCardTextColor },
              ]}
            >
              {heroStatusMeta.helper}
            </Text>
          </LeagueCard>

          {!isScoreSubmissionAllowed ? (
            <LeagueCard
              style={[
                styles.warningCard,
                {
                  backgroundColor: 'rgba(245, 158, 11, 0.12)',
                  borderColor: Colors.warning500 || '#F59E0B',
                },
              ]}
            >
              <Text style={[Fonts.p3, { color: Colors.warning500 || '#F59E0B' }]}>
                {' '}
                {scoreSubmissionBlockReason}
                {' '}
              </Text>
            </LeagueCard>
          ) : null}

          {hasOwnSubmission ? (
            <LeagueCard
              style={[
                styles.ownScoreCard,
                leagueSurface,
                {
                  backgroundColor: 'rgba(34, 197, 94, 0.08)',
                  borderColor: 'rgba(34, 197, 94, 0.24)',
                },
              ]}
            >
              <View style={styles.cardHeaderRow}>
                <View
                  style={[
                    styles.miniHeaderDot,
                    { backgroundColor: Colors.success500 },
                  ]}
                />
                <Text style={[Fonts.p3Bold, { color: Colors.success500 }]}>
                  Score déjà saisi
                </Text>
              </View>
              <Text style={[Fonts.h3, { color: Colors.neutral100, marginTop: 4 }]}>
                {`${ownSubmission?.score_a ?? '-'} - ${ownSubmission?.score_b ?? '-'}`}
              </Text>
              <Text style={[Fonts.p3, { color: leagueCardTextColor, marginTop: 6 }]}>
                En attente de validation adverse. Sans réponse, ce score sera validé automatiquement dans
                {' '}
                {scoreFlowCountdown}
                .
              </Text>
              <Text style={[Fonts.p4, { color: Colors.neutral400, marginTop: 8 }]}>
                Vous pouvez encore corriger votre saisie tant que le match n&apos;est pas validé.
              </Text>
            </LeagueCard>
          ) : null}

          {hasOpponentSubmission ? (
            <LeagueCard
              style={[
                styles.opponentScoreCard,
                leagueSurface,
                {
                  backgroundColor: 'rgba(255, 215, 0, 0.08)',
                  borderColor: 'rgba(255, 215, 0, 0.22)',
                },
              ]}
            >
              <View style={styles.cardHeaderRow}>
                <View
                  style={[
                    styles.miniHeaderDot,
                    { backgroundColor: Colors.gold500 },
                  ]}
                />
                <Text style={[Fonts.p3Bold, { color: Colors.gold500 }]}>
                  Score saisi par le capitaine adverse
                </Text>
              </View>
              <Text
                style={[Fonts.h3, { color: Colors.gold500, marginTop: 4 }]}
              >
                {`${opponentScoreA ?? '-'} - ${opponentScoreB ?? '-'}`}
              </Text>
              <Text
                style={[Fonts.p3, { color: leagueCardTextColor, marginTop: 6 }]}
              >
                Confirmez ce score si vous êtes d&apos;accord, sinon ouvrez un litige.
              </Text>
              <View style={styles.opponentScoreActions}>
                <Button
                  icon="check"
                  iconColor={Colors.neutral00}
                  iconPosition="before"
                  onPress={handleConfirmOpponentScore}
                  style={{ width: '100%' }}
                  title="Confirmer le score"
                  variant="Primary"
                />
                <Button
                  icon="close"
                  iconColor={Colors.error500}
                  iconPosition="before"
                  onPress={handleDisputeOpponentScore}
                  style={{ borderColor: Colors.error500, width: '100%' }}
                  textStyle={{ color: Colors.error500 }}
                  title="Contester le score"
                  variant="Secondary"
                />
              </View>
            </LeagueCard>
          ) : null}

          {shouldShowGuidedState ? (
            <LeagueCard
              style={[
                styles.guidedStateCard,
                leagueSurface,
                {
                  backgroundColor: leagueAccentSurface,
                  borderColor: 'rgba(1, 179, 244, 0.22)',
                },
              ]}
            >
              <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>
                En attente de votre décision
              </Text>
              <Text
                style={[Fonts.p3, { color: leagueCardTextColor, marginTop: 6 }]}
              >
                Utilisez les boutons ci-dessus pour confirmer ou contester le
                score adverse.
              </Text>
            </LeagueCard>
          ) : null}

          {canShowManualForms ? (
            <LeagueCard style={[styles.scoreCard, leagueSurface]}>
              <View style={styles.cardHeaderRow}>
                <View
                  style={[
                    styles.miniHeaderDot,
                    { backgroundColor: Colors.primary500 },
                  ]}
                />
                <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>
                  Saisie du score final
                </Text>
              </View>
              <View style={styles.scoreContainer}>
                <View
                  style={[
                    styles.teamColumn,
                    styles.scoreTeamCard,
                    {
                      backgroundColor: leagueAccentSurface,
                      borderColor: 'rgba(1, 179, 244, 0.24)',
                    },
                  ]}
                >
                  <TeamShield
                    initials={String(teamA?.name?.substring(0, 2) || '?')}
                    isGold
                    size={64}
                  />
                  <Text
                    numberOfLines={1}
                    style={[
                      Fonts.h4,
                      styles.teamName,
                      { color: Colors.neutral100 },
                    ]}
                  >
                    {teamA?.name}
                  </Text>
                  <TextInput
                    keyboardType="number-pad"
                    maxLength={2}
                    onChangeText={handleScoreChange(setScoreA)}
                    placeholder="0"
                    placeholderTextColor={Colors.neutral500}
                    style={[
                      styles.scoreInput,
                      {
                        backgroundColor: 'rgba(255,255,255,0.08)',
                        borderColor: 'rgba(255,255,255,0.22)',
                        color: Colors.gold500,
                      },
                    ]}
                    value={scoreA}
                  />
                  <View style={styles.scoreActions}>
                    <TouchableOpacity
                      onPress={() => decrementScore(scoreA, setScoreA)}
                      style={[
                        styles.scoreStepper,
                        { borderColor: Colors.primary500 },
                      ]}
                    >
                      <Text style={[Fonts.p1Bold, { color: Colors.primary500 }]}>
                        -
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => incrementScore(scoreA, setScoreA)}
                      style={[
                        styles.scoreStepper,
                        { borderColor: Colors.primary500 },
                      ]}
                    >
                      <Text style={[Fonts.p1Bold, { color: Colors.primary500 }]}>
                        +
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.scoreSeparatorWrap}>
                  <Text style={[Fonts.h2, { color: Colors.gold500 }]}>VS</Text>
                </View>

                <View
                  style={[
                    styles.teamColumn,
                    styles.scoreTeamCard,
                    {
                      backgroundColor: leagueGoldSurface,
                      borderColor: 'rgba(255, 215, 0, 0.24)',
                    },
                  ]}
                >
                  <TeamShield
                    initials={String(teamB?.name?.substring(0, 2) || '?')}
                    isGold
                    size={64}
                  />
                  <Text
                    numberOfLines={1}
                    style={[
                      Fonts.h4,
                      styles.teamName,
                      { color: Colors.neutral100 },
                    ]}
                  >
                    {teamB?.name}
                  </Text>
                  <TextInput
                    keyboardType="number-pad"
                    maxLength={2}
                    onChangeText={handleScoreChange(setScoreB)}
                    placeholder="0"
                    placeholderTextColor={Colors.neutral500}
                    style={[
                      styles.scoreInput,
                      {
                        backgroundColor: 'rgba(255,255,255,0.08)',
                        borderColor: 'rgba(255,255,255,0.22)',
                        color: Colors.gold500,
                      },
                    ]}
                    value={scoreB}
                  />
                  <View style={styles.scoreActions}>
                    <TouchableOpacity
                      onPress={() => decrementScore(scoreB, setScoreB)}
                      style={[
                        styles.scoreStepper,
                        { borderColor: Colors.primary500 },
                      ]}
                    >
                      <Text style={[Fonts.p1Bold, { color: Colors.primary500 }]}>
                        -
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => incrementScore(scoreB, setScoreB)}
                      style={[
                        styles.scoreStepper,
                        { borderColor: Colors.primary500 },
                      ]}
                    >
                      <Text style={[Fonts.p1Bold, { color: Colors.primary500 }]}>
                        +
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </LeagueCard>
          ) : null}

          {canShowManualForms ? (
            <LeagueCard style={[styles.disputeCard, leagueSurface]}>
              <View style={styles.cardHeaderRow}>
                <View
                  style={[
                    styles.miniHeaderDot,
                    { backgroundColor: Colors.error500 },
                  ]}
                />
                <Text style={[Fonts.p3Bold, { color: Colors.error500 }]}>
                  Gestion du litige
                </Text>
              </View>
              <View style={styles.headerRow}>
                <Text style={[Fonts.h4, { color: Colors.neutral100 }]}>
                  Y a-t-il un litige ?
                </Text>
                <Switch
                  onValueChange={setDispute}
                  thumbColor={Colors.neutral100}
                  trackColor={{ false: Colors.neutral600, true: Colors.error500 }}
                  value={dispute}
                />
              </View>
              <Text
                style={[Fonts.p3, { color: leagueCardTextColor, marginTop: 6 }]}
              >
                Activez en cas de désaccord. Preuve optionnelle sauf no-show
                (caméra obligatoire).
              </Text>

              {dispute ? (
                <View style={styles.disputeContent}>
                  <View>
                    <Text
                      style={[
                        Fonts.p3,
                        { color: leagueCardTextColor, marginBottom: 8 },
                      ]}
                    >
                      Type de litige
                    </Text>
                    <View style={styles.chipsRow}>
                      {DISPUTE_TYPES.map((item) => (
                        <TouchableOpacity
                          key={item.key}
                          onPress={() => setDisputeType(item.key)}
                          style={[
                            styles.disputeTypeChip,
                            {
                              backgroundColor:
                                disputeType === item.key
                                  ? 'rgba(1,179,244,0.15)'
                                  : 'rgba(255,255,255,0.06)',
                              borderColor:
                                disputeType === item.key
                                  ? Colors.primary500
                                  : Colors.neutral600,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              Fonts.p3Bold,
                              {
                                color:
                                  disputeType === item.key
                                    ? Colors.primary500
                                    : Colors.neutral300,
                              },
                            ]}
                          >
                            {item.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View>
                    <Text
                      style={[
                        Fonts.p3,
                        { color: leagueCardTextColor, marginBottom: 8 },
                      ]}
                    >
                      Commentaire (optionnel)
                    </Text>
                    <TextInput
                      maxLength={500}
                      multiline
                      onChangeText={setDisputeComment}
                      placeholder="Expliquez brièvement le problème"
                      placeholderTextColor={Colors.neutral500}
                      style={[
                        styles.commentInput,
                        {
                          backgroundColor: 'rgba(255,255,255,0.06)',
                          borderColor: Colors.neutral600,
                          color: Colors.neutral100,
                        },
                      ]}
                      textAlignVertical="top"
                      value={disputeComment}
                    />
                  </View>

                  <Button
                    icon="camera"
                    iconColor={proof ? Colors.neutral00 : Colors.primary500}
                    iconPosition="before"
                    onPress={handleCaptureProof}
                    style={{ borderColor: Colors.primary500 }}
                    title={captureProofButtonTitle}
                    variant={proof ? 'Primary' : 'Secondary'}
                  />
                  {!isNoShowDispute ? (
                    <Button
                      icon="plus"
                      iconColor={Colors.neutral300}
                      iconPosition="before"
                      onPress={handlePickProofFromGallery}
                      style={{ borderColor: Colors.neutral500 }}
                      title="Importer depuis la galerie"
                      variant="Secondary"
                    />
                  ) : null}
                  {isNoShowDispute ? (
                    <Text style={[Fonts.p3, { color: leagueCardTextColor }]}>
                      Pour un no-show, seule une preuve prise en direct est
                      acceptée.
                    </Text>
                  ) : null}
                  {proof ? (
                    <Image
                      source={{ uri: proof.uri }}
                      style={styles.proofPreview}
                    />
                  ) : null}
                </View>
              ) : null}
            </LeagueCard>
          ) : null}

          {canShowManualForms ? (
            <Button
              disabled={submitMutation.isPending || !isScoreSubmissionAllowed}
              icon="check"
              iconColor={Colors.neutral00}
              iconPosition="before"
              onPress={handleSubmit}
              style={[
                styles.submitButton,
                {
                  backgroundColor: Colors.primary500,
                  borderColor: Colors.primary500,
                },
              ]}
              textStyle={{ color: Colors.neutral00 }}
              title={submitButtonTitle}
              variant="Primary"
            />
          ) : null}
        </ScrollView>
        <MatchFinalPosterModal
          onClose={() => setFinalPosterPayload(null)}
          onOpenDetails={() => {
            setFinalPosterPayload(null);
            navigation.goBack();
          }}
          onRelaunchSearch={async () => {
            try {
              await relaunchSearchNow();
              setFinalPosterPayload(null);
              Alert.alert('Recherche relancée', "La recherche d'un nouvel adversaire a été lancée.");
            } catch (error) {
              const apiError = /** @type {any} */ (error);
              Alert.alert('Relance impossible', apiError?.message || 'Relance impossible.');
            }
          }}
          payload={finalPosterPayload}
          visible={Boolean(finalPosterPayload)}
        />
      </SafeAreaView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  cardHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 14,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  commentInput: {
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 96,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  container: {
    flex: 1,
  },
  disputeCard: {
    marginBottom: 18,
  },
  disputeContent: {
    gap: 12,
    marginTop: 16,
  },
  disputeTypeChip: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  guidedStateCard: {
    marginBottom: 18,
  },
  headerBackButton: {
    marginLeft: 0,
  },
  headerBar: {
    alignItems: 'center',
    borderBottomColor: 'rgba(255,255,255,0.1)',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerSide: {
    alignItems: 'flex-start',
    minWidth: 42,
  },
  headerTitle: {
    flex: 1,
    letterSpacing: 1,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  heroCard: {
    marginBottom: 18,
  },
  heroContextPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  heroMatchupRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  heroScoreCenter: {
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 120,
    paddingHorizontal: 12,
    paddingVertical: 14,
    width: '40%',
  },
  heroStatusPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  heroTeamBlock: {
    alignItems: 'center',
    width: '28%',
  },
  heroTeamName: {
    marginTop: 8,
    textAlign: 'center',
  },
  heroTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  introText: {
    textAlign: 'center',
  },
  miniHeaderDot: {
    borderRadius: 999,
    height: 10,
    marginRight: 10,
    width: 10,
  },
  opponentScoreActions: {
    flexDirection: 'column',
    gap: 10,
    marginTop: 14,
  },
  opponentScoreCard: {
    marginBottom: 18,
  },
  ownScoreCard: {
    marginBottom: 18,
  },
  proofPreview: {
    borderRadius: 10,
    height: 200,
    marginTop: 8,
    resizeMode: 'cover',
    width: '100%',
  },
  scoreActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  scoreCard: {
    marginBottom: 18,
  },
  scoreContainer: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  scoreInput: {
    borderRadius: 14,
    borderWidth: 1,
    fontSize: 38,
    fontWeight: '700',
    height: 74,
    textAlign: 'center',
    width: 74,
  },
  scoreSeparatorWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 68,
    width: 28,
  },
  scoreStepper: {
    alignItems: 'center',
    backgroundColor: 'rgba(1, 179, 244, 0.1)',
    borderRadius: 21,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  scoreTeamCard: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  screenContainer: {
    paddingHorizontal: 0,
  },
  scrollContent: {
    paddingBottom: 48,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  submitButton: {
    marginTop: 6,
  },
  teamColumn: {
    alignItems: 'center',
    flex: 1,
  },
  teamName: {
    marginVertical: 10,
  },
  warningCard: {
    marginBottom: 16,
  },
});

export default EndMatchScreen;
