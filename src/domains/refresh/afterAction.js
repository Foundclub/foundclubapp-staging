import { createLogger } from '@/utils/logger/logger';

/**
 * T08 — LE SEUL ENDROIT OU SE DECLARE « CE QUI DEVIENT FAUX APRES UNE ACTION ».
 *
 * POURQUOI CE MODULE EXISTE — mesure du 2026-08-17 sur `staging` (897afc6) :
 * l'app compte **459 appels a `invalidateQueries` hors tests**, dont **452
 * ecrivent leur cle A LA MAIN**. Une racine recopiee dans 45 ecrans diverge le
 * jour ou l'un d'eux bouge, et **rien ne le voit** : `invalidateQueries` sur une
 * cle qui n'existe pas ne leve aucune erreur, elle ne fait simplement RIEN.
 *
 * Le defaut ressenti n'est pas « ca n'affiche pas », c'est « ca affiche
 * l'ANCIEN » — et c'est pire : un ecran vide dit « attends », un ecran perime
 * dit une contre-verite. Quelqu'un qui vient de rejoindre une equipe et qui ne
 * la voit pas rejoint une DEUXIEME fois.
 *
 * ⚠️ CE N'EST PAS UN NOUVEAU MECANISME. C'est le motif deja present a trois
 * endroits du depot, sorti des ecrans et declare UNE fois :
 *  · `SUBSCRIPTION_STATE_QUERY_KEYS` (domains/subscription/subscriptionRefresh.js)
 *  · `CACHES_A_RAFRAICHIR`          (views/event/wizard/EventWizardRecap.js)
 *  · `invalidateEventParticipationState()` (views/event/hooks/useEventMutations.js)
 *
 * ⛔ CE MODULE NE S'APPELLE QUE DEPUIS `onSuccess`. Jamais `onSettled`, jamais
 * `onError` : rafraichir apres un echec fait clignoter l'ecran pour rien et
 * laisse croire que quelque chose a change.
 */

const refreshLogger = createLogger('after-action-refresh');

/**
 * ⚠️ `['planning']` EST VOLONTAIREMENT LARGE, et ce n'est pas de la paresse.
 * Le planning pose QUATRE familles de cles :
 * `['planning','personal',…]` (PersonalPlanningContainer) et
 * `['planning','fullscreen','personal'|'club'|'club-shared'|'cm',…]`
 * (PersonalPlanningWeekFullscreen). Invalider `['planning','personal']` — ce que
 * font aujourd'hui 18 appels — laisse donc les vues plein ecran perimees.
 * Le prefixe court les couvre toutes, et il ne deborde sur rien d'autre :
 * aucune autre racine de l'app ne commence par `planning`.
 *
 * Chaque entree est une liste de RACINES. La correspondance de react-query est
 * prefixee : `['event']` couvre `['event', 'evt-1']` sans avoir a citer l'id.
 * @type {Readonly<Record<string, string[][]>>}
 */
