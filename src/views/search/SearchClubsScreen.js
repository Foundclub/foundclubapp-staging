import { useTranslation } from 'react-i18next';

import useAuth from '@/domains/auth/useAuth';
import { TutorialIds } from '@/domains/tutorial/tutorialIds';

import OnboardingWrapper from '@/components/molecules/onboardingWrapper/OnboardingWrapper';
import TutorialFlowBoundary from '@/components/molecules/tutorial/TutorialFlowBoundary';
import ClubListContent from '@/components/organisms/clubListContent/ClubListContent';

import SearchScreenShell from './components/SearchScreenShell';

/**
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 * @returns {import('react').ReactElement}
 */
function SearchClubsScreen({ navigation, route }) {
  const { t } = useTranslation();
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
      tutorialId={TutorialIds.SEARCH_CLUBS}
      userId={userData?.documentId}
    >
      <SearchScreenShell
        activeType="clubs"
        navigation={navigation}
        tutorialSteps={{
          header: {
            description: t(
              'searchClubsScreen.tutorial.header.description',
              'Retrouve ici la recherche complète de clubs.',
            ),
            id: 'search-clubs-header',
            order: 1,
            title: t('searchClubsScreen.tutorial.header.title', 'Recherche club'),
          },
          switcher: {
            description: t(
              'searchClubsScreen.tutorial.switcher.description',
              'Bascule rapidement entre les differentes recherches.',
            ),
            id: 'search-clubs-switcher',
            order: 2,
            title: t('searchClubsScreen.tutorial.switcher.title', 'Types de recherche'),
          },
        }}
      >
        <OnboardingWrapper
          description={t(
            'searchClubsScreen.tutorial.content.description',
            'Utilise la barre de recherche, les filtres et ouvre une fiche club.',
          )}
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
          title={t('searchClubsScreen.tutorial.content.title', 'Liste des clubs')}
        >
          <ClubListContent enableMapMode />
        </OnboardingWrapper>
      </SearchScreenShell>
    </TutorialFlowBoundary>
  );
}

export default SearchClubsScreen;
