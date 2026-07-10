import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import useAuth from '@/domains/auth/useAuth';
import { subscribeToGuidanceSignals } from '@/domains/guidance/guidanceRuntime';
import { getTourProfile } from '@/domains/tour/tourCatalog';
import { storage } from '@/store/appContext';

import { navigate as navigateRoot } from '@/navigation/navigationService';

/**
 * Moteur du tour guidé v2 (docs/PLAN_TOUR_GUIDE_V2_2026_07_10.md) :
 * navigation directe sur les vraies pages + message de succès par étape.
 * Remplace le système de missions (obsolète, décision 2026-07-10).
 */

const SUCCESS_DISPLAY_MS = 1800;

const TourContext = createContext(/** @type {any} */ (null));

/**
 * @param {string | null | undefined} userId
 * @returns {string}
 */
const getStorageKey = (userId) => `tourProgress_${String(userId || 'anonymous')}`;

/**
 * @param {any} target
 * @param {any} context
 * @returns {boolean}
 */
const navigateToTarget = (target, context) => {
  if (!target?.routeName) return false;
  const params = typeof target.params === 'function' ? target.params(context) : target.params;
  return Boolean(navigateRoot(target.routeName, params));
};

/**
 * @param {object} root0
 * @param {import('react').ReactNode} root0.children
 * @returns {import('react').ReactElement}
 */
