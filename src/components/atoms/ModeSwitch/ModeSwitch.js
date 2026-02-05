
import React from 'react';
import { Switch, View, Text, StyleSheet } from 'react-native';
import { useAppMode } from '@/context/AppModeContext';
import useTheme from '@/theme/themeContext';

export default function ModeSwitch() {
  const { isGold, toggleMode } = useAppMode();
  const { Colors, Fonts } = useTheme();

  return (
    <View style={styles.container}>
      <Text style={[Fonts.p2, { color: isGold ? Colors.warning500 : Colors.neutral00, marginRight: 8 }]}>
        {isGold ? 'GOLD' : 'CLASSIC'}
      </Text>
      <Switch
        value={isGold}
        onValueChange={toggleMode}
        trackColor={{ false: '#767577', true: Colors.warning500 }}
        thumbColor={isGold ? '#FFFFFF' : '#f4f3f4'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
  },
});
