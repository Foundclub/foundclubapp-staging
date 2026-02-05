
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import useTheme from '@/theme/themeContext';

export default function LeagueStandings() {
  const { Colors, Fonts } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: Colors.neutral900, justifyContent: 'center', alignItems: 'center' }}>
       <Text style={[Fonts.h1, { color: Colors.gold500 }]}>CLASSEMENT</Text>
       <Text style={[Fonts.p1, { color: Colors.neutral00, marginTop: 10 }]}>Saison 1 - En cours</Text>
       <Text style={[Fonts.p2, { color: Colors.neutral500, marginTop: 20 }]}>Bientôt disponible</Text>
    </View>
  );
}
