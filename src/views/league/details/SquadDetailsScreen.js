import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
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
import {
  deleteLeagueTeam, requestToJoinSquad, updateLeagueTeam,
} from '@/services/leagueTeam/leagueTeamService';
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
      || t('squadDetails.labels.locationUnknown', 'Localisation non renseignee'),
    [normalizedHomeBase, t],
  );

  const uiTone = useMemo(() => ({
    captainBadgeBg: `${Colors.gold500}24`,
    captainBadgeBorder: `${Colors.gold500}73`,
    cardStrokeGold: `${Colors.gold500}47`,
    chipInfoBg: `${Colors.primary500}1F`,
    chipInfoBorder: `${Colors.primary500}61`,
    editButtonBg: `${Colors.neutral900}A6`,
    overlayBg: `${Colors.neutral900}66`,
    playerBadgeBg: `${Colors.primary500}1F`,
    playerBadgeBorder: `${Colors.primary500}59`,
    rosterCaptainBorder: `${Colors.gold500}40`,
    rosterPlayerBorder: `${Colors.primary500}33`,
  }), [Colors]);

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
      await requestToJoinSquad(String(teamId || ''), currentUserId || '');
      await refetch();
      Alert.alert(t('squad.join.successTitle', 'Demande envoyée'), t('squad.join.successMessage', 'Le capitaine a recu votre demande.'));
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

  const handleSaveSlot = async (
    /** @type {{ day: string, startTime: string, endTime: string } | { day: string, startTime: string, endTime: string }[]} */ slotInput,
  ) => {
    let slotsToSave = [];
    if (Array.isArray(slotInput)) {
      slotsToSave = slotInput.filter(Boolean);
    } else if (slotInput) {
      slotsToSave = [slotInput];
    }
    if (slotsToSave.length === 0) return;

    try {
      setIsUpdating(true);

      if (editingSlot) {
        const slotData = slotsToSave[0];
        const editingSlotId = getEntityDocumentId(editingSlot);
        if (!editingSlotId) {
          throw new Error('Missing slot id');
        }

        const payload = {
          end_hour: `${slotData.endTime}:00`,
          league_team: String(teamId || ''),
          recurrence_day: slotData.day,
          start_hour: `${slotData.startTime}:00`,
          status: 'open',
        };

        await updateTeamSlot(editingSlotId, payload);
        Alert.alert(
          t('common.success', 'Succès'),
          t('squadDetails.slots.updated', 'Créneau modifié'),
        );
      } else {
        await Promise.all(
          slotsToSave.map((slotData) => {
            const payload = {
              end_hour: `${slotData.endTime}:00`,
              league_team: String(teamId || ''),
              recurrence_day: slotData.day,
              start_hour: `${slotData.startTime}:00`,
              status: 'open',
            };
            return createTeamSlot(payload);
          }),
        );

        Alert.alert(
          t('common.success', 'Succès'),
          slotsToSave.length > 1
            ? t('squadDetails.slots.multipleAdded', '{{count}} créneaux ajoutes', { count: slotsToSave.length })
            : t('squadDetails.slots.added', 'Créneau ajouté'),
        );
      }

      await refetch();
      setIsSlotModalVisible(false);
      setEditingSlot(null);
      setIsUpdating(false);
    } catch (e) {
      console.error(e);
      setIsUpdating(false);
      Alert.alert(
        t('common.error', 'Erreur'),
        t('squadDetails.slots.saveError', 'Impossible de sauvegarder le créneau'),
      );
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
      Alert.alert(
        t('common.success', 'Succès'),
        t('squadDetails.slots.deleted', 'Créneau supprimé'),
      );
    } catch (e) {
      console.error(e);
      setIsUpdating(false);
      Alert.alert(
        t('common.error', 'Erreur'),
        t('squadDetails.slots.deleteError', 'Impossible de supprimer le créneau'),
      );
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
        Alert.alert(
          t('squadDetails.actions.unavailableTitle', 'Action non disponible'),
          t('squadDetails.slots.joinHint', 'Rejoignez la squad pour participer aux créneaux.'),
        );
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
        Alert.alert(
          t('squadDetails.actions.unavailableTitle', 'Action non disponible'),
          t('squadDetails.slots.joinHint', 'Rejoignez la squad pour participer aux créneaux.'),
        );
        return;
      }
      Alert.alert(
        t('common.error', 'Erreur'),
        t('squadDetails.slots.statusError', 'Impossible de modifier votre statut.'),
      );
    }
  };

  const handleDeleteTeam = useCallback(() => {
    const teamDisplayName = String(team?.name || '').trim() || t('squadDetails.defaultName', 'Équipe');
    Alert.alert(
      t('squadDetails.delete.title', "Supprimer l'équipe"),
      t('squadDetails.delete.confirmationWithName', {
        defaultValue: `Êtes-vous sûr de vouloir supprimer l'équipe "${teamDisplayName}" ? Cette action est irréversible.`,
        teamName: teamDisplayName,
      }),
      [
        { style: 'cancel', text: t('common.cancel', 'Annuler') },
        {
          onPress: async () => {
            try {
              setIsUpdating(true);
              await deleteLeagueTeam(teamId);
              navigation.navigate(RouteNames.LeagueHomeTab, { screen: RouteNames.LeagueDashboard });
            } catch (error) {
              console.error(error);
              Alert.alert(
                t('common.error', 'Erreur'),
                t('squadDetails.actions.deleteTeamError', 'Impossible de supprimer l\'équipe.'),
              );
            } finally {
              setIsUpdating(false);
            }
          },
          style: 'destructive',
          text: t('common.delete', 'Supprimer'),
        },
      ],
    );
  }, [navigation, t, team?.name, teamId]);

  const openCaptainActionsMenu = useCallback(() => {
    Alert.alert(
      t('squadDetails.actions.menuTitle', 'Actions équipe'),
      t('squadDetails.actions.menuDescription', 'Choisissez une action.'),
      [
        { style: 'cancel', text: t('common.cancel', 'Annuler') },
        {
          onPress: () => navigation.navigate(RouteNames.SquadEdit, { teamId }),
          text: t('squadDetails.actions.editTeam', 'Modifier l\'équipe'),
        },
        {
          onPress: () => navigation.navigate(RouteNames.SquadRequests, { teamId }),
          text: t('squadDetails.actions.openRequests', 'Voir les demandes'),
        },
        {
          onPress: handleDeleteTeam,
          style: 'destructive',
          text: t('squadDetails.actions.deleteTeam', 'Supprimer l\'équipe'),
        },
      ],
    );
  }, [handleDeleteTeam, navigation, t, teamId]);

  const showJoinAction = !isMember && !isCaptain;

  return (
    <ScreenContainer bgImage="bg2">
      <ScrollView
        contentContainerStyle={[Spaces.paddingVertical[16], Spaces.paddingHorizontal[4], { paddingBottom: 32 }]}
        refreshControl={<RefreshControl onRefresh={refetch} refreshing={isLoading || isUpdating} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, { marginBottom: 20, marginTop: 4 }]}>
          <HeaderBackButton
            onPress={() => navigation.goBack()}
            style={{ marginLeft: 0 }}
            withDefaultMargin={false}
          />
          <View style={[Alignments.row, Alignments.alignCenter]}>
            {isCaptain ? (
              <TouchableOpacity
                onPress={() => navigation.navigate(RouteNames.SquadRequests, { teamId })}
                style={{
                  alignItems: 'center',
                  borderRadius: 12,
                  justifyContent: 'center',
                  marginRight: 8,
                  minHeight: 44,
                  minWidth: 44,
                  paddingHorizontal: 10,
                }}
              >
                <View>
                  <Text style={[Fonts.p2Bold, { color: Colors.gold500 }]}>
                    {t('squadDetails.actions.requests', 'Demandes')}
                  </Text>
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
                style={{
                  alignItems: 'center',
                  borderRadius: 12,
                  justifyContent: 'center',
                  marginRight: 8,
                  minHeight: 44,
                  minWidth: 44,
                  paddingHorizontal: 10,
                }}
              >
                <Text style={[Fonts.p2Bold, { color: Colors.primary500 }]}>
                  {t('squadDetails.actions.edit', 'Modifier')}
                </Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              onPress={handleShare}
              style={{
                alignItems: 'center',
                borderRadius: 12,
                justifyContent: 'center',
                marginRight: isCaptain ? 8 : 0,
                minHeight: 44,
                minWidth: 44,
              }}
            >
              <Image
                source={Images.share}
                style={[ApplicationStyle.icon24, { tintColor: Colors.primary500 }]}
              />
            </TouchableOpacity>
            {isCaptain ? (
              <TouchableOpacity
                onPress={openCaptainActionsMenu}
                style={{
                  alignItems: 'center',
                  borderRadius: 12,
                  justifyContent: 'center',
                  minHeight: 44,
                  minWidth: 44,
                }}
              >
                <Text style={[Fonts.h3, { color: Colors.primary500 }]}>...</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Header / Identity */}
        <View style={[Alignments.alignCenter, { marginBottom: 18, marginTop: 2 }]}>
          <Text style={[Fonts.p2Bold, { color: Colors.gold500, letterSpacing: 0.8, marginBottom: 6 }]}>SQUAD</Text>
          <Text style={[Fonts.h1, { color: Colors.neutral00, marginBottom: 4, textAlign: 'center' }]}>{team?.name}</Text>
          <Text style={[Fonts.p2, { color: Colors.neutral300, textAlign: 'center' }]}>{locationLabel}</Text>
        </View>

        {/* Join Action for Non-Members */}
        {showJoinAction && (
        <View style={[Alignments.alignCenter, { marginBottom: 30, marginTop: 8, width: '100%' }]}>
          {hasPendingRequest ? (
            <View style={{ backgroundColor: Colors.neutral800, borderRadius: 8, padding: 12 }}>
              <Text style={[Fonts.p2, { color: Colors.neutral100 }]}>
                {t('squadDetails.join.pending', 'Demande en attente...')}
              </Text>
            </View>
          ) : (
            <Button
              isLoading={isUpdating}
              onPress={handleRequestJoin}
              style={{
                alignSelf: 'center', marginTop: 6, maxWidth: 340, width: '100%',
              }}
              title={t('squadDetails.join.request', 'Demander à rejoindre')}
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
              borderColor: uiTone.cardStrokeGold,
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
                backgroundColor: uiTone.overlayBg,
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
                  backgroundColor: uiTone.editButtonBg,
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
                    variant="logo"
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

            {/* League badges */}
            <View style={[Alignments.row, Alignments.wrap, Alignments.justifyCenter, Spaces.gap[12], { marginTop: 4 }]}>
              {team?.activities?.[0]?.name ? (
                <View style={{
                  backgroundColor: uiTone.chipInfoBg,
                  borderColor: uiTone.chipInfoBorder,
                  borderRadius: 999,
                  borderWidth: 1,
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                }}
                >
                  <Text style={[Fonts.p2Bold, { color: Colors.neutral100 }]}>
                    {String(team.activities[0].name).toUpperCase()}
                  </Text>
                </View>
              ) : null}
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
                  backgroundColor: uiTone.chipInfoBg,
                  borderColor: uiTone.chipInfoBorder,
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
            cardWidthMode="responsive"
            currentUserId={currentUser?.documentId}
            isCaptain={isCaptain}
            isMember={Boolean(isMember)}
            layout="carousel"
            onAddSlot={() => setIsSlotModalVisible(true)}
            onCheckIn={handleCheckIn}
            onSlotPress={handleSlotPress}
            showMemberHelperText
            slots={team?.slots || []}
          />
        </View>

        {/* Roster Preview */}
        <View style={{ marginBottom: 24 }}>
          <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.marginBottom[12]]}>
            <Text style={[Fonts.h2, { color: Colors.neutral00 }]}>
              {t('squadDetails.roster.title', 'Effectif')}
              {' ('}
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
              { borderColor: uiTone.rosterCaptainBorder, borderWidth: 1 },
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
                backgroundColor: uiTone.captainBadgeBg,
                borderColor: uiTone.captainBadgeBorder,
                borderRadius: 999,
                borderWidth: 1,
                marginTop: 4,
                paddingHorizontal: 10,
                paddingVertical: 3,
              }}
              >
                <Text style={[Fonts.p3Bold, { color: Colors.gold500 }]}>
                  {t('squadDetails.roster.captain', 'Capitaine')}
                </Text>
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
                { borderColor: uiTone.rosterPlayerBorder, borderWidth: 1 },
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
                  backgroundColor: uiTone.playerBadgeBg,
                  borderColor: uiTone.playerBadgeBorder,
                  borderRadius: 999,
                  borderWidth: 1,
                  marginTop: 4,
                  paddingHorizontal: 10,
                  paddingVertical: 3,
                }}
                >
                  <Text style={[Fonts.p3Bold, { color: Colors.neutral100 }]}>
                    {t('squadDetails.roster.player', 'Joueur')}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>

      </ScrollView>
      <BottomModal
        close={() => setIsSlotModalVisible(false)}
        headerComponent={(
          <Text style={[Fonts.h3, { color: Colors.neutral00, textAlign: 'center' }]}>
            {editingSlot
              ? t('squadDetails.slots.editTitle', 'Modifier le créneau')
              : t('squadDetails.slots.addTitle', 'Ajouter un créneau')}
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
                t('common.confirmation', 'Confirmation'),
                t('squadDetails.slots.deleteConfirm', 'Voulez-vous vraiment supprimer ce créneau ?'),
                [
                  { style: 'cancel', text: t('common.cancel', 'Annuler') },
                  {
                    onPress: () => editingSlot && handleDeleteSlot(editingSlot),
                    style: 'destructive',
                    text: t('common.delete', 'Supprimer'),
                  },
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
