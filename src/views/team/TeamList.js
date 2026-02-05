import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Image, View } from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ProfileButton from '@/components/molecules/profileButton/ProfileButton';
import TeamListContent from '@/components/organisms/teamListContent/TeamListContent';
import ScreenContainer from '@/components/templates/ScreenContainer';
import NotificationBadge from '@/components/molecules/notificationBadge/NotificationBadge';
import LeagueHeaderSwitch from '@/components/molecules/header/LeagueHeaderSwitch';

import { RouteNames } from '@/navigation/routeNames';

/**
 * Team list screen component
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} Team list screen component
 */
function TeamList({ navigation, route }) {
  const { t } = useTranslation();
  const { canManageTeam, refetchUserData, userData } = useAuth();
  const clubId = route?.params?.clubId ? route?.params.clubId : userData?.club?.documentId;

  // Effects
  useFocusEffect(() => {
    refetchUserData();
  });

  // hooks
  const {
    Alignments,
    Images,
    Spaces,
  } = useTheme();

  const handleAddTeam = () => {
    navigation.navigate(RouteNames.TeamStack, {
      screen: RouteNames.TeamEdit,
      params: { clubId },
    });
  };

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.paddingBottom[24],
        Alignments.justifySpaceBetween,
        Alignments.column,
        Alignments.fill,
      ]}
    >
      <View style={[
        Spaces.marginTop[16],
        Spaces.marginBottom[24],
        Alignments.row,
        Alignments.alignCenter,
        Alignments.justifySpaceBetween]}
      >
        <LeagueHeaderSwitch />
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <NotificationBadge />
          <ProfileButton />
        </View>
      </View>
      <TeamListContent clubId={clubId} />
      {
        canManageTeam ? (
          <Button
            onPress={handleAddTeam}
            title={t('teamList.actions.add')}
            variant="Primary"
          />
        ) : null
      }
    </ScreenContainer>
  );
}

export default TeamList;
