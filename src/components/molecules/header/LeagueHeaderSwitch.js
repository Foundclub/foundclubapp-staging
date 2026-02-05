import React from 'react';
import { TouchableOpacity, View, Text, Image, StyleSheet } from 'react-native';
import useTheme from '@/theme/themeContext';
import { useAppMode } from '@/context/AppModeContext';

const LeagueHeaderSwitch = () => {
    const { Colors, Fonts, Images } = useTheme();
    const { isGold, toggleMode } = useAppMode();

    return (
        <TouchableOpacity 
            onPress={toggleMode} 
            activeOpacity={0.8}
            style={styles.container}
        >
            <View style={styles.logoContainer}>
                {/* FOUNDCLUB Logo */}
                {/* In Classic (Standard), it's big and white. In Gold (League), it's smaller/dimmed. */}
                <Image 
                    source={Images.logo} 
                    style={[
                        styles.logo,
                        isGold ? { width: 100, height: 18, opacity: 0.6 } : { width: 140, height: 26, opacity: 1 }
                    ]} 
                />

                {/* Vertical Separator (Optional, maybe just spacing) */}
                <View style={{ width: 1, height: 20, backgroundColor: Colors.neutral700, marginHorizontal: 12, display: 'none' }} />

                {/* LEAGUE Text */}
                {/* In Classic, it's small and dimmed. In Gold, it's big and Gold. */}
                <Text style={[
                    Fonts.h1Bold, 
                    { 
                        marginLeft: 8,
                        transform: [{ translateY: isGold ? 0 : 2 }], // Alignment fix
                    },
                    isGold ? { 
                        fontSize: 24, 
                        color: Colors.gold500, 
                        opacity: 1,
                        letterSpacing: 2
                    } : { 
                        fontSize: 14, 
                        color: Colors.gold500, 
                        opacity: 0.4,
                        letterSpacing: 1
                    }
                ]}>
                    LEAGUE
                </Text>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingVertical: 8,
        // No horizontal padding here, let the parent handle it or align naturally
    },
    logoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    logo: {
        resizeMode: 'contain',
        // Transition handled via style prop updates, LayoutAnimation could be added for smoothness
    }
});

export default LeagueHeaderSwitch;
