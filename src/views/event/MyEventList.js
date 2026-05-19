import useAuth from '@/domains/auth/useAuth';
import { TutorialIds } from '@/domains/tutorial/tutorialIds';

import CMPlanningContent from '@/components/organisms/planning/CMPlanningContent';
import ScreenContainer from '@/components/templates/ScreenContainer';
import MyEventListTutorialBoundary from '@/views/event/MyEventListTutorialBoundary';
import ParticipantEventList from '@/views/event/ParticipantEventList';

/**
 * My events list screen component that shows events or CM planning based on role
 * @param {object} props
 * @param {object} props.navigation - Navigation object
 * @param props.route
 * @returns {React.ReactElement} MyEventList component
 */
function MyEventList({ navigation, route }) {
  const { userData } = useAuth();

  // Check if user is a multisport manager
  const multisportClub = userData?.multisportClubs?.[0];

  return (
    <MyEventListTutorialBoundary
      onForceStartHandled={() => {
        navigation.setParams({
          startTutorial: undefined,
          tutorialId: undefined,
          tutorialSource: undefined,
          tutorialStartToken: undefined,
        });
      }}
      routeParams={route?.params}
      tutorialId={TutorialIds.PLANNING}
      userId={userData?.documentId}
    >
      {multisportClub ? (
        <ScreenContainer bgImage="bg2">
          <CMPlanningContent
            cmId={multisportClub.documentId}
            insideScreenContainer
            navigation={navigation}
            showTopHeader
          />
        </ScreenContainer>
      ) : (
        <ParticipantEventList navigation={navigation} />
      )}
    </MyEventListTutorialBoundary>
  );
}

export default MyEventList;
