import { useFocusEffect } from '@react-navigation/native';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Image, Linking, RefreshControl, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import { USER_ROLES } from '@/domains/auth/authUseCases';
import { useAuth } from '@/domains/auth/useAuth';
import { getClubInitials } from '@/domains/club/clubUseCase';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { removeTrainerFromClub } from '@/services/auth/authService';
import { useGetAddressFromCoordinates, useGetClub } from '@/services/club/clubQueries';
import { updateClub } from '@/services/club/clubService';

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
  const { inviteTrainer, userData } = useAuth();
  const { t } = useTranslation();

  const {
    data: club,
    error,
    isLoading,
    refetch,
  } = useGetClub(clubId ?? '');

  const { data: address } = useGetAddressFromCoordinates({
    lat: club?.address?.lat,
    lng: club?.address?.lng,
  });

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

  // TODO: put this in a permission hook
  const canEditClub = useMemo(() => userData?.role.name === USER_ROLES.president
  && userData?.club?.documentId === clubId, [userData, clubId]);

  const coachs = useMemo(() => club?.members?.filter(
    (user) => user.role.name === USER_ROLES.coach,
  ), [club]);

  // handlers
  const handleCreateCoach = () => {
    navigation.navigate(RouteNames.AddCoach, { clubId });
  };

  const handleCreateSponsor = () => {
    navigation.navigate(RouteNames.AddSponsor, { clubId });
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

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

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
            Spaces.marginTop[32],
          ]}
          >
            <View style={{ marginTop: -40 }}>
              <TeamShield
                initials={club?.name ? getClubInitials(club?.name) : ''}
              />
            </View>
            <View style={[
              Spaces.gap[4],
              Alignments.alignCenter]}
            >
              <Text style={[Fonts.h3Black, Fonts.neutral00, Fonts.textCenter]}>
                {club?.name}
              </Text>
              <Text style={[Fonts.p2, Fonts.primary100]}>
                {address}
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
          {(club?.sponsor?.length || canEditClub) && (
          <View style={[Spaces.gap[16]]}>
            <View style={[Alignments.row,
              Alignments.alignCenter, Alignments.scrollSpaceBetween, Spaces.gap[16]]}
            >
              <Text style={[Fonts.h4Black, Fonts.neutral00]}>{t('clubDetails.titles.sponsors')}</Text>
              {canEditClub ? (
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
                    canEditClub ? (
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
                    <Image
                      source={{ uri: sponsor?.logo?.url }}
                      style={[
                        ApplicationStyle.roundIcon55,
                        ApplicationStyle.borderWidth1,
                        ApplicationStyle.borderColor.neutral00,
                      ]}
                    />
                    <Text numberOfLines={1} style={[Fonts.p2Bold, Fonts.neutral00]}>
                      {sponsor.title}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
          )}

          {/* Coachs */}
          {coachs?.length || canEditClub ? (
            <View style={[Spaces.gap[16]]}>
              <View style={[Alignments.row,
                Alignments.alignCenter, Alignments.scrollSpaceBetween, Spaces.gap[16]]}
              >
                <Text style={[Fonts.h4Black, Fonts.neutral00]}>{t('clubDetails.titles.coachs')}</Text>
                {canEditClub ? (
                  <Button
                    icon="plus"
                    isOption
                    onPress={handleCreateCoach}
                    variant="Primary"
                  />
                ) : null}
              </View>
              <ScrollView
                contentContainerStyle={[Spaces.gap[16]]}
              >
                {
                  coachs?.map((/** @type {User} */ user) => (
                    <View
                      key={user.documentId}
                      style={[
                        ApplicationStyle.borderRadius24,
                        ApplicationStyle.backgroundColor.primary700,
                        Alignments.row,
                        Alignments.alignCenter,
                        Alignments.justifySpaceBetween,
                        Spaces.padding[16],
                        Spaces.gap[16]]}
                    >
                      <View style={[Alignments.row, Spaces.gap[16], Alignments.alignCenter]}>
                        <Image
                          source={user.avatar ? { uri: user?.avatar?.url } : Images.roundAvatar}
                          style={[
                            ApplicationStyle.roundIcon40,
                            ApplicationStyle.borderWidth1,
                            ApplicationStyle.borderColor.neutral00,
                          ]}
                        />
                        <Text numberOfLines={1} style={[Fonts.p1Bold, Fonts.neutral00]}>
                          {`${user.firstname} ${user.lastname}`}
                        </Text>
                      </View>
                      {canEditClub ? (
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
                    </View>
                  ))
                }
              </ScrollView>
            </View>
          ) : null}

        </WithDataWrapper>
      </ScrollView>
    </ScreenContainer>
  );
}

export default ClubDetails;
