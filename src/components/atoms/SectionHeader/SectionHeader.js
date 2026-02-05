import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import useTheme from '@/theme/themeContext';

const SectionHeader = ({ title, subtitle, rightElement }) => {
    const { Colors, Fonts, Spaces } = useTheme();

    return (
        <View style={[styles.container, { marginBottom: Spaces?.gap?.[16] || 16 }]}>
            <View style={{ flex: 1 }}>
                <Text style={[styles.title, { ...Fonts.h3, color: Colors.neutral00 || '#FFF' }]}>{title}</Text>
                {subtitle && <Text style={[styles.subtitle, { ...Fonts.p2, color: Colors.neutral300 || '#CCC', marginTop: Spaces?.gap?.[4] || 4 }]}>{subtitle}</Text>}
            </View>
            {rightElement && (
                <View style={[styles.rightElement, { marginLeft: Spaces?.gap?.[16] || 16 }]}>
                    {rightElement}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    title: {
        textTransform: 'uppercase',
    },
    subtitle: {
    },
    rightElement: {
    }
});

export default SectionHeader;
