import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View, Dimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import useTheme from '@/theme/themeContext';
import { useOnboarding } from '@/context/OnboardingContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const OnboardingOverlay = () => {
    const { t } = useTranslation();
    const { Colors, Fonts, Spaces, Alignments } = useTheme();
    const { isActive, currentStep, nextStep, skipOnboarding, totalSteps, currentStepIndex } = useOnboarding();

    if (!isActive || !currentStep) return null;

    const { layout, title, description } = currentStep;

    // Calculate 4 rectangles around the target
    const topHeight = layout.y;
    const bottomHeight = SCREEN_HEIGHT - (layout.y + layout.height);
    const leftWidth = layout.x;
    const rightWidth = SCREEN_WIDTH - (layout.x + layout.width);

    // Tooltip position (above or below target)
    const isTopHalf = layout.y > SCREEN_HEIGHT / 2;
    const tooltipTop = isTopHalf
        ? layout.y - 150 // Show above
        : layout.y + layout.height + 20; // Show below

    return (
        <Modal transparent animationType="fade" visible={isActive} onRequestClose={skipOnboarding}>
            {/* 4-View Spotlight Overlay */}
            <View style={[styles.overlayPart, { top: 0, height: topHeight, left: 0, right: 0 }]} />
            <View style={[styles.overlayPart, { top: topHeight + layout.height, bottom: 0, left: 0, right: 0 }]} />
            <View style={[styles.overlayPart, { top: topHeight, height: layout.height, left: 0, width: leftWidth }]} />
            <View style={[styles.overlayPart, { top: topHeight, height: layout.height, right: 0, width: rightWidth }]} />

            {/* Tooltip Card */}
            <View style={[
                styles.tooltip,
                {
                    top: tooltipTop,
                    backgroundColor: Colors.neutral00
                },
                Spaces.padding[16]
            ]}>
                <Text style={[Fonts.h3Bold, Fonts.neutral900, Spaces.marginBottom[8]]}>
                    {title}
                </Text>
                <Text style={[Fonts.p1, Fonts.neutral500, Spaces.marginBottom[16]]}>
                    {description}
                </Text>

                <View style={[Alignments.row, Alignments.justifySpaceBetween]}>
                    <TouchableOpacity onPress={skipOnboarding}>
                        <Text style={[Fonts.p2Bold, { color: Colors.neutral500 }]}>
                            {t('common.skip', 'Passer')}
                        </Text>
                    </TouchableOpacity>
                    <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
                        <Text style={[Fonts.p3, { color: Colors.neutral400 }]}>
                            {currentStepIndex + 1}/{totalSteps}
                        </Text>
                        <TouchableOpacity onPress={nextStep} style={[styles.nextButton, { backgroundColor: Colors.primary }]}>
                            <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>
                                {currentStepIndex < totalSteps - 1 ? t('common.next', 'Suivant') : t('common.finish', 'Terminer')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlayPart: {
        position: 'absolute',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
    },
    tooltip: {
        position: 'absolute',
        left: 20,
        right: 20,
        borderRadius: 12,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    nextButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    }
});

export default OnboardingOverlay;
