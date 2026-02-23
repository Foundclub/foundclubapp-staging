import { useNavigation, useRoute } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useLayoutEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  ImageBackground,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import useAuth from '@/domains/auth/useAuth';
import useClub from '@/domains/club/useClub';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Loader from '@/components/atoms/loader/Loader';
import Tag from '@/components/atoms/tag/Tag';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { deleteRecruitmentAd, getRecruitmentAd } from '@/services/recruitment/recruitmentService';

import { formatDateWithDayPrefix } from '@/utils/date';
import { getImageUrl } from '@/utils/imageUrl';
import { getShortAddress } from '@/utils/location';

// Assets (Same as EventDetails/RecruitmentAdCard)
const BG_OTHER = require('@/assets/background-card-event/card-autre.png');
const BG_TRAINING = require('@/assets/background-card-event/card-entrainement.png');
const BG_MATCH = require('@/assets/background-card-event/card-match.png');

// Get background based on sport/context (simplified logic)
const getBackgroundImage = (sport) =>
// Could eventually depend on sport
  BG_MATCH
;

/**
 *
 */
function RecruitmentAdDetails() {
  const { params } = useRoute();
  const navigation = useNavigation();
  const { t } = useTranslation();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const { userData } = useAuth();
  const { getClubInitials } = useClub();
  const queryClient = useQueryClient();
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);

  // Get adId from params (handle both full object or just ID)
  const adId = params?.ad?.documentId || params?.adId || params?.ad?.id;

  // Fetch fresh ad details
  const { data: fetchedAd, isLoading } = useQuery({
    enabled: !!adId,
    initialData: params?.ad, // Show passed data immediately while fetching
    queryFn: () => getRecruitmentAd(adId),
    queryKey: ['recruitmentAd', adId],
  });

  const ad = fetchedAd || params?.ad;
  const isOwner = useMemo(() => {
    if (!userData || !ad) return false;

    // 1. Direct Author check
    if (ad.author?.documentId === userData.documentId || ad.author?.id === userData.id) return true;

    // 2. Team Managment check (Coach/Manager)
    const myTeams = userData.myTeams || [];
    const trainedTeams = userData.trainedTeams || [];
    const allUserTeams = [...myTeams, ...trainedTeams];

    const adTeamId = ad.team?.documentId || ad.team?.id;
    if (!adTeamId) return false;

    return allUserTeams.some((t) => t.documentId === adTeamId || t.id === adTeamId);
  }, [userData, ad]);

  const deleteMutation = useMutation({
    mutationFn: deleteRecruitmentAd,
    onError: (error) => {
      console.error('Error deleting ad:', error);
      setIsDeleteModalVisible(false);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recruitmentAds'] });
      queryClient.invalidateQueries({ queryKey: ['myRecruitmentAds'] });
      setIsDeleteModalVisible(false);
      navigation.goBack();
    },
  });

  const confirmDelete = () => {
    deleteMutation.mutate(ad.documentId);
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
          <Text style={[Fonts.h3, { color: Colors.neutral100 }]}>Annonce introuvable</Text>
        </View>
      </ScreenContainer>
    );
  }

  // Data Extraction & Formatting
  const { team } = ad;
  const club = team?.club;
  const clubName = club?.name || team?.name || 'Club inconnu';
  // Simplified logic for audit fix - assuming club logo is enough or ad specific image
  const clubLogo = getImageUrl(club?.logo?.url);
  const positionLabel = ad.position || 'Poste non spécifié';
  const levelName = ad.level?.name || ad.minLevel || 'Niveau ?';
  const categoryName = ad.category?.name || ad.category || 'Catégorie ?';
  const address = getShortAddress(ad.city || club?.city || '');
  const sectionName = ad.section?.name || ad.section;
  const date = ad.createdAt ? formatDateWithDayPrefix(new Date(ad.createdAt)) : '';

  // Actions
  const handleViewCandidates = () => {
    Alert.alert('Candidatures', 'Liste des candidats à venir.');
    // navigation.navigate('RecruitmentCandidates', { adId: ad.documentId });
  };

  const handleApply = () => {
    Alert.alert('Postuler', 'Fonctionnalité en cours de développement (bientôt disponible !)');
  };

  const handleEdit = () => {
    navigation.navigate('RecruitmentAdEdit', { ad, adId: ad.documentId });
  };

  const handleDelete = () => {
    setIsDeleteModalVisible(true);
  };

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[Alignments.fill, Alignments.justifySpaceBetween]}
    >
      <ScrollView contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
        {/* Header Image */}
        <ImageBackground
          resizeMode="cover"
          source={getBackgroundImage(club?.sport)}
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
            {/* Club Shield */}
            <View style={[styles.shieldContainer, { shadowColor: Colors.primary500 }]}>
              {clubLogo ? (
                <ImageBackground
                  imageStyle={{ borderRadius: 50 }}
                  source={{ uri: clubLogo }}
                  style={styles.clubLogo}
                />
              ) : (
                <View style={{ transform: [{ scale: 1.5 }] }}>
                      <TeamShield
                           initials={getClubInitials(clubName)}
                         />
                    </View>
              )}
            </View>

            {/* Title & Club */}
            <Text style={[Fonts.h1, {
              color: Colors.neutral100, letterSpacing: 1, marginTop: 12, textAlign: 'center', textTransform: 'uppercase',
            }]}
            >
              {positionLabel}
            </Text>
            <Text style={[Fonts.h3, {
              color: Colors.primary500, fontWeight: '700', marginTop: 4, textAlign: 'center',
            }]}
            >
              {clubName}
            </Text>
            {team?.name && (
            <Text style={[Fonts.p1, { color: Colors.neutral300, marginTop: 2, textAlign: 'center' }]}>
              {team.name}
              {' '}
              {sectionName ? `• ${sectionName}` : ''}
            </Text>
            )}

            {/* Status Badge */}
            <View style={[styles.statusBadge, { backgroundColor: ad.isActive ? 'rgba(0, 179, 244, 0.2)' : 'rgba(100,100,100,0.2)', borderColor: ad.isActive ? Colors.primary500 : Colors.neutral500 }]}>
              <Text style={[Fonts.captionBold, { color: ad.isActive ? Colors.primary500 : Colors.neutral400 }]}>
                {ad.isActive ? 'EN LIGNE' : 'INACTIF'}
              </Text>
            </View>
          </View>
        </ImageBackground>

        {/* Info Bar */}

        {/* Info Bar */}
        {/* Info Bar */}
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
            <Text style={[Fonts.caption, { color: Colors.neutral300, marginBottom: 4 }]}>Publié le</Text>
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
            <Text style={[Fonts.caption, { color: Colors.neutral300, marginBottom: 4 }]}>Catégorie</Text>
            <Text style={[Fonts.p2Bold, { color: Colors.neutral100, textAlign: 'center' }]}>{categoryName}</Text>
          </View>
        </View>

        {/* Main Content */}
        <View style={[Spaces.paddingHorizontal[16], Spaces.paddingTop[24]]}>

          {/* Tags */}
          <View style={[Alignments.row, { flexWrap: 'wrap', gap: 8, marginBottom: 24 }]}>
            {address && <Tag style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderColor: 'transparent' }} text={address} textColor="neutral100" textStyle={{ fontWeight: '600' }} />}
          </View>

          {/* Owner Section: Applications */}
          {isOwner && (
          <View style={{ marginBottom: 32 }}>
            <Text style={[Fonts.h3, { color: Colors.neutral100, marginBottom: 16 }]}>
              Candidatures (
              {ad.applications?.length || 0}
              )
            </Text>
            {ad.applications?.length > 0 ? (
              <View>
                {/* Preview of first few candidates could go here */}
                <Button
                      onPress={handleViewCandidates}
                      style={{ backgroundColor: Colors.primary500 }}
                      title="Voir les candidats"
                      variant="Primary"
                    />
              </View>
            ) : (
              <View style={{
                    alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 16,
                  }}
                  >
                    <Text style={[Fonts.p1, { color: Colors.neutral300 }]}>Aucune candidature pour le moment.</Text>
                  </View>
            )}
          </View>
          )}

          {/* Description */}
          <Text style={[Fonts.h3, { color: Colors.neutral100, marginBottom: 16 }]}>Description</Text>
          <Text style={[Fonts.p1, { color: Colors.neutral300, lineHeight: 26 }]}>
            {ad.description || 'Aucune description fournie pour cette annonce.'}
          </Text>

        </View>
      </ScrollView>

      {/* Footer Actions (Floating) */}
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
                style={{
                  backgroundColor: 'transparent',
                  borderColor: '#FF3B30',
                  borderWidth: 2,
                  marginTop: 4,
                }}
                textStyle={{ color: '#FF3B30' }}
                title="Supprimer"
                variant="Secondary"
              />
            </View>
          </View>
        ) : (
          <Button
            onPress={handleApply}
            title="Postuler"
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
            Supprimer l'annonce
          </Text>
          <Text style={[Fonts.p1, { color: Colors.neutral300, marginBottom: 24, textAlign: 'center' }]}>
            Voulez-vous vraiment supprimer cette annonce ? Cette action est irréversible.
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
  clubLogo: {
    borderColor: '#FFFFFF', // White border for pop
    borderRadius: 50,
    borderWidth: 2,
    height: 100,
    width: 100, // Larger logo
  },
  footer: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 0 : 20, // Adjust bottom padding since ScreenContainer handles safe area logic or flex
    // No background, no border, just padding/spacing
  },
  headerContent: {
    alignItems: 'center',
    padding: 24,
    paddingBottom: 40, // Space for overlap
  },
  headerImage: {
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 32, // Large radius for modern look
    borderWidth: 1,
    height: 380, // slightly taller for better spacing
    justifyContent: 'flex-end',
    marginTop: 4,
    overflow: 'hidden',
    width: '100%',
  },
  infoBar: {
    backgroundColor: 'rgba(20, 20, 20, 0.95)', // Deep dark with slight transparency
    borderColor: 'rgba(255,255,255,0.08)', // Subtle highlight
    borderRadius: 24, // softer corners
    borderWidth: 1,
    elevation: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginHorizontal: 16,
    marginTop: -30, // More overlap
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
  modalContent: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
  },
  separator: {
    alignSelf: 'center',
    backgroundColor: '#444',
    height: '60%',
    width: 1,
  },
  shieldContainer: {
    // shadowColor set dynamically
    backgroundColor: 'rgba(0,0,0,0.2)', // Subtle backing
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
});

export default RecruitmentAdDetails;
