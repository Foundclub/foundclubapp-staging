import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { useOnboarding } from '@/context/OnboardingContext';

const OnboardingWrapper = ({ id, order, title, description, children, style }) => {
    const { registerStep, unregisterStep } = useOnboarding();
    const viewRef = useRef(null);

    const measureAndRegister = () => {
        if (viewRef.current) {
            viewRef.current.measure((x, y, width, height, pageX, pageY) => {
                registerStep(id, { x: pageX, y: pageY, width, height }, order, title, description);
            });
        }
    };

    useEffect(() => {
        // Initial measurement
        const timer = setTimeout(measureAndRegister, 500); // Small delay to ensure layout is ready
        return () => {
            clearTimeout(timer);
            unregisterStep(id);
        };
    }, [id, order, title, description]);

    return (
        <View
            ref={viewRef}
            style={style}
            onLayout={measureAndRegister}
            collapsable={false} // Important for measure to work on Android
        >
            {children}
        </View>
    );
};

export default OnboardingWrapper;
