import { useFocusEffect } from '@react-navigation/native';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Image, Linking, RefreshControl, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useClub from '@/domains/club/useClub';
import useMessaging from '@/domains/messaging/useMessaging';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import ScreenContainer from '@/components/templates/ScreenContainer';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';

import { RouteNames } from '@/navigation/routeNames';

import { removeTrainerFromClub } from '@/services/auth/authService';
import { useGetClub } from '@/services/club/clubQueries';
import { updateClub, claimClub } from '@/services/club/clubService';
import { createClubMembershipRequest } from '@/services/clubMembershipRequest/clubMembershipRequestService';
import { getImageUrl } from '@/utils/imageUrl';

import ClubPlanning from './ClubPlanningScreen';
import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';

/**
 * Club details screen component
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} Club details screen component
 */
function ClubDetails({ navigation, route }) {
  const { clubId } = route?.params ?? {};

  // hooks
  const {
    Alignments, ApplicationStyle, Fonts, Images, Spaces,
  } = useTheme();
  const {
    canContactAdmin,
    canEditClub,
    canJoinClub,
    inviteTrainer,
    refetchUserData,
    USER_ROLES,
    userData,
  } = useAuth();
  const { startClubChat } = useMessaging();
  const { t } = useTranslation();
  const { getClubInitials } = useClub();
  const [selectedTab, setSelectedTab] = useState('infos');

  const {
    data: club,
    error,
    isLoading,
    refetch,
  } = useGetClub(clubId ?? '');

  const deleteTrainerMutation = useMutation({
    mutationFn: removeTrainerFromClub,
    onSuccess: () => {
      refetch();
    },
  });

  const deleteSponsorMutation = useMutation({
    mutationFn: updateClub,
    onSuccess: () => {
      refetch();
    },
  });

  const createClubMembershipRequestMutation = useMutation({
    mutationFn: createClubMembershipRequest,
    onSuccess: () => {
      Alert.alert(
        t('clubDetails.alerts.joinClub.title'),
        t('clubDetails.alerts.joinClub.description'),
        [
          {
            onPress: () => refetch(),
            text: t('clubDetails.alerts.joinClub.actions.ok'),
          },
        ],
      );
    },
  });

  const claimClubMutation = useMutation({
    mutationFn: claimClub,
    onSuccess: () => {
      Alert.alert(
        t('clubDetails.alerts.claimClub.title', 'Demande envoyée'),
        t('clubDetails.alerts.claimClub.description', 'Votre demande pour revendiquer ce club a été envoyée aux administrateurs.'),
        [
          {
            onPress: () => {
              refetch();
              refetchUserData();
            },
            text: t('common.ok', 'OK'),
          },
        ]
      );
    },
    onError: (err) => {
      Alert.alert(
        t('common.error', 'Erreur'),
        err.message || t('clubDetails.alerts.claimClub.error', 'Une erreur est survenue.'),
        [{ text: 'OK' }]
      );
    }
  });

  const handleClaimClub = () => {
    Alert.alert(
      t('clubDetails.alerts.claimClub.confirmTitle', "C'est votre club ?"),
      t('clubDetails.alerts.claimClub.confirmDescription', "Voulez-vous revendiquer la gestion de ce club ? Une vérification sera effectuée."),
      [
        {
          text: t('common.cancel', 'Annuler'),
          style: 'cancel',
        },
        {
          text: t('common.confirm', 'Confirmer'),
          onPress: () => {
            if (clubId) {
              claimClubMutation.mutate(clubId);
            }
          },
        },
      ]
    );
  };

  const coachs = useMemo(() => club?.members?.filter(
    (user) => user.role.name === USER_ROLES.coach,
  ), [club, USER_ROLES.coach]);

  const owners = useMemo(() => club?.members?.filter(
    (user) => user.role.name === USER_ROLES.president,
  ), [club, USER_ROLES.president]);

  const canEdit = useMemo(() => canEditClub(clubId), [clubId, canEditClub]);

  // handlers
  const handleStartChat = async () => {
    if (club?.documentId) {
      const newChat = await startClubChat(club?.documentId);
      if (newChat?.documentId) {
        navigation.navigate(RouteNames.Conversation, { chatId: newChat.documentId });
      }
    }
  };

  const handleCreateCoach = () => {
    if (userData) {
      navigation.navigate(RouteNames.AddCoach, { clubId, clubName: club?.name });
    }
  };

  const handleCreateSponsor = () => {
    if (userData) {
      navigation.navigate(RouteNames.AddSponsor, { clubId });
    }
  };

  /**
   * Handle delete sponsor action
   * @param {Sponsor} sponsor
   */
  const handleDeleteSponsor = (sponsor) => {
    Alert.alert(
      t('clubDetails.alerts.deleteSponsor.title', { sponsorName: sponsor.title }),
      t('clubDetails.alerts.deleteSponsor.description'),
      [
        {
          style: 'cancel',
          text: t('clubDetails.alerts.deleteSponsor.actions.cancel'),
        },
        {
          onPress: () => {
            if (club) {
              const newClub = Object.assign(club, {
                sponsor: (club?.sponsor || []).filter((s) => s.link !== sponsor.link),
              });
              deleteSponsorMutation.mutate(newClub);
            }
          },
          text: t('clubDetails.alerts.deleteSponsor.actions.confirm'),
        },
      ],
    );
  };

  const handleContactFoundClub = () => {
    const contactUrl = process.env.CONTACT_URL;

    Alert.alert(
      t('clubDetails.alerts.myClub.title'),
      t('clubDetails.alerts.myClub.description'),
      [
        {
          style: 'cancel',
          text: t('clubDetails.alerts.myClub.actions.cancel'),
        },
        {
          onPress: async () => {
            await Linking.openURL(contactUrl || '');
          },
          text: t('clubDetails.alerts.myClub.actions.confirm'),
        },
      ],
    );
  };

  /**
   * Handle delete trainer action
   * @param {string | undefined} trainerId
   */
  const handleDeleteTrainer = (trainerId) => {
    if (trainerId) {
      Alert.alert(
        t('clubDetails.alerts.deleteTrainer.title'),
        t('clubDetails.alerts.deleteTrainer.description'),
        [
          {
            style: 'cancel',
            text: t('clubDetails.alerts.deleteTrainer.actions.cancel'),
          },
          {
            onPress: () => {
              deleteTrainerMutation.mutate(trainerId);
            },
            text: t('clubDetails.alerts.deleteTrainer.actions.confirm'),
          },
        ],
      );
    }
  };

  const handleAskToJoinClub = () => {
    if (canJoinClub && clubId && userData?.documentId) {
      createClubMembershipRequestMutation.mutate({
        club: clubId,
      });
    }
  };

  /**
   * Handle user press action
   * @param {User} user
   */
  const handleUserPress = (user) => {
    if (user?.documentId) {
      if (user?.documentId === userData?.documentId) {
        navigation.navigate(RouteNames.ProfileStack);
      } else {
        navigation.navigate(RouteNames.ProfileStack, {
          screen: RouteNames.UserDetails,
          params: { userId: user.documentId },
        });
      }
    }
  };

  /**
   * Handle team press action
   * @param {Team} team
   */
  const handleTeamPress = (team) => {
    if (team?.documentId) {
      navigation.navigate(RouteNames.TeamStack, {
        screen: RouteNames.TeamDetails,
        params: { teamId: team.documentId },
      });
    }
  };

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const isMember = useMemo(() => {
    if (!userData) return false;
    if (userData.role?.name === 'admin' || userData.role?.name === 'SuperAdmin') return true;

    // Check direct club membership
    const userClubId = userData.club?.documentId || userData.club?.id;
    if (userClubId === clubId) return true;

    // Check team membership
    return userData.teams?.some(t => {
      const teamClubId = t.club?.documentId || t.club?.id;
      return teamClubId === clubId;
    });
  }, [userData, clubId]);

  const isParentClubAdmin = useMemo(() => {
    // Check if user is admin of the parent multisport club
    if (!userData?.club || !club?.parentMultisport) return false;

    // Normalize IDs (support objects and IDs)
    const userClubId = userData.club.documentId || userData.club.id;
    const parentId = club.parentMultisport.documentId || club.parentMultisport.id;

    // Check if IDs match
    return userClubId === parentId;
  }, [userData, club]);

  const tabs = useMemo(() => {
    const options = [{ label: 'Informations', value: 'infos' }];
    if (isMember) {
      options.push({ label: 'Planning', value: 'planning' });
    }
    return options;
  }, [isMember]);

  // Reset tab if access lost
  if (selectedTab === 'planning' && !isMember) {
    setSelectedTab('infos');
  }

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.paddingVertical[24],
        Alignments.column,
        Alignments.fill,
      ]}
    >
      <ScrollView
        contentContainerStyle={[
          Spaces.gap[32],
          Spaces.paddingBottom[40],
        ]}
        refreshControl={(
          <RefreshControl
            onRefresh={refetch}
            refreshing={isLoading}
          />
        )}
        showsVerticalScrollIndicator={false}
      >
        <WithDataWrapper
          error={error?.message}
          isLoading={isLoading}
          wrapperStyle={[Spaces.gap[32]]}
        >
          <View style={[
            ApplicationStyle.borderRadius24,
            ApplicationStyle.backgroundColor.primary700,
            Alignments.alignCenter,
            Spaces.gap[16],
            Spaces.paddingHorizontal[24],
            Spaces.paddingBottom[40],
            Spaces.marginTop[24],
          ]}
          >
            {canEdit ? (
              <TouchableOpacity
                onPress={() => {
                  // Try direct navigation first, then parent
                  try {
                    navigation.navigate(RouteNames.ClubEdit, { clubId });
                  } catch (e) {
                    console.warn('Direct navigation failed, trying parent', e);
                    navigation.getParent()?.navigate(RouteNames.ClubEdit, { clubId });
                  }
                }}
                style={[
                  Alignments.absolute,
                  Alignments.row,
                  Alignments.alignCenter,
                  Spaces.gap[8],
                  { right: 16, top: 16, zIndex: 10 }
                ]}
              >
                <Image
                  source={Images.edit}
                  style={[
                    ApplicationStyle.icon20,
                    ApplicationStyle.tintColor.primary500
                  ]}
                />
                <Text style={[Fonts.p1Bold, Fonts.primary500]}>
                  {t('clubDetails.actions.editInfo') || 'Modifier'}
                </Text>
              </TouchableOpacity>
            ) : null}
            <View style={{ marginTop: -32 }}>
              {club?.logo?.url ? (
                <ProfileAvatar
                  imageUrl={club.logo.url}
                  size={80}
                  style={[
                    ApplicationStyle.borderWidth1,
                    ApplicationStyle.borderColor.neutral00,
                    { borderRadius: 80 },
                  ]}
                  imageStyle={{ borderRadius: 80 }}
                />
              ) : (
                <TeamShield
                  initials={club?.name ? getClubInitials(club?.name) : ''}
                />
              )}
            </View>
            <View style={[
              Spaces.gap[4],
              Alignments.alignCenter]}
            >
              <Text style={[Fonts.h3Black, Fonts.neutral00, Fonts.textCenter]}>
                {club?.name}
              </Text>
              <Text style={[Fonts.p2, Fonts.primary100]}>
                {(() => {
                  try {
                    return club?.addressDetails ? JSON.parse(club.addressDetails)?.address : '';
                  } catch (e) {
                    return club?.addressDetails || '';
                  }
                })()}
              </Text>
            </View>
            <View style={[
              Spaces.gap[4],
              Alignments.alignCenter,
              Spaces.paddingHorizontal[24]]}
            >
              {club?.phoneNumber ? (
                <View style={[Alignments.row, Spaces.gap[4]]}>
                  <Image source={Images.phone} style={[ApplicationStyle.icon20]} />
                  <TouchableOpacity onPress={() => { Linking.openURL(`tel:${club?.phoneNumber}`); }}>
                    <Text style={[Fonts.p2, Fonts.primary100, Fonts.underlineText]}>
                      {club?.phoneNumber}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              {club?.email ? (
                <View style={[
                  Alignments.row, Spaces.gap[4]]}
                >
                  <Image source={Images.envelope} style={[ApplicationStyle.icon20]} />
                  <TouchableOpacity onPress={() => { Linking.openURL(`mailto:${club?.email}`); }}>
                    <Text
                      numberOfLines={1}
                      style={[Fonts.p2, Fonts.primary100, Fonts.underlineText]}
                    >
                      {club?.email}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          </View>

          {/* Tabs */}
          <View style={[Alignments.alignCenter]}>
            <SegmentedControl
              options={tabs}
              value={selectedTab}
              onChange={setSelectedTab}
            />
          </View>

          {selectedTab === 'planning' ? (
            <ClubPlanning clubId={clubId} />
          ) : (
            <>
              {/* Admin Actions */}
              {canEdit ? (
                <View style={[Spaces.gap[16]]}>
                  <Button
                    onPress={() => navigation.navigate(RouteNames.FacilityList, {
                      clubId,
                      cmId: club?.parentMultisport?.documentId,
                    })}
                    title="Gérer les installations"
                    variant="Secondary"
                    icon="plus"
                  />

                </View>
              ) : null}

              {/* Activities */}
              <View style={[Spaces.gap[16]]}>
                <Text style={[Fonts.h4Black, Fonts.neutral00]}>{t('clubDetails.titles.activities')}</Text>
                <View
                  key={Math.random()}
                  style={[
                    Alignments.row,
                    Alignments.alignCenter,
                    Spaces.gap[16],
                  ]}
                >
                  <Text style={[Fonts.p1, Fonts.neutral00]}>
                    {club?.activites?.map(({ name }) => name)?.join(', ')}
                  </Text>
                </View>
              </View>

              {/* Sponsors */}
              {(club?.sponsor?.length || canEdit) && (
                <View style={[Spaces.gap[16]]}>
                  <View style={[Alignments.row,
                  Alignments.alignCenter, Alignments.scrollSpaceBetween, Spaces.gap[16]]}
                  >
                    <Text style={[Fonts.h4Black, Fonts.neutral00]}>{t('clubDetails.titles.sponsors')}</Text>
                    {canEdit ? (
                      <Button
                        icon="plus"
                        isOption
                        onPress={handleCreateSponsor}
                        variant="Primary"
                      />
                    ) : null}
                  </View>
                  <ScrollView
                    contentContainerStyle={[Spaces.gap[16]]}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                  >
                    {club?.sponsor?.map((/** @type {Sponsor} */ sponsor) => (
                      <View
                        key={sponsor.link}
                        style={[Alignments.relative, Spaces.marginTop[8]]}
                      >
                        {
                          canEdit ? (
                            <TouchableOpacity
                              onPress={() => handleDeleteSponsor(sponsor)}
                              style={[
                                Alignments.absolute,
                                ApplicationStyle.backgroundColor.error700,
                                ApplicationStyle.borderRadius24,
                                Spaces.padding[8],
                                { right: -12, top: -8, zIndex: 1 },
                              ]}
                            >
                              <Image
                                source={Images.trash}
                                style={[
                                  ApplicationStyle.icon16,
                                  ApplicationStyle.tintColor.neutral00]}
                              />
                            </TouchableOpacity>
                          ) : null
                        }
                        <TouchableOpacity
                          onPress={() => {
                            if (sponsor.link) {
                              Linking.openURL(sponsor.link);
                            }
                          }}
                          style={[
                            Alignments.alignCenter,
                          ]}
                        >
                          <ProfileAvatar
                            imageUrl={sponsor?.logo?.url}
                            size={55}
                            enablePreview={false}
                            style={[
                              ApplicationStyle.borderWidth1,
                              ApplicationStyle.borderColor.neutral00,
                              { borderRadius: 8, width: 110, height: 55 },
                            ]}
                            imageStyle={{ borderRadius: 8, width: 110, height: 55 }}
                          />
                          <Text numberOfLines={1} style={[Fonts.p2Bold, Fonts.neutral00, { marginTop: 4, maxWidth: 110, textAlign: 'center' }]}>
                            {sponsor.title}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* teams */}
              {club?.teams?.length ? (
                <View style={[Spaces.gap[16]]}>
                  <View style={[Alignments.row,
                  Alignments.alignCenter, Alignments.scrollSpaceBetween, Spaces.gap[16]]}
                  >
                    <Text style={[Fonts.h4Black, Fonts.neutral00]}>{t('clubDetails.titles.teams')}</Text>
                  </View>
                  <View
                    style={[Spaces.gap[16]]}
                  >
                    {
                      club?.teams?.map((/** @type {Team} */ team) => (
                        <TouchableOpacity
                          key={team.documentId}
                          onPress={() => handleTeamPress(team)}
                          style={[
                            ApplicationStyle.borderRadius24,
                            ApplicationStyle.backgroundColor.primary700,
                            Alignments.row,
                            Alignments.alignCenter,
                            Alignments.justifySpaceBetween,
                            Spaces.padding[8],
                            Spaces.gap[16]]}
                        >
                          <View style={[Alignments.row, Spaces.gap[16], Alignments.alignCenter]}>
                            <TeamShield
                              initials={team?.name ? getClubInitials(team?.name) : ''}
                              isNeutral
                              isSmall
                            />
                            <Text numberOfLines={1} style={[Fonts.p1Bold, Fonts.neutral00]}>
                              {team.name}
                            </Text>
                          </View>

                        </TouchableOpacity>
                      ))
                    }
                  </View>
                </View>
              ) : null}

              {/* Coachs */}
              {coachs?.length || canEdit ? (
                <View style={[Spaces.gap[16]]}>
                  <View style={[Alignments.row,
                  Alignments.alignCenter, Alignments.scrollSpaceBetween, Spaces.gap[16]]}
                  >
                    <Text style={[Fonts.h4Black, Fonts.neutral00]}>{t('clubDetails.titles.coachs')}</Text>
                    {canEdit ? (
                      <Button
                        icon="plus"
                        isOption
                        onPress={handleCreateCoach}
                        variant="Primary"
                      />
                    ) : null}
                  </View>
                  <View
                    style={[Spaces.gap[16]]}
                  >
                    {
                      coachs?.map((/** @type {User} */ user) => (
                        <TouchableOpacity
                          key={user.documentId}
                          onPress={() => handleUserPress(user)}
                          style={[
                            ApplicationStyle.borderRadius24,
                            ApplicationStyle.backgroundColor.primary700,
                            Alignments.row,
                            Alignments.fill,
                            Alignments.alignCenter,
                            Alignments.fill,
                            Alignments.justifySpaceBetween,
                            Spaces.padding[16],
                            Spaces.gap[24],
                          ]}
                        >
                          <View style={[
                            Alignments.row, Spaces.gap[16], Alignments.alignCenter, { flex: 0.7 }]}
                          >
                            <Image
                              source={user.avatar ? { uri: getImageUrl(user?.avatar?.url) } : Images.roundAvatar}
                              style={[
                                ApplicationStyle.roundIcon40,
                                ApplicationStyle.borderWidth1,
                                ApplicationStyle.borderColor.neutral00,
                              ]}
                            />
                            <Text
                              numberOfLines={2}
                              style={[Fonts.p1Bold, Fonts.neutral00]}
                            >
                              {`${user.firstname} ${user.lastname}`}
                            </Text>
                          </View>
                          {canEdit ? (
                            <View style={[Alignments.row, Spaces.gap[8]]}>
                              <Button
                                icon="trash"
                                isOption
                                onPress={() => handleDeleteTrainer(user.documentId)}
                                variant="SecondaryLight"
                              />
                              <Button
                                icon="share"
                                isOption
                                onPress={() => {
                                  inviteTrainer({
                                    clubName: club?.name,
                                    firstname: user.firstname,
                                    phoneNumber: user.phoneNumber,
                                  });
                                }}
                                variant="SecondaryLight"
                              />
                            </View>
                          ) : null}
                        </TouchableOpacity>
                      ))
                    }
                  </View>
                </View>
              ) : null}
              {/* president */}
              {owners?.length ? (
                <View style={[Spaces.gap[16]]}>
                  <View style={[Alignments.row,
                  Alignments.alignCenter, Alignments.scrollSpaceBetween, Spaces.gap[16]]}
                  >
                    <Text style={[Fonts.h4Black, Fonts.neutral00]}>{t('clubDetails.titles.owners')}</Text>
                  </View>
                  <View
                    style={[Spaces.gap[16]]}
                  >
                    {
                      owners?.map((/** @type {User} */ user) => (
                        <TouchableOpacity
                          key={user.documentId}
                          onPress={() => handleUserPress(user)}
                          style={[
                            ApplicationStyle.borderRadius24,
                            ApplicationStyle.backgroundColor.primary700,
                            Alignments.row,
                            Alignments.alignCenter,
                            Alignments.fill,
                            Alignments.justifySpaceBetween,
                            Spaces.padding[16],
                            Spaces.gap[16]]}
                        >
                          <View style={[
                            Alignments.row, Spaces.gap[16], Alignments.alignCenter, { flex: 0.7 }]}
                          >
                            <Image
                              source={user.avatar ? { uri: getImageUrl(user?.avatar?.url) } : Images.roundAvatar}
                              style={[
                                ApplicationStyle.roundIcon40,
                                ApplicationStyle.borderWidth1,
                                ApplicationStyle.borderColor.neutral00,
                              ]}
                            />
                            <Text
                              numberOfLines={2}
                              style={[Fonts.p1Bold, Fonts.neutral00]}
                            >
                              {`${user.firstname} ${user.lastname}`}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      ))
                    }
                  </View>
                </View>
              ) : null}
            </>
          )}
        </WithDataWrapper>
      </ScrollView>
      {
        canJoinClub && !isParentClubAdmin ? (
          <Button
            onPress={handleAskToJoinClub}
            style={Spaces.marginTop[12]}
            title={t('clubDetails.actions.join')}
            variant="Primary"
          />
        ) : null
      }
      {
        canContactAdmin && !club?.parentMultisport && owners?.length > 0 ? (
          <Button
            onPress={handleContactFoundClub}
            style={Spaces.marginTop[12]}
            title={t('clubDetails.actions.join')}
            variant="Primary"
          />
        ) : null
      }
      {
        coachs?.length && canEdit ? (
          <Button
            onPress={handleStartChat}
            style={Spaces.marginBottom[24]}
            title={t('clubDetails.actions.contactTrainers')}
            variant="Primary"
          />
        ) : null
      }
      {
        /* Claim Club Button - Show if not member, not admin, and club has no owners */
        !isMember && !canEdit && owners?.length === 0 && userData ? (
          (() => {
            const hasPendingClubRequest = (userData.clubMembershipRequests || [])
              .some((r) => (r.club?.documentId === clubId || r.club?.id === clubId) && r.state === 'pending');

            if (hasPendingClubRequest) {
              return (
                <Button
                  disabled
                  style={[Spaces.marginTop[12], Spaces.marginBottom[24], { opacity: 0.6 }]}
                  title={t('clubDetails.actions.requestPending', 'Demande en attente')}
                  variant="Secondary"
                />
              );
            }

            return (
              <Button
                onPress={handleClaimClub}
                style={[Spaces.marginTop[12], Spaces.marginBottom[24]]}
                title={t('clubDetails.actions.claimClub', "C'est mon club")}
                variant="Secondary"
              />
            );
          })()
        ) : null
      }
    </ScreenContainer >
  );
}

export default ClubDetails;
