import { useTranslation } from 'react-i18next';
import {
  Image, RefreshControl, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useClub from '@/domains/club/useClub';
import useMessaging from '@/domains/messaging/useMessaging';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import ScreenContainer from '@/components/templates/ScreenContainer';

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
    Alignments, ApplicationStyle, Fonts, Images, Spaces,
  } = useTheme();
  const { getClubInitials } = useClub();
  const { canSendMessageToUser, userData: currentUser } = useAuth();
  const { startWhisperChat } = useMessaging();

  const {
    data: user,
    error,
    isLoading,
    refetch,
  } = useGetUserById(userId);

  const handleStartChat = async () => {
    if (currentUser?.documentId && user?.documentId) {
      const newChat = await startWhisperChat([currentUser.documentId, user?.documentId]);
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

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.gap[40],
        Spaces.paddingBottom[24],
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
          Spaces.gap[32],
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
        >

          <View
            style={[
              Alignments.row,
              Alignments.alignCenter,
              Spaces.gap[16],
            ]}
          >
            <Image
              source={user?.avatar?.url
                ? { uri: user.avatar?.url }
                : Images.roundAvatar}
              style={[
                ApplicationStyle.borderColor.neutral00,
                ApplicationStyle.borderWidth1,
                { borderRadius: 80, height: 80, width: 80 }]}
            />
            {user?.firstname && user?.lastname && (
              <View style={[
                { maxWidth: '70%' },
                Alignments.justifyStart,
                Alignments.alignStart,
                Spaces.gap[24],
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
                      Spaces.gap[16],
                      { marginTop: -10, maxWidth: '75%' }]}
                  >
                    <TeamShield
                      initials={user?.club?.name
                        ? getClubInitials(user.club?.name) : ''}
                      isSmall
                    />
                    <View style={[
                      { height: 40, width: 1 },
                      ApplicationStyle.backgroundColor.neutral300,
                    ]}
                    />
                    <Text
                      numberOfLines={2}
                      style={[Fonts.p1Black, Fonts.neutral00]}
                    >
                      {user?.club?.name}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )}
          </View>
          {/* TODO: {renderUserTeams()} */}
        </WithDataWrapper>
      </ScrollView>
      {user && canSendMessageToUser(user) ? (
        <Button
          onPress={handleStartChat}
          style={Spaces.marginBottom[24]}
          title={t('userDetails.actions.sendMessage')}
          variant="Primary"
        />
      ) : null}
    </ScreenContainer>
  );
}

export default UserDetails;
