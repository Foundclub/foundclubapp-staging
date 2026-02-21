import OnboardingWrapper from '@/components/molecules/onboardingWrapper/OnboardingWrapper';
import TutorialFlowBoundary from '@/components/molecules/tutorial/TutorialFlowBoundary';
import ReservationListContent from '@/components/organisms/reservationListContent/ReservationListContent';
import useAuth from '@/domains/auth/useAuth';
import { TutorialIds } from '@/domains/tutorial/tutorialIds';

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
          tutorialStartToken: undefined,
          tutorialSource: undefined,
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
            description: 'Accedez ici aux reservations de terrains et installations.',
            id: 'search-reservations-header',
            order: 1,
            title: 'Recherche reservations',
          },
          switcher: {
            description: 'Le switch permet de passer a un autre type de recherche.',
            id: 'search-reservations-switcher',
            order: 2,
            title: 'Types de recherche',
          },
        }}
      >
        <OnboardingWrapper
          description="Filtrez par date, activite et criteres avances pour trouver une reservation."
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
          title="Liste des reservations"
        >
          <ReservationListContent showFilters />
        </OnboardingWrapper>
      </SearchScreenShell>
    </TutorialFlowBoundary>
  );
}

export default SearchReservationsScreen;
