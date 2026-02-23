import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

/**
 *
 * @param root0
 * @param root0.navigation
 */
function TestScreen({ navigation }) {
  return (
    <View style={{
      alignItems: 'center', backgroundColor: 'cyan', flex: 1, justifyContent: 'center',
    }}
    >
      <Text>Test Screen Works!</Text>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text>Go Back</Text>
      </TouchableOpacity>
    </View>
  );
}

export default TestScreen;
