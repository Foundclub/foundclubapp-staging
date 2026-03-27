import useAuth from '@/domains/auth/useAuth';
import {
  canAccessRecruitmentProfiles,
  sanitizeRecruitmentTabForRole,
} from '@/domains/search/recruitmentFlow';
import { TutorialIds } from '@/domains/tutorial/tutorialIds';

import OnboardingWrapper from '@/components/molecules/onboardingWrapper/OnboardingWrapper';
import TutorialFlowBoundary from '@/components/molecules/tutorial/TutorialFlowBoundary';
import RecrutementListContent from '@/components/organisms/recrutementListContent/RecrutementListContent';

import SearchScreenShell from './components/SearchScreenShell';
/**
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 * @returns {import('react').ReactElement}
 */
function SearchRecruitmentScreen({ navigation, route }) {
  const { userData } = useAuth();
  const canSearchProfiles = canAccessRecruitmentProfiles(userData);
  const initialRecruitmentTab = sanitizeRecruitmentTabForRole(
    route?.params?.initialRecruitmentTab,
    userData,
  );

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
      tutorialId={TutorialIds.SEARCH_RECRUITMENT}
      userId={userData?.documentId}
    >
      <SearchScreenShell
        activeType="recruitment"
        navigation={navigation}
        tutorialSteps={{
          header: {
            description: canSearchProfiles
              ? 'Retrouve ici les profils a recruter et les annonces de tes equipes.'
              : 'Retrouve ici les annonces de recrutement et le suivi de tes candidatures.',
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
          description={canSearchProfiles
            ? 'Utilisez les onglets Profils et Mes annonces pour piloter votre recrutement.'
            : 'Utilisez les onglets Annonces et Mes candidatures pour suivre vos opportunites.'}
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
