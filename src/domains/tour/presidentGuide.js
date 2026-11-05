import { homeTarget } from '@/domains/tour/guideCommon';
import { M1_MISSION, M1_STEPS } from '@/domains/tour/presidentM1';
import { M2M3_MISSIONS, M2M3_STEPS } from '@/domains/tour/presidentM2M3';
import { M4_MISSIONS, M4_STEPS } from '@/domains/tour/presidentM4';
import PRESIDENT_GUIDE_SETTINGS from '@/domains/tour/presidentGuideSettings';
import t from '@/domains/tour/presidentText';

/**
 * Guide Dirigeant·e (pack `design_handoff_tutoriels/05_GUIDE_D_DIRIGEANT.md`). Ce fichier assemble
 * les missions ; chacune vit dans son fichier. Quand le pack et l'app diffèrent, l'app a raison.
 *
 * Il s'active par `PRESIDENT_GUIDE_SETTINGS.enabled` : éteint, `tourCatalog` garde le tour v2.
 */

/**
 * Pas de guide pour un dirigeant sans club (décision 2) : revendication ou demande en attente,
 * « Passer ». Il lui est proposé dès qu'il a son club.
 * @param {any} userData - Profil.
 * @returns {boolean} Le guide peut-il partir ?
 */
const canStart = (userData) => Boolean(userData?.club?.documentId);

export const PRESIDENT_GUIDE = Object.freeze({
  accountLabelKey: 'profile.actions.presidentGuide',
  /**
   * Situation au départ, figée pour tout le guide.
   * @param {{ subscriptionAccessLevel?: string; userData: any }} context - Personne connectée.
   * @returns {{ firstName: string; hasClubPlan: boolean }} Drapeaux. `hasClubPlan` : l'offre Club
   *   (ou le cadeau de bienvenue) ouvre ce club ; sinon ②③④ et M2 sont montrés, pas joués.
   */
  buildFlags: ({ subscriptionAccessLevel, userData }) => ({
    firstName: String(userData?.firstname || userData?.firstName || ''),
    hasClubPlan: !PRESIDENT_GUIDE_SETTINGS.visitWithoutClubPlan
      || String(subscriptionAccessLevel || '').startsWith('CLUB'),
  }),
  canStart,
  // Palier et clôture : 2ᵉ session (lot L5).
  closingLines: () => [],
  gaugeLabelKey: 'tourGuide.ringLabelClub',
  gaugeSpokenKey: 'tourGuide.clubReady',
  /**
   * Vrai si cette fin d'inscription ouvre droit à la proposition du guide (décision 3).
   * @param {string | null | undefined} completedAt - `onboardingCompletedAt` du profil.
   * @returns {boolean} Vrai à partir de la sortie du guide ; faux tant qu'elle n'est pas datée.
   */
  isOfferDate: (completedAt) => Boolean(PRESIDENT_GUIDE_SETTINGS.offerSince)
    && Date.parse(String(completedAt)) >= Number(PRESIDENT_GUIDE_SETTINGS.offerSince),
  get kicker() { return t('kicker', 'Guide dirigeant·e'); },
  keyMissionId: 'president_m1',
  missions: [M1_MISSION, ...M2M3_MISSIONS, ...M4_MISSIONS],
  offerMessageKey: 'tourGuide.offer.messagePresident',
  preStartSignals: ['club.created'],
  steps: [
    { id: 'open', kind: 'opening', navTarget: homeTarget },
    ...M1_STEPS,
    ...M2M3_STEPS,
    ...M4_STEPS,
  ],
  version: 3,
});

export default PRESIDENT_GUIDE;
