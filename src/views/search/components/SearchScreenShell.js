import {
  useCallback,
  useMemo,
  useRef,
  useState,
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
import { EnTeteDeRechercheContext } from '@/views/search/components/enTeteDeRecherche';

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
 *  types?: ReadonlyArray<SearchType>;
 *  annuaire?: boolean;
 * }} props
 *   `annuaire` (ANNUAIRE-E1, posé par l'annuaire du site seulement) : ni l'en-tête de l'app
 *   (« FoundClub League », cloche, avatar), ni le cadre d'écran à hauteur bornée — la page du site
 *   porte déjà sa barre, et la liste défile avec elle. Absent, le téléphone ne change pas.
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
  annuaire = false,
  children,
  navigation,
  onTutorialLayout,
  onTypeChange,
  tutorialSteps,
  types,
}) {
  const {
    Alignments,
    Spaces,
  } = useTheme();
  const { userData } = useAuth();
  const switcherTargetRef = useRef(/** @type {import('react-native').View | null} */ (null));
  // CORR-RECHERCHE point 2 — combien de listes posent l'en-tête dans ce qu'elles font défiler.
  const [porteurs, setPorteurs] = useState(0);
  const reclamer = useCallback(() => {
    setPorteurs((n) => n + 1);
    return () => setPorteurs((n) => n - 1);
  }, []);

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

  const enTete = useMemo(() => (
    <View style={Spaces.paddingBottom[4]}>
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
              types={types}
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
            types={types}
          />
        </View>
      )}
    </View>
  ), [Alignments, Spaces, activeType, emitTutorialLayout, handleTypeChange, tutorialSteps, types]);
  const contexteEnTete = useMemo(() => ({ enTete, reclamer }), [enTete, reclamer]);

  if (annuaire) {
    // ANNUAIRE-E1 — l'annuaire garde les onglets et le contenu de l'écran, rien d'autre.
    return (
      <View>
        <SearchTypeSwitcher
          activeType={activeType}
          onTypeChange={handleTypeChange}
          types={types}
        />
        <View style={[Spaces.marginTop[4]]}>
          {children}
        </View>
      </View>
    );
  }

  return (
    // RECHERCHE-UNIQUE (25/09) — `boundedHeight` : sur le SITE, sans lui la liste
    // prend la hauteur de TOUT son contenu et, n'ayant plus rien a faire defiler,
    // reclame page apres page (banc du 25/09 : 8 pages sur 8 demandees d'un coup).
    // Sans effet sur le telephone (ScreenContainer.js l'ignore).
    // CORR-RECHERCHE point 2 — la boîte bornée est désormais TOUTE la hauteur : l'en-tête défile
    // dedans (voir enTeteDeRecherche.js), et plus de marge morte de 24 px sous la liste.
    <ScreenContainer
      bgImage="bg2"
      boundedHeight
      contentContainerStyle={[Alignments.fill]}
    >
      <EnTeteDeRechercheContext.Provider value={contexteEnTete}>
        {porteurs === 0 ? enTete : null}
        <View style={Alignments.fill}>
          {children}
        </View>
      </EnTeteDeRechercheContext.Provider>
    </ScreenContainer>
  );
}

export default SearchScreenShell;
