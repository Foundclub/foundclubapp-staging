import { useNavigation, useRoute } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLayoutEffect, useMemo, useState } from 'react';
import {
  Alert,
  ImageBackground,
  Platform,
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

const normalizeComparableId = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

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

function RecruitmentAdDetails() {
  const { params } = useRoute();
  const navigation = useNavigation();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const { userData } = useAuth();
  const { getClubInitials } = useClub();
  const queryClient = useQueryClient();
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);

  const adId = params?.ad?.documentId || params?.adId || params?.ad?.id;

  const { data: fetchedAd, isLoading } = useQuery({
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
  const currentUserId = normalizeComparableId(userData?.documentId || userData?.id);

  const hasApplied = useMemo(() => {
    if (!currentUserId || candidates.length === 0) return false;
    return candidates.some((candidate) => {
      const candidateDocumentId = normalizeComparableId(candidate?.documentId);
      const candidateId = normalizeComparableId(candidate?.id);
      return candidateDocumentId === currentUserId || candidateId === currentUserId;
    });
  }, [candidates, currentUserId]);

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
    mutationFn: () => applyToRecruitmentAd(ad.documentId || ad.id),
    onError: (error) => {
      const message = error?.response?.data?.error?.message
        || error?.response?.data?.message
        || error?.message
        || 'Impossible d\'envoyer la candidature pour le moment.';
      Alert.alert('Candidature', message);
    },
    onSuccess: (result) => {
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

  if (!ad) {
    return (
      <ScreenContainer>
        <View style={[Alignments.fill, Alignments.alignCenter, Alignments.justifyCenter]}>
          <Text style={[Fonts.h3, { color: Colors.neutral100 }]}>
            {isLoading ? 'Chargement...' : 'Annonce introuvable'}
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  const { team } = ad;
  const club = team?.club;
  const clubName = club?.name || team?.name || 'Club inconnu';
  const clubLogo = getImageUrl(club?.logo?.url);
  const positionLabel = ad.position || 'Poste non specifie';
  const levelName = ad.level?.name || ad.minLevel || 'Niveau ?';
  const categoryName = ad.category?.name || ad.category || 'Categorie ?';
  const address = getShortAddress(ad.city || club?.city || '');
  const sectionName = ad.section?.name || ad.section;
  const date = ad.createdAt ? formatDateWithDayPrefix(new Date(ad.createdAt)) : '';
  const isDetectionLinked = normalizeTypeLabel(ad?.event?.type?.name).includes('detection');
  const detectionDate = ad?.event?.date ? formatDateWithDayPrefix(new Date(ad.event.date)) : '';

  const handleApply = () => {
    if (hasApplied) {
      Alert.alert('Candidature', 'Tu as deja postule a cette annonce.');
      return;
    }

    applyMutation.mutate();
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
  if (hasApplied) {
    applyButtonTitle = 'Deja postule';
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

        {!slotParticipationsQuery.isLoading && slotParticipations.length > 0 ? (
          <View style={{ gap: 12 }}>
            {slotParticipations.map((participation) => {
              const participationId = String(participation?.documentId || '').trim();
              const status = String(participation?.participationStatus || '').trim().toLowerCase();
              const statusMeta = getParticipationStatusMeta(status, Colors);
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
                    <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12], { flex: 1 }]}>
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
                      </View>
                    </View>

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

        {!slotParticipationsQuery.isLoading && slotParticipations.length === 0 ? (
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
                const candidateName = [candidate?.firstname, candidate?.lastname]
                  .filter(Boolean)
                  .join(' ')
                  .trim() || candidate?.phoneNumber || 'Candidat';

                return (
                  <Text
                    key={String(candidateKey)}
                    style={[Fonts.p1, { color: Colors.neutral300, marginBottom: 6 }]}
                  >
                    -
                    {' '}
                    {candidateName}
                  </Text>
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