export const AFTER_ACTION_CACHES = Object.freeze({
  /**
   * Accepter une demande (equipe, club, evenement, mise en avant). C'est ICI que
   * l'adhesion prend effet — pas a l'envoi de la demande : le serveur force
   * `state: 'pending'` a la creation (admin, team-membership-request.ts:273).
   */
  acceptRequest: [
    ['requestsHub'],
    ['teamMembershipRequests'],
    ['clubMembershipRequests'],
    ['clubInterestRequests'],
    ['pendingEvents'],
    // U05 — LES DEUX RACINES QUI MANQUAIENT, mesurees sur le SEUL ecran qui
    // traite reellement les sept familles de demandes (`RequestsHub`, la
    // fonction `invalidateRequests`) : « a la une » et « installation » y sont
    // acceptees comme les autres. Sans elles, brancher cet ecran sur le module
    // lui RETIRERAIT deux rafraichissements qu'il faisait deja.
    ['pending-featured-requests'],
    ['facility-override-requests'],
    ['teams'],
    ['team'],
    ['events'],
    ['planning'],
    ['home-summary'],
  ],

  /** Repondre present / absent a un evenement. */
  answerEvent: [
    ['event'],
    ['events'],
    ['eventParticipations'],
    ['eventAttendance'],
    ['planning'],
    ['home-summary'],
  ],

  /** Creer un club : l'identite de la personne change (elle devient dirigeante). */
  createClub: [
    ['app-bootstrap'],
    ['get-me'],
    ['clubs'],
    ['club'],
    ['teams'],
    ['home-summary'],
  ],

  /** Creer un evenement. Reprend `CACHES_A_RAFRAICHIR` (EventWizardRecap). */
  createEvent: [
    ['events'],
    ['planning'],
    ['club-planning'],
    ['pending-featured-requests'],
    ['app-bootstrap'],
    ['get-me'],
    ['home-summary'],
  ],

  /** Demander a rejoindre un club. */
  joinClub: [
    ['requestsHub'],
    ['clubMembershipRequests'],
    ['club'],
    ['clubs'],
    ['app-bootstrap'],
    ['get-me'],
    ['home-summary'],
  ],

  /** Rejoindre un evenement (participation, annonce de recrutement). */
  joinEvent: [
    ['event'],
    ['events'],
    ['eventParticipations'],
    ['recruitmentAds'],
    ['myApplications'],
    ['planning'],
    ['home-summary'],
  ],

  /**
   * Demander a rejoindre une equipe.
   *
   * 📌 MESURE QUI NUANCE CETTE ENTREE : l'adhesion ne prend PAS effet ici (le
   * serveur force `pending`), donc en theorie `teams` / `planning` ne bougent
   * pas encore. Ils restent declares parce que le cout est de trois requetes
   * perimees, quand le cout de se tromper est la contre-verite qui fait
   * rejoindre DEUX fois. Le vrai rafraichissement d'adhesion vit dans
   * `acceptRequest`, sur l'appareil qui accepte.
   */
  joinTeam: [
    ['team'],
    ['teams'],
    ['teamMembershipRequests'],
    ['requestsHub'],
    ['planning'],
    ['app-bootstrap'],
    ['get-me'],
    ['home-summary'],
  ],

  /** Quitter une equipe. */
  leaveTeam: [
    ['team'],
    ['teams'],
    ['events'],
    ['planning'],
    ['app-bootstrap'],
    ['get-me'],
    ['home-summary'],
  ],

  /**
   * U05 — L'ACTION QUI N'EXISTAIT PAS, ET C'EST CELLE QU'ADEL DECRIT.
   *
   * « Quand on est accepte, c'est hyper long alors que ca doit etre immediat. »
   * Sur l'appareil de la personne ACCEPTEE, aucune action n'a eu lieu : c'est
   * une notification qui arrive. L'app n'en rafraichissait que la CLOCHE
   * (`useNotifications`, `invalidateNotificationQueries` : deux cles, les
   * notifications et le compteur non-lus). Rien ne relisait l'appartenance.
   *
   * C'est le miroir de `acceptRequest`, avec UNE difference qui compte :
   * ici l'IDENTITE change (`myTeams` / `trainedTeams` / `clubs` gagnent une
   * entree), alors que sur l'appareil qui accepte elle ne bouge pas. D'ou
   * `app-bootstrap` et `get-me`, absents de `acceptRequest`.
   *
   * ⛔ NE SE DECLENCHE QUE SUR LES TYPES D'APPARTENANCE (`teamMembershipRequest`,
   * `clubMembershipRequest`, `addToTeam`). Le brancher sur toutes les
   * notifications ferait payer dix requetes a chaque message de discussion.
   */
  membershipChanged: [
    ['requestsHub'],
    ['teamMembershipRequests'],
    ['clubMembershipRequests'],
    ['teams'],
    ['team'],
    ['events'],
    ['planning'],
    ['app-bootstrap'],
    ['get-me'],
    ['home-summary'],
  ],

  /** Publier une compo / une convocation. */
  publishComposition: [
    ['event'],
    ['events'],
    ['eventComposition'],
    ['eventConvocation'],
    ['home-summary'],
  ],

  /**
   * S'abonner. Les deux memes cles que `SUBSCRIPTION_STATE_QUERY_KEYS`, et
   * c'est deliberement TOUT : l'abonnement ne change que les droits.
   * ⚠️ Pour un achat, passer par `scheduleSubscriptionStateRefresh` — la verite
   * arrive par le webhook du store quelques secondes plus tard, une invalidation
   * immediate relit l'ANCIEN etat et le remet en cache comme frais.
   */
  subscribe: [
    ['app-bootstrap'],
    ['get-me'],
  ],
});

