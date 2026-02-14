import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, Image, RefreshControl, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';
import { differenceInYears, format } from 'date-fns';

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

import { useGetUserById } from '@/services/auth/authQueries';

/**
 * User profile view component for displaying other users' profiles
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} UserProfile component
 */
function UserDetails({ navigation, route }) {
  const { userId } = route.params ?? {};
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const { getClubInitials } = useClub();
  const { userData: currentUser, USER_ROLES } = useAuth();
  const { startWhisperChat } = useMessaging();

  const {
    data: user,
    error,
    isLoading,
    refetch,
  } = useGetUserById(userId);

  const allUserTeams = useMemo(
    () => currentUser?.myTeams?.concat(currentUser?.trainedTeams || []) || [],
    [currentUser],
  );

  const canContact = useMemo(() => {
    if (!currentUser || !user) return false;
    // Cannot contact self
    if (currentUser.documentId === user.documentId) return false;
    // Only Coach and President can contact
    return currentUser.role?.name === USER_ROLES.coach || currentUser.role?.name === USER_ROLES.president;
  }, [currentUser, user, USER_ROLES]);

  // handlers
  const handleContactUser = async () => {
    if (!user || !currentUser) return;

    // Age verification
    let age = 18; // Default to adult if no birthdate
    if (user.birthdate) {
      age = differenceInYears(new Date(), new Date(user.birthdate));
    }

    if (age < 13) {
      // Minor check
      if (user.parentAccount) {
        // Create group chat with parent
        const newChat = await startWhisperChat([
          currentUser.documentId,
          user.documentId,
          user.parentAccount.documentId
        ]);
        if (newChat?.documentId) {
          navigation.navigate(RouteNames.Conversation, { chatId: newChat.documentId });
        }
      } else {
        // Block
        Alert.alert(
          t('common.errors.error'),
          "Impossible de contacter ce joueur mineur car aucun compte parent n'est lié."
        );
      }
    } else {
      // Adult or >= 13
      const newChat = await startWhisperChat([currentUser.documentId, user.documentId]);
      if (newChat?.documentId) {
        navigation.navigate(RouteNames.Conversation, { chatId: newChat.documentId });
      }
    }
  };

  const handleOpenClub = () => {
    navigation.navigate(RouteNames.Club, {
      clubId: user?.club?.documentId,
    });
  };

  /**
   * Handle team press action
   * @param {Team} team
   */
  const handleTeamPress = (team) => {
    if (team?.documentId) {
      navigation.navigate(RouteNames.TeamDetails, { teamId: team.documentId });
    }
  };

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.gap[40],
        Spaces.paddingBottom[0], // Remove padding bottom to handle sticky footer
        Alignments.justifySpaceBetween,
        Alignments.column,
        Alignments.fill,
      ]}
    >
      {/* header */}
      <View
        style={[
          Alignments.justifyCenter,
          Alignments.alignCenter,
          Spaces.gap[12],
        ]}
      >
        <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
          {t('userDetails.title').toUpperCase()}
        </Text>
        <View style={[
          ApplicationStyle.separator,
          ApplicationStyle.backgroundColor.neutral00,
          { width: 98 }]}
        />
        <Text style={[Fonts.p2Bold, Fonts.primary500]}>
          {user?.role?.name?.toUpperCase()}
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={[
          Spaces.gap[24],
          { paddingBottom: 100 }, // Add padding for sticky footer
        ]}
        refreshControl={(
          <RefreshControl
            onRefresh={refetch}
            refreshing={isLoading}
          />
        )}
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
      >
        <WithDataWrapper
          error={error?.message}
          isLoading={isLoading}
          wrapperStyle={[Spaces.gap[24]]}
        >

          <View
            style={[
              Alignments.row,
              Alignments.alignCenter,
              Spaces.gap[16],
            ]}
          >
            <ProfileAvatar
              imageUrl={user?.avatar?.url}
              size={80}
              style={[
                ApplicationStyle.borderColor.neutral00,
                ApplicationStyle.borderWidth1,
                { borderRadius: 80 },
              ]}
              imageStyle={{ borderRadius: 80 }}
            />
            {user?.firstname && user?.lastname && (
              <View style={[
                { maxWidth: '70%' },
                Alignments.justifyStart,
                Alignments.alignStart,
                Spaces.gap[8],
              ]}
              >
                <Text
                  numberOfLines={2}
                  style={[
                    Fonts.textCenter,
                    Fonts.h4Black,
                    Spaces.marginLeft[8],
                    Fonts.neutral00]}
                >
                  {`${user.firstname} ${user.lastname?.toUpperCase()}`}
                </Text>
                {user.club ? (
                  <TouchableOpacity
                    onPress={handleOpenClub}
                    style={[
                      Alignments.row,
                      Alignments.alignCenter,
                      Spaces.gap[8],
                      Spaces.marginLeft[8],
                      { maxWidth: '90%' }]}
                  >
                    <TeamShield
                      initials={user?.club?.name
                        ? getClubInitials(user.club?.name) : ''}
                      isSmall
                    />
                    <Text
                      numberOfLines={1}
                      style={[Fonts.p2, Fonts.neutral300]}
                    >
                      {user?.club?.name}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )}
          </View>

          {/* Mercato Status Badge */}
          {user?.isLookingForClub && (
            <View style={[
              Alignments.selfStart,
              Spaces.marginLeft[8],
              Spaces.paddingHorizontal[16],
              Spaces.paddingVertical[8],
              ApplicationStyle.borderRadius16,
              { backgroundColor: Colors.primary500 }
            ]}>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                {t('userDetails.badges.lookingForClub', 'En recherche de club')}
              </Text>
            </View>
          )}

          {/* SECTION SPORTIF */}
          <View style={[
            ApplicationStyle.card,
            Spaces.padding[16],
            Spaces.gap[16],
            { backgroundColor: 'rgba(0,0,0,0.3)' } // Glassmorphism-like
          ]}>
            <Text style={[Fonts.h5Bold, Fonts.neutral00, Spaces.marginBottom[8]]}>Profil Sportif</Text>
            <View style={[Alignments.row, { flexWrap: 'wrap' }, Alignments.justifySpaceBetween]}>
              {/* Sport */}
              {user?.preferredSport && (
                <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12], { width: '48%', marginBottom: 16 }]}>
                  <View style={[
                    Alignments.justifyCenter, Alignments.alignCenter,
                    { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.neutral800 }
                  ]}>
                    <Image source={Images.running} style={{ width: 20, height: 20, tintColor: Colors.primary500 }} />
                  </View>
                  <View>
                    <Text style={[Fonts.p2, Fonts.neutral300]}>{t('userDetails.fields.sport', 'Sport')}</Text>
                    <Text style={[Fonts.h5Bold, Fonts.neutral00, { textTransform: 'capitalize' }]}>{user.preferredSport}</Text>
                  </View>
                </View>
              )}

              {/* Poste */}
              {user?.position && (
                <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12], { width: '48%', marginBottom: 16 }]}>
                  <View style={[
                    Alignments.justifyCenter, Alignments.alignCenter,
                    { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.neutral800 }
                  ]}>
                    <Image source={Images.pin} style={{ width: 20, height: 20, tintColor: Colors.primary500 }} />
                  </View>
                  <View>
                    <Text style={[Fonts.p2, Fonts.neutral300]}>{t('userDetails.fields.position')}</Text>
                    <Text style={[Fonts.h5Bold, Fonts.neutral00]}>{user.position}</Text>
                  </View>
                </View>
              )}

              {/* Niveau */}
              {user?.bestLevel && (
                <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12], { width: '48%', marginBottom: 16 }]}>
                  <View style={[
                    Alignments.justifyCenter, Alignments.alignCenter,
                    { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.neutral800 }
                  ]}>
                    <Image source={Images.shield} style={{ width: 20, height: 20, tintColor: Colors.primary500 }} />
                  </View>
                  <View>
                    <Text style={[Fonts.p2, Fonts.neutral300]}>{t('userDetails.fields.bestLevel', 'Niveau')}</Text>
                    <Text style={[Fonts.h5Bold, Fonts.neutral00]}>{user.bestLevel}</Text>
                  </View>
                </View>
              )}

              {/* Catégorie */}
              {user?.section?.name && (
                <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12], { width: '48%', marginBottom: 16 }]}>
                  <View style={[
                    Alignments.justifyCenter, Alignments.alignCenter,
                    { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.neutral800 }
                  ]}>
                    <Image source={Images.users} style={{ width: 20, height: 20, tintColor: Colors.primary500 }} />
                  </View>
                  <View>
                    <Text style={[Fonts.p2, Fonts.neutral300]}>{t('userDetails.fields.category', 'Catégorie')}</Text>
                    <Text style={[Fonts.h5Bold, Fonts.neutral00]}>{user.section.name}</Text>
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* SECTION PERSONNEL */}
          <View style={[
            ApplicationStyle.card,
            Spaces.padding[16],
            Spaces.gap[16],
            { backgroundColor: 'rgba(0,0,0,0.3)' }
          ]}>
            <Text style={[Fonts.h5Bold, Fonts.neutral00, Spaces.marginBottom[8]]}>Infos Personnelles</Text>
            <View style={[Alignments.row, { flexWrap: 'wrap' }, Alignments.justifySpaceBetween]}>
              {/* Age */}
              {user?.birthdate && (
                <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12], { width: '48%', marginBottom: 16 }]}>
                  <View style={[
                    Alignments.justifyCenter, Alignments.alignCenter,
                    { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.neutral800 }
                  ]}>
                    <Image source={Images.calendar} style={{ width: 20, height: 20, tintColor: Colors.primary500 }} />
                  </View>
                  <View>
                    <Text style={[Fonts.p2, Fonts.neutral300]}>{t('userDetails.fields.age', 'Age')}</Text>
                    <Text style={[Fonts.h5Bold, Fonts.neutral00]}>
                      {`${differenceInYears(new Date(), new Date(user.birthdate))} ans`}
                    </Text>
                  </View>
                </View>
              )}

              {/* Date de naissance */}
              {user?.birthdate && (
                <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12], { width: '48%', marginBottom: 16 }]}>
                  <View style={[
                    Alignments.justifyCenter, Alignments.alignCenter,
                    { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.neutral800 }
                  ]}>
                    <Image source={Images.calendar} style={{ width: 20, height: 20, tintColor: Colors.primary500 }} />
                  </View>
                  <View>
                    <Text style={[Fonts.p2, Fonts.neutral300]}>Né le</Text>
                    <Text style={[Fonts.h5Bold, Fonts.neutral00]}>
                      {format(new Date(user.birthdate), 'dd/MM/yyyy')}
                    </Text>
                  </View>
                </View>
              )}

              {/* Taille */}
              {user?.height && (
                <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12], { width: '48%', marginBottom: 16 }]}>
                  <View style={[
                    Alignments.justifyCenter, Alignments.alignCenter,
                    { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.neutral800 }
                  ]}>
                    <Image source={Images.check} style={{ width: 20, height: 20, tintColor: Colors.primary500 }} />
                  </View>
                  <View>
                    <Text style={[Fonts.p2, Fonts.neutral300]}>{t('userDetails.fields.height', 'Taille')}</Text>
                    <Text style={[Fonts.h5Bold, Fonts.neutral00]}>{user.height} m</Text>
                  </View>
                </View>
              )}

              {/* Poids */}
              {user?.weight && (
                <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12], { width: '48%', marginBottom: 16 }]}>
                  <View style={[
                    Alignments.justifyCenter, Alignments.alignCenter,
                    { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.neutral800 }
                  ]}>
                    <Image source={Images.check} style={{ width: 20, height: 20, tintColor: Colors.primary500 }} />
                  </View>
                  <View>
                    <Text style={[Fonts.p2, Fonts.neutral300]}>{t('userDetails.fields.weight', 'Poids')}</Text>
                    <Text style={[Fonts.h5Bold, Fonts.neutral00]}>{user.weight} kg</Text>
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* teams */}
          {allUserTeams?.length ? (
            <View style={[Spaces.gap[16]]}>
              <View style={[Alignments.row,
              Alignments.alignCenter, Alignments.scrollSpaceBetween, Spaces.gap[16]]}
              >
                <Text style={[Fonts.h4Black, Fonts.neutral00]}>{t('userDetails.titles.teams')}</Text>
              </View>
              {
                allUserTeams?.map((/** @type {Team} */ team) => (
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
                    <Image
                      source={Images.arrowRight}
                      style={{ width: 16, height: 16, tintColor: Colors.neutral00, marginRight: 16 }}
                    />
                  </TouchableOpacity>
                ))
              }
            </View>
          ) : null}
        </WithDataWrapper>
      </ScrollView>

      {/* Sticky Footer Button */}
      {canContact && (
        <View style={[
          Alignments.absolute,
          { bottom: 0, left: 0, right: 0 },
          Spaces.padding[16],
          // Add background color/blur if needed, but for now just the button
        ]}>
          <Button
            onPress={handleContactUser}
            title={t('userDetails.actions.contact', 'Contacter')}
            variant="Primary"
          />
        </View>
      )}
    </ScreenContainer>
  );
}

export default UserDetails;
