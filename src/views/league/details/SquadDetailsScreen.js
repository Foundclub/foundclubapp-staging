import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, Image, ImageBackground, RefreshControl, ScrollView, Share, Text, TouchableOpacity, View,
} from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';

import useAuth from '@/domains/auth/useAuth';
import useClub from '@/domains/club/useClub';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import DivisionBadge from '@/components/atoms/league/DivisionBadge';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import ProfilePicturePreviewOverlay from '@/components/molecules/profilePicturePreviewOverlay/ProfilePicturePreviewOverlay';
import TeamSlotList from '@/components/molecules/teamSlotList/TeamSlotList';
import TeamSlotCreationForm from '@/components/organisms/teamSlotCreationForm/TeamSlotCreationForm';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetLeagueTeam } from '@/services/leagueTeam/leagueTeamQueries';
import { updateLeagueTeam } from '@/services/leagueTeam/leagueTeamService';
import { createTeamSlot, deleteTeamSlot, updateTeamSlot } from '@/services/teamSlot/teamSlotService';

import { getEntityDocumentId } from '@/utils/entityId';
import { getImageUrl } from '@/utils/imageUrl';
import { normalizeLocationInput } from '@/utils/location';

/**
 * Squad Details Screen for FC League
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 */
function SquadDetailsScreen({ navigation, route }) {
  const { teamId } = route?.params ?? {};
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { userData: currentUser } = /** @type {{ userData: User | null }} */ (useAuth());
  const currentUserId = getEntityDocumentId(currentUser);
  const { getClubInitials } = useClub();

  // Use League Team Hook
  const { data: team, isLoading, refetch } = useGetLeagueTeam(teamId);

  const [isSlotModalVisible, setIsSlotModalVisible] = useState(false);

  const [isUpdating, setIsUpdating] = useState(false);
  const [editingSlot, setEditingSlot] = useState(/** @type {LeagueSlot | null} */ (null));

  const [isCoverPreviewVisible, setIsCoverPreviewVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const snapPoints = useMemo(() => ['85%'], []);

  // Calculate isCaptain
  const isCaptain = useMemo(() => team?.captain?.documentId === currentUser?.documentId, [team, currentUser]);

  const isMember = useMemo(() => team?.roster?.some((/** @type {User} */ p) => p.documentId === currentUser?.documentId) || isCaptain, [team, currentUser, isCaptain]);

  const hasPendingRequest = useMemo(() => team?.join_requests?.some((/** @type {User} */ u) => u.documentId === currentUser?.documentId), [team, currentUser]);

  const rosterCount = useMemo(() => {
    const uniqueIds = new Set();
    if (team?.captain?.documentId) uniqueIds.add(String(team.captain.documentId));
    (team?.roster || []).forEach((/** @type {User} */ player) => {
      if (player?.documentId) uniqueIds.add(String(player.documentId));
    });
    return uniqueIds.size;
  }, [team]);

  const normalizedHomeBase = useMemo(
    () => normalizeLocationInput(team?.home_base),
    [team?.home_base],
  );

  const locationLabel = useMemo(
    () => normalizedHomeBase?.city
      || normalizedHomeBase?.label
      || normalizedHomeBase?.address
      || 'Localisation non renseignee',
    [normalizedHomeBase],
  );

  const handleShare = useCallback(() => {
    const squadId = team?.documentId || teamId;
    const deepLink = squadId ? `foundclub://squad/${squadId}` : null;
    const message = deepLink
      ? `Rejoins ma squad ${team?.name || ''} sur FoundClub League !\n${deepLink}`
      : `Rejoins ma squad ${team?.name || ''} sur FoundClub League !`;

    Share.share({
      message,
      title: `Rejoins ${team?.name || 'ma squad'} !`,
    });
  }, [team?.documentId, team?.name, teamId]);

  const handleRequestJoin = async () => {
    try {
      if (!teamId || !currentUserId) {
        Alert.alert(t('common.error'), t('squad.join.error', 'Impossible d\'envoyer la demande.'));
        return;
      }
      setIsUpdating(true);
      const { requestToJoinSquad } = require('@/services/leagueTeam/leagueTeamService');
      await requestToJoinSquad(String(teamId || ''), currentUserId || '');
      await refetch();
      Alert.alert(t('squad.join.successTitle', 'Demande envoyée'), t('squad.join.successMessage', 'Le capitaine a reçu votre demande.'));
    } catch (error) {
      console.error(error);
      Alert.alert(t('common.error'), t('squad.join.error', 'Impossible d\'envoyer la demande.'));
    } finally {
      setIsUpdating(false);
    }
  };

  /**
   * @param {'logo' | 'cover'} type
   */
  const handleImageUpload = (type) => { // type: 'logo' (mapped to crest) | 'cover'
    Alert.alert(
      'Modifier la photo',
      'Choisissez une option',
      [
        {
          onPress: () => openImagePicker(type, 'camera'),
          text: 'Camera',
        },
        {
          onPress: () => openImagePicker(type, 'library'),
          text: 'Galerie',
        },
        {
          style: 'cancel',
          text: 'Annuler',
        },
      ],
    );
  };

  /**
   * @param {'logo' | 'cover'} type
   * @param {'camera' | 'library'} source
   */
  const openImagePicker = async (type, source) => {
    try {
      const cameraOptions = /** @type {import('react-native-image-picker').CameraOptions} */ ({
        mediaType: 'photo',
        quality: 0.8,
        saveToPhotos: true,
      });
      const libraryOptions = /** @type {import('react-native-image-picker').ImageLibraryOptions} */ ({
        mediaType: 'photo',
        quality: 0.8,
      });

      const result = source === 'camera'
        ? await launchCamera(cameraOptions)
        : await launchImageLibrary(libraryOptions);

      if (result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const file = {
          filename: asset.fileName || 'photo.jpg',
          mime: asset.type || 'image/jpeg',
          uri: asset.uri,
        };

        setIsUpdating(true);
        const payload = {
          documentId: String(teamId || ''),
          [type]: file, // Service maps 'logo' to 'crest'
        };

        await updateLeagueTeam(/** @type {any} */ (payload));
        await refetch();
        setIsUpdating(false);
      }
    } catch (e) {
      setIsUpdating(false);
      console.error(e);
      const pickerError = /** @type {{ code?: string }} */ (e);
      if (pickerError?.code !== 'E_PICKER_CANCELLED') {
        Alert.alert('Erreur', 'Impossible de mettre à jour l\'image');
      }
    }
  };

  const handleSaveSlot = async (/** @type {{ day: string, startTime: string, endTime: string }} */ slotData) => {
    try {
      setIsUpdating(true);

      // slotData = { day: 'monday', startTime: '20:00', endTime: '22:00' }
      // New recurring format: just send hours, no date calculation
      const payload = {
        end_hour: `${slotData.endTime}:00`, // "22:00" -> "22:00:00"
        league_team: String(teamId || ''),
        recurrence_day: slotData.day,
        start_hour: `${slotData.startTime}:00`, // "20:00" -> "20:00:00"
        status: 'open',
      };

      if (editingSlot) {
        const editingSlotId = getEntityDocumentId(editingSlot);
        if (!editingSlotId) {
          throw new Error('Missing slot id');
        }
        await updateTeamSlot(editingSlotId, payload);
        Alert.alert('Succès', 'Créneau modifié');
      } else {
        await createTeamSlot(payload);
        Alert.alert('Succès', 'Créneau ajouté');
      }

      await refetch();
      setIsSlotModalVisible(false);
      setEditingSlot(null);
      setIsUpdating(false);
    } catch (e) {
      console.error(e);
      setIsUpdating(false);
      Alert.alert('Erreur', 'Impossible de sauvegarder le créneau');
    }
  };

  const handleDeleteSlot = async (/** @type {LeagueSlot} */ slot) => {
    try {
      setIsUpdating(true);
      const slotId = getEntityDocumentId(slot);
      if (!slotId) {
        throw new Error('Missing slot id');
      }
      await deleteTeamSlot(slotId);
      await refetch();
      setIsSlotModalVisible(false);
      setEditingSlot(null);
      setIsUpdating(false);
      Alert.alert('Succès', 'Créneau supprimé');
    } catch (e) {
      console.error(e);
      setIsUpdating(false);
      Alert.alert('Erreur', 'Impossible de supprimer le créneau');
    }
  };

  const handleSlotPress = (/** @type {LeagueSlot} */ slot) => {
    setEditingSlot(slot);
    setIsSlotModalVisible(true);
  };

  const handleCheckIn = async (/** @type {LeagueSlot} */ slot) => {
    try {
      if (!currentUserId) return;
      if (!isMember) {
        Alert.alert('Action non disponible', 'Rejoignez la squad pour participer aux creneaux.');
        return;
      }
      // Check if already participant
      const isCheckedIn = slot.participants?.some((/** @type {User} */ p) => p.documentId === currentUser?.documentId);

      // Strapi v5 Connect/Disconnect syntax
      const payload = {
        participants: {
          [isCheckedIn ? 'disconnect' : 'connect']: [{ documentId: currentUserId }],
        },
      };

      const slotId = getEntityDocumentId(slot);
      if (!slotId) {
        throw new Error('Missing slot id');
      }
      await updateTeamSlot(slotId, payload);
      await refetch(); // Refresh UI
    } catch (e) {
      console.error(e);
      const backendCode = e?.response?.data?.code
            || e?.response?.data?.error?.details?.code
            || e?.response?.data?.error?.code;
      if (backendCode === 'SQUAD_MEMBERSHIP_REQUIRED') {
        Alert.alert('Action non disponible', 'Rejoignez la squad pour participer aux creneaux.');
        return;
      }
      Alert.alert('Erreur', 'Impossible de modifier votre statut.');
    }
  };

  const showJoinAction = !isMember && !isCaptain;

  return (
    <ScreenContainer bgImage="bg2">
      <ScrollView
        contentContainerStyle={[Spaces.paddingVertical[16], Spaces.paddingHorizontal[4], { paddingBottom: 120 }]}
        refreshControl={<RefreshControl onRefresh={refetch} refreshing={isLoading || isUpdating} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, { marginBottom: 16, marginTop: 4 }]}>
          <HeaderBackButton
            onPress={() => navigation.goBack()}
            style={{ marginLeft: 0 }}
            withDefaultMargin={false}
          />
          <View style={[Alignments.row, Alignments.alignCenter]}>
            {isCaptain ? (
              <TouchableOpacity
                onPress={() => navigation.navigate(RouteNames.SquadRequests, { teamId })}
                style={{ marginRight: 12 }}
              >
                <View>
                  <Text style={[Fonts.p2Bold, { color: Colors.gold500 }]}>Demandes</Text>
                  {team?.join_requests?.length > 0 ? (
                    <View style={{
                      backgroundColor: Colors.error500,
                      borderRadius: 4,
                      height: 8,
                      position: 'absolute',
                      right: -10,
                      top: -5,
                      width: 8,
                    }}
                    />
                  ) : null}
                </View>
              </TouchableOpacity>
            ) : null}
            {isCaptain ? (
              <TouchableOpacity
                onPress={() => navigation.navigate(RouteNames.SquadEdit, { teamId })}
                style={{ marginRight: 12 }}
              >
                <Text style={[Fonts.p2Bold, { color: Colors.primary500 }]}>Modifier</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={handleShare}>
              <Image
                source={Images.share}
                style={[ApplicationStyle.icon24, { tintColor: Colors.primary500 }]}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Header / Identity */}
        <View style={[Alignments.alignCenter, { marginBottom: 24, marginTop: 8 }]}>
          <Text style={[Fonts.p2Bold, { color: Colors.gold500, letterSpacing: 0.8, marginBottom: 6 }]}>SQUAD</Text>
          <Text style={[Fonts.h1, { color: Colors.neutral00, marginBottom: 4, textAlign: 'center' }]}>{team?.name}</Text>
          <Text style={[Fonts.p2, { color: Colors.neutral300, marginBottom: 6, textAlign: 'center' }]}>{locationLabel}</Text>
          {team?.activities?.[0]?.name && (
          <Text style={[Fonts.p1Bold, { color: Colors.primary500 }]}>{team.activities[0].name.toUpperCase()}</Text>
          )}
        </View>

        {/* Join Action for Non-Members */}
        {showJoinAction && (
        <View style={[Alignments.alignCenter, { marginBottom: 30, marginTop: 8, width: '100%' }]}>
          {hasPendingRequest ? (
            <View style={{ backgroundColor: Colors.neutral800, borderRadius: 8, padding: 12 }}>
              <Text style={[Fonts.p2, { color: Colors.neutral100 }]}>Demande en attente...</Text>
            </View>
          ) : (
            <Button
              isLoading={isUpdating}
              onPress={handleRequestJoin}
              style={{
                alignSelf: 'center', marginTop: 6, maxWidth: 340, width: '100%',
              }}
              title="Demander a rejoindre"
              variant="Primary"
            />
          )}
        </View>
        )}

        {/* Info Card */}
        <TouchableOpacity
          activeOpacity={team?.cover?.url ? 0.9 : 1}
          onPress={() => {
            if (team?.cover?.url) setIsCoverPreviewVisible(true);
          }}
          style={[
            { marginBottom: 32, marginTop: showJoinAction ? 2 : 0 },
            {
              borderColor: 'rgba(250, 204, 21, 0.28)',
              borderRadius: 16,
              borderWidth: 1,
              overflow: 'hidden',
            }, // Ensure border radius clips background
          ]}
        >
          <ImageBackground
            imageStyle={{ opacity: 0.6 }} // Dim background image for readability
            source={team?.cover?.url ? { uri: getImageUrl(team.cover.url) } : undefined}
            style={[
              !team?.cover?.url && ApplicationStyle.backgroundColor.primary700,
              Spaces.padding[16],
              Alignments.alignCenter,
              { justifyContent: 'center', minHeight: 200 },
            ]}
          >
            {/* Overlay for better readability if image exists */}
            {team?.cover?.url && (
              <View style={{
                ...Alignments.absolute,
                backgroundColor: 'rgba(0,0,0,0.4)',
                zIndex: -1,
              }}
              />
            )}

            {/* Edit Cover Button (If simple card or captain) */}
            {isCaptain && (
            <View style={{
              left: 10, position: 'absolute', top: 10, zIndex: 10,
            }}
            >
              <TouchableOpacity onPress={() => handleImageUpload('cover')} style={{ alignItems: 'center' }}>
                {/* Plus icon */}
                <View style={{
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  borderRadius: 20,
                  padding: 8,
                }}
                >
                  <Image
                    source={Images.plus}
                    style={[ApplicationStyle.icon16, { tintColor: Colors.primary500 }]}
                  />
                </View>
              </TouchableOpacity>
            </View>
            )}

            <View style={{ alignItems: 'center', flexDirection: 'row', marginBottom: 12 }}>
              {/* Logo or Shield (Using CREST for League Squad) */}
              <View>
                {team?.crest?.url ? (
                  <ProfileAvatar
                    imageUrl={team.crest.url}
                    size={80}
                    style={{ borderColor: Colors.gold500, borderRadius: 80, borderWidth: 2 }}
                  />
                ) : (
                  <TeamShield
                    initials={getClubInitials(team?.name || '')}
                    isGold
                    size={80}
                  />
                )}

                {/* Add Logo Button (Next to shield as requested) */}
                {isCaptain && !team?.crest?.url && (
                <TouchableOpacity
                  onPress={() => handleImageUpload('logo')}
                  style={{
                    backgroundColor: Colors.neutral800,
                    borderColor: Colors.primary500,
                    borderRadius: 20,
                    borderWidth: 1,
                    bottom: 0,
                    padding: 6,
                    position: 'absolute',
                    right: -10,
                  }}
                >
                  <Image
                    source={Images.plus}
                    style={[ApplicationStyle.icon16, { height: 12, tintColor: Colors.primary500, width: 12 }]}
                  />
                </TouchableOpacity>
                )}
              </View>
            </View>

            <Text style={[Fonts.p2, { color: Colors.neutral200, marginBottom: 10, textAlign: 'center' }]}>
              {locationLabel}
            </Text>

            {/* League badges */}
            <View style={[Alignments.row, Alignments.wrap, Alignments.justifyCenter, Spaces.gap[12], { marginTop: 4 }]}>
              {team?.division ? (
                <DivisionBadge
                  division={team.division}
                  showChrome={false}
                  showLabel={false}
                  size={44}
                />
              ) : null}
              {team?.elo ? (
                <View style={{
                  backgroundColor: 'rgba(1, 179, 244, 0.12)',
                  borderColor: 'rgba(1, 179, 244, 0.38)',
                  borderRadius: 999,
                  borderWidth: 1,
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                }}
                >
                  <Text style={[Fonts.p2Bold, { color: Colors.primary500 }]}>
                    {team.elo}
                    {' '}
                    PTS
                  </Text>
                </View>
              ) : null}
            </View>
          </ImageBackground>
        </TouchableOpacity>

        {/* Availability Slots */}
        <View style={{ marginBottom: 28 }}>
          <TeamSlotList
            currentUserId={currentUser?.documentId}
            isCaptain={isCaptain}
            isMember={Boolean(isMember)}
            onAddSlot={() => setIsSlotModalVisible(true)}
            onCheckIn={handleCheckIn}
            onSlotPress={handleSlotPress}
            slots={team?.slots || []}
          />
        </View>

        {/* Roster Preview */}
        <View style={{ marginBottom: 24 }}>
          <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.marginBottom[12]]}>
            <Text style={[Fonts.h2, { color: Colors.neutral00 }]}>
              Effectif (
              {rosterCount}
              )
            </Text>
          </View>

          {/* Captain */}
          {team?.captain && (
          <View
            key={team.captain.documentId}
            style={[
              Alignments.row, Alignments.alignCenter, Spaces.gap[12],
              ApplicationStyle.backgroundColor.neutral800,
              Spaces.padding[12],
              ApplicationStyle.borderRadius12,
              Spaces.marginBottom[8],
              { borderColor: 'rgba(250, 204, 21, 0.25)', borderWidth: 1 },
            ]}
          >
            <ProfileAvatar imageUrl={team.captain.avatar?.url} size={40} />
            <View>
              <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>
                {team.captain.firstname}
                {' '}
                {team.captain.lastname}
              </Text>
              <View style={{
                alignSelf: 'flex-start',
                backgroundColor: 'rgba(250, 204, 21, 0.14)',
                borderColor: 'rgba(250, 204, 21, 0.45)',
                borderRadius: 999,
                borderWidth: 1,
                marginTop: 4,
                paddingHorizontal: 10,
                paddingVertical: 3,
              }}
              >
                <Text style={[Fonts.p3Bold, { color: Colors.gold500 }]}>Capitaine</Text>
              </View>
            </View>
          </View>
          )}

          {/* Roster Players */}
          {team?.roster?.filter((/** @type {User} */ p) => p.documentId !== team?.captain?.documentId).map((/** @type {User} */ player) => (
            <View
              key={player.documentId}
              style={[
                Alignments.row, Alignments.alignCenter, Spaces.gap[12],
                ApplicationStyle.backgroundColor.neutral800,
                Spaces.padding[12],
                ApplicationStyle.borderRadius12,
                Spaces.marginBottom[8],
                { borderColor: 'rgba(1, 179, 244, 0.2)', borderWidth: 1 },
              ]}
            >
              <ProfileAvatar imageUrl={player.avatar?.url} size={40} />
              <View>
                <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>
                  {player.firstname}
                  {' '}
                  {player.lastname}
                </Text>
                <View style={{
                  alignSelf: 'flex-start',
                  backgroundColor: 'rgba(1, 179, 244, 0.12)',
                  borderColor: 'rgba(1, 179, 244, 0.35)',
                  borderRadius: 999,
                  borderWidth: 1,
                  marginTop: 4,
                  paddingHorizontal: 10,
                  paddingVertical: 3,
                }}
                >
                  <Text style={[Fonts.p3Bold, { color: Colors.neutral100 }]}>Joueur</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

      </ScrollView>

      {/* Delete Team Button (Captain Only) - Fixed at bottom */}
      {isCaptain && (
      <View style={[
        {
          backgroundColor: 'rgba(9, 27, 42, 0.98)',
          borderTopColor: 'rgba(1, 179, 244, 0.26)',
          borderTopWidth: 1,
          bottom: 0,
          left: -24,
          paddingBottom: 40,
          paddingHorizontal: 24,
          paddingTop: 16,
          position: 'absolute',
          right: -24,
        },
      ]}
      >
        <TouchableOpacity
          onPress={() => {
            Alert.alert(
              t('squad.delete.title', 'Supprimer l\'équipe'),
              t('squad.delete.confirmation', 'Êtes-vous sûr de vouloir supprimer votre équipe ? Cette action est irréversible.'),
              [
                { style: 'cancel', text: t('common.cancel', 'Annuler') },
                {
                  onPress: async () => {
                    try {
                      setIsUpdating(true);
                      const { deleteLeagueTeam } = require('@/services/leagueTeam/leagueTeamService');
                      await deleteLeagueTeam(teamId);
                      navigation.navigate(RouteNames.LeagueHomeTab, { screen: RouteNames.LeagueDashboard });
                    } catch (error) {
                      console.error(error);
                      Alert.alert('Erreur', 'Impossible de supprimer l\'équipe.');
                    } finally {
                      setIsUpdating(false);
                    }
                  },
                  style: 'destructive',
                  text: t('common.delete', 'Supprimer'),
                },
              ],
            );
          }}
          style={[
            Alignments.alignCenter,
            Spaces.padding[16],
            ApplicationStyle.borderRadius16,
            { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: Colors.error500, borderWidth: 1 },
          ]}
        >
          <Text style={[Fonts.p1Bold, { color: Colors.error500 }]}>
            {t('squad.delete.button', 'Supprimer l\'équipe')}
          </Text>
        </TouchableOpacity>
      </View>
      )}

      <BottomModal
        close={() => setIsSlotModalVisible(false)}
        headerComponent={(
          <Text style={[Fonts.h3, { color: Colors.neutral00, textAlign: 'center' }]}>
            {editingSlot ? 'Modifier le créneau' : 'Ajouter un créneau'}
          </Text>
           )}
        isVisible={isSlotModalVisible}
        snapPoints={snapPoints}
      >
        <TeamSlotCreationForm
          initialValues={editingSlot ? {
            day: /** @type {any} */ (editingSlot)?.recurrence_day,
            endTime: /** @type {any} */ (editingSlot)?.end_hour?.substring(0, 5),
            startTime: /** @type {any} */ (editingSlot)?.start_hour?.substring(0, 5),
          } : null}
          onAdd={handleSaveSlot}
          onCancel={() => setIsSlotModalVisible(false)}
          onDelete={() => {
            // Fix for "Alert not attached to Activity" on Android
            setTimeout(() => {
              Alert.alert(
                'Confirmation',
                'Voulez-vous vraiment supprimer ce créneau ?',
                [
                  { style: 'cancel', text: 'Annuler' },
                  { onPress: () => editingSlot && handleDeleteSlot(editingSlot), style: 'destructive', text: 'Supprimer' },
                ],
              );
            }, 500);
          }}
        />
      </BottomModal>

      <ProfilePicturePreviewOverlay
        imageUrl={team?.cover?.url ? (getImageUrl(team.cover.url) || '') : ''}
        isVisible={isCoverPreviewVisible}
        onClose={() => setIsCoverPreviewVisible(false)}
      />
    </ScreenContainer>
  );
}

export default SquadDetailsScreen;