/**
 * U05 — LES SEULS TYPES DE NOTIFICATION QUI CHANGENT L'APPARTENANCE.
 *
 * Les valeurs viennent de `NOTIFICATION_TYPES` (`domains/auth/authUseCases.js`),
 * et le serveur les emet ici :
 *  · `teamMembershipRequest` — reponse a MA demande d'equipe
 *    (admin/src/api/team-membership-request/services/notification.ts:97) ;
 *  · `clubMembershipRequest` — reponse a MA demande de club ;
 *  · `addToTeam` — on m'a ajoute comme encadrant
 *    (admin/src/api/team/services/notification.ts:88).
 *
 * ⛔ `teamRequest` et `clubRequest` n'y sont PAS : ce sont les demandes qui
 * ARRIVENT chez un encadrant. Elles ne changent aucune appartenance, seulement
 * une liste a traiter — et cette liste, `RequestsHub` la relit deja.
 *
 * ⚠️ Pas d'annotation `@type` ici : `Object.freeze` infere `readonly string[]`,
 * et l'ecrire a la main fait tomber la porte des types (TS4104) sans rien
 * apporter — l'inference est deja exacte.
 */
export const MEMBERSHIP_NOTIFICATION_TYPES = Object.freeze([
  'addToTeam',
  'clubMembershipRequest',
  'teamMembershipRequest',
]);

/**
 * Quelle action du module une notification recue rend-elle necessaire ?
 *
 * ⚠️ Rend `''` pour tout le reste, et c'est le coeur de la mesure : la grande
 * majorite des notifications (messages, rappels, convocations) ne change AUCUNE
 * donnee au-dela de la cloche. Les brancher ferait payer dix requetes reseau a
 * chaque notification recue — la lenteur que ce lot doit eviter, pas creer.
 * @param {string} [notificationType] Le type porte par la notification.
 * @returns {string} La cle de `AFTER_ACTION_CACHES`, ou '' s'il n'y a rien a faire.
 */
export const resolveNotificationRefreshAction = (notificationType) => (
  MEMBERSHIP_NOTIFICATION_TYPES.includes(String(notificationType || '').trim())
    ? 'membershipChanged'
    : ''
);

/**
 * Marque perimes les caches devenus faux apres une action reussie.
 *
 * ⚠️ Ne pas attendre le resultat ne perd RIEN : `invalidateQueries` marque les
 * requetes de facon SYNCHRONE, seule la relecture est asynchrone, et le
 * `queryClient` est un singleton qui survit au demontage de l'ecran. Le
 * `Promise.all` n'est la que pour les tests. (Raisonnement mesure le 07/08 sur
 * la creation d'evenement : six invalidations en file indienne coutaient 205 ms
 * d'attente pure, jusqu'a 1,8 s sur reseau reel.)
 * @param {import('@tanstack/react-query').QueryClient} queryClient - Le cache de l'app.
 * @param {string} action - Une cle de `AFTER_ACTION_CACHES`.
 * @returns {Promise<void>}
 */
export const invalidateAfterAction = async (queryClient, action) => {
  const queryKeys = AFTER_ACTION_CACHES[action];

  if (!Array.isArray(queryKeys) || queryKeys.length === 0) {
    // ⛔ ON N'INVALIDE RIEN, et surtout pas tout : `invalidateQueries()` sans
    // filtre perime le cache ENTIER. Une action inconnue est un defaut de
    // cablage, pas une raison de recharger l'application.
    refreshLogger.warn(`[AFTER_ACTION] action inconnue, aucun cache rafraichi : ${action}`);
    return;
  }

  await Promise.all(
    queryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  );
};

export default invalidateAfterAction;
