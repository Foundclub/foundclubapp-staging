import { useNavigation, useRoute } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLayoutEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  ImageBackground,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import useAuth from '@/domains/auth/useAuth';
import useClub from '@/domains/club/useClub';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Checkable from '@/components/atoms/checkable/Checkable';
import Tag from '@/components/atoms/tag/Tag';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import {
  acceptEventParticipation,
  declineEventParticipation,
  getEventParticipations,
} from '@/services/eventParticipation/eventParticipationService';
import {
  applyToRecruitmentAd,
  deleteRecruitmentAd,
  getRecruitmentAd,
  resolveRecruitmentAdApplicationState,
} from '@/services/recruitment/recruitmentService';

import { formatDateWithDayPrefix } from '@/utils/date';
import { getImageUrl } from '@/utils/imageUrl';
import { getShortAddress } from '@/utils/location';

const BG_MATCH = require('@/assets/background-card-event/card-match.png');

const getBackgroundImage = () => BG_MATCH;
const normalizeTypeLabel = (value = '') => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim();

const getCandidateDisplayName = (participation) => {
  const requesterName = String(participation?.requester?.displayName || '').trim();
  if (requesterName) return requesterName;

  const firstname = String(participation?.user?.firstname || '').trim();
  const lastname = String(participation?.user?.lastname || '').trim();
  const fullName = [firstname, lastname].filter(Boolean).join(' ').trim();
  if (fullName) return fullName;

  return String(participation?.user?.phoneNumber || 'Candidat').trim();
};

const getParticipationStatusMeta = (status, colors) => {
  const normalizedStatus = String(status || '').trim().toLowerCase();

  if (normalizedStatus === 'accepted') {
    return {
      backgroundColor: `${colors.success500}18`,
      borderColor: `${colors.success500}45`,
      label: 'Accepte',
      textColor: colors.success500,
    };
  }

  if (normalizedStatus === 'declined') {
    return {
      backgroundColor: `${colors.error500}16`,
      borderColor: `${colors.error500}45`,
      label: 'Refuse',
      textColor: colors.error500,
    };
  }

  return {
    backgroundColor: `${colors.warning500}18`,
    borderColor: `${colors.warning500}45`,
    label: 'En attente',
    textColor: colors.warning500,
  };
};

/**
 *
 */
