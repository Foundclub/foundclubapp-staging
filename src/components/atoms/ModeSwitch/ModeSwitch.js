import React from 'react';
import {
  StyleSheet, Switch, Text, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import { useAppMode } from '@/context/AppModeContext';

/**
 *
 */
export default function ModeSwitch() {
  const { isGold, toggleMode } = useAppMode();
  const { Colors, Fonts } = useTheme();

  return (
    <View style={styles.container}>
      <Text style={[Fonts.p2, { color: isGold ? Colors.warning500 : Colors.neutral00, marginRight: 8 }]}>
        {isGold ? 'GOLD' : 'CLASSIC'}
      </Text>
      <Switch
        onValueChange={toggleMode}
        thumbColor={isGold ? '#FFFFFF' : '#f4f3f4'}
        trackColor={{ false: '#767577', true: Colors.warning500 }}
        value={isGold}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    marginRight: 15,
  },
});
