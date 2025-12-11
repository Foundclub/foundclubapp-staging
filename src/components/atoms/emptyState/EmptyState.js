import React from 'react';
import { View, Text, Image } from 'react-native';
import useTheme from '@/theme/themeContext';
import Button from '@/components/atoms/button/Button';

const EmptyState = ({
    title,
    description,
    icon, // Can be an image source or icon name if using an icon lib
    actionLabel,
    onAction,
}) => {
    const { Colors, Fonts, Spaces, Alignments, ApplicationStyle } = useTheme();

    return (
        <View style={[
            ApplicationStyle.backgroundColor.primary900, // Or neutral background
            ApplicationStyle.borderRadius16,
            Alignments.alignCenter,
            Spaces.gap[16],
            Spaces.padding[24],
            Spaces.marginVertical[24]
        ]}>
            {icon && (
                <View style={[Spaces.marginBottom[8]]}>
                    {/* Placeholder for icon/image */}
                    {/* <Image source={icon} style={{ width: 80, height: 80 }} resizeMode="contain" /> */}
                </View>
            )}
            <Text style={[Fonts.h3, Fonts.neutral00, Fonts.textCenter]}>
                {title}
            </Text>
            {description && (
                <Text style={[Fonts.p1, Fonts.neutral200, Fonts.textCenter]}>
                    {description}
                </Text>
            )}
            {actionLabel && onAction && (
                <View style={[Spaces.marginTop[16]]}>
                    <Button
                        title={actionLabel}
                        onPress={onAction}
                        variant="SecondaryLight"
                        isOption // Assuming this prop makes it smaller/fit content
                    />
                </View>
            )}
        </View>
    );
};

export default EmptyState;
