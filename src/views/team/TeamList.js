import { useFocusEffect } from '@react-navigation/native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import { TutorialIds } from '@/domains/tutorial/tutorialIds';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import LeagueHeaderSwitch from '@/components/molecules/header/LeagueHeaderSwitch';
import NotificationBadge from '@/components/molecules/notificationBadge/NotificationBadge';
import OnboardingWrapper from '@/components/molecules/onboardingWrapper/OnboardingWrapper';
import ProfileButton from '@/components/molecules/profileButton/ProfileButton';
import TutorialFlowBoundary from '@/components/molecules/tutorial/TutorialFlowBoundary';
import TeamListContent from '@/components/organisms/teamListContent/TeamListContent';
import ScreenContainer from '@/components/templates/ScreenContainer';

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
  const assignmentTrainerName = route?.params?.assignmentTrainerName;
  const assignmentTrainerId = route?.params?.assignmentTrainerId;
  const openAssignTrainerGuide = route?.params?.openAssignTrainerGuide;

  // Effects
  useFocusEffect(() => {
    refetchUserData();
  });

  useEffect(() => {
    if (!openAssignTrainerGuide) return;

    Alert.alert(
      'Assigner un entraineur',
      `${assignmentTrainerName || 'Cet entraineur'} est maintenant dans votre club.\n\n1) Ouvrez une equipe.\n2) Appuyez sur "Modifier".\n3) Dans la section "Entraineurs", ajoutez puis validez.`,
      [{ text: t('common.actions.ok', 'OK') }],
    );

    navigation.setParams({
      openAssignTrainerGuide: false,
    });
  }, [assignmentTrainerName, navigation, openAssignTrainerGuide, t]);

  // hooks
  const {
    Alignments,
    Spaces,
  } = useTheme();

  const handleAddTeam = () => {
    navigation.navigate(RouteNames.TeamStack, {
      params: { clubId },
      screen: RouteNames.TeamWizardName,
    });
  };

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
        bgImage="bg2"
        contentContainerStyle={[
          Spaces.paddingBottom[24],
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
          description="Consultez vos equipes, les demandes et ouvrez chaque fiche equipe."
          id="team-list-main-content"
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
            assignmentTrainerId={assignmentTrainerId}
            assignmentTrainerName={assignmentTrainerName}
            clubId={clubId}
          />
        </OnboardingWrapper>
        {
          canManageTeam ? (
            <Button
              onPress={handleAddTeam}
              style={[Spaces.marginTop[16]]}
              title={`+ ${t('teamList.actions.add')}`}
              variant="Primary"
            />
          ) : null
        }
      </ScreenContainer>
    </TutorialFlowBoundary>
  );
}

export default TeamList;
