import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform } from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import { subscribeToGuidanceSignals } from '@/domains/guidance/guidanceRuntime';
import { getTourProfile, TOUR_HOME_TARGET } from '@/domains/tour/tourCatalog';
import {
  firstIndexOfNextMission,
  getMission,
  indexOfStep,
  matchCurrentRoute,
  matchSignal,
  missionPosition,
  nextAvailableIndex,
} from '@/domains/tour/tourGuideEngine';
import { storage } from '@/store/appContext';

import { navigate as navigateRoot } from '@/navigation/navigationService';

import { TourContext, useTour } from './useTour';

/**
 * Moteur du tour guidé v2 (docs/PLAN_TOUR_GUIDE_V2_2026_07_10.md) :
 * navigation directe sur les vraies pages + message de succès par étape.
 * Remplace le système de missions (obsolète, décision 2026-07-10).
 *
 * TUTOE (pack design_handoff_tutoriels, 27/10) : un profil `version: 3` est un
 * GUIDE À MISSIONS. Il ne navigue qu'au départ et à la reprise ; ensuite chaque
 * étape attend le vrai geste de la personne (signal du bus guidance). Missions
 * essentielles verrouillées (+jauge), palier, bonus passables, clôture.
 */

const SUCCESS_DISPLAY_MS = 1800;
// Bandeau « Mission réussie » du guide (04_COUCHE_VISUELLE §5).
const REWARD_DISPLAY_MS = 1700;
const GUIDE_VERSION = 3;
// Garde-fou : une suite d'étapes déjà faites ne s'enchaîne pas sans fin.
const MAX_AUTO_ADVANCE = 20;

/**
 * @param {string | null | undefined} userId
 * @returns {string}
 */
const getStorageKey = (userId) => `tourProgress_${String(userId || 'anonymous')}`;

/**
 * Clé des bonus laissés « pour plus tard » au palier (relance depuis Mon compte).
 * @param {string | null | undefined} userId - Identifiant de la personne.
 * @returns {string} Clé MMKV.
 */
export const getBonusLaterKey = (userId) => `tourBonusLater_${String(userId || 'anonymous')}`;

/**
 * Marqueur « guide déjà lancé » : relancé depuis Mon compte, il ouvre alors un
 * menu au lieu de tout refaire (GUIDE-RELANCE, décision d'Adel 3- A).
 * @param {string | null | undefined} userId - Identifiant de la personne.
 * @returns {string} Clé MMKV.
 */
const getGuideDoneKey = (userId) => `tourGuideDone_${String(userId || 'anonymous')}`;

/**
 * Vrai pour un guide à missions (TUTOE), faux pour un tour v2.
 * @param {any} profile - Profil du catalogue.
 * @returns {boolean} Guide à missions ?
 */
const isGuideProfile = (profile) => profile?.version === GUIDE_VERSION;

/**
 * @param {any} target
 * @param {any} context
 * @param {{ pop?: boolean }} [options] - Options de navigation.
 * @returns {boolean}
 */
const navigateToTarget = (target, context, options) => {
  if (!target?.routeName) return false;
  const params = typeof target.params === 'function' ? target.params(context) : target.params;
  // GUIDE-BONUS (L5) : une cible `pop` revient en DÉPILANT (sinon react-navigation 7
  // empile un doublon de l'accueil au-dessus de l'écran quitté).
  const navOptions = options || (target.pop ? { pop: true } : null);
  return Boolean(navOptions
    ? navigateRoot(target.routeName, params, navOptions)
    : navigateRoot(target.routeName, params));
};

/**
 * Ce qu'une action réelle a créé, gardé pour la clôture (« RÉEL »).
 * @param {any} signal - Signal du bus guidance.
 * @returns {Record<string, any>} Métadonnées utiles du signal.
 */
