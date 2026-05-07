import PropTypes from 'prop-types';
import {
  Image, StyleSheet, Text, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

/**
 *
 * @param root0
 * @param root0.team
 * @param root0.variant
 */
function FutCard({ team, variant = 'classic' }) {
  const { Colors, Fonts } = useTheme();

  // Determine colors based on variant
  const isGold = variant === 'gold';
  const BorderColor = isGold ? Colors.gold500 : Colors.primary500;
  const GoldColor = Colors.gold500;
  const GoldDarkColor = Colors.gold700;
  const CardBg = Colors.neutral900; // Keep dark background for contrast
  const ShadowColor = isGold ? Colors.gold500 : Colors.primary500;

  return (
    <View style={[styles.cardContainer, { backgroundColor: CardBg, borderColor: BorderColor, shadowColor: ShadowColor }]}>

      <View style={styles.topRow}>
        <View style={styles.ratingBox}>
          <Text style={[Fonts.h1, { color: GoldColor, fontSize: 32 }]}>
            {team.elo || 1200}
          </Text>
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.72}
            numberOfLines={1}
            style={[Fonts.p3, { color: Colors.neutral300, textTransform: 'uppercase' }]}
          >
            ELO matchmaking
          </Text>
        </View>

        <View style={[styles.divisionBox, { borderColor: BorderColor }]}>
          <Text style={[Fonts.h2, { color: GoldColor }]}>
            D
            {team.division || 5}
          </Text>
        </View>
      </View>

      {/* Center: Image */}
      <View style={styles.imageContainer}>
        {team.crest ? (
          <Image source={{ uri: team.crest }} style={styles.crest} />
        ) : (
        // Placeholder Shield
          <View style={[styles.placeholderCrest, { borderColor: GoldDarkColor }]}>
            <Text style={[Fonts.h1, { color: GoldDarkColor, fontSize: 40 }]}>
              {team.name ? team.name.substring(0, 1).toUpperCase() : '?'}
            </Text>
          </View>
        )}
      </View>

      {/* Bottom: Team Name */}
      <View style={[styles.bottomRow, { borderTopColor: GoldDarkColor }]}>
        <Text style={[Fonts.h3, { color: GoldColor, textAlign: 'center', textTransform: 'uppercase' }]}>
          {team.name || 'Unknown Squad'}
        </Text>
        <Text style={[Fonts.p3, { color: Colors.neutral300, textAlign: 'center' }]}>
          {team.home_base?.address || 'No Home Base'}
        </Text>
      </View>
    </View>
  );
}

FutCard.propTypes = {
  team: PropTypes.shape({
    crest: PropTypes.string,
    division: PropTypes.number,
    elo: PropTypes.number,
    home_base: PropTypes.shape({
      address: PropTypes.string,
    }),
    name: PropTypes.string,
  }).isRequired,
  variant: PropTypes.oneOf(['classic', 'gold']),
};

FutCard.defaultProps = {
  variant: 'classic',
};

const styles = StyleSheet.create({
  bottomRow: {
    alignItems: 'center',
    borderTopWidth: 1,
    gap: 4,
    paddingTop: 12,
  },
  cardContainer: {
    aspectRatio: 0.7, // Classic card ratio
    borderRadius: 16,
    borderWidth: 2,
    justifyContent: 'space-between',
    padding: 16,
    width: '100%',
    // Shadow for "Elevation"
    // shadowColor dynamic
    elevation: 5,
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  crest: {
    height: 120,
    resizeMode: 'contain',
    width: 120,
  },
  divisionBox: {
    borderColor: '#B8860B',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  imageContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    marginVertical: 10,
  },
  placeholderCrest: {
    alignItems: 'center',
    borderRadius: 10, // Simple shield
    borderWidth: 4,
    height: 130, // Shield shape approx
    justifyContent: 'center',
    width: 100,
  },
  ratingBox: {
    alignItems: 'center',
  },
  topRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});

export default FutCard;