function RecruitmentAdDetails() {
  const { params } = useRoute();
  const navigation = useNavigation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { userData } = useAuth();
  const { getClubInitials } = useClub();
  const queryClient = useQueryClient();
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [isDetectionApplyModalVisible, setIsDetectionApplyModalVisible] = useState(false);
  const [hasAcceptedDetectionRiskDeclaration, setHasAcceptedDetectionRiskDeclaration] = useState(false);
  const [hasAcceptedDetectionConditions, setHasAcceptedDetectionConditions] = useState(false);

  const adId = params?.ad?.documentId || params?.adId || params?.ad?.id;

  const {
    data: fetchedAd,
    error: adError,
    isLoading,
    refetch: refetchAd,
  } = useQuery({
    enabled: !!adId,
    initialData: params?.ad,
    queryFn: () => getRecruitmentAd(adId),
    queryKey: ['recruitmentAd', adId],
  });

  const ad = fetchedAd || params?.ad;
  const eventDocumentId = String(ad?.event?.documentId || '').trim();
  const recruitmentAdDocumentId = String(ad?.documentId || ad?.id || '').trim();
  const candidates = useMemo(
    () => (Array.isArray(ad?.candidates) ? ad.candidates : []),
    [ad?.candidates],
  );
  const applicationState = useMemo(
    () => resolveRecruitmentAdApplicationState(ad, userData),
    [ad, userData],
  );
  const { hasApplied } = applicationState;
  const isAppliedOnAnotherDetectionSlot = Boolean(
    isDetectionLinked
    && applicationState.linkedRecruitmentAdDocumentId
    && applicationState.linkedRecruitmentAdDocumentId !== recruitmentAdDocumentId,
  );

  const isOwner = useMemo(() => {
    if (!userData || !ad) return false;

    if (ad.author?.documentId === userData.documentId || ad.author?.id === userData.id) return true;

    const myTeams = userData.myTeams || [];
    const trainedTeams = userData.trainedTeams || [];
    const allUserTeams = [...myTeams, ...trainedTeams];

    const adTeamId = ad.team?.documentId || ad.team?.id;
    if (!adTeamId) return false;

    return allUserTeams.some((teamItem) => teamItem.documentId === adTeamId || teamItem.id === adTeamId);
  }, [userData, ad]);

  const slotParticipationsQuery = useQuery({
    enabled: Boolean(isOwner && eventDocumentId && recruitmentAdDocumentId),
    queryFn: () => getEventParticipations(eventDocumentId, undefined, {
      pageSize: 100,
      recruitmentAdId: recruitmentAdDocumentId,
    }),
    queryKey: ['recruitmentAdParticipations', eventDocumentId, recruitmentAdDocumentId],
  });

  const slotParticipations = useMemo(() => {
    const items = Array.isArray(slotParticipationsQuery?.data?.data)
      ? slotParticipationsQuery.data.data
      : [];

    const weightByStatus = {
      accepted: 1,
      declined: 2,
      pending: 0,
    };

    return [...items].sort((left, right) => {
      const leftStatus = String(left?.participationStatus || '').trim().toLowerCase();
      const rightStatus = String(right?.participationStatus || '').trim().toLowerCase();
      const leftWeight = weightByStatus[leftStatus] ?? 99;
      const rightWeight = weightByStatus[rightStatus] ?? 99;
      if (leftWeight !== rightWeight) return leftWeight - rightWeight;

      const leftDate = new Date(left?.updatedAt || left?.createdAt || 0).getTime();
      const rightDate = new Date(right?.updatedAt || right?.createdAt || 0).getTime();
      return rightDate - leftDate;
    });
  }, [slotParticipationsQuery?.data?.data]);

  const deleteMutation = useMutation({
    mutationFn: deleteRecruitmentAd,
    onError: (error) => {
      console.error('Error deleting ad:', error);
      setIsDeleteModalVisible(false);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recruitmentAds'] });
      queryClient.invalidateQueries({ queryKey: ['myRecruitmentAds'] });
      queryClient.invalidateQueries({ queryKey: ['recruitmentAd', adId] });
      setIsDeleteModalVisible(false);
      navigation.goBack();
    },
  });

  const applyMutation = useMutation({
    mutationFn: (payload) => applyToRecruitmentAd(ad.documentId || ad.id, payload),
    onError: (error) => {
      const message = error?.response?.data?.error?.message
        || error?.response?.data?.message
        || error?.message
        || 'Impossible d\'envoyer la candidature pour le moment.';
      Alert.alert('Candidature', message);
    },
    onSuccess: (result) => {
      setIsDetectionApplyModalVisible(false);
      setHasAcceptedDetectionRiskDeclaration(false);
      setHasAcceptedDetectionConditions(false);
      queryClient.invalidateQueries({ queryKey: ['recruitmentAd', adId] });
      queryClient.invalidateQueries({ queryKey: ['recruitmentAds'] });
      queryClient.invalidateQueries({ queryKey: ['myApplications'] });
      if (ad?.event?.documentId) {
        queryClient.invalidateQueries({ queryKey: ['event', ad.event.documentId] });
        queryClient.invalidateQueries({ queryKey: ['eventParticipations', ad.event.documentId] });
      }
      Alert.alert(
        'Candidature envoyee',
        result?.message || 'Ta candidature a bien ete envoyee.',
      );
    },
  });

  const acceptParticipationMutation = useMutation({
    mutationFn: acceptEventParticipation,
    onError: (error) => {
      const message = error?.response?.data?.error?.message
        || error?.response?.data?.message
        || error?.message
        || 'Impossible d\'accepter cette candidature pour le moment.';
      Alert.alert('Candidatures', message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recruitmentAdParticipations', eventDocumentId, recruitmentAdDocumentId] });
      queryClient.invalidateQueries({ queryKey: ['recruitmentAd', adId] });
      queryClient.invalidateQueries({ queryKey: ['recruitmentAds'] });
      if (eventDocumentId) {
        queryClient.invalidateQueries({ queryKey: ['event', eventDocumentId] });
        queryClient.invalidateQueries({ queryKey: ['eventParticipations', eventDocumentId] });
      }
    },
  });

  const declineParticipationMutation = useMutation({
    mutationFn: declineEventParticipation,
    onError: (error) => {
      const message = error?.response?.data?.error?.message
        || error?.response?.data?.message
        || error?.message
        || 'Impossible de refuser cette candidature pour le moment.';
      Alert.alert('Candidatures', message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recruitmentAdParticipations', eventDocumentId, recruitmentAdDocumentId] });
      queryClient.invalidateQueries({ queryKey: ['recruitmentAd', adId] });
      queryClient.invalidateQueries({ queryKey: ['recruitmentAds'] });
      if (eventDocumentId) {
        queryClient.invalidateQueries({ queryKey: ['event', eventDocumentId] });
        queryClient.invalidateQueries({ queryKey: ['eventParticipations', eventDocumentId] });
      }
    },
  });

  const confirmDelete = () => {
    deleteMutation.mutate(ad.documentId || ad.id);
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTintColor: Colors.neutral100,
      headerTitle: '',
      headerTransparent: true,
    });
  }, [navigation, Colors]);

  const team = ad?.team;
  const club = team?.club;
  const clubName = club?.name || team?.name || 'Club inconnu';
  const clubLogo = getImageUrl(club?.logo?.url);
  const positionLabel = ad?.position || 'Poste non specifie';
  const levelName = ad?.level?.name || ad?.minLevel || 'Niveau ?';
  const categoryName = ad?.category?.name || ad?.category || 'Categorie ?';
  const address = getShortAddress(ad?.city || club?.city || '');
  const sectionName = ad?.section?.name || ad?.section;
  const date = ad?.createdAt ? formatDateWithDayPrefix(new Date(ad.createdAt)) : '';
  const isDetectionLinked = normalizeTypeLabel(ad?.event?.type?.name).includes('detection');
  const detectionDate = ad?.event?.date ? formatDateWithDayPrefix(new Date(ad.event.date)) : '';
  const detectionDateTimeLabel = useMemo(() => {
    if (!ad?.event?.date) return '';

    const detectionDateValue = new Date(ad.event.date);
    if (Number.isNaN(detectionDateValue.getTime())) return '';

    const dateLabel = formatDateWithDayPrefix(detectionDateValue);
    const hourLabel = detectionDateValue.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    return hourLabel ? `${dateLabel} a ${hourLabel}` : dateLabel;
  }, [ad?.event?.date]);
  const detectionApplySummary = useMemo(() => {
    const summaryParts = [];

    if (positionLabel) {
      summaryParts.push(`Poste vise : ${positionLabel}`);
    }

    if (detectionDateTimeLabel) {
      summaryParts.push(`Date de la detection : ${detectionDateTimeLabel}`);
    }

    if (clubName) {
      summaryParts.push(`Club concerne : ${clubName}`);
    }

    return summaryParts.join('\n');
  }, [clubName, detectionDateTimeLabel, positionLabel]);
  const checkableWrapperStyle = useMemo(() => ([
    ApplicationStyle.borderWidth0,
    ApplicationStyle.backgroundColor.transparent,
    Spaces.padding[0],
    Alignments.rowReverse,
    { flex: 0, width: '100%' },
  ]), [Alignments.rowReverse, ApplicationStyle.backgroundColor.transparent, ApplicationStyle.borderWidth0, Spaces.padding]);

  if (!ad) {
    return (
      <ScreenContainer bgImage="bg2">
        <View style={[Alignments.fill, Alignments.alignCenter, Alignments.justifyCenter, Spaces.padding[16], { gap: 12 }]}>
          <Text style={[Fonts.h3, { color: adError ? Colors.error500 : Colors.neutral100 }]}>
            {isLoading ? 'Chargement...' : adError ? 'Chargement impossible' : 'Annonce introuvable'}
          </Text>
          <Text style={[Fonts.p2, { color: Colors.neutral300, textAlign: 'center' }]}>
            {adError?.message || 'Cette annonce n est plus disponible ou n a pas pu etre chargee.'}
          </Text>
          {adError ? (
            <Button
              onPress={() => refetchAd()}
              title="Recharger"
              variant="Primary"
            />
          ) : null}
        </View>
      </ScreenContainer>
    );
  }

  const handleApply = () => {
    if (hasApplied) {
      if (applicationState.status === 'accepted') {
        Alert.alert(
          'Candidature',
          isDetectionLinked
            ? 'Tu participes deja a cette detection.'
            : 'Ta candidature est deja validee pour cette annonce.',
        );
        return;
      }

      Alert.alert(
        'Candidature',
        isDetectionLinked
          ? 'Tu as deja une candidature en attente sur cette detection.'
          : 'Tu as deja postule a cette annonce.',
      );
      return;
    }

    if (isDetectionLinked) {
      setHasAcceptedDetectionRiskDeclaration(false);
      setHasAcceptedDetectionConditions(false);
      setIsDetectionApplyModalVisible(true);
      return;
    }

    applyMutation.mutate({});
  };

  const handleCloseDetectionApplyModal = () => {
    if (applyMutation.isPending) return;
    setIsDetectionApplyModalVisible(false);
    setHasAcceptedDetectionRiskDeclaration(false);
    setHasAcceptedDetectionConditions(false);
  };

  const handleConfirmDetectionApply = () => {
    if (!hasAcceptedDetectionRiskDeclaration || !hasAcceptedDetectionConditions) return;

    applyMutation.mutate({
      acceptRiskDeclaration: true,
    });
  };

  const handleEdit = () => {
    navigation.navigate('RecruitmentAdEdit', { ad, adId: ad.documentId });
  };

  const handleOpenDetection = () => {
    if (!ad?.event?.documentId) return;
    navigation.navigate(RouteNames.EventStack, {
      params: { eventId: ad.event.documentId },
      screen: RouteNames.EventDetails,
    });
  };

  const handleDelete = () => {
    setIsDeleteModalVisible(true);
  };

  const handleCandidatePress = (candidateUser) => {
    const candidateUserId = String(
      candidateUser?.documentId
      || candidateUser?.id
      || '',
    ).trim();

    if (!candidateUserId) return;

    if (candidateUserId === userData?.documentId) {
      navigation.navigate(RouteNames.ProfileStack);
      return;
    }

    navigation.navigate(RouteNames.ProfileStack, {
      params: { userId: candidateUserId },
      screen: RouteNames.UserDetails,
    });
  };

  const handleAcceptParticipation = (requestId) => {
    if (!requestId || acceptParticipationMutation.isPending || declineParticipationMutation.isPending) return;
    acceptParticipationMutation.mutate(requestId);
  };

  const handleDeclineParticipation = (requestId) => {
    if (!requestId || acceptParticipationMutation.isPending || declineParticipationMutation.isPending) return;

    Alert.alert(
      'Refuser la candidature',
      'Voulez-vous vraiment refuser cette candidature ?',
      [
        { style: 'cancel', text: 'Annuler' },
        {
          onPress: () => declineParticipationMutation.mutate({ requestId }),
          style: 'destructive',
          text: 'Refuser',
        },
      ],
    );
  };

  let applyButtonTitle = 'Postuler';
  if (applicationState.status === 'accepted') {
    applyButtonTitle = 'Je participe';
  } else if (applicationState.status === 'pending') {
    applyButtonTitle = 'Demande en attente';
  } else if (!ad.isActive) {
    applyButtonTitle = 'Annonce inactive';
  }

  let ownerCandidatesSection = null;

  if (isOwner && isDetectionLinked) {
    ownerCandidatesSection = (
      <View style={{ marginBottom: 32 }}>
        <Text style={[Fonts.h3, { color: Colors.neutral100, marginBottom: 16 }]}>
          Candidatures du poste (
          {slotParticipations.length}
          )
        </Text>
        {slotParticipationsQuery.isLoading ? (
          <View style={styles.emptyCandidatesBox}>
            <Text style={[Fonts.p1, { color: Colors.neutral300 }]}>Chargement des candidatures...</Text>
          </View>
        ) : null}

        {slotParticipationsQuery.error ? (
          <View style={styles.emptyCandidatesBox}>
            <Text style={[Fonts.p1Bold, { color: Colors.error500, marginBottom: 8 }]}>Chargement impossible</Text>
            <Text style={[Fonts.p2, { color: Colors.neutral300, marginBottom: 12, textAlign: 'center' }]}>
              {slotParticipationsQuery.error?.message || 'Impossible de charger les candidatures pour le moment.'}
            </Text>
            <Button
              onPress={() => slotParticipationsQuery.refetch()}
              size="sm"
              title="Recharger"
              variant="Primary"
            />
          </View>
        ) : null}

        {!slotParticipationsQuery.isLoading && !slotParticipationsQuery.error && slotParticipations.length > 0 ? (
          <View style={{ gap: 12 }}>
            {slotParticipations.map((participation) => {
              const participationId = String(participation?.documentId || '').trim();
              const status = String(participation?.participationStatus || '').trim().toLowerCase();
              const statusMeta = getParticipationStatusMeta(status, Colors);
              const candidateUser = participation?.user || participation?.requester;
              const candidateUserId = String(
                candidateUser?.documentId
                || candidateUser?.id
                || '',
              ).trim();
              const canOpenCandidateProfile = Boolean(candidateUserId);
              const requesterName = getCandidateDisplayName(participation);
              const requesterPhone = String(participation?.requester?.phoneNumber || participation?.user?.phoneNumber || '').trim();
              const sourceTeamName = String(participation?.sourceTeam?.name || '').trim();
              const isPending = status === 'pending';
              const isAcceptLoading = acceptParticipationMutation.isPending
                && acceptParticipationMutation.variables === participationId;
              const isDeclineLoading = declineParticipationMutation.isPending
                && declineParticipationMutation.variables?.requestId === participationId;
              const isProcessing = isAcceptLoading || isDeclineLoading;

              return (
                <View
                  key={participationId || requesterName}
                  style={[
                    styles.candidateCard,
                    {
                      backgroundColor: 'rgba(1,179,244,0.08)',
                      borderColor: 'rgba(1,179,244,0.22)',
                    },
                  ]}
                >
                  <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[12]]}>
                    <Pressable
                      disabled={!canOpenCandidateProfile}
                      onPress={() => handleCandidatePress(candidateUser)}
                      style={({ pressed }) => ([
                        Alignments.row,
                        Alignments.alignCenter,
                        Spaces.gap[12],
                        {
                          flex: 1,
                          opacity: pressed && canOpenCandidateProfile ? 0.75 : 1,
                        },
                      ])}
                    >
                      <ProfileAvatar
                        imageStyle={{ borderRadius: 40 }}
                        imageUrl={participation?.user?.avatar?.url}
                        size={42}
                        style={{
                          borderColor: Colors.primary500,
                          borderRadius: 42,
                          borderWidth: 1,
                        }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={2} style={[Fonts.p1Bold, { color: Colors.neutral100 }]}>
                          {requesterName}
                        </Text>
                        {sourceTeamName ? (
                          <Text style={[Fonts.p4, { color: Colors.primary500, marginTop: 4 }]}>
                            {sourceTeamName}
                          </Text>
                        ) : null}
                        {requesterPhone ? (
                          <Text style={[Fonts.p4, { color: Colors.neutral300, marginTop: 4 }]}>
                            {requesterPhone}
                          </Text>
                        ) : null}
                        {canOpenCandidateProfile ? (
                          <Text style={[Fonts.p4Bold, { color: Colors.primary500, marginTop: 6 }]}>
                            Voir le profil
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>

                    <View
                      style={[
                        styles.candidateStatusBadge,
                        {
                          backgroundColor: statusMeta.backgroundColor,
                          borderColor: statusMeta.borderColor,
                        },
                      ]}
                    >
                      <Text style={[Fonts.p4Bold, { color: statusMeta.textColor }]}>
                        {statusMeta.label}
                      </Text>
                    </View>
                  </View>

                  {isPending ? (
                    <View style={[Alignments.row, Alignments.justifyEnd, Spaces.gap[8], { marginTop: 12 }]}>
                      <Button
                        disabled={isProcessing}
                        isLoading={isAcceptLoading}
                        onPress={() => handleAcceptParticipation(participationId)}
                        size="sm"
                        title="Accepter"
                        variant="Primary"
                      />
                      <Button
                        disabled={isProcessing}
                        isLoading={isDeclineLoading}
                        onPress={() => handleDeclineParticipation(participationId)}
                        size="sm"
                        title="Refuser"
                        variant="Secondary"
                      />
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : null}

        {!slotParticipationsQuery.isLoading && !slotParticipationsQuery.error && slotParticipations.length === 0 ? (
          <View style={styles.emptyCandidatesBox}>
            <Text style={[Fonts.p1, { color: Colors.neutral300 }]}>Aucune candidature pour le moment.</Text>
          </View>
        ) : null}
      </View>
    );
  } else if (isOwner) {
    ownerCandidatesSection = (
      <View style={{ marginBottom: 32 }}>
        <Text style={[Fonts.h3, { color: Colors.neutral100, marginBottom: 16 }]}>
          Candidatures (
          {candidates.length}
          )
        </Text>
        {candidates.length > 0 ? (
          <View>
            <View style={{ marginBottom: 12 }}>
              {candidates.slice(0, 3).map((candidate) => {
                const candidateKey = candidate?.documentId || candidate?.id || candidate?.phoneNumber;
                const candidateId = String(candidate?.documentId || candidate?.id || '').trim();
                const candidateName = [candidate?.firstname, candidate?.lastname]
                  .filter(Boolean)
                  .join(' ')
                  .trim() || candidate?.phoneNumber || 'Candidat';
                const candidatePhone = String(candidate?.phoneNumber || '').trim();

                return (
                  <Pressable
                    disabled={!candidateId}
                    key={String(candidateKey)}
                    onPress={() => handleCandidatePress(candidate)}
                    style={({ pressed }) => ([
                      styles.candidateCard,
                      {
                        backgroundColor: 'rgba(1,179,244,0.08)',
                        borderColor: 'rgba(1,179,244,0.22)',
                        marginBottom: 8,
                        opacity: pressed && candidateId ? 0.75 : 1,
                      },
                    ])}
                  >
                    <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[12]]}>
                      <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12], { flex: 1 }]}>
                        <ProfileAvatar
                          imageStyle={{ borderRadius: 40 }}
                          imageUrl={candidate?.avatar?.url}
                          size={42}
                          style={{
                            borderColor: Colors.primary500,
                            borderRadius: 42,
                            borderWidth: 1,
                          }}
                        />
                        <View style={{ flex: 1 }}>
                          <Text numberOfLines={2} style={[Fonts.p1Bold, { color: Colors.neutral100 }]}>
                            {candidateName}
                          </Text>
                          {candidatePhone ? (
                            <Text style={[Fonts.p4, { color: Colors.neutral300, marginTop: 4 }]}>
                              {candidatePhone}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                      {candidateId ? (
                        <Text style={[Fonts.p4Bold, { color: Colors.primary500 }]}>
                          Voir le profil
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={styles.emptyCandidatesBox}>
            <Text style={[Fonts.p1, { color: Colors.neutral300 }]}>Aucune candidature pour le moment.</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[Alignments.fill, Alignments.justifySpaceBetween]}
    >
      <ScrollView contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
        <ImageBackground
          resizeMode="cover"
          source={getBackgroundImage()}
          style={[
            styles.headerImage,
            {
              borderColor: Colors.primary500,
              borderWidth: 1.5,
              elevation: 10,
              shadowColor: Colors.primary500,
              shadowOffset: { height: 0, width: 0 },
              shadowOpacity: 0.4,
              shadowRadius: 10,
            },
          ]}
        >
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.3)' }]} />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.9)']}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.headerContent}>
            <View style={[styles.shieldContainer, { shadowColor: Colors.primary500 }]}>
              {clubLogo ? (
                <ImageBackground
                  imageStyle={{ borderRadius: 50 }}
                  source={{ uri: clubLogo }}
                  style={styles.clubLogo}
                />
              ) : (
                <View style={{ transform: [{ scale: 1.5 }] }}>
                  <TeamShield initials={getClubInitials(clubName)} />
                </View>
              )}
            </View>

            <Text style={[Fonts.h1, styles.title]}>
              {positionLabel}
            </Text>
            <Text style={[Fonts.h3, styles.clubTitle, { color: Colors.primary500 }]}>
              {clubName}
            </Text>
            {team?.name && (
              <Text style={[Fonts.p1, { color: Colors.neutral300, marginTop: 2, textAlign: 'center' }]}>
                {team.name}
                {' '}
                {sectionName ? `- ${sectionName}` : ''}
              </Text>
            )}

            <View style={[styles.statusBadge, {
              backgroundColor: ad.isActive ? 'rgba(0, 179, 244, 0.2)' : 'rgba(100,100,100,0.2)',
              borderColor: ad.isActive ? Colors.primary500 : Colors.neutral500,
            }]}
            >
              <Text style={[Fonts.captionBold, { color: ad.isActive ? Colors.primary500 : Colors.neutral400 }]}>
                {ad.isActive ? 'EN LIGNE' : 'INACTIF'}
              </Text>
            </View>
          </View>
        </ImageBackground>

        <View style={[
          styles.infoBar,
          {
            borderColor: Colors.primary500,
            borderWidth: 1.5,
            elevation: 10,
            shadowColor: Colors.primary500,
            shadowOpacity: 0.5,
            shadowRadius: 12,
          },
        ]}
        >
          <View style={styles.infoItem}>
            <Text style={[Fonts.caption, { color: Colors.neutral300, marginBottom: 4 }]}>Publie le</Text>
            <Text style={[Fonts.p2Bold, { color: Colors.neutral100, textAlign: 'center' }]}>{date}</Text>
          </View>
          <View style={styles.separator} />
          <View style={styles.infoItem}>
            <Text style={[Fonts.caption, { color: Colors.neutral300, marginBottom: 4 }]}>Niveau</Text>
            <Text
              numberOfLines={2}
              style={[Fonts.p2Bold, { color: Colors.neutral100, textAlign: 'center' }]}
            >
              {levelName}
            </Text>
          </View>
          <View style={styles.separator} />
          <View style={styles.infoItem}>
            <Text style={[Fonts.caption, { color: Colors.neutral300, marginBottom: 4 }]}>Categorie</Text>
            <Text style={[Fonts.p2Bold, { color: Colors.neutral100, textAlign: 'center' }]}>{categoryName}</Text>
          </View>
        </View>

        <View style={[Spaces.paddingHorizontal[16], Spaces.paddingTop[24]]}>
          <View style={[Alignments.row, { flexWrap: 'wrap', gap: 8, marginBottom: 24 }]}>
            {isDetectionLinked ? (
              <Tag
                style={{ backgroundColor: 'rgba(1,179,244,0.14)', borderColor: Colors.primary500 }}
                text={detectionDate ? `Detection · ${detectionDate}` : 'Detection'}
                textColor="primary500"
                textStyle={{ fontWeight: '700' }}
              />
            ) : null}
            {address ? (
              <Tag
                style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderColor: 'transparent' }}
                text={address}
                textColor="neutral100"
                textStyle={{ fontWeight: '600' }}
              />
            ) : null}
          </View>

          {ownerCandidatesSection}

          <Text style={[Fonts.h3, { color: Colors.neutral100, marginBottom: 16 }]}>Description</Text>
          <Text style={[Fonts.p1, { color: Colors.neutral300, lineHeight: 26 }]}>
            {ad.description || 'Aucune description fournie pour cette annonce.'}
          </Text>

          {isAppliedOnAnotherDetectionSlot ? (
            <View
              style={{
                backgroundColor: applicationState.status === 'accepted' ? `${Colors.success500}12` : `${Colors.warning500}12`,
                borderColor: applicationState.status === 'accepted' ? `${Colors.success500}35` : `${Colors.warning500}35`,
                borderRadius: 18,
                borderWidth: 1,
                marginTop: 20,
                padding: 14,
              }}
            >
              <Text style={[Fonts.p2Bold, { color: applicationState.status === 'accepted' ? Colors.success500 : Colors.warning500 }]}>
                {applicationState.status === 'accepted' ? 'Participation deja validee sur cette detection' : 'Candidature deja envoyee sur cette detection'}
              </Text>
              <Text style={[Fonts.p3, { color: Colors.neutral200, lineHeight: 20, marginTop: 6 }]}>
                {applicationState.status === 'accepted'
                  ? 'Tu participes deja a un autre poste de cette detection. Les autres annonces gardent donc le meme statut.'
                  : 'Tu as deja une demande en attente sur un autre poste de cette detection. Les autres annonces gardent donc le meme statut.'}
              </Text>
            </View>
          ) : null}

          {isDetectionLinked && ad?.event?.documentId ? (
            <View style={{ marginTop: 24 }}>
              <Button
                onPress={handleOpenDetection}
                title="Ouvrir la detection"
                variant="Secondary"
              />
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {isOwner ? (
          <View>
            <View style={{ marginBottom: 12 }}>
              <Button
                onPress={handleEdit}
                title="Modifier"
                variant="Primary"
              />
            </View>
            <View>
              <Button
                onPress={handleDelete}
                style={styles.deleteButton}
                textStyle={{ color: '#FF3B30' }}
                title="Supprimer"
                variant="Secondary"
              />
            </View>
          </View>
        ) : (
          <Button
            disabled={!ad.isActive || hasApplied}
            isLoading={applyMutation.isPending}
            onPress={handleApply}
            title={applyButtonTitle}
            variant="Primary"
          />
        )}
      </View>

      <BottomModal
        close={() => setIsDeleteModalVisible(false)}
        height={250}
        isVisible={isDeleteModalVisible}
      >
        <View style={Spaces.gap[12]}>
          <Text style={[Fonts.h3, { color: Colors.neutral100, marginBottom: 8, textAlign: 'center' }]}>
            Supprimer cette annonce
          </Text>
          <Text style={[Fonts.p1, { color: Colors.neutral300, marginBottom: 24, textAlign: 'center' }]}>
            Voulez-vous vraiment supprimer cette annonce ? Cette action est irreversible.
          </Text>

          <View style={{ gap: 12 }}>
            <Button
              isLoading={deleteMutation.isPending}
              onPress={confirmDelete}
              style={{ backgroundColor: '#FF3B30' }}
              title="Supprimer"
              variant="Primary"
            />
            <Button
              onPress={() => setIsDeleteModalVisible(false)}
              title="Annuler"
              variant="Secondary"
            />
          </View>
        </View>
      </BottomModal>
      <BottomModal
        close={handleCloseDetectionApplyModal}
        footerComponent={(
          <View style={{ gap: 12 }}>
            <Button
              disabled={!hasAcceptedDetectionRiskDeclaration || !hasAcceptedDetectionConditions}
              isLoading={applyMutation.isPending}
              onPress={handleConfirmDetectionApply}
              title="Confirmer ma candidature"
              variant="Primary"
            />
            <Button
              disabled={applyMutation.isPending}
              onPress={handleCloseDetectionApplyModal}
              title="Annuler"
              variant="Secondary"
            />
          </View>
        )}
        headerComponent={(
          <Text style={[Fonts.p1Black, { color: Colors.neutral100, textAlign: 'center' }]}>
            {t('eventList.joinModal.title')}
          </Text>
        )}
        hideCloseButton
        isVisible={isDetectionApplyModalVisible}
        snapPoints={['78%']}
      >
        <View style={{ gap: 20 }}>
          <View
            style={{
              backgroundColor: 'rgba(1,179,244,0.10)',
              borderColor: 'rgba(1,179,244,0.28)',
              borderRadius: 18,
              borderWidth: 1,
              padding: 16,
            }}
          >
            <Text style={[Fonts.p2Bold, { color: Colors.primary500, marginBottom: 8 }]}>
              Tu candidates a une detection
            </Text>
            <Text style={[Fonts.p2, { color: Colors.neutral100, lineHeight: 22 }]}>
              {detectionApplySummary || 'Verification de la detection en cours.'}
            </Text>
          </View>

          <Text style={[Fonts.p1, { color: Colors.neutral100, lineHeight: 24 }]}>
            {t('eventList.joinModal.description', { clubName })}
          </Text>

          <Checkable
            fontStyle={[Fonts.p2, { color: Colors.neutral100, flex: 1 }]}
            isChecked={hasAcceptedDetectionRiskDeclaration}
            setIsChecked={() => setHasAcceptedDetectionRiskDeclaration((previous) => !previous)}
            text={t('eventList.joinModal.checkboxes.responsibility')}
            type="square"
            wrapperStyle={checkableWrapperStyle}
          />

          <Checkable
            fontStyle={[Fonts.p2, { color: Colors.neutral100, flex: 1 }]}
            isChecked={hasAcceptedDetectionConditions}
            setIsChecked={() => setHasAcceptedDetectionConditions((previous) => !previous)}
            text={t('eventList.joinModal.checkboxes.conditions')}
            type="square"
            wrapperStyle={checkableWrapperStyle}
          />

          <Text style={[Fonts.p2, { color: Colors.neutral100, lineHeight: 22 }]}>
            {t('eventList.joinModal.validation')}
          </Text>
        </View>
      </BottomModal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  candidateCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },
  candidateStatusBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  clubLogo: {
    borderColor: '#FFFFFF',
    borderRadius: 50,
    borderWidth: 2,
    height: 100,
    width: 100,
  },
  clubTitle: {
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
  },
  deleteButton: {
    backgroundColor: 'transparent',
    borderColor: '#FF3B30',
    borderWidth: 2,
    marginTop: 4,
  },
  emptyCandidatesBox: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
  },
  footer: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 0 : 20,
  },
  headerContent: {
    alignItems: 'center',
    padding: 24,
    paddingBottom: 40,
  },
  headerImage: {
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 32,
    borderWidth: 1,
    height: 380,
    justifyContent: 'flex-end',
    marginTop: 4,
    overflow: 'hidden',
    width: '100%',
  },
  infoBar: {
    backgroundColor: 'rgba(20, 20, 20, 0.95)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 24,
    borderWidth: 1,
    elevation: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginHorizontal: 16,
    marginTop: -30,
    paddingHorizontal: 16,
    paddingVertical: 24,
    shadowColor: '#000',
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  infoItem: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-start',
  },
  separator: {
    alignSelf: 'center',
    backgroundColor: '#444',
    height: '60%',
    width: 1,
  },
  shieldContainer: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 50,
    elevation: 10,
    marginBottom: 16,
    shadowOffset: {
      height: 0,
      width: 0,
    },
    shadowOpacity: 0.4,
    shadowRadius: 16,
  },
  statusBadge: {
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  title: {
    color: '#FFFFFF',
    letterSpacing: 1,
    marginTop: 12,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
});

export default RecruitmentAdDetails;
