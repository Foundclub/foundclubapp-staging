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
import MercatoListContent from '@/components/organisms/mercatoListContent/MercatoListContent';
import OnboardingOverlay from '@/components/molecules/onboardingOverlay/OnboardingOverlay';
import ReservationListContent from '@/components/organisms/reservationListContent/ReservationListContent';
import ScreenContainer from '@/components/templates/ScreenContainer';

import useNotifications from '@/hooks/useNotifications';
import useAuth from '@/domains/auth/useAuth';
import { OnboardingProvider, useOnboarding } from '@/context/OnboardingContext';
import OnboardingWrapper from '@/components/molecules/onboardingWrapper/OnboardingWrapper';
import { useIsFocused } from '@react-navigation/native';

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
function HomeContent({ navigation }) {
  const [searchType, setSearchType] = useState(baseSearchOptions[0].value);
  const [isNotifVisible, setIsNotifVisible] = useState(false);
  const { notifications, markAsRead } = useNotificationController();

  const [{ auth }] = useAppContext();
  const {
    Alignments,
    ApplicationStyle,
    Fonts,
    Images,
    Spaces,
  } = useTheme();
  const { userData } = useAuth();
  const { t } = useTranslation();
  useNotifications({ navigate: navigation.navigate });
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
    const role = userData?.role?.name;

    if (role === USER_ROLES.president || role === USER_ROLES.coach || role === USER_ROLES.superAdmin) {
      options.push({
        label: 'Mercato',
        value: 'profiles',
      });
    }
    return options;
  }, [userData]);

  /**
   * Handle search type change
   * @param {string} value - The new search type value
   */
  const onChange = (value) => {
    setSearchType(value);
  };

  const renderContent = () => {
    switch (searchType) {
      case 'clubs':
        return <ClubListContent />;
      case 'events':
        return (
          <EventListContent
            additionalFilters={{ sessionStatus: 'open', excludeType: 'Réservation' }}
            showFilters
          />
        );
      case 'reservations':
        return <ReservationListContent showFilters />;
      case 'profiles':
        return <MercatoListContent />;
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
        <Image source={Images.logo} style={{ height: 30, resizeMode: 'contain', width: 222 }} />
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
