import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, Alert, TouchableOpacity, ImageBackground, Image, Share } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import useTheme from '@/theme/themeContext';
import ScreenContainer from '@/components/templates/ScreenContainer';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import TeamSlotList from '@/components/molecules/teamSlotList/TeamSlotList';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import ProfilePicturePreviewOverlay from '@/components/molecules/profilePicturePreviewOverlay/ProfilePicturePreviewOverlay';
import { getImageUrl } from '@/utils/imageUrl';
import { normalizeLocationInput } from '@/utils/location';
import useAuth from '@/domains/auth/useAuth';
import useClub from '@/domains/club/useClub';
import { useGetLeagueTeam } from '@/services/leagueTeam/leagueTeamQueries';
import { updateLeagueTeam } from '@/services/leagueTeam/leagueTeamService';
import { RouteNames } from '@/navigation/routeNames';
import TeamSlotCreationForm from '@/components/organisms/teamSlotCreationForm/TeamSlotCreationForm';
import { createTeamSlot, updateTeamSlot, deleteTeamSlot } from '@/services/teamSlot/teamSlotService';
import Button from '@/components/atoms/button/Button';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';

/**
 * Squad Details Screen for FC League
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 */
const SquadDetailsScreen = ({ navigation, route }) => {
  const { teamId } = route?.params ?? {};
  const { Colors, Fonts, Spaces, Alignments, ApplicationStyle, Images } = useTheme();
  const { t } = useTranslation();
  const { userData: currentUser } = useAuth();
  const { getClubInitials } = useClub();

  // Use League Team Hook
  const { data: team, isLoading, refetch } = useGetLeagueTeam(teamId);
  
  const [isSlotModalVisible, setIsSlotModalVisible] = useState(false);

  const [isUpdating, setIsUpdating] = useState(false);
  const [editingSlot, setEditingSlot] = useState(null);

  const [isCoverPreviewVisible, setIsCoverPreviewVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const snapPoints = useMemo(() => ['85%'], []);


  // Calculate isCaptain
  const isCaptain = useMemo(() => {
      return team?.captain?.documentId === currentUser?.documentId;
  }, [team, currentUser]);

  const isMember = useMemo(() => {
    return team?.roster?.some(p => p.documentId === currentUser?.documentId) || isCaptain;
  }, [team, currentUser, isCaptain]);

  const hasPendingRequest = useMemo(() => {
    return team?.join_requests?.some(u => u.documentId === currentUser?.documentId);
  }, [team, currentUser]);

  const rosterCount = useMemo(() => {
    const uniqueIds = new Set();
    if (team?.captain?.documentId) uniqueIds.add(String(team.captain.documentId));
    (team?.roster || []).forEach((player) => {
      if (player?.documentId) uniqueIds.add(String(player.documentId));
    });
    return uniqueIds.size;
  }, [team]);

  const normalizedHomeBase = useMemo(
    () => normalizeLocationInput(team?.home_base),
    [team?.home_base]
  );

  const locationLabel = useMemo(
    () => normalizedHomeBase?.city
      || normalizedHomeBase?.label
      || normalizedHomeBase?.address
      || 'Localisation non renseignee',
    [normalizedHomeBase]
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
        setIsUpdating(true);
        const { requestToJoinSquad } = require('@/services/leagueTeam/leagueTeamService');
        await requestToJoinSquad(teamId, currentUser?.documentId);
        await refetch();
        Alert.alert(t('squad.join.successTitle', 'Demande envoyée'), t('squad.join.successMessage', 'Le capitaine a reçu votre demande.'));
    } catch (error) {
        console.error(error);
        Alert.alert(t('common.error'), t('squad.join.error', 'Impossible d\'envoyer la demande.'));
    } finally {
        setIsUpdating(false);
    }
  };

  const handleImageUpload = (type) => { // type: 'logo' (mapped to crest) | 'cover'
      Alert.alert(
          'Modifier la photo',
          'Choisissez une option',
          [
              {
                  text: 'Camera',
                  onPress: () => openImagePicker(type, 'camera'),
              },
              {
                  text: 'Galerie',
                  onPress: () => openImagePicker(type, 'library'),
              },
              {
                  text: 'Annuler',
                  style: 'cancel',
              },
          ]
      );
  };

  const openImagePicker = async (type, source) => {
      try {
          const options = {
              mediaType: 'photo',
              quality: 0.8,
              saveToPhotos: true,
          };

          const result = source === 'camera' 
              ? await launchCamera(options)
              : await launchImageLibrary(options);

          if (result.assets && result.assets.length > 0) {
              const asset = result.assets[0];
              const file = {
                  uri: asset.uri,
                  filename: asset.fileName || 'photo.jpg',
                  mime: asset.type || 'image/jpeg',
              };

              setIsUpdating(true);
              const payload = {
                  documentId: teamId,
                  [type]: file // Service maps 'logo' to 'crest'
              };
              
              await updateLeagueTeam(payload);
              await refetch();
              setIsUpdating(false);
          }
      } catch (e) {
          setIsUpdating(false);
          console.error(e);
          if (e.code !== 'E_PICKER_CANCELLED') {
              Alert.alert('Erreur', 'Impossible de mettre à jour l\'image');
          }
      }
  };

  const handleSaveSlot = async (slotData) => {
      try {
          setIsUpdating(true);
          
          // slotData = { day: 'monday', startTime: '20:00', endTime: '22:00' }
          // New recurring format: just send hours, no date calculation
          const payload = {
              start_hour: slotData.startTime + ':00', // "20:00" -> "20:00:00"
              end_hour: slotData.endTime + ':00',     // "22:00" -> "22:00:00"
              recurrence_day: slotData.day,
              league_team: teamId,
              status: 'open'
          };

          if (editingSlot) {
              await updateTeamSlot(editingSlot.documentId, payload);
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

  const handleDeleteSlot = async (slot) => {
      try {
          setIsUpdating(true);
          await deleteTeamSlot(slot.documentId);
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

  const handleSlotPress = (slot) => {
      setEditingSlot(slot);
      setIsSlotModalVisible(true);
  };

  const handleCheckIn = async (slot) => {
      try {
          // Check if already participant
          const isCheckedIn = slot.participants?.some(p => p.documentId === currentUser?.documentId);
          
          // Strapi v5 Connect/Disconnect syntax
          const payload = {
              participants: {
                  [isCheckedIn ? 'disconnect' : 'connect']: [{ documentId: currentUser.documentId }]
              }
          };

          await updateTeamSlot(slot.documentId, payload);
          await refetch(); // Refresh UI

      } catch (e) {
          console.error(e);
          Alert.alert('Erreur', 'Impossible de modifier votre statut');
      }
  };

  const showJoinAction = !isMember && !isCaptain;

  return (
    <ScreenContainer bgImage="bg2">
      <ScrollView
        contentContainerStyle={[Spaces.paddingVertical[16], Spaces.paddingHorizontal[4], { paddingBottom: 120 }]}
        refreshControl={<RefreshControl refreshing={isLoading || isUpdating} onRefresh={refetch} />}
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
                  <Text style={{ color: Colors.gold500, fontWeight: 'bold' }}>Demandes</Text>
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
                <Text style={{ color: Colors.primary500, fontWeight: 'bold' }}>Modifier</Text>
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
           <Text style={[Fonts.h1, { color: Colors.neutral00, textAlign: 'center', marginBottom: 4 }]}>{team?.name}</Text>
           <Text style={[Fonts.p2, { color: Colors.neutral300, textAlign: 'center', marginBottom: 6 }]}>{locationLabel}</Text>
           {team?.activities?.[0]?.name && (
                <Text style={[Fonts.p1Bold, { color: Colors.primary500 }]}>{team.activities[0].name.toUpperCase()}</Text>
           )}
        </View>

        {/* Join Action for Non-Members */}
        {showJoinAction && (
            <View style={[Alignments.alignCenter, { marginTop: 8, marginBottom: 30, width: '100%' }]}>
                {hasPendingRequest ? (
                    <View style={{ backgroundColor: Colors.neutral800, padding: 12, borderRadius: 8 }}>
                        <Text style={[Fonts.p2, { color: Colors.neutral100 }]}>Demande en attente...</Text>
                    </View>
                ) : (
                    <Button 
                        title="Demander à rejoindre" 
                        onPress={handleRequestJoin} 
                        isLoading={isUpdating}
                        style={{ alignSelf: 'center', marginTop: 6, maxWidth: 340, width: '100%' }}
                        variant="Primary"
                    />
                )}
            </View>
        )}


        {/* Info Card */}
        <TouchableOpacity 
             activeOpacity={team?.cover?.url ? 0.9 : 1}
             onPress={() => {
                if(team?.cover?.url) setIsCoverPreviewVisible(true);
             }}
             style={[
                 { marginTop: showJoinAction ? 2 : 0, marginBottom: 32 },
                 {
                   borderRadius: 16,
                   borderWidth: 1,
                   borderColor: 'rgba(250, 204, 21, 0.28)',
                   overflow: 'hidden'
                 } // Ensure border radius clips background
             ]}
        >
          <ImageBackground
              source={team?.cover?.url ? { uri: getImageUrl(team.cover.url) } : undefined}
              style={[
                  !team?.cover?.url && ApplicationStyle.backgroundColor.primary700,
                  Spaces.padding[16],
                  Alignments.alignCenter,
                  { minHeight: 200, justifyContent: 'center' }
              ]}
              imageStyle={{ opacity: 0.6 }} // Dim background image for readability
          >
              {/* Overlay for better readability if image exists */}
              {team?.cover?.url && (
                  <View style={{
                      ...Alignments.absolute,
                      backgroundColor: 'rgba(0,0,0,0.4)',
                      zIndex: -1
                  }} />
              )}
             
             {/* Edit Cover Button (If simple card or captain) */}
             {isCaptain && (
                <View style={{ position: 'absolute', top: 10, left: 10, zIndex: 10 }}> 
                    <TouchableOpacity onPress={() => handleImageUpload('cover')} style={{ alignItems: 'center' }}>
                         {/* Plus icon */}
                         <View style={{ 
                             backgroundColor: 'rgba(0,0,0,0.5)', 
                             borderRadius: 20, 
                             padding: 8 
                         }}>
                             <Image 
                                source={Images.plus} 
                                style={[ApplicationStyle.icon16, { tintColor: Colors.primary500 }]} 
                             />
                         </View>
                    </TouchableOpacity>
                </View>
             )}

             <View style={{ marginBottom: 12, flexDirection: 'row', alignItems: 'center' }}>
                {/* Logo or Shield (Using CREST for League Squad) */}
                <View>
                    {team?.crest?.url ? (
                    <ProfileAvatar
                        imageUrl={team.crest.url}
                        size={80}
                        style={{ borderWidth: 2, borderColor: Colors.gold500, borderRadius: 80 }}
                    />
                    ) : (
                    <TeamShield
                        initials={getClubInitials(team?.name || '')}
                        size={80}
                    />
                    )}
                    
                    {/* Add Logo Button (Next to shield as requested) */}
                    {isCaptain && !team?.crest?.url && (
                        <TouchableOpacity 
                            onPress={() => handleImageUpload('logo')}
                            style={{
                                position: 'absolute',
                                right: -10,
                                bottom: 0,
                                backgroundColor: Colors.neutral800,
                                borderRadius: 20,
                                padding: 6,
                                borderWidth: 1,
                                borderColor: Colors.primary500
                            }}
                        >
                             <Image 
                                source={Images.plus} 
                                style={[ApplicationStyle.icon16, { tintColor: Colors.primary500, width: 12, height: 12 }]} 
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
                     <View style={{
                         backgroundColor: 'rgba(250, 204, 21, 0.12)',
                         borderColor: 'rgba(250, 204, 21, 0.45)',
                         borderRadius: 999,
                         borderWidth: 1,
                         paddingHorizontal: 14,
                         paddingVertical: 7,
                     }}
                     >
                         <Text style={[Fonts.p2Bold, { color: Colors.gold500 }]}>DIV {team.division}</Text>
                     </View>
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
                         <Text style={[Fonts.p2Bold, { color: Colors.primary500 }]}>{team.elo} PTS</Text>
                     </View>
                 ) : null}
             </View>
          </ImageBackground>
        </TouchableOpacity>

        {/* Availability Slots */}
        <View style={{ marginBottom: 28 }}>
            <TeamSlotList 
                slots={team?.slots || []}
                isCaptain={isCaptain}
                onAddSlot={() => setIsSlotModalVisible(true)}
                onCheckIn={handleCheckIn}
                currentUserId={currentUser?.documentId}
                onSlotPress={handleSlotPress}
            />
        </View>


        {/* Roster Preview */}
        <View style={{ marginBottom: 24 }}>
             <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.marginBottom[12]]}>
                <Text style={[Fonts.h2, { color: Colors.neutral00 }]}>Effectif ({rosterCount})</Text>
             </View>
             
             {/* Captain */}
             {team?.captain && (
                 <View key={team.captain.documentId} style={[
                     Alignments.row, Alignments.alignCenter, Spaces.gap[12], 
                     ApplicationStyle.backgroundColor.neutral800,
                     Spaces.padding[12],
                     ApplicationStyle.borderRadius12,
                     Spaces.marginBottom[8],
                     { borderWidth: 1, borderColor: 'rgba(250, 204, 21, 0.25)' }
                 ]}>
                     <ProfileAvatar imageUrl={team.captain.avatar?.url} size={40} />
                     <View>
                         <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>{team.captain.firstname} {team.captain.lastname}</Text>
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
             {team?.roster?.filter(p => p.documentId !== team?.captain?.documentId).map(player => (
                 <View key={player.documentId} style={[
                     Alignments.row, Alignments.alignCenter, Spaces.gap[12], 
                     ApplicationStyle.backgroundColor.neutral800,
                     Spaces.padding[12],
                     ApplicationStyle.borderRadius12,
                     Spaces.marginBottom[8],
                     { borderWidth: 1, borderColor: 'rgba(1, 179, 244, 0.2)' }
                 ]}>
                     <ProfileAvatar imageUrl={player.avatar?.url} size={40} />
                     <View>
                         <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>{player.firstname} {player.lastname}</Text>
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
              Spaces.padding[16],
              {
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  backgroundColor: 'rgba(239, 68, 68, 0.0)', // Transparent, or semi-transparent if needed
                  paddingBottom: 40 // Safe area
              }
          ]}>
              <TouchableOpacity
                  onPress={() => {
                      Alert.alert(
                          t('squad.delete.title', 'Supprimer l\'équipe'),
                          t('squad.delete.confirmation', 'Êtes-vous sûr de vouloir supprimer votre équipe ? Cette action est irréversible.'),
                          [
                              { text: t('common.cancel', 'Annuler'), style: 'cancel' },
                              { 
                                  text: t('common.delete', 'Supprimer'), 
                                  style: 'destructive',
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
                                  }
                              }
                          ]
                      );
                  }}
                  style={[
                      Alignments.alignCenter,
                      Spaces.padding[16],
                      ApplicationStyle.borderRadius16,
                      { borderWidth: 1, borderColor: Colors.error500, backgroundColor: 'rgba(239, 68, 68, 0.1)' }
                  ]}
              >
                  <Text style={[Fonts.p1Bold, { color: Colors.error500 }]}>
                      {t('squad.delete.button', 'Supprimer l\'équipe')}
                  </Text>
              </TouchableOpacity>
          </View>
      )}

  <BottomModal
         isVisible={isSlotModalVisible}
         close={() => setIsSlotModalVisible(false)}
         headerComponent={
             <Text style={[Fonts.h3, { color: Colors.neutral00, textAlign: 'center' }]}>
                 {editingSlot ? 'Modifier le créneau' : 'Ajouter un créneau'}
             </Text>
         }
         snapPoints={snapPoints}
      >
           <TeamSlotCreationForm 
              onAdd={handleSaveSlot}
              onCancel={() => setIsSlotModalVisible(false)}
               initialValues={editingSlot ? {
                   day: editingSlot.recurrence_day,
                   startTime: editingSlot.start_hour?.substring(0, 5),
                   endTime: editingSlot.end_hour?.substring(0, 5)
               } : null}
                onDelete={() => {
                   // Fix for "Alert not attached to Activity" on Android
                   setTimeout(() => {
                       Alert.alert(
                           'Confirmation',
                           'Voulez-vous vraiment supprimer ce créneau ?',
                           [
                               { text: 'Annuler', style: 'cancel' },
                               { text: 'Supprimer', style: 'destructive', onPress: () => handleDeleteSlot(editingSlot) }
                           ]
                       );
                   }, 500);
                }}
            />
      </BottomModal>


      
      <ProfilePicturePreviewOverlay
            isVisible={isCoverPreviewVisible}
            imageUrl={team?.cover?.url ? getImageUrl(team.cover.url) : ''}
            onClose={() => setIsCoverPreviewVisible(false)}
        />
    </ScreenContainer>
  );
};

export default SquadDetailsScreen;

