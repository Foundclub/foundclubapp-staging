import React from 'react';
import useAuth from '@/domains/auth/useAuth';
import CMPlanningContent from '@/components/organisms/planning/CMPlanningContent';
import ParticipantEventList from '@/views/event/ParticipantEventList';
import ScreenContainer from '@/components/templates/ScreenContainer';

/**
 * My events list screen component that shows events or CM planning based on role
 * @param {object} props
 * @param {object} props.navigation - Navigation object
 * @returns {React.ReactElement} MyEventList component
 */
function MyEventList({ navigation }) {
  const { userData } = useAuth();
  
  // Check if user is a multisport manager
  const multisportClub = userData?.multisportClubs?.[0];

  if (multisportClub) {
     return (
       <ScreenContainer bgImage="bg2">
          <CMPlanningContent cmId={multisportClub.documentId} navigation={navigation} />
       </ScreenContainer>
     );
  }

  return <ParticipantEventList navigation={navigation} />;
}

export default MyEventList;
