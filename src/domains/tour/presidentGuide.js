import { homeTarget } from '@/domains/tour/guideCommon';
import { B1_MISSION, B1_STEPS } from '@/domains/tour/presidentBonusDues';
import { B2_STEPS, B3_STEPS, BONUS_MESSAGES_MISSIONS } from '@/domains/tour/presidentBonusMessages';
import { B4_MISSION, B4_STEPS } from '@/domains/tour/presidentBonusRecruit';
import { B5_MISSION, B5_STEPS } from '@/domains/tour/presidentBonusSearch';
import { PRESIDENT_GUIDE_SETTINGS } from '@/domains/tour/presidentGuideSettings';
import { M1_MISSION, M1_STEPS } from '@/domains/tour/presidentM1';
import { M2M3_MISSIONS, M2M3_STEPS } from '@/domains/tour/presidentM2M3';
import { M4_MISSIONS, M4_STEPS } from '@/domains/tour/presidentM4';
import t from '@/domains/tour/presidentText';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

import { RouteNames } from '@/navigation/routeNames';

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

/**
 * Repli français de l'écran plein cadre, clé par clé (sous `tourCatalog.president`) : sans lui, une
 * clé absente de `fr.js` y dirait le texte de l'entraîneur. Témoin : TourFullScreen.presidentL5.
 */
const FULL_SCREEN_TEXTS = {
  'close.bonus': 'BONUS',
  'close.cta': "Aller à l'accueil",
  // GUIDE-D-CORR TG-23 (r87) : le SMS d'invitation de M2, lui, est réellement parti.
  'close.example': 'Les exemples du guide sont effacés.',
  'close.footer': 'Retrouve ce guide dans Mon compte › Guide dirigeant·e.',
  'close.offer': 'Voir l’offre Club',
  'close.real': 'RÉEL',
  'close.skipped': 'PASSÉ',
  'close.subtitle': 'Bonne saison !',
  'close.title': 'Ton club est prêt',
  'close.titlePartial': 'Le guide est fini',
  kicker: 'Guide dirigeant·e',
  'open.cta': "C'est parti",
  'open.gauge': '{{count}} missions pour le mettre en route. Chacune fait monter ta jauge de 25 %.',
  'open.later': 'Plus tard',
  'open.note': 'Ce que tu crées est réel. Les exemples sont marqués « Exemple » et ne laissent '
    + "rien. Je t'accompagne à chaque étape.",
  'open.noteWithClub': 'Ce que tu crées est réel. Les exemples sont marqués « Exemple » et ne '
    + "laissent rien. Je t'accompagne à chaque étape.",
  'open.title': 'Salut{{name}}, ton club est créé.',
  'palier.blocked': 'Plus tard',
  'palier.bonus': '{{count}} missions bonus pour aller plus loin',
  'palier.continue': 'Continuer',
  'palier.later': 'Plus tard',
  'palier.laterHint': 'Plus tard ? Les bonus t’attendent dans Mon compte › Guide dirigeant·e.',
  'palier.skipped': 'Passée',
  'palier.subtitle': '{{count}} missions sur {{count}}, l’essentiel est fait.',
  'palier.subtitlePartial': '{{done}} missions sur {{total}} : les autres attendent que l’app te '
    + 'le permette.',
  'palier.title': 'Ton club est prêt à 100 %',
  'palier.titleNone': 'Aucune mission faite pour l’instant',
  'palier.titlePartial': 'Une partie est faite',
};

