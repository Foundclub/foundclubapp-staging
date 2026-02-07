import { useFocusEffect } from '@react-navigation/native';
import { View } from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import ProfileButton from '@/components/molecules/profileButton/ProfileButton';
import NotificationBadge from '@/components/molecules/notificationBadge/NotificationBadge';
import TeamListContent from '@/components/organisms/teamListContent/TeamListContent';
import ScreenContainer from '@/components/templates/ScreenContainer';
import LeagueHeaderSwitch from '@/components/molecules/header/LeagueHeaderSwitch';

/**
 * Team list screen component
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} Team list screen component
 */
function MyTeamList({ route }) {
  const { Images } = useTheme();
  const { playerId, isLeagueMode } = route?.params ?? {};
  const { refetchUserData, userData } = useAuth();
  // Effects
  useFocusEffect(() => {
    refetchUserData();
  });

  // hooks
  const {
    Alignments,
    Spaces,
  } = useTheme();

  return (
    <ScreenContainer
      contentContainerStyle={[
        Spaces.paddingVertical[24],
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
      <TeamListContent
        clubId={userData?.club?.documentId}
        isLeagueMode={isLeagueMode}
        playerId={playerId}
      />
    </ScreenContainer>
  );
}

export default MyTeamList;
