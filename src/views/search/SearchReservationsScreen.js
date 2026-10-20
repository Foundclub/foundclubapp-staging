import { useTranslation } from 'react-i18next';

import useAuth from '@/domains/auth/useAuth';
import { TutorialIds } from '@/domains/tutorial/tutorialIds';

import OnboardingWrapper from '@/components/molecules/onboardingWrapper/OnboardingWrapper';
import TutorialFlowBoundary from '@/components/molecules/tutorial/TutorialFlowBoundary';
import ReservationListContent from '@/components/organisms/reservationListContent/ReservationListContent';
import RechercheDeTerrains from '@/views/reserverTerrain/RechercheDeTerrains';
// RESA-CARTE : la coquille par `@/views/…`, comme SearchHubScreen, pour que les deux règles
// d'ordre des imports s'accordent avec l'interrupteur importé en dernier.
import SearchScreenShell from '@/views/search/components/SearchScreenShell';

import { COMPLEXES_JOUEUR } from '@/config/fonctionsMasquees';

/**
 * L'onglet « Réservations » de la recherche, À L'ADRESSE DU SITE /search/reservations (le site
 * passe par SearchScreenShell, pas par le panneau de SearchHubScreen).
 * RESA-CARTE (20/10/2026) — interrupteur `COMPLEXES_JOUEUR` allumé, l'onglet monte la recherche de
 * terrains (E-P01, « le site fait pareil », RC-T03), comme le panneau du téléphone ; éteint
 * (staging), l'ancienne liste, inchangée. Importée en tête : le site n'a pas `require`.
 * Témoin : `__tests__/SearchReservationsScreen.complexes.test.js`.
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 * @returns {import('react').ReactElement}
 */
function SearchReservationsScreen({ navigation, route }) {
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
      tutorialId={TutorialIds.SEARCH_RESERVATIONS}
      userId={userData?.documentId}
    >
      <SearchScreenShell
        activeType="reservations"
        navigation={navigation}
        tutorialSteps={{
          header: {
            description: t(
              'searchReservationsScreen.tutorial.header.description',
              'Accèdes ici aux réservations de terrains et installations.',
            ),
            id: 'search-reservations-header',
            order: 1,
            title: t('searchReservationsScreen.tutorial.header.title', 'Recherche réservations'),
          },
          switcher: {
            description: t(
              'searchReservationsScreen.tutorial.switcher.description',
              'Le switch permet de passer ? un autre type de recherche.',
            ),
            id: 'search-reservations-switcher',
            order: 2,
            title: t('searchReservationsScreen.tutorial.switcher.title', 'Types de recherche'),
          },
        }}
      >
        {COMPLEXES_JOUEUR ? <RechercheDeTerrains /> : (
          <OnboardingWrapper
            description={t(
              'searchReservationsScreen.tutorial.content.description',
              'Filtre par activité et critères avancés pour trouver une réservation.',
            )}
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
            title={t('searchReservationsScreen.tutorial.content.title', 'Liste des réservations')}
          >
            <ReservationListContent enableMapMode showFilters />
          </OnboardingWrapper>
        )}
      </SearchScreenShell>
    </TutorialFlowBoundary>
  );
}

export default SearchReservationsScreen;
