import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import useTheme from '@/theme/themeContext';
import { useNavigation } from '@react-navigation/native';
import { RouteNames } from '@/navigation/routeNames';
import Button from '@/components/atoms/button/Button';

export default function LeagueMatchCenter() {
    const { Colors, Fonts } = useTheme();
    const navigation = useNavigation();

    return (
        <View style={[styles.container, { backgroundColor: Colors.neutral900 }]}>
            <Text style={[Fonts.h1, { color: Colors.gold500 }]}>Match Center</Text>
            <Text style={[Fonts.p1, { color: Colors.neutral00, marginBottom: 20 }]}>Find Matches & Challenges</Text>
            
            <Button 
                onPress={() => navigation.navigate(RouteNames.MatchDetails, { matchId: 'test-match-1' })}
                label="Voir un Match (Test)"
                style={{ backgroundColor: Colors.gold500, marginTop: 20 }}
                textStyle={{ color: Colors.neutral900 }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, alignItems: 'center', justifyContent: 'center' }
});
