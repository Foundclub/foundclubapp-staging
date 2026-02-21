import OnboardingWrapper from '@/components/molecules/onboardingWrapper/OnboardingWrapper';
import TutorialFlowBoundary from '@/components/molecules/tutorial/TutorialFlowBoundary';
import RecrutementListContent from '@/components/organisms/recrutementListContent/RecrutementListContent';
import useAuth from '@/domains/auth/useAuth';
import { TutorialIds } from '@/domains/tutorial/tutorialIds';

import SearchScreenShell from './components/SearchScreenShell';
import { normalizeRecruitmentTab } from './searchRouteHelpers';

/**
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 * @returns {import('react').ReactElement}
 */
function SearchRecruitmentScreen({ navigation, route }) {
  const { userData } = useAuth();
  const initialRecruitmentTab = normalizeRecruitmentTab(
    route?.params?.initialRecruitmentTab,
    'annonces',
  );

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
      tutorialId={TutorialIds.SEARCH_RECRUITMENT}
      userId={userData?.documentId}
    >
      <SearchScreenShell
        activeType="recruitment"
        navigation={navigation}
        tutorialSteps={{
          header: {
            description: 'Decouvrez ici les annonces et profils de recrutement.',
            id: 'search-recruitment-header',
            order: 1,
            title: 'Recherche recrutement',
          },
          switcher: {
            description: 'Changez de type de recherche en un geste.',
            id: 'search-recruitment-switcher',
            order: 2,
            title: 'Types de recherche',
          },
        }}
      >
        <OnboardingWrapper
          description="Utilisez les onglets Profils, Annonces et Candidatures pour naviguer dans le recrutement."
          id="search-recruitment-content"
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
          title="Contenu recrutement"
        >
          <RecrutementListContent
            initialTab={initialRecruitmentTab}
            timestamp={route?.params?.timestamp}
          />
        </OnboardingWrapper>
      </SearchScreenShell>
    </TutorialFlowBoundary>
  );
}

export default SearchRecruitmentScreen;
