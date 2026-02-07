import { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  View,
} from 'react-native';

import i18n from '@/theme/strings';
import useTheme from '@/theme/themeContext';

import { useAppContext } from '@/store/appContext';
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

import useNotifications from '@/hooks/useNotifications';
import useAuth from '@/domains/auth/useAuth';
import { OnboardingProvider, useOnboarding } from '@/context/OnboardingContext';
import OnboardingWrapper from '@/components/molecules/onboardingWrapper/OnboardingWrapper';
import { useIsFocused } from '@react-navigation/native';
import ModeSwitch from '@/components/atoms/ModeSwitch/ModeSwitch';
import LeagueHeaderSwitch from '@/components/molecules/header/LeagueHeaderSwitch';

// Notification imports (Fix for Popup issue)
import { useNotificationController } from '@/hooks/useNotificationController';
import NotificationPopup from '@/components/organisms/notificationPopup/NotificationPopup';

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
  const [isNotifVisible, setIsNotifVisible] = useState(false);
  const { notifications, markAsRead } = useNotificationController();

  useEffect(() => {
    if (route.params?.initialSearchType) {
      setSearchType(route.params.initialSearchType);
      // Reset params to avoid stuck state if needed, or just let it be superseded by user action
    }
  }, [route.params?.initialSearchType]);

  const [{ auth }] = useAppContext();
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

  // Handle Pending Notification (Cold Start)
  const [{ pendingNotification }, dispatch] = useAppContext();
  const { handleNavigateOnOpen } = useNotifications({ navigate: navigation.navigate }); // Destructure new handler

  useEffect(() => {
    if (pendingNotification && isFocused) {
      console.log('[Home] Processing pending notification:', pendingNotification);
      
      // Navigate
      handleNavigateOnOpen(pendingNotification);
      
      // Clear pending notification to avoid loops
      dispatch({ type: 'SET_PENDING_NOTIFICATION', payload: null });
    }
  }, [pendingNotification, isFocused, handleNavigateOnOpen, dispatch]);

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
          <NotificationBadge onPress={() => setIsNotifVisible(true)} />
          <ProfileButton />
        </View>
      </View>

      {/* SegmentedControl - Figma exact design */}
      <View style={[Alignments.alignCenter, Spaces.marginBottom[24]]}>
        <OnboardingWrapper
          description="Choisissez ici ce que vous cherchez : Événements, Clubs ou Profils."
          id="search-tabs"
          order={1}
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

      {/* Notification Popup at Root Level ensuring it appears above everything */}
      <NotificationPopup
        isVisible={isNotifVisible}
        onClose={() => setIsNotifVisible(false)}
        notifications={notifications}
        onMarkAsRead={markAsRead}
      />
    </ScreenContainer>
  );
}

function Home(props) {
  return (
    <OnboardingProvider>
      <HomeContent {...props} />
    </OnboardingProvider>
  );
}

export default Home;
