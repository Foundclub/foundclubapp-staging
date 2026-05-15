import { useNavigation } from '@react-navigation/native';
import {
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

const NAV_ITEMS = [
  { label: 'Dashboard', routeName: RouteNames.SuperAdminHome },
  { label: 'Cotisations', routeName: RouteNames.SuperAdminLicenses },
  { label: 'Paramètres', routeName: RouteNames.SuperAdminSettings },
  { label: 'Squads', routeName: RouteNames.SuperAdminLeagueSquads },
  { label: 'Matchs', routeName: RouteNames.SuperAdminLeagueMatches },
  { label: 'Litiges', routeName: RouteNames.SuperAdminLeagueDisputes },
  { label: 'Divisions', routeName: RouteNames.SuperAdminLeagueDivisions },
];

/**
 *
 * @param root0
 * @param root0.activeRouteNames
 * @param root0.children
 * @param root0.description
 * @param root0.rightAction
 * @param root0.title
 */
function SuperAdminLeagueLayout({
  activeRouteNames = [],
  children,
  description,
  rightAction,
  title,
}) {
  const navigation = useNavigation();
  const parentNavigation = navigation.getParent?.();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const {
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const isCompactScreen = width <= 390;
  const scrollBottomPadding = Math.max(insets.bottom + 24, 32);

  const handleGoBack = () => {
    if (navigation.canGoBack?.()) {
      navigation.goBack();
      return;
    }

    parentNavigation?.navigate?.(RouteNames.ProfileStack, {
      screen: RouteNames.Profile,
    });
  };

  return (
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="none"
      contentContainerStyle={[Spaces.paddingTop[16]]}
      responsivePadding
    >
      <ScrollView
        contentContainerStyle={[
          Spaces.gap[20],
          { paddingBottom: scrollBottomPadding },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[Spaces.gap[12]]}>
          <HeaderBackButton
            accessibilityLabel="Retour"
            onPress={handleGoBack}
            style={styles.backButton}
            withDefaultMargin={false}
          />
          <Text style={[Fonts.label, styles.eyebrow, { color: Colors.primary500 }]}>
            SUPER ADMIN LEAGUE
          </Text>
          <Text style={[Fonts.h2, Fonts.neutral00, styles.title]}>{title}</Text>
          {description ? (
            <Text style={[Fonts.p2, Fonts.neutral300, styles.description]}>
              {description}
            </Text>
          ) : null}
          {rightAction ? (
            <Button
              onPress={rightAction.onPress}
              size="sm"
              style={[
                styles.headerAction,
                isCompactScreen ? styles.headerActionCompact : null,
              ]}
              title={rightAction.label}
              variant={rightAction.variant || 'Secondary'}
            />
          ) : null}
        </View>

        <ScrollView
          contentContainerStyle={styles.navContent}
          horizontal
          showsHorizontalScrollIndicator
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeRouteNames.includes(item.routeName);
            return (
              <Button
                key={item.routeName}
                onPress={() => {
                  if (isActive) return;
                  navigation.navigate(item.routeName);
                }}
                size="sm"
                title={item.label}
                variant={isActive ? 'Primary' : 'Secondary'}
              />
            );
          })}
        </ScrollView>

        {children}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignSelf: 'flex-start',
  },
  description: {
    lineHeight: 22,
    maxWidth: 560,
  },
  eyebrow: {
    letterSpacing: 1.2,
  },
  headerAction: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  headerActionCompact: {
    width: '100%',
  },
  navContent: {
    gap: 10,
    paddingRight: 24,
  },
  title: {
    maxWidth: 560,
  },
});

export default SuperAdminLeagueLayout;
