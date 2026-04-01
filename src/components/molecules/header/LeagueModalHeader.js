import {
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

/**
 * @param {{
 *  align?: 'center' | 'left';
 *  description?: string | null;
 *  title?: string | null;
 * }} props
 */
function LeagueModalHeader({
  align = 'center',
  description = null,
  title = null,
}) {
  const {
    Colors, Fonts, Images,
  } = useTheme();
  const isCentered = align !== 'left';

  return (
    <View style={styles.container}>
      <View style={[styles.brandBlock, isCentered ? styles.brandCentered : styles.brandLeft]}>
        <View style={styles.brandRow}>
          <Image source={Images.logo} style={styles.logo} />
          <Text style={[Fonts.h1Bold, styles.leagueTitle, { color: Colors.gold500 }]}>
            LEAGUE
          </Text>
        </View>
        <View style={styles.dotRow}>
          <View
            style={[
              styles.modeDot,
              { backgroundColor: Colors.primary500, borderColor: Colors.primary500 },
            ]}
          />
          <View style={styles.dotSpacer} />
          <View
            style={[
              styles.modeDot,
              { backgroundColor: 'transparent', borderColor: Colors.gold500 },
            ]}
          />
        </View>
      </View>

      {title ? (
        <Text
          style={[
            Fonts.h3Bold,
            styles.title,
            isCentered ? styles.centeredText : styles.leftText,
            { color: Colors.neutral00 },
          ]}
        >
          {title}
        </Text>
      ) : null}

      {description ? (
        <Text
          style={[
            Fonts.p2,
            styles.description,
            isCentered ? styles.centeredText : styles.leftText,
            { color: Colors.neutral200 },
          ]}
        >
          {description}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  brandBlock: {
    gap: 8,
  },
  brandCentered: {
    alignItems: 'center',
  },
  brandLeft: {
    alignItems: 'flex-start',
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  centeredText: {
    textAlign: 'center',
  },
  container: {
    gap: 10,
  },
  description: {
    lineHeight: 24,
  },
  dotRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  dotSpacer: {
    width: 40,
  },
  leagueTitle: {
    fontSize: 16,
    letterSpacing: 1.6,
    marginLeft: 10,
    opacity: 0.95,
  },
  leftText: {
    textAlign: 'left',
  },
  logo: {
    height: 24,
    resizeMode: 'contain',
    width: 136,
  },
  modeDot: {
    borderRadius: 6,
    borderWidth: 1.5,
    height: 12,
    width: 12,
  },
  title: {
    marginTop: 2,
  },
});

export default LeagueModalHeader;
