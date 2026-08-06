import {
  useCallback,
  useRef,
} from 'react';
import { View } from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import { getDefaultRecruitmentTab } from '@/domains/search/recruitmentFlow';
import useTheme from '@/theme/themeContext';

import LeagueHeaderSwitch from '@/components/molecules/header/LeagueHeaderSwitch';
import NotificationBadge from '@/components/molecules/notificationBadge/NotificationBadge';
import OnboardingWrapper from '@/components/molecules/onboardingWrapper/OnboardingWrapper';
import ProfileButton from '@/components/molecules/profileButton/ProfileButton';
import SearchTypeSwitcher from '@/components/molecules/searchTypeSwitcher/SearchTypeSwitcher';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

/**
 * @typedef {'events' | 'clubs' | 'reservations' | 'recruitment' | 'amicaux'} SearchType
 */

/**
 * @param {{
 *  activeType: SearchType;
 *  children: import('react').ReactNode;
 *  navigation: import('@react-navigation/native').NavigationProp<any>;
 *  onTypeChange?: (type: SearchType) => void;
 *  tutorialSteps?: {
 *    header?: { id: string; order: number; title: string; description: string };
 *    switcher?: { id: string; order: number; title: string; description: string };
 *  };
 *  onTutorialLayout?: (key: 'header' | 'switcher', layout: { x: number; y: number; width: number; height: number }) => void;
 * }} props
 * @returns {import('react').ReactElement}
 *
 * ⚠️ `tutorialSteps.header` reste dans le type mais n'est PLUS rendu depuis le
 * lot D07 : l'en-tete qu'il eclairait (fleche + titre « RECHERCHER ») a disparu.
 * Le champ survit parce que trois appelants le passent encore — et qu'aucun des
 * trois n'est monte (routeNames.js:16-19). Le supprimer est un lot de menage,
 * pas un lot de design.
 */
function SearchScreenShell({
  activeType,
  children,
  navigation,
  onTutorialLayout,
  onTypeChange,
  tutorialSteps,
}) {
  const {
    Alignments,
    Spaces,
  } = useTheme();
  const { userData } = useAuth();
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

  const handleTypeChange = useCallback(
    /**
     * @param {SearchType} type
     */
    (type) => {
      if (type === activeType) return;
      if (onTypeChange) {
        onTypeChange(type);
        return;
      }

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

      // Les matchs amicaux n'ont pas d'ecran alias dedie : ils vivent dans le hub
      // canonique. Enregistrer un ecran de plus exigerait son motif web
      // (webRoutes.parity.test.js), et le routage web est le lot L7.
      if (type === 'amicaux') {
        navigateTo(RouteNames.SearchHub, { activeType: 'amicaux' });
        return;
      }

      navigateTo(RouteNames.SearchRecruitment, {
        initialRecruitmentTab: getDefaultRecruitmentTab(userData),
      });
    },
    [activeType, navigation, onTypeChange, userData],
  );

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[Alignments.fill, Spaces.paddingBottom[24]]}
    >
      <View style={[
        Spaces.marginTop[16],
        Spaces.marginBottom[16],
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

      <View style={[Alignments.fill, Spaces.marginTop[4]]}>
        {children}
      </View>
    </ScreenContainer>
  );
}

export default SearchScreenShell;
