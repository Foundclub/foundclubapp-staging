import React, { createContext, useState, useContext, useCallback } from 'react';
import { MMKV } from 'react-native-mmkv';

const OnboardingContext = createContext();
const storage = new MMKV();
const ONBOARDING_KEY = 'hasSeenOnboardingV2';

export const OnboardingProvider = ({ children }) => {
    const [steps, setSteps] = useState({});
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [isActive, setIsActive] = useState(false);

    const orderedSteps = Object.values(steps).sort((a, b) => a.order - b.order);

    const startOnboarding = useCallback(() => {
        // const hasSeen = storage.getBoolean(ONBOARDING_KEY);
        // Forcing onboarding on every start for now as requested
        console.log('Attempting to start onboarding. Steps:', orderedSteps.length);
        if (orderedSteps.length > 0) {
            console.log('Starting onboarding now!');
            setIsActive(true);
            setCurrentStepIndex(0);
        }
    }, [orderedSteps.length]);

    const registerStep = useCallback((id, layout, order, title, description) => {
        setSteps((prev) => ({
            ...prev,
            [id]: { id, layout, order, title, description },
        }));
    }, []);

    const unregisterStep = useCallback((id) => {
        setSteps((prev) => {
            const newSteps = { ...prev };
            delete newSteps[id];
            return newSteps;
        });
    }, []);

    const nextStep = useCallback(() => {
        if (currentStepIndex < orderedSteps.length - 1) {
            setCurrentStepIndex((prev) => prev + 1);
        } else {
            stopOnboarding();
        }
    }, [currentStepIndex, orderedSteps.length]);

    const stopOnboarding = useCallback(() => {
        setIsActive(false);
        storage.set(ONBOARDING_KEY, true);
    }, []);

    const skipOnboarding = useCallback(() => {
        stopOnboarding();
    }, [stopOnboarding]);

    return (
        <OnboardingContext.Provider value={{
            isActive,
            currentStep: orderedSteps[currentStepIndex],
            totalSteps: orderedSteps.length,
            currentStepIndex,
            registerStep,
            unregisterStep,
            nextStep,
            skipOnboarding,
            startOnboarding
        }}>
            {children}
        </OnboardingContext.Provider>
    );
};

export const useOnboarding = () => useContext(OnboardingContext);
