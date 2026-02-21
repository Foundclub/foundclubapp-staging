import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import useTheme from '@/theme/themeContext';
import PropTypes from 'prop-types';

const FutCard = ({ team, variant = 'classic' }) => {
    const { Colors, Fonts } = useTheme();

    // Determine colors based on variant
    const isGold = variant === 'gold';
    const BorderColor = isGold ? Colors.gold500 : Colors.primary500;
    const AccentColor = isGold ? Colors.gold500 : Colors.neutral00;
    const GoldColor = Colors.gold500;
    const GoldDarkColor = Colors.gold700;
    const CardBg = Colors.neutral900; // Keep dark background for contrast
    const ShadowColor = isGold ? Colors.gold500 : Colors.primary500;

    return (
        <View style={[styles.cardContainer, { borderColor: BorderColor, backgroundColor: CardBg, shadowColor: ShadowColor }]}>

            <View style={styles.topRow}>
                <View style={styles.ratingBox}>
                    <Text style={[Fonts.h1, { color: GoldColor, fontSize: 32 }]}>
                        {team.elo || 1200}
                    </Text>
                    <Text style={[Fonts.p3, { color: Colors.neutral300, textTransform: 'uppercase' }]}>
                        ELO
                    </Text>
                </View>
                
                <View style={[styles.divisionBox, { borderColor: BorderColor }]}>
                    <Text style={[Fonts.h2, { color: AccentColor }]}>
                        D{team.division || 5}
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
                    {team.name || "Unknown Squad"}
                </Text>
                <Text style={[Fonts.p3, { color: Colors.neutral300, textAlign: 'center' }]}>
                    {team.home_base?.address || "No Home Base"}
                </Text>
            </View>
        </View>
    );
};

FutCard.propTypes = {
    team: PropTypes.shape({
        name: PropTypes.string,
        elo: PropTypes.number,
        division: PropTypes.number,
        crest: PropTypes.string,
        home_base: PropTypes.shape({
            address: PropTypes.string
        })
    }),
    variant: PropTypes.oneOf(['classic', 'gold'])
};

const styles = StyleSheet.create({
    cardContainer: {
        width: '100%',
        aspectRatio: 0.7, // Classic card ratio
        borderWidth: 2,
        borderRadius: 16,
        padding: 16,
        justifyContent: 'space-between',
        // Shadow for "Elevation"
        // shadowColor dynamic
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 5,
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    ratingBox: {
        alignItems: 'center',
    },
    divisionBox: {
        borderWidth: 1,
        borderColor: '#B8860B',
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    imageContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginVertical: 10,
    },
    crest: {
        width: 120,
        height: 120,
        resizeMode: 'contain',
    },
    placeholderCrest: {
        width: 100,
        height: 130, // Shield shape approx
        borderWidth: 4,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 10, // Simple shield
    },
    bottomRow: {
        borderTopWidth: 1,
        paddingTop: 12,
        alignItems: 'center',
        gap: 4
    }
});

export default FutCard;
