import useAuth from '@/domains/auth/useAuth';
import { TutorialIds } from '@/domains/tutorial/tutorialIds';

import OnboardingWrapper from '@/components/molecules/onboardingWrapper/OnboardingWrapper';
import TutorialFlowBoundary from '@/components/molecules/tutorial/TutorialFlowBoundary';
import ReservationListContent from '@/components/organisms/reservationListContent/ReservationListContent';

import SearchScreenShell from './components/SearchScreenShell';

/**
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 * @returns {import('react').ReactElement}
 */
function SearchReservationsScreen({ navigation, route }) {
  const { userData } = useAuth();
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
      tutorialId={TutorialIds.SEARCH_RESERVATIONS}
      userId={userData?.documentId}
    >
      <SearchScreenShell
        activeType="reservations"
        navigation={navigation}
        tutorialSteps={{
          header: {
            description: 'Accédez ici aux réservations de terrains et installations.',
            id: 'search-reservations-header',
            order: 1,
            title: 'Recherche réservations',
          },
          switcher: {
            description: 'Le switch permet de passer ? un autre type de recherche.',
            id: 'search-reservations-switcher',
            order: 2,
            title: 'Types de recherche',
          },
        }}
      >
        <OnboardingWrapper
          description="Filtrez par activité et critères avancés pour trouver une réservation."
          id="search-reservations-content"
          order={3}
          spotlight={{
            borderRadius: 16,
            maxHeight: 280,
            overlayOpacity: 0.4,
            paddingX: 2,
            paddingY: 2,
          }}
          style={{
            flex: 1,
          }}
          title="Liste des réservations"
        >
          <ReservationListContent showFilters />
        </OnboardingWrapper>
      </SearchScreenShell>
    </TutorialFlowBoundary>
  );
}

export default SearchReservationsScreen;
