import { useNavigation } from '@react-navigation/native';
import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import { RouteNames } from '@/navigation/routeNames';

import { useAppMode } from '@/context/AppModeContext';

/**
 * Toggle between the classic FoundClub home and the League home.
 * @returns {import('react').ReactElement}
 */
function LeagueHeaderSwitch() {
  const { Colors, Fonts, Images } = useTheme();
  const { isGold, toggleMode } = useAppMode();
  const navigation = useNavigation();
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
