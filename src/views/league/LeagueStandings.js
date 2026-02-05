
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import useTheme from '@/theme/themeContext';

export default function LeagueStandings() {
    const { Colors, Fonts } = useTheme();
    return (
        <View style={[styles.container, { backgroundColor: Colors.neutral900 }]}>
            <Text style={[Fonts.h1, { color: Colors.gold500 }]}>Standings</Text>
            <Text style={[Fonts.p1, { color: Colors.neutral00 }]}>ELO & Divisions</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, alignItems: 'center', justifyContent: 'center' }
});
