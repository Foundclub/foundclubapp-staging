import { useIsFocused } from '@react-navigation/native';
import { useEffect, useMemo, useState } from 'react';
import {
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import LeagueHeaderSwitch from '@/components/molecules/header/LeagueHeaderSwitch';
import NotificationBadge from '@/components/molecules/notificationBadge/NotificationBadge';
import OnboardingOverlay from '@/components/molecules/onboardingOverlay/OnboardingOverlay';
import OnboardingWrapper from '@/components/molecules/onboardingWrapper/OnboardingWrapper';
import ProfileButton from '@/components/molecules/profileButton/ProfileButton';
import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';
import ClubListContent from '@/components/organisms/clubListContent/ClubListContent';
import EventListContent from '@/components/organisms/eventListContent/EventListContent';
import RecrutementListContent from '@/components/organisms/recrutementListContent/RecrutementListContent';
import ReservationListContent from '@/components/organisms/reservationListContent/ReservationListContent';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { OnboardingProvider, useOnboarding } from '@/context/OnboardingContext';

const publicSearchOptions = [
  {
    label: 'Événements',
    value: 'events',
  },
  {
    label: 'Clubs',
    value: 'clubs',
  },
  {
    label: 'Recrutement',
    value: 'recrutement',
  },
];

const authenticatedSearchOptions = [
  publicSearchOptions[0],
  publicSearchOptions[1],
  {
    label: 'Réservations',
    value: 'reservations',
  },
  publicSearchOptions[2],
];

/**
 * Main home screen to search for clubs, team or events
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} Home screen component
 */
function Home({ route }) {
  return (
    <OnboardingProvider flowId="home-search-onboarding-v1">
      <HomeContent route={route} />
    </OnboardingProvider>
  );
}

/**
 *
 * @param root0
 * @param root0.navigation
 * @param root0.route
 */
function HomeContent({ route }) {
  const [searchType, setSearchType] = useState(publicSearchOptions[0].value);

  useEffect(() => {
    if (route.params?.initialSearchType) {
      setSearchType(route.params.initialSearchType);
      // Reset params to avoid stuck state if needed, or just let it be superseded by user action
    }
  }, [route.params?.initialSearchType]);

  const {
    Alignments,
    Spaces,
  } = useTheme();
  const { userData } = useAuth();
  const isAuthenticated = Boolean(userData?.documentId);
  // removed duplicate useNotifications call
  const isFocused = useIsFocused();
  const { startOnboarding } = useOnboarding();

  useEffect(() => {
    let timer;
    if (isFocused) {
      timer = setTimeout(() => {
        // startOnboarding(); // Disabled for debugging
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [startOnboarding, isFocused]);

  const searchOptions = useMemo(() => {
    if (isAuthenticated) return authenticatedSearchOptions;
    return publicSearchOptions;
  }, [isAuthenticated]);

  useEffect(() => {
    if (!searchOptions.some((option) => option.value === searchType)) {
      setSearchType(searchOptions[0].value);
    }
  }, [searchOptions, searchType]);

  /**
   * Handle search type change
   * @param {string} value - The new search type value
   */
  const onChange = (value) => {
    setSearchType(value);
  };

  const eventFiltersProps = useMemo(() => ({ excludeType: 'Réservation', sessionStatus: 'open' }), []);

  const renderContent = () => {
    switch (searchType) {
      case 'clubs':
        return <ClubListContent />;
      case 'events':
        return (
          <EventListContent
            additionalFilters={eventFiltersProps}
            showFilters
          />
        );
      case 'recrutement':
        return (
          <RecrutementListContent
            initialTab={route.params?.initialRecruitmentTab}
            timestamp={route.params?.timestamp}
          />
        );
      case 'reservations':
        return <ReservationListContent showFilters />;
      default:
        return null;
    }
  };

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Alignments.column,
        Alignments.fill,
      ]}
    >
      <View style={[
        Spaces.marginTop[16],
        Spaces.marginBottom[24],
        Alignments.row,
        Alignments.alignCenter,
        Alignments.justifySpaceBetween]}
      >
        <LeagueHeaderSwitch />
        <View style={{ alignItems: 'center', flexDirection: 'row' }}>
          <NotificationBadge />
          <ProfileButton />
        </View>
      </View>

      {/* SegmentedControl - Figma exact design */}
      <View style={[Alignments.alignCenter, Alignments.fullWidth, Spaces.marginBottom[24]]}>
        <OnboardingWrapper
          description="Choisis ici ce que tu cherches : Événements, Clubs ou Recrutement."
          id="search-tabs"
          order={1}
          style={Alignments.fullWidth}
          title="Navigation"
        >
          <SegmentedControl
            onChange={onChange}
            options={searchOptions}
            value={searchType}
          />
        </OnboardingWrapper>
      </View>
      {renderContent()}
      <OnboardingOverlay />
    </ScreenContainer>
  );
}

export default Home;
