import { useMemo } from 'react';

import useAuth from '@/domains/auth/useAuth';
import { TutorialIds } from '@/domains/tutorial/tutorialIds';

import CMPlanningContent from '@/components/organisms/planning/CMPlanningContent';
import ScreenContainer from '@/components/templates/ScreenContainer';
import MyEventListTutorialBoundary from '@/views/event/MyEventListTutorialBoundary';
import ParticipantEventList from '@/views/event/ParticipantEventList';

import { useClubScope } from '@/context/ClubScopeContext';

/**
 * My events list screen component that shows events or CM planning based on role
 * @param {object} props
 * @param {object} props.navigation - Navigation object
 * @param props.route
 * @returns {React.ReactElement} MyEventList component
 */
function MyEventList({ navigation, route }) {
  const { userData } = useAuth();
  const clubScope = useClubScope() || {};
  const managedMultisportClubIds = useMemo(() => (
    new Set(
      (Array.isArray(userData?.multisportClubs) ? userData.multisportClubs : [])
        .map((multisportClub) => String(multisportClub?.documentId || multisportClub?.id || '').trim())
        .filter(Boolean),
    )
  ), [userData?.multisportClubs]);

  const multisportClub = useMemo(() => {
    if (clubScope.activeMode !== 'multisport' || managedMultisportClubIds.size === 0) {
      return null;
    }

    const preferredIds = [
      clubScope.activeMultisportClubId,
      userData?.multisportClubs?.[0]?.documentId,
      userData?.multisportClubs?.[0]?.id,
    ]
      .map((value) => String(value || '').trim())
      .filter(Boolean);

    const resolvedMultisportClubId = preferredIds.find((candidate) => managedMultisportClubIds.has(candidate));
    return resolvedMultisportClubId ? { documentId: resolvedMultisportClubId } : null;
  }, [
    clubScope.activeMode,
    clubScope.activeMultisportClubId,
    managedMultisportClubIds,
    userData?.multisportClubs,
  ]);

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
