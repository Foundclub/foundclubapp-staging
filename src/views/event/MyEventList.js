import React from 'react';
import useAuth from '@/domains/auth/useAuth';
import CMPlanningContent from '@/components/organisms/planning/CMPlanningContent';
import ParticipantEventList from '@/views/event/ParticipantEventList';
import TutorialFlowBoundary from '@/components/molecules/tutorial/TutorialFlowBoundary';
import ScreenContainer from '@/components/templates/ScreenContainer';
import { TutorialIds } from '@/domains/tutorial/tutorialIds';

/**
 * My events list screen component that shows events or CM planning based on role
 * @param {object} props
 * @param {object} props.navigation - Navigation object
 * @returns {React.ReactElement} MyEventList component
 */
function MyEventList({ navigation, route }) {
  const { userData } = useAuth();
  
  // Check if user is a multisport manager
  const multisportClub = userData?.multisportClubs?.[0];

  return (
    <TutorialFlowBoundary
      onForceStartHandled={() => {
        navigation.setParams({
          startTutorial: undefined,
          tutorialId: undefined,
          tutorialStartToken: undefined,
          tutorialSource: undefined,
        });
      }}
      routeParams={route?.params}
      tutorialId={TutorialIds.PLANNING}
      userId={userData?.documentId}
    >
      {multisportClub ? (
        <ScreenContainer bgImage="bg2">
          <CMPlanningContent cmId={multisportClub.documentId} navigation={navigation} />
        </ScreenContainer>
      ) : (
        <ParticipantEventList navigation={navigation} />
      )}
    </TutorialFlowBoundary>
  );
}

export default MyEventList;
