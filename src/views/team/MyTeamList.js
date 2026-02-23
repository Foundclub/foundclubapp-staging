import { useFocusEffect } from '@react-navigation/native';
import { View } from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import { TutorialIds } from '@/domains/tutorial/tutorialIds';
import useTheme from '@/theme/themeContext';

import LeagueHeaderSwitch from '@/components/molecules/header/LeagueHeaderSwitch';
import NotificationBadge from '@/components/molecules/notificationBadge/NotificationBadge';
import OnboardingWrapper from '@/components/molecules/onboardingWrapper/OnboardingWrapper';
import ProfileButton from '@/components/molecules/profileButton/ProfileButton';
import TutorialFlowBoundary from '@/components/molecules/tutorial/TutorialFlowBoundary';
import TeamListContent from '@/components/organisms/teamListContent/TeamListContent';
import ScreenContainer from '@/components/templates/ScreenContainer';

/**
 * Team list screen component
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} Team list screen component
 */
function MyTeamList({ navigation, route }) {
  const { isLeagueMode, playerId } = route?.params ?? {};
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
    <TutorialFlowBoundary
      onForceStartHandled={() => {
        navigation.setParams({
          startTutorial: undefined,
          tutorialId: undefined,
          tutorialSource: undefined,
          tutorialStartToken: undefined,
        });
      }}
      routeParams={route?.params}
      tutorialId={TutorialIds.MY_TEAMS}
      userId={userData?.documentId}
    >
      <ScreenContainer
        contentContainerStyle={[
          Spaces.paddingVertical[24],
          Alignments.justifySpaceBetween,
          Alignments.column,
          Alignments.fill,
        ]}
        responsiveHorizontalPadding
      >
        <View style={[
          Spaces.marginTop[16],
          Spaces.marginBottom[24],
          Alignments.row,
          Alignments.alignCenter,
          Alignments.justifySpaceBetween]}
        >
          <LeagueHeaderSwitch />
          <View style={{ alignItems: 'center', flexDirection: 'row' }}>
            <NotificationBadge />
            <ProfileButton />
          </View>
        </View>
        <OnboardingWrapper
          description="Retrouvez vos equipes, les demandes en attente et l acces aux details."
          id="my-teams-main-content"
          order={1}
          spotlight={{
            borderRadius: 16,
            maxHeight: 280,
            overlayOpacity: 0.4,
            paddingX: 2,
            paddingY: 2,
          }}
          style={{ flex: 1 }}
          title="Mes equipes"
        >
          <TeamListContent
            clubId={userData?.club?.documentId}
            isLeagueMode={isLeagueMode}
            playerId={playerId}
          />
        </OnboardingWrapper>
      </ScreenContainer>
    </TutorialFlowBoundary>
  );
}

export default MyTeamList;