export function TourProvider({ children }) {
  const { userData } = /** @type {any} */ (useAuth());
  const userId = userData?.documentId || null;

  const [tourState, setTourState] = useState(/** @type {any} */ (null));
  const tourStateRef = useRef(/** @type {any} */ (null));
  tourStateRef.current = tourState;
  const successTimerRef = useRef(/** @type {any} */ (null));
  const hydratedUserRef = useRef(/** @type {string | null} */ (null));

  const persist = useCallback((/** @type {any} */ nextState) => {
    if (!userId) return;
    if (nextState) {
      storage.set(getStorageKey(userId), JSON.stringify({
        profileKey: nextState.profileKey,
        skippedStepIds: nextState.skippedStepIds || [],
        stepIndex: nextState.stepIndex,
      }));
    } else {
      storage.delete(getStorageKey(userId));
    }
  }, [userId]);

  // Reprise : un tour inachevé revient en mode « paused » au prochain lancement.
  useEffect(() => {
    if (!userId || hydratedUserRef.current === userId) return;
    hydratedUserRef.current = userId;
    try {
      const raw = storage.getString(getStorageKey(userId));
      if (!raw) return;
      const saved = JSON.parse(raw);
      const profile = getTourProfile(saved?.profileKey);
      if (!profile || !Number.isFinite(Number(saved?.stepIndex))) return;
      const stepIndex = Math.min(Number(saved.stepIndex), profile.steps.length - 1);
      setTourState({
        profileKey: saved.profileKey,
        skippedStepIds: Array.isArray(saved.skippedStepIds) ? saved.skippedStepIds : [],
        status: 'paused',
        stepIndex,
      });
    } catch (error) {
      storage.delete(getStorageKey(userId));
    }
  }, [userId]);

  const clearSuccessTimer = () => {
    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
    }
  };

  const goToStep = useCallback((/** @type {any} */ state, /** @type {number} */ stepIndex) => {
    const profile = getTourProfile(state?.profileKey);
    const step = profile?.steps?.[stepIndex];
    if (!step) return;
    const skippedPrevious = (state.skippedStepIds || []).length > 0;
    const target = (skippedPrevious && step.fallbackTarget) ? step.fallbackTarget : step.navTarget;
    navigateToTarget(target, { userData });
  }, [userData]);

  const startTour = useCallback((/** @type {string} */ profileKey) => {
    const profile = getTourProfile(profileKey);
    if (!profile || profile.steps.length === 0) return false;
    clearSuccessTimer();
    // Les etapes deja accomplies (ex. equipe deja creee) sont sautees au demarrage.
    let startIndex = 0;
    while (startIndex < profile.steps.length - 1
      && typeof profile.steps[startIndex].isAlreadyDone === 'function'
      && /** @type {any} */ (profile.steps[startIndex].isAlreadyDone)({ userData })) {
      startIndex += 1;
    }
    const nextState = {
      profileKey,
      skippedStepIds: [],
      status: 'active',
      stepIndex: startIndex,
    };
    setTourState(nextState);
    persist(nextState);
    goToStep(nextState, nextState.stepIndex);
    return true;
  }, [goToStep, persist, userData]);

  const finishTour = useCallback(() => {
    clearSuccessTimer();
    setTourState(null);
    persist(null);
  }, [persist]);

  // Succès d'une étape : message ✓ dans le bandeau, puis navigation vers la suivante.
  const completeCurrentStep = useCallback((/** @type {{ skipped?: boolean }} */ options = {}) => {
    const { current } = tourStateRef;
    if (!current || current.status !== 'active') return;
    const profile = getTourProfile(current.profileKey);
    const step = profile?.steps?.[current.stepIndex];
    if (!step) return;

    const skippedStepIds = options.skipped
      ? [...(current.skippedStepIds || []), step.id]
      : (current.skippedStepIds || []);
    const isLastStep = current.stepIndex >= profile.steps.length - 1;
    const successState = {
      ...current,
      showSuccess: !options.skipped,
      skippedStepIds,
      status: 'success',
    };
    setTourState(successState);

    clearSuccessTimer();
    successTimerRef.current = setTimeout(() => {
      successTimerRef.current = null;
      if (isLastStep) {
        setTourState(null);
        persist(null);
        return;
      }
      const nextState = {
        profileKey: current.profileKey,
        skippedStepIds,
        status: 'active',
        stepIndex: current.stepIndex + 1,
      };
      setTourState(nextState);
      persist(nextState);
      goToStep(nextState, nextState.stepIndex);
    }, options.skipped ? 150 : SUCCESS_DISPLAY_MS);
  }, [goToStep, persist]);

  const resumeTour = useCallback(() => {
    const { current } = tourStateRef;
    if (!current || current.status !== 'paused') return;
    const nextState = { ...current, status: 'active' };
    setTourState(nextState);
    goToStep(nextState, nextState.stepIndex);
  }, [goToStep]);

  const exitTour = useCallback(() => {
    finishTour();
  }, [finishTour]);

  // Validation automatique : signaux métier du bus guidance (event.created, etc.).
  useEffect(() => {
    const unsubscribe = subscribeToGuidanceSignals((/** @type {any} */ signal) => {
      const { current } = tourStateRef;
      if (!current || current.status !== 'active') return;
      const profile = getTourProfile(current.profileKey);
      const step = profile?.steps?.[current.stepIndex];
      if (!step || step.success?.type === 'manual') return;
      if (signal?.kind === step.success?.type && signal?.key === step.success?.key) {
        completeCurrentStep();
      }
    });
    return unsubscribe;
  }, [completeCurrentStep]);

  useEffect(() => () => clearSuccessTimer(), []);

  const profile = getTourProfile(tourState?.profileKey);
  const currentStep = profile?.steps?.[tourState?.stepIndex] || null;

  const value = useMemo(() => ({
    completeCurrentStep,
    currentStep,
    exitTour,
    isTourActive: Boolean(tourState),
    resumeTour,
    startTour,
    stepIndex: Number(tourState?.stepIndex || 0),
    totalSteps: profile?.steps?.length || 0,
    tourStatus: tourState?.status || null,
  }), [
    completeCurrentStep,
    currentStep,
    exitTour,
    profile?.steps?.length,
    resumeTour,
    startTour,
    tourState,
  ]);

  return (
    <TourContext.Provider value={value}>
      {children}
    </TourContext.Provider>
  );
}

export const useTour = () => useContext(TourContext) || {
  completeCurrentStep: () => {},
  currentStep: null,
  exitTour: () => {},
  isTourActive: false,
  resumeTour: () => {},
  startTour: () => false,
  stepIndex: 0,
  totalSteps: 0,
  tourStatus: null,
};
