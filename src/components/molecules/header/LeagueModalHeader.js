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
          <Image resizeMode="contain" source={Images.logo} style={styles.logo} />
          <Text style={[Fonts.h1Bold, styles.leagueTitle, { color: Colors.gold500 }]}>
            LEAGUE
          </Text>
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
    gap: 4,
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
    gap: 8,
  },
  description: {
    lineHeight: 22,
  },
  leagueTitle: {
    fontSize: 15,
    letterSpacing: 1.2,
    marginLeft: 8,
    opacity: 0.95,
  },
  leftText: {
    textAlign: 'left',
  },
  logo: {
    height: 20,
    width: 122,
  },
  title: {
    marginTop: 0,
  },
});

export default LeagueModalHeader;