const signalMeta = (signal) => {
  const {
    key, kind, occurredAt, ...meta
  } = signal || {};
  return { ...meta, at: occurredAt || null };
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
  const [guideDone, setGuideDone] = useState(false);
  const tourStateRef = useRef(/** @type {any} */ (null));
  tourStateRef.current = tourState;
  const userDataRef = useRef(userData);
  userDataRef.current = userData;
  const successTimerRef = useRef(/** @type {any} */ (null));
  const hydratedUserRef = useRef(/** @type {string | null} */ (null));
  const lastRouteRef = useRef(/** @type {string | null} */ (null));
  // GUIDE-RECUL : étapes de la mission en cours et l'écran où chacune s'est
  // ouverte, pour revenir à la bonne au retour arrière.
  const historyRef = useRef(
    /** @type {Array<{ index: number; route: string | null; stepRoute: string | null }>} */ ([]),
  );

  const persist = useCallback((/** @type {any} */ nextState) => {
    if (!userId) return;
    // La visite « sans rien créer » ne touche jamais la progression gardée.
    if (nextState?.review || (!nextState && tourStateRef.current?.review)) return;
    if (nextState && nextState.version === GUIDE_VERSION) {
      storage.set(getStorageKey(userId), JSON.stringify({
        created: nextState.created || {},
        flags: nextState.flags || {},
        gauge: nextState.gauge || 0,
        missionStatus: nextState.missionStatus || {},
        profileKey: nextState.profileKey,
        stepIndex: nextState.stepIndex,
        version: GUIDE_VERSION,
      }));
    } else if (nextState) {
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
  // C09 — Changement de compte / déconnexion : on purge d'abord l'état du tour
  // gardé en mémoire, sinon le bandeau (avec le numéro d'étape de l'ancien
  // compte) reste affiché après un switch de compte (le « tour fantôme »).
  useEffect(() => {
    if (hydratedUserRef.current === userId) return;
    hydratedUserRef.current = userId;
    clearSuccessTimer();
    setTourState(null);
    setGuideDone(Boolean(userId && storage.getString(getGuideDoneKey(userId))));
    if (!userId) return;
    try {
      const raw = storage.getString(getStorageKey(userId));
      if (!raw) return;
      const saved = JSON.parse(raw);
      const profile = getTourProfile(saved?.profileKey);
      if (!profile || !Number.isFinite(Number(saved?.stepIndex))) return;
      const stepIndex = Math.min(Number(saved.stepIndex), profile.steps.length - 1);
      if (isGuideProfile(profile)) {
        // Un état v2 d'un profil devenu guide à missions ne se rejoue pas : purge.
        if (saved.version !== GUIDE_VERSION) {
          storage.delete(getStorageKey(userId));
          return;
        }
        setTourState({
          created: saved.created || {},
          flags: saved.flags || {},
          gauge: Number(saved.gauge) || 0,
          missionStatus: saved.missionStatus || {},
          profileKey: saved.profileKey,
          // Relancement de l'app : un brouillon de tunnel est perdu ⇒ `resumeFrom`.
          restored: true,
          status: 'paused',
          stepIndex,
          version: GUIDE_VERSION,
        });
        return;
      }
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

  const finishTour = useCallback(() => {
    clearSuccessTimer();
    setTourState(null);
    persist(null);
  }, [persist]);

  /**
   * Guide : contexte passé aux `when` / textes du catalogue.
   * @param {any} state - État du guide.
   * @returns {any} Contexte.
   */
  const guideContext = (state) => ({
    created: state?.created || {},
    flags: state?.flags || {},
    missionStatus: state?.missionStatus || {},
    review: Boolean(state?.review),
    userData: userDataRef.current,
  });

  // Guide : entrer dans une étape. Si la personne est déjà là où l'étape veut
  // l'emmener, on applique la sortie tout de suite (sans boucle infinie).
  // `stepRoute` : l'écran qui a ouvert l'étape (sortie « route » franchie), ou
  // null ; la couche coupe le voile hors de cet écran (décision du chef 3).
  const enterGuideStep = useCallback((
    /** @type {any} */ base,
    /** @type {number} */ index,
    /** @type {number} */ depth = 0,
    /** @type {string | null} */ stepRoute = null,
  ) => {
    const profile = getTourProfile(base.profileKey);
    if (!profile || index < 0 || index >= profile.steps.length) {
      // Fin de la visite : la progression d'avant revient, en pause.
      if (base.review) {
        clearSuccessTimer();
        setTourState(base.resumeAfter ? { ...base.resumeAfter, status: 'paused' } : null);
        navigateToTarget(TOUR_HOME_TARGET, guideContext(base));
        return;
      }
      finishTour();
      return;
    }
    const nextState = {
      ...base, blocked: null, reward: null, status: 'active', stepIndex: index, stepRoute,
    };
    const already = depth < MAX_AUTO_ADVANCE && !base.review
      ? matchCurrentRoute(profile, index, lastRouteRef.current, guideContext(nextState))
      : null;
    if (already && !already.completes) {
      enterGuideStep(nextState, already.index, depth + 1, lastRouteRef.current);
      return;
    }
    const first = historyRef.current[0];
    const sameMission = Boolean(first)
      && profile.steps[first.index]?.missionId === profile.steps[index]?.missionId;
    historyRef.current = [
      ...(sameMission ? historyRef.current : []),
      { index, route: lastRouteRef.current, stepRoute },
    ];
    setTourState(nextState);
    persist(nextState);
    if (already) {
      applyGuideMatch(nextState, already);
      return;
    }
    // Étape qui emmène elle-même (B2 : le match d'exemple n'a pas de carte).
    const step = profile.steps[index];
    if (nextState.review) {
      navigateToTarget(step?.navTarget, guideContext(nextState), { pop: true });
      return;
    }
    if (step?.navigateOnEnter) navigateToTarget(step.navTarget, guideContext(nextState));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finishTour, persist]);

  // Guide : une étape est franchie. Si elle clôt une mission, bandeau de
  // récompense + jauge, puis étape suivante.
  const applyGuideMatch = useCallback((
    /** @type {any} */ current,
    /** @type {{ advance?: any; completes: boolean; index: number }} */ match,
  ) => {
    clearSuccessTimer();
    const stepRoute = match.advance?.type === 'route' ? lastRouteRef.current : null;
    if (!match.completes) {
      enterGuideStep(current, match.index, 0, stepRoute);
      return;
    }
    const profile = getTourProfile(current.profileKey);
    const step = profile?.steps?.[current.stepIndex];
    const mission = getMission(profile, step?.missionId);
    const from = Number(current.gauge) || 0;
    const to = Math.min(100, from + (Number(mission?.gaugeStep) || 0));
    const rewarded = {
      ...current,
      gauge: to,
      missionStatus: { ...(current.missionStatus || {}), [String(mission?.id)]: 'done' },
      reward: {
        from, isBonus: !mission?.locked, missionId: mission?.id || null, to,
      },
      status: 'success',
    };
    setTourState(rewarded);
    persist(rewarded);
    successTimerRef.current = setTimeout(() => {
      successTimerRef.current = null;
      enterGuideStep(rewarded, match.index, 0, stepRoute);
    }, REWARD_DISPLAY_MS);
  }, [enterGuideStep, persist]);

  const startTour = useCallback((
    /** @type {string} */ profileKey,
    /** @type {{ fromMission?: string; review?: boolean }} */ options = {},
  ) => {
    // Sur le site, TourBanner n'est pas monté (audit 2026-07-31 §4.5) : démarrer
    // baladerait l'utilisateur de page en page sans instruction ni porte de
    // sortie. Refuser ⇒ Welcome navigue vers l'accueil (son chemin `!started`).
    if (Platform.OS === 'web') return false;
    const profile = getTourProfile(profileKey);
    if (!profile || profile.steps.length === 0) return false;
    clearSuccessTimer();

    if (isGuideProfile(profile) && options.review) {
      // « Revoir le guide sans rien créer » : visite au bouton ; la progression
      // gardée (s'il y en a une) attend à côté et revient à la fin.
      const before = tourStateRef.current;
      enterGuideStep({
        created: {},
        flags: typeof profile.buildFlags === 'function' ? profile.buildFlags({ userData }) : {},
        gauge: 0,
        missionStatus: {},
        profileKey,
        resumeAfter: before && !before.review ? { ...before, reward: null } : null,
        review: true,
        version: GUIDE_VERSION,
      }, nextAvailableIndex(profile, -1, { review: true }));
      return true;
    }

    if (isGuideProfile(profile)) {
      const fromMission = getMission(profile, options.fromMission);
      const essentialsDone = Boolean(fromMission && !fromMission.locked);
      const base = {
        created: {},
        flags: typeof profile.buildFlags === 'function' ? profile.buildFlags({ userData }) : {},
        gauge: essentialsDone ? 100 : 0,
        missionStatus: essentialsDone
          ? Object.fromEntries(profile.missions
            .filter((/** @type {any} */ mission) => mission.locked)
            .map((/** @type {any} */ mission) => [mission.id, 'done']))
          : {},
        profileKey,
        status: 'active',
        stepIndex: 0,
        version: GUIDE_VERSION,
      };
      const ctx = guideContext(base);
      const startIndex = fromMission
        ? nextAvailableIndex(profile, profile.steps
          .findIndex((/** @type {any} */ step) => step.missionId === fromMission.id) - 1, ctx)
        : nextAvailableIndex(profile, -1, ctx);
      if (startIndex === -1) return false;
      const startState = { ...base, stepIndex: startIndex };
      historyRef.current = [{ index: startIndex, route: null, stepRoute: null }];
      setTourState(startState);
      persist(startState);
      if (userId) storage.set(getGuideDoneKey(userId), '1');
      setGuideDone(true);
      // GUIDE-ENTETE (décision d'Adel 3- A, 28/10) : relancé depuis Mon compte,
      // le guide repart de l'accueil en dépilant Mon compte ; sans `pop`, il
      // restait sur Mon compte, sans barre d'onglets (audit, captures 76-77).
      navigateToTarget(profile.steps[startIndex].navTarget, { userData }, { pop: true });
      return true;
    }

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
  }, [enterGuideStep, goToStep, persist, userData, userId]);

  // Bloquant n° 6 de l'audit : l'écran a refusé le geste d'une mission
  // essentielle (quota, club partenaire, publication refusée). On ne contourne
  // rien : la mission est passée, et celles qui en ont besoin aussi.
  const skipBlockedMission = useCallback(() => {
    const { current } = tourStateRef;
    if (!current?.blocked) return;
    const profile = getTourProfile(current.profileKey);
    const mission = getMission(profile, profile?.steps?.[current.stepIndex]?.missionId);
    if (!mission) return;
    const missionStatus = { ...(current.missionStatus || {}), [mission.id]: 'blocked' };
    (profile.missions || []).forEach((/** @type {any} */ other) => {
      if ((other.needs || []).includes(mission.id) && missionStatus[other.id] !== 'done') {
        missionStatus[other.id] = 'blocked';
      }
    });
    const skipped = { ...current, blocked: null, missionStatus };
    enterGuideStep(skipped, nextAvailableIndex(profile, current.stepIndex, guideContext(skipped)));
  }, [enterGuideStep]);

  // « Rester » : la carte se ferme, la mission continue (autre club, offre prise).
  const dismissBlocked = useCallback(() => {
    const { current } = tourStateRef;
    if (current?.blocked) setTourState({ ...current, blocked: null });
  }, []);

  // Guide : la mission bonus courante est passée ; on saute à la suivante.
  const skipMission = useCallback(() => {
    const { current } = tourStateRef;
    if (!current || current.status !== 'active' || current.version !== GUIDE_VERSION) return;
    const profile = getTourProfile(current.profileKey);
    const step = profile?.steps?.[current.stepIndex];
    const mission = getMission(profile, step?.missionId);
    // Mission essentielle : jamais de « Passer » (règle 3 du pack).
    if (!mission || mission.locked) return;
    const skipped = {
      ...current,
      missionStatus: { ...(current.missionStatus || {}), [mission.id]: 'skipped' },
    };
    enterGuideStep(
      skipped,
      firstIndexOfNextMission(profile, current.stepIndex, guideContext(skipped)),
    );
  }, [enterGuideStep]);

  // Succès d'une étape : message ✓ dans le bandeau, puis navigation vers la suivante.
  const completeCurrentStep = useCallback((/** @type {{ skipped?: boolean }} */ options = {}) => {
    const { current } = tourStateRef;
    if (!current || current.status !== 'active') return;
    const profile = getTourProfile(current.profileKey);
    const step = profile?.steps?.[current.stepIndex];
    if (!step) return;

    if (isGuideProfile(profile)) {
      if (options.skipped) {
        skipMission();
        return;
      }
      // Bouton de la bulle (« Compris », « C'est parti », « Continuer »).
      applyGuideMatch(current, {
        completes: Boolean(step.completesMission),
        index: nextAvailableIndex(profile, current.stepIndex, guideContext(current)),
      });
      return;
    }

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
        // D23 (defaut ⑥ de la recette du 07/08 : « a la fin du tour guide je me
        // suis retrouve bloque dans les onglets rechercher sans pouvoir aller a
        // l'accueil »). Le tour s'eteignait SUR PLACE, en laissant
        // l'utilisateur sur l'ecran de la derniere etape — et surtout en
        // laissant l'onglet « Accueil » gare sur le hub de recherche, qui s'y
        // empile (`SearchStack`). On raccompagne donc a l'accueil : `navigate`
        // vers un ecran deja empile y revient en DEPILANT.
        navigateToTarget(TOUR_HOME_TARGET, { userData });
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
  }, [applyGuideMatch, goToStep, persist, skipMission, userData]);

  // Guide : fin (palier « Plus tard » ou clôture) ⇒ retour à l'accueil.
  const finishGuide = useCallback((/** @type {{ later?: boolean }} */ options = {}) => {
    const { current } = tourStateRef;
    if (!current || current.version !== GUIDE_VERSION) return;
    if (options.later && userId) {
      const profile = getTourProfile(current.profileKey);
      const left = (profile?.missions || [])
        .filter((/** @type {any} */ mission) => !mission.locked
          && !current.missionStatus?.[mission.id])
        .map((/** @type {any} */ mission) => mission.id);
      storage.set(getBonusLaterKey(userId), JSON.stringify(left));
    }
    finishTour();
    // GUIDE-BONUS (L5) : en DÉPILANT, la compo d'exemple et sa feuille « Publier la
    // compo ? » sortent de la pile (audit, captures 64-67).
    navigateToTarget(TOUR_HOME_TARGET, { userData }, { pop: true });
  }, [finishTour, userData, userId]);

  // Guide : « Quitter » met en PAUSE (question ouverte n° 2, reco du pack) ;
  // la progression reste, « Reprendre le tour » revient à l'étape.
  const pauseTour = useCallback(() => {
    const { current } = tourStateRef;
    if (!current) return;
    clearSuccessTimer();
    setTourState({ ...current, reward: null, status: 'paused' });
  }, []);

  const resumeTour = useCallback((/** @type {{ pop?: boolean }} */ options = {}) => {
    const { current } = tourStateRef;
    const profile = getTourProfile(current?.profileKey);
    // Guide : « Reprendre là où j'en étais » (Mon compte) vaut aussi en cours.
    const resumable = current?.status === 'paused'
      || (isGuideProfile(profile) && current?.status === 'active');
    if (!current || !resumable) return;
    if (isGuideProfile(profile)) {
      // Après un relancement de l'app, une étape au milieu d'un tunnel reprend
      // au début du tunnel (le brouillon est perdu) : `resumeFrom`. Une pause
      // dans la même séance revient à l'étape en pause (décision du chef, 27/10).
      const step = profile.steps[current.stepIndex];
      const resumeIndex = current.restored && step?.resumeFrom
        ? indexOfStep(profile, step.resumeFrom)
        : -1;
      const index = resumeIndex === -1 ? current.stepIndex : resumeIndex;
      const nextState = {
        ...current, restored: false, status: 'active', stepIndex: index,
      };
      historyRef.current = [{ index, route: null, stepRoute: current.stepRoute || null }];
      setTourState(nextState);
      persist(nextState);
      // Depuis Mon compte, on revient en dépilant (comme `startTour`).
      navigateToTarget(
        profile.steps[index]?.navTarget,
        { userData },
        options.pop ? { pop: true } : undefined,
      );
      return;
    }
    const nextState = { ...current, status: 'active' };
    setTourState(nextState);
    goToStep(nextState, nextState.stepIndex);
  }, [goToStep, persist, userData]);

  const exitTour = useCallback(() => {
    finishTour();
  }, [finishTour]);

  // GUIDE-RECUL (audit du 28/10, capture 25) : retour arrière vers un écran où
  // une étape de la mission s'est ouverte ⇒ cette étape revient, au lieu de la
  // bulle de l'étape suivante posée sur l'écran d'avant.
  const stepBack = useCallback((/** @type {any} */ current, /** @type {string} */ routeKey) => {
    const history = historyRef.current;
    const top = history[history.length - 1];
    if (!top || top.index !== current.stepIndex) return;
    // Écran de l'étape encore inconnu (départ, reprise) : c'est le premier vu.
    if (!top.route) top.route = routeKey;
    if (top.route === routeKey) return;
    let at = history.length - 2;
    while (at >= 0 && history[at].route !== routeKey) at -= 1;
    if (at < 0) return;
    const entry = history[at];
    historyRef.current = history.slice(0, at + 1);
    const back = {
      ...current, reward: null, stepIndex: entry.index, stepRoute: entry.stepRoute,
    };
    setTourState(back);
    persist(back);
  }, [persist]);

  // Validation automatique : signaux métier du bus guidance (event.created, etc.).
  useEffect(() => {
    const unsubscribe = subscribeToGuidanceSignals((/** @type {any} */ signal) => {
      if (signal?.kind === 'route') lastRouteRef.current = signal.key;
      const { current } = tourStateRef;
      if (!current || current.status !== 'active') return;
      const profile = getTourProfile(current.profileKey);
      const step = profile?.steps?.[current.stepIndex];
      if (isGuideProfile(profile) && current.review) return;
      if (isGuideProfile(profile) && signal?.kind === 'refusal') {
        const mission = getMission(profile, step?.missionId);
        const refusals = /** @type {any} */ (mission)?.refusals;
        if (!mission?.locked || !refusals || !(signal.key in refusals)) return;
        setTourState({
          ...current,
          blocked: { key: signal.key, reason: signal.reason || refusals[signal.key] },
        });
        return;
      }
      if (isGuideProfile(profile)) {
        const match = matchSignal(profile, current.stepIndex, signal, guideContext(current));
        if (!match) {
          if (signal?.kind === 'route') stepBack(current, signal.key);
          return;
        }
        const withCreated = signal.kind === 'action'
          ? {
            ...current,
            created: { ...(current.created || {}), [signal.key]: signalMeta(signal) },
          }
          : current;
        applyGuideMatch(withCreated, match);
        return;
      }
      if (!step || step.success?.type === 'manual') return;
      if (signal?.kind === step.success?.type && signal?.key === step.success?.key) {
        completeCurrentStep();
      }
    });
    return unsubscribe;
  }, [applyGuideMatch, completeCurrentStep, stepBack]);

  useEffect(() => () => clearSuccessTimer(), []);

  const profile = getTourProfile(tourState?.profileKey);
  const currentStep = profile?.steps?.[tourState?.stepIndex] || null;
  const isGuide = isGuideProfile(profile);
  const currentMission = isGuide ? getMission(profile, currentStep?.missionId) : null;

  const value = useMemo(() => ({
    blocked: tourState?.blocked || null,
    completeCurrentStep,
    created: tourState?.created || {},
    currentMission,
    currentStep,
    dismissBlocked,
    exitTour,
    finishGuide,
    flags: tourState?.flags || {},
    gauge: Number(tourState?.gauge || 0),
    hasGuideHistory: guideDone,
    isGuide,
    isLockedStep: Boolean(currentMission?.locked),
    isReview: Boolean(tourState?.review),
    isTourActive: Boolean(tourState),
    missionPosition: isGuide ? missionPosition(profile, currentStep?.missionId) : null,
    missions: isGuide ? profile.missions : [],
    missionStatus: tourState?.missionStatus || {},
    pauseTour,
    profileKey: tourState?.profileKey || null,
    resumeTour,
    reward: tourState?.reward || null,
    skipBlockedMission,
    skipMission,
    startTour,
    stepIndex: Number(tourState?.stepIndex || 0),
    stepRoute: tourState?.stepRoute || null,
    totalSteps: profile?.steps?.length || 0,
    tourStatus: tourState?.status || null,
  }), [
    completeCurrentStep,
    currentMission,
    currentStep,
    dismissBlocked,
    exitTour,
    finishGuide,
    guideDone,
    isGuide,
    pauseTour,
    profile,
    resumeTour,
    skipBlockedMission,
    skipMission,
    startTour,
    tourState,
  ]);

  return (
    <TourContext.Provider value={value}>
      {children}
    </TourContext.Provider>
  );
}

export { useTour };