export const PRESIDENT_GUIDE = Object.freeze({
  accountLabelKey: 'profile.actions.presidentGuide',
  get bonusDetail() {
    return t('bonusDetail', 'Cotisation, canal, groupe, recrutement, recherche');
  },
  bonusFromMission: B1_MISSION.id,
  /**
   * Situation au départ, figée pour tout le guide.
   * @param {{ subscriptionAccessLevel?: string; userData: any }} context - Personne connectée.
   * @returns {{ firstName: string; hasClubPlan: boolean }} Drapeaux. `hasClubPlan` : l'offre Club
   *   (ou le cadeau de bienvenue) ouvre ce club ; sinon M2 est montré, pas joué.
   */
  buildFlags: ({ subscriptionAccessLevel, userData }) => ({
    firstName: String(userData?.firstname || userData?.firstName || ''),
    hasClubPlan: !PRESIDENT_GUIDE_SETTINGS.visitWithoutClubPlan
      || String(subscriptionAccessLevel || '').startsWith('CLUB'),
  }),
  canStart,
  /**
   * Bilan de la clôture : ce qui existe pour de vrai grâce au guide, rien d'autre (un refus, une
   * partie passée ou une visite n'y figurent pas).
   * @param {(key: string, ...args: any[]) => string} text - `t` de l'écran.
   * @param {{ created?: any }} state - Ce qui a été créé.
   * @returns {string[]} Lignes.
   */
  closingLines: (text, { created }) => [
    created?.['club.updated']
      && text('tourCatalog.president.close.club', 'Infos du club enregistrées'),
    created?.['sponsor.created']
      && text('tourCatalog.president.close.partner', 'Partenaire ajouté'),
    created?.['facility.created']
      && text('tourCatalog.president.close.facility', 'Installation créée'),
    created?.['club.poster.shared']
      && text('tourCatalog.president.close.poster', 'Affiche prête à partager'),
    (created?.['staff.invited'] || created?.['staff.linked'])
      && text('tourCatalog.president.close.coach', 'Coach ajouté au club'),
    created?.['team.created']
      && text('tourCatalog.president.close.team', '{{team}} créée', {
        team: created['team.created'].teamName
          || text('tourCatalog.president.close.yourTeam', 'Ton équipe'),
        ...SANS_ECHAPPEMENT,
      }),
    created?.['conversation.group.created'] && !created['conversation.group.created'].simulated
      && text('tourCatalog.president.close.group', 'Groupe créé'),
  ].filter(Boolean),
  /**
   * Décision 5 : coach et partenaire se passent, la jauge va quand même à 100 % ; le bilan dit ce
   * qui reste à faire.
   * @param {(key: string, ...args: any[]) => string} text - `t` de l'écran.
   * @param {string[]} [skipped] - Les parties passées.
   * @param {any} [created] - Ce qui existe : une partie passée APRÈS avoir été faite (rejouée
   *   après un retour, TG-06) n'est plus « à faire ».
   * @returns {string[]} Lignes.
   */
  closingTodoLines: (text, skipped = [], created = {}) => /** @type {string[]} */ ([
    skipped.includes('coach') && !created?.['staff.invited'] && !created?.['staff.linked']
      && text('tourCatalog.president.close.todoCoach', 'À faire : ton coach'),
    skipped.includes('partners') && !created?.['sponsor.created']
      && !created?.['sponsor.existing']
      && text('tourCatalog.president.close.todoPartner', 'À faire : ton partenaire'),
  ].filter(Boolean)),
  /**
   * Décision 1 : sans droit ouvert, l'achat est proposé en fin de guide ; rien n'est forcé.
   * @param {{ hasClubPlan?: boolean }} [flags] - Situation au départ.
   * @returns {string | null} L'écran de l'offre, ou rien.
   */
  closingOfferRoute: (flags) => (flags?.hasClubPlan ? null : RouteNames.GuideOffersRecap),
  // La demande d'exemple de M4 : la clôture dit qu'elle n'a rien laissé.
  exampleMissionId: 'president_m4',
  fullScreenTexts: FULL_SCREEN_TEXTS,
  gaugeLabel: 'Club prêt',
  gaugeLabelKey: 'tourGuide.ringLabelClub',
  gaugeSpokenKey: 'tourGuide.clubReady',
  /**
   * Vrai si cette fin d'inscription ouvre droit à la proposition du guide (décision 3).
   * @param {string | null | undefined} completedAt - `onboardingCompletedAt` du profil.
   * @returns {boolean} Vrai à partir de la sortie du guide ; faux tant qu'elle n'est pas datée.
   */
  isOfferDate: (completedAt) => Boolean(PRESIDENT_GUIDE_SETTINGS.offerSince)
    && Date.parse(String(completedAt)) >= Number(PRESIDENT_GUIDE_SETTINGS.offerSince),
  keyMissionId: 'president_m1',
  get kicker() { return t('kicker', 'Guide dirigeant·e'); },
  missions: [
    M1_MISSION,
    ...M2M3_MISSIONS,
    ...M4_MISSIONS,
    B1_MISSION,
    BONUS_MESSAGES_MISSIONS.b2,
    BONUS_MESSAGES_MISSIONS.b3,
    B4_MISSION,
    B5_MISSION,
  ],
  offerMessageKey: 'tourGuide.offer.messagePresident',
  preStartSignals: ['club.created'],
  // « Prêt à 100 % » : les 4 missions, pas la seule M1.
  readyNeedsAllMissions: true,
  steps: [
    { id: 'open', kind: 'opening', navTarget: homeTarget },
    ...M1_STEPS,
    ...M2M3_STEPS,
    ...M4_STEPS,
    { id: 'palier', kind: 'milestone' },
    ...B1_STEPS,
    ...B2_STEPS,
    ...B3_STEPS,
    ...B4_STEPS,
    ...B5_STEPS,
    { id: 'close', kind: 'closing' },
  ],
  version: 3,
});

export default PRESIDENT_GUIDE;
