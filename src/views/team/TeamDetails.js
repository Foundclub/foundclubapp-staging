import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image, RefreshControl, ScrollView, Text, View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useClub from '@/domains/club/useClub';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetTeam } from '@/services/team/teamQueries';

/**
 * Team details screen component
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} Team details screen component
 */
function TeamDetails({ navigation, route }) {
  const { teamId } = route?.params ?? {};

  // hooks
  const {
    Alignments, ApplicationStyle, Fonts, Images, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { canManageTeam } = useAuth();
  const { getClubInitials } = useClub();

  const {
    data: team, error, isLoading, refetch,
  } = useGetTeam(teamId);

  // handlers
  const handleEditTeam = useCallback(() => {
    navigation.navigate(RouteNames.TeamEdit, { clubId: team?.club?.documentId, teamId });
  }, [navigation, team?.club?.documentId, teamId]);

  // Count-based section titles
  const trainersCount = useMemo(() => team?.trainers?.length || 0, [team?.trainers]);
  const playersCount = useMemo(() => team?.players?.length || 0, [team?.players]);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.paddingBottom[32],
        Spaces.gap[24],
        Alignments.justifySpaceBetween,
        Alignments.column,
        Alignments.fill,
      ]}
    >
      <View style={[
        Spaces.gap[8],
        Alignments.justifyCenter,
        Alignments.alignCenter]}
      >
        <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
          {t('teamDetails.title').toUpperCase()}
        </Text>
        <View style={[
          ApplicationStyle.separator,
          ApplicationStyle.backgroundColor.neutral00,
          { width: 120 }]}
        />
        <Text style={[Fonts.p2Bold, Fonts.primary500]}>
          {team?.activities?.[0]?.name?.toUpperCase()}
        </Text>
      </View>
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
          wrapperStyle={[Alignments.fill]}
        >
          <View
            key={team?.documentId}
            style={[
              ApplicationStyle.borderRadius24,
              ApplicationStyle.backgroundColor.primary700,
              Alignments.alignCenter,
              Alignments.relative,
              Spaces.gap[24],
              Spaces.padding[24],
              Spaces.marginTop[24],
            ]}
          >
            <View style={[{ marginTop: -32 }, Alignments.absolute]}>
              <TeamShield
                initials={team?.club?.name ? getClubInitials(team?.club?.name || '') : ''}
              />
            </View>
            <View style={[
              Spaces.marginTop[32],
              Spaces.gap[4],
              Alignments.alignCenter]}
            >
              <Text style={[Fonts.h3Black, Fonts.neutral00, Fonts.textCenter]}>
                {team?.name}
              </Text>
            </View>
            {team?.description ? (
              <View style={[Alignments.alignCenter]}>
                <Text style={[Fonts.p2, Fonts.primary100]}>
                  {team?.description}
                </Text>
              </View>
            ) : null}
            <View style={[
              Alignments.fullWidth,
              ApplicationStyle.separator,
              ApplicationStyle.backgroundColor.neutral500,
            ]}
            />
            <View style={[
              Spaces.gap[8],
              Alignments.row,
              Alignments.wrap,
              Alignments.justifyCenter,
            ]}
            >
              {team?.section ? (
                <Text style={[Fonts.p2Bold, Fonts.primary100]}>
                  {t('teamList.fields.section')}
                  {' : '}
                  <Text style={[Fonts.p2, Fonts.primary100]}>
                    {team?.section?.name}
                  </Text>
                </Text>
              ) : null}
              {team?.category ? (
                <Text style={[Fonts.p2Bold, Fonts.primary100]}>
                  {t('teamList.fields.category')}
                  {' : '}
                  <Text style={[Fonts.p2, Fonts.primary100]}>
                    {team?.category?.name}
                  </Text>
                </Text>
              ) : null}
              {team?.level ? (
                <Text style={[Fonts.p2Bold, Fonts.primary100]}>
                  {t('teamList.fields.level')}
                  {' : '}
                  <Text style={[Fonts.p2, Fonts.primary100]}>
                    {team?.level?.name}
                  </Text>
                </Text>
              ) : null}
            </View>
          </View>
          <View
            style={[
              Spaces.gap[24],
              Spaces.marginTop[24],
              Spaces.paddingBottom[24],
            ]}
          >
            {/* Trainers */}
            {trainersCount ? (
              <View style={[Spaces.gap[16]]}>
                <View style={[Alignments.row,
                  Alignments.alignCenter, Alignments.scrollSpaceBetween, Spaces.gap[16]]}
                >
                  <Text style={[Fonts.h4Black, Fonts.neutral00]}>
                    {t('teamDetails.sections.trainers', { count: trainersCount })}
                  </Text>
                </View>
                {
                  team?.trainers?.map((/** @type {User} */ user) => (
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
                    </View>
                  ))
                }
              </View>
            ) : null}
            {/* Players */}
            {playersCount ? (
              <View style={[Spaces.gap[16]]}>
                <View style={[Alignments.row,
                  Alignments.alignCenter, Alignments.scrollSpaceBetween, Spaces.gap[16]]}
                >
                  <Text style={[Fonts.h4Black, Fonts.neutral00]}>
                    {t('teamDetails.sections.players', { count: playersCount })}
                  </Text>
                </View>
                {
                  team?.players?.map((/** @type {User} */ user) => (
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
                    </View>
                  ))
                }
              </View>
            ) : null}
          </View>
        </WithDataWrapper>
      </ScrollView>
      {canManageTeam && (
        <Button
          onPress={handleEditTeam}
          style={Spaces.paddingHorizontal[16]}
          title={t('teamDetails.actions.edit')}
          variant="Primary"
        />
      )}
    </ScreenContainer>
  );
}

export default TeamDetails;
