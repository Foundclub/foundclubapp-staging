import React from 'react';
import {
    TouchableOpacity,
    View,
    Text,
    Image,
    StyleSheet,
} from 'react-native';
import useTheme from '@/theme/themeContext';
import { useAppMode } from '@/context/AppModeContext';

const LeagueHeaderSwitch = () => {
    const { Colors, Fonts, Images } = useTheme();
    const { isGold, toggleMode } = useAppMode();
    const logoWidth = isGold ? 100 : 140;
    const logoHeight = isGold ? 18 : 26;
    const leagueSectionWidth = isGold ? 118 : 92;

    return (
        <TouchableOpacity 
            onPress={toggleMode} 
            activeOpacity={0.8}
            style={styles.container}
        >
            <View style={styles.logoContainer}>
                <View style={[styles.brandSection, { width: logoWidth }]}>
                    <Image
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
                            ? { color: Colors.gold500, fontSize: 24, letterSpacing: 2, opacity: 1 }
                            : { color: Colors.gold500, fontSize: 14, letterSpacing: 1, opacity: 0.4 },
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
                                backgroundColor: isGold ? Colors.gold500 : 'transparent',
                                borderColor: Colors.gold500,
                            },
                        ]}
                    />
                </View>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingVertical: 8,
    },
    brandSection: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    leagueSection: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    leagueTitle: {
        textAlign: 'center',
        transform: [{ translateY: 1 }],
    },
    logoContainer: {
        alignItems: 'center',
        flexDirection: 'row',
    },
    logo: {
        resizeMode: 'contain',
    },
    modeIndicator: {
        flexDirection: 'row',
        marginTop: 6,
        width: 'auto',
    },
    sectionSpacer: {
        width: 6,
    },
    modeDot: {
        borderRadius: 6,
        borderWidth: 1.5,
        height: 12,
        width: 12,
    },
});

export default LeagueHeaderSwitch;
