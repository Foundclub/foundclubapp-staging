import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

const TestScreen = ({ navigation }) => (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'cyan' }}>
        <Text>Test Screen Works!</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text>Go Back</Text>
        </TouchableOpacity>
    </View>
);

export default TestScreen;
