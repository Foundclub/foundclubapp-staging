import { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  View,
} from 'react-native';

import i18n from '@/theme/strings';
import useTheme from '@/theme/themeContext';

import { USER_ROLES } from '@/domains/auth/authUseCases';
import ProfileButton from '@/components/molecules/profileButton/ProfileButton';
import NotificationBadge from '@/components/molecules/notificationBadge/NotificationBadge';
import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';
import ClubListContent from '@/components/organisms/clubListContent/ClubListContent';
import EventListContent from '@/components/organisms/eventListContent/EventListContent';
import RecrutementListContent from '@/components/organisms/recrutementListContent/RecrutementListContent';
import OnboardingOverlay from '@/components/molecules/onboardingOverlay/OnboardingOverlay';
import ReservationListContent from '@/components/organisms/reservationListContent/ReservationListContent';
import ScreenContainer from '@/components/templates/ScreenContainer';

import useAuth from '@/domains/auth/useAuth';
import { OnboardingProvider, useOnboarding } from '@/context/OnboardingContext';
import OnboardingWrapper from '@/components/molecules/onboardingWrapper/OnboardingWrapper';
import { useIsFocused } from '@react-navigation/native';
import ModeSwitch from '@/components/atoms/ModeSwitch/ModeSwitch';
import LeagueHeaderSwitch from '@/components/molecules/header/LeagueHeaderSwitch';

const baseSearchOptions = [
  {
    label: 'Évènements',
    value: 'events',
  },
  {
    label: 'Clubs',
    value: 'clubs',
  },
  {
    label: 'Réservations',
    value: 'reservations',
  },
];

/**
 * Main home screen to search for clubs, team or events
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} Home screen component
 */
function HomeContent({ navigation, route }) {
  const [searchType, setSearchType] = useState(baseSearchOptions[0].value);

  useEffect(() => {
    if (route.params?.initialSearchType) {
      setSearchType(route.params.initialSearchType);
      // Reset params to avoid stuck state if needed, or just let it be superseded by user action
    }
  }, [route.params?.initialSearchType]);

  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Images,
    Spaces,
  } = useTheme();
  const { userData } = useAuth();
  const { t } = useTranslation();
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
    const options = [...baseSearchOptions];
    // Recrutement tab is available for all users
    options.push({
      label: 'Recrutement',
      value: 'recrutement',
    });
    return options;
  }, []);

  /**
   * Handle search type change
   * @param {string} value - The new search type value
   */
  const onChange = (value) => {
    setSearchType(value);
  };

  const eventFiltersProps = useMemo(() => ({ sessionStatus: 'open', excludeType: 'Réservation' }), []);

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
      case 'reservations':
        return <ReservationListContent showFilters />;
      case 'recrutement':
        return (
          <RecrutementListContent 
            initialTab={route.params?.initialRecruitmentTab} 
            timestamp={route.params?.timestamp}
          />
        );
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
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <NotificationBadge />
          <ProfileButton />
        </View>
      </View>

      {/* SegmentedControl - Figma exact design */}
      <View style={[Alignments.alignCenter, Alignments.fullWidth, Spaces.marginBottom[24]]}>
        <OnboardingWrapper
          description="Choisissez ici ce que vous cherchez : Événements, Clubs ou Profils."
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

function Home(props) {
  return (
    <OnboardingProvider flowId="home-search-onboarding-v1">
      <HomeContent {...props} />
    </OnboardingProvider>
  );
}

export default Home;
