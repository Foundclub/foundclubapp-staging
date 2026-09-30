import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import { RouteNames } from '@/navigation/routeNames';

import { LEAGUE_SUR_ACCUEIL } from '@/config/fonctionsMasquees';
import { useAppMode } from '@/context/AppModeContext';

/**
 * Le logo en haut à gauche de l'accueil, de la recherche et des onglets.
 *
 * 🏠 A01 + A02 (audit V1, décision d'Adel du 30/09, option A) : « le logo ramène à
 * l'accueil — le même logo, la même police ». Tant que la League est masquée
 * (`LEAGUE_SUR_ACCUEIL`, `config/fonctionsMasquees.js`), ce n'est PLUS un
 * interrupteur FoundClub / League : c'est le logo seul, au format de l'accueil
 * FoundClub, et un appui ramène en haut de l'accueil. L'interrupteur d'avant est
 * gardé tel quel plus bas : rallumer la League le rend.
 * @param {{ onPress?: () => void }} [props] - `onPress` : le geste de l'écran qui
 *   EST l'accueil (remonter en haut). Absent, le logo ramène à l'accueil.
 * @returns {import('react').ReactElement}
 */
function LeagueHeaderSwitch({ onPress } = {}) {
  const { Colors, Fonts, Images } = useTheme();
  const { isGold, setMode, toggleMode } = useAppMode();
  // Les routes de l'app ne sont pas déclarées au typage de React Navigation :
  // sans cette annotation, chaque `navigate` est une erreur de type (`never`).
  const navigation = /** @type {any} */ (useNavigation());
  const { t } = useTranslation();
  const logoWidth = isGold ? 100 : 140;
  const logoHeight = isGold ? 18 : 26;
  const leagueSectionWidth = isGold ? 118 : 92;
  const leagueTextColor = Colors.gold500;
  const leagueTextOpacity = isGold ? 1 : 0.72;
  const leagueIndicatorColor = Colors.gold500;

  const handleSwitch = React.useCallback(() => {
    const targetRoute = isGold ? RouteNames.HomeTab : RouteNames.LeagueHomeTab;
    toggleMode();

    const currentRouteNames = navigation?.getState?.()?.routeNames || [];
    if (currentRouteNames.includes(targetRoute)) {
      navigation.navigate(targetRoute);
      return;
    }

    const parentNavigation = navigation?.getParent?.();
    const parentRouteNames = parentNavigation?.getState?.()?.routeNames || [];
    if (parentNavigation && parentRouteNames.includes(targetRoute)) {
      parentNavigation.navigate(targetRoute);
      return;
    }

    navigation.navigate(targetRoute);
  }, [isGold, navigation, toggleMode]);

  // A01 — RETOUR À L'ACCUEIL, et à sa RACINE.
  // 🪤 `navigate('HomeTab')` tout court EMPILE une seconde copie de l'onglet sous
  // React Navigation 7 dès qu'on n'y est pas (StackRouter, `NAVIGATE` : il ne
  // revient en arrière qu'avec `pop`) — le défaut A22 de l'audit. D'où `pop`
  // aux deux étages : la pile racine revient sur l'accueil existant, et la pile
  // de l'onglet redescend sur `SearchHome` au lieu d'en pousser un second.
  // Sur le site, l'adresse « / » est l'accueil : il n'y a pas de pile à dépiler.
  const handleOpenHome = React.useCallback(() => {
    if (onPress) {
      onPress();
      return;
    }
    // Un mode League mémorisé (écran de League ouvert par une notification) :
    // en sortir pour de bon, sans le basculer une seconde fois.
    if (isGold) setMode('classic');
    if (Platform.OS === 'web') {
      navigation.navigate(RouteNames.HomeTab);
      return;
    }
    navigation.navigate(
      RouteNames.HomeTab,
      { params: { pop: true, screen: RouteNames.SearchHome }, screen: RouteNames.Search },
      { pop: true },
    );
  }, [isGold, navigation, onPress, setMode]);

  if (!LEAGUE_SUR_ACCUEIL) {
    return (
      <TouchableOpacity
        accessibilityLabel={t('menu.home', 'Accueil')}
        accessibilityRole="button"
        activeOpacity={0.8}
        onPress={handleOpenHome}
        style={styles.container}
      >
        {/* Le logo de l'accueil FoundClub, à son format (140 × 26), sans voile. */}
        <Image resizeMode="contain" source={Images.logo} style={styles.logoSeul} />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={handleSwitch}
      style={styles.container}
    >
      <View style={styles.logoContainer}>
        <View style={[styles.brandSection, { width: logoWidth }]}>
          <Image
            resizeMode="contain"
            source={Images.logo}
            style={[
              styles.logo,
              { height: logoHeight, opacity: isGold ? 0.6 : 1, width: logoWidth },
            ]}
          />
        </View>
        <View style={styles.sectionSpacer} />
        <View style={[styles.leagueSection, { width: leagueSectionWidth }]}>
          <Text style={[
            Fonts.h1Bold,
            styles.leagueTitle,
            isGold
              ? {
                color: leagueTextColor, fontSize: 24, letterSpacing: 2, opacity: leagueTextOpacity,
              }
              : {
                color: leagueTextColor, fontSize: 14, letterSpacing: 1, opacity: leagueTextOpacity,
              },
          ]}
          >
            LEAGUE
          </Text>
        </View>
      </View>
      <View style={styles.modeIndicator}>
        <View style={[styles.brandSection, { width: logoWidth }]}>
          <View
            style={[
              styles.modeDot,
              {
                backgroundColor: isGold ? 'transparent' : Colors.primary500,
                borderColor: Colors.primary500,
              },
            ]}
          />
        </View>
        <View style={styles.sectionSpacer} />
        <View style={[styles.leagueSection, { width: leagueSectionWidth }]}>
          <View
            style={[
              styles.modeDot,
              {
                backgroundColor: isGold ? leagueIndicatorColor : 'transparent',
                borderColor: leagueIndicatorColor,
              },
            ]}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  brandSection: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    paddingVertical: 8,
  },
  leagueSection: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  leagueTitle: {
    textAlign: 'center',
    transform: [{ translateY: 1 }],
  },
  logo: {
  },
  logoContainer: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  logoSeul: {
    height: 26,
    width: 140,
  },
  modeDot: {
    borderRadius: 6,
    borderWidth: 1.5,
    height: 12,
    width: 12,
  },
  modeIndicator: {
    flexDirection: 'row',
    marginTop: 6,
    width: 'auto',
  },
  sectionSpacer: {
    width: 6,
  },
});

export default LeagueHeaderSwitch;
