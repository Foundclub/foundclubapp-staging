import OnboardingWrapper from '@/components/molecules/onboardingWrapper/OnboardingWrapper';
import TutorialFlowBoundary from '@/components/molecules/tutorial/TutorialFlowBoundary';
import ClubListContent from '@/components/organisms/clubListContent/ClubListContent';
import useAuth from '@/domains/auth/useAuth';
import { TutorialIds } from '@/domains/tutorial/tutorialIds';

import SearchScreenShell from './components/SearchScreenShell';

/**
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 * @returns {import('react').ReactElement}
 */
function SearchClubsScreen({ navigation, route }) {
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
      tutorialId={TutorialIds.SEARCH_CLUBS}
      userId={userData?.documentId}
    >
      <SearchScreenShell
        activeType="clubs"
        navigation={navigation}
        tutorialSteps={{
          header: {
            description: 'Retrouvez ici la recherche complete de clubs.',
            id: 'search-clubs-header',
            order: 1,
            title: 'Recherche club',
          },
          switcher: {
            description: 'Basculez rapidement entre les differentes recherches.',
            id: 'search-clubs-switcher',
            order: 2,
            title: 'Types de recherche',
          },
        }}
      >
        <OnboardingWrapper
          description="Utilisez la barre de recherche, les filtres et ouvrez une fiche club."
          id="search-clubs-content"
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
          title="Liste des clubs"
        >
          <ClubListContent />
        </OnboardingWrapper>
      </SearchScreenShell>
    </TutorialFlowBoundary>
  );
}

export default SearchClubsScreen;
