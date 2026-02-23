import {
  useCallback,
  useRef,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Text,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import LeagueHeaderSwitch from '@/components/molecules/header/LeagueHeaderSwitch';
import NotificationBadge from '@/components/molecules/notificationBadge/NotificationBadge';
import OnboardingWrapper from '@/components/molecules/onboardingWrapper/OnboardingWrapper';
import ProfileButton from '@/components/molecules/profileButton/ProfileButton';
import SearchTypeSwitcher from '@/components/molecules/searchTypeSwitcher/SearchTypeSwitcher';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

/**
 * @typedef {'events' | 'clubs' | 'reservations' | 'recruitment'} SearchType
 */

/**
 * @param {{
 *  activeType: SearchType;
 *  children: import('react').ReactNode;
 *  navigation: import('@react-navigation/native').NavigationProp<any>;
 *  tutorialSteps?: {
 *    header?: { id: string; order: number; title: string; description: string };
 *    switcher?: { id: string; order: number; title: string; description: string };
 *  };
 *  onTutorialLayout?: (key: 'header' | 'switcher', layout: { x: number; y: number; width: number; height: number }) => void;
 * }} props
 * @returns {import('react').ReactElement}
 */
function SearchScreenShell({
  activeType,
  children,
  navigation,
  onTutorialLayout,
  tutorialSteps,
}) {
  const {
    Alignments,
    ApplicationStyle,
    Fonts,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const titleSideWidth = 44;
  const headerTargetRef = useRef(/** @type {import('react-native').View | null} */ (null));
  const switcherTargetRef = useRef(/** @type {import('react-native').View | null} */ (null));

  const emitTutorialLayout = useCallback((key, ref) => {
    if (!onTutorialLayout || !ref?.current) return;
    requestAnimationFrame(() => {
      ref.current?.measureInWindow((x, y, width, height) => {
        if (!width || !height) return;
        onTutorialLayout(key, {
          height: Math.round(height),
          width: Math.round(width),
          x: Math.round(x),
          y: Math.round(y),
        });
      });
    });
  }, [onTutorialLayout]);

  const handleBackPress = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate(RouteNames.Search);
  }, [navigation]);

  const handleTypeChange = useCallback(
    /**
     * @param {SearchType} type
     */
    (type) => {
      if (type === activeType) return;

      const navigateTo = (routeName, params = undefined) => {
        navigation.replace(routeName, params);
      };

      if (type === 'events') {
        navigateTo(RouteNames.SearchEvents);
        return;
      }

      if (type === 'clubs') {
        navigateTo(RouteNames.SearchClubs);
        return;
      }

      if (type === 'reservations') {
        navigateTo(RouteNames.SearchReservations);
        return;
      }

      navigateTo(RouteNames.SearchRecruitment, {
        initialRecruitmentTab: 'annonces',
      });
    },
    [activeType, navigation],
  );

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[Alignments.fill, Spaces.paddingBottom[24]]}
    >
      <View style={[
        Spaces.marginTop[16],
        Spaces.marginBottom[8],
        Alignments.row,
        Alignments.alignCenter,
        Alignments.justifySpaceBetween,
      ]}
      >
        <LeagueHeaderSwitch />
        <View
          style={[
            Alignments.row,
            Alignments.alignCenter,
            Spaces.gap[12],
          ]}
        >
          <NotificationBadge />
          <ProfileButton />
        </View>
      </View>

      {tutorialSteps?.header ? (
        <View
          style={[
            Alignments.row,
            Alignments.alignCenter,
            Spaces.marginBottom[12],
          ]}
        >
          <View style={{ alignItems: 'flex-start', width: titleSideWidth }}>
            <HeaderBackButton
              onPress={handleBackPress}
              withDefaultMargin={false}
            />
          </View>
          <OnboardingWrapper
            description={tutorialSteps.header.description}
            id={tutorialSteps.header.id}
            order={tutorialSteps.header.order}
            spotlight={{
              borderRadius: 14, overlayOpacity: 0.4, paddingX: 4, paddingY: 2,
            }}
            style={[Alignments.grow1, Alignments.alignCenter]}
            title={tutorialSteps.header.title}
          >
            <View
              onLayout={() => emitTutorialLayout('header', headerTargetRef)}
              ref={headerTargetRef}
              style={[Alignments.alignCenter, Spaces.gap[8]]}
            >
              <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
                {t('menu.search', 'Rechercher').toUpperCase()}
              </Text>
              <View
                style={[
                  ApplicationStyle.separator,
                  ApplicationStyle.backgroundColor.neutral00,
                  { width: 96 },
                ]}
              />
            </View>
          </OnboardingWrapper>
          <View style={{ width: titleSideWidth }} />
        </View>
      ) : (
        <View
          style={[
            Alignments.row,
            Alignments.alignCenter,
            Spaces.marginBottom[12],
          ]}
        >
          <View style={{ alignItems: 'flex-start', width: titleSideWidth }}>
            <HeaderBackButton
              onPress={handleBackPress}
              withDefaultMargin={false}
            />
          </View>
          <View
            onLayout={() => emitTutorialLayout('header', headerTargetRef)}
            ref={headerTargetRef}
            style={[Alignments.grow1, Alignments.alignCenter, Spaces.gap[8]]}
          >
            <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
              {t('menu.search', 'Rechercher').toUpperCase()}
            </Text>
            <View
              style={[
                ApplicationStyle.separator,
                ApplicationStyle.backgroundColor.neutral00,
                { width: 96 },
              ]}
            />
          </View>
          <View style={{ width: titleSideWidth }} />
        </View>
      )}

      {tutorialSteps?.switcher ? (
        <OnboardingWrapper
          description={tutorialSteps.switcher.description}
          id={tutorialSteps.switcher.id}
          order={tutorialSteps.switcher.order}
          spotlight={{
            borderRadius: 14, overlayOpacity: 0.4, paddingX: 2, paddingY: 2,
          }}
          title={tutorialSteps.switcher.title}
        >
          <View
            onLayout={() => emitTutorialLayout('switcher', switcherTargetRef)}
            ref={switcherTargetRef}
          >
            <SearchTypeSwitcher
              activeType={activeType}
              onTypeChange={handleTypeChange}
            />
          </View>
        </OnboardingWrapper>
      ) : (
        <View
          onLayout={() => emitTutorialLayout('switcher', switcherTargetRef)}
          ref={switcherTargetRef}
        >
          <SearchTypeSwitcher
            activeType={activeType}
            onTypeChange={handleTypeChange}
          />
        </View>
      )}

      <View style={[Alignments.fill]}>
        {children}
      </View>
    </ScreenContainer>
  );
}

export default SearchScreenShell;
