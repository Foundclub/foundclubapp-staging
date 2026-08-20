import {
  getApiErrorTranslation,
  getErrorStatus,
  getServerErrorCode,
} from '@/utils/errors/displayError';

/**
 * AB05 — CE QUE DIT LA FENETRE QUAND « C EST MON CLUB » EST REFUSE.
 *
 * Constat d Adel, le 2026-08-20 : « Quand un entraîneur clique sur "c'est mon
 * club", il y a écrit "Accès refusé" sans expliquer pourquoi. Ce n'est pas
 * normal. » Sa capture : une fenetre blanche, deux mots, un bouton OK.
 *
 * 🎯 « Accès refusé » n est pas un motif, c est un STATUT HTTP traduit. Le filet
 * global (`app/queryClient.js`) fabrique cette phrase pour TOUT 403, quel que
 * soit le geste — donc elle ne peut, par construction, rien apprendre a
 * personne. Ce module fait l inverse : une situation, une phrase, et la SORTIE.
 *
 * ⛔ AUCUN TEXTE EN DUR ICI : chaque phrase est une clef de `fr.js`, et le repli
 * passe en second argument de `t` — le motif deja tenu par la table de
 * felicitations du lot Y04 (`requestAcceptanceCelebration.js`), dont ce fichier
 * est le miroir cote refus.
 *
 * ---------------------------------------------------------------------------
 * 🔑 L ORDRE DES DEUX LECTURES, ET IL N EST PAS ARBITRAIRE
 * ---------------------------------------------------------------------------
 * 1. LE CODE DU SERVEUR D ABORD. Quand le serveur nomme lui-meme son refus
 *    (`HAD_PENDING_MEMBERSHIP_REQUEST_POLICY_ERROR`,
 *    `SUBSCRIPTION_PERMISSION_DENIED`…), il en sait plus que nous : sa phrase
 *    existe deja dans `APIerrors` et elle gagne. Deviner par-dessus lui, c est
 *    remplacer « tu as deja une demande en attente » par « tu n as pas de
 *    role » — un mensonge.
 * 2. LE STATUT ENSUITE, et seulement s il n y a aucun code.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ POURQUOI « 403 ⇒ ton compte n a pas de role » EST VRAI ICI, ET MESURE
 * ---------------------------------------------------------------------------
 * Les deux gestes de la fiche club passent par :
 *   · `POST /clubs/:id/claim`            (« Je dirige ce club » / « C'est mon club ! »)
 *   · `POST /club-membership-requests`   (« C'est mon club ! » de l entraineur)
 * Mesure du 2026-08-20 sur `admin` :
 *   · la route `claim` porte `policies: []` (routes/custom-club.ts) et son
 *     controleur ne repond JAMAIS 403 (401, 404, 400 seulement) ;
 *   · la policy de `create` (`had-pending-membership-request`) pose toujours un
 *     CODE sur son refus — donc elle sort en 1, jamais en 2 ;
 *   · au manifeste, le seul role connecte a qui il manque `api::club.club.claim`
 *     et `club-membership-request.create` est `Authenticated`, c est-a-dire un
 *     compte qui n a pas fini son inscription. 40 comptes sur 118 en production.
 * ⇒ Un 403 NU sur ces deux gestes veut dire exactement une chose : pas de role.
 * 🔒 Le temoin 4 de `tests/authz/AB05-droit-dirigeant.test.js` casse le jour ou
 *    l une de ces trois conditions cesse d etre vraie.
 */

/**
 * Une situation, une phrase. `unknown` est le repli — et il ne pretend rien
 * savoir : il dit ce qui s est passe (rien n est parti) et quoi faire.
 */
const REFUS_PAR_SITUATION = /** @type {const} */ ({
  alreadyAsked: {
    fallback: 'Tu as déjà demandé ce club. Un administrateur FoundClub est en train de regarder ta demande.',
    key: 'clubDetails.refusal.alreadyAsked',
  },
  clubGone: {
    fallback: 'Ce club n’existe plus. Reviens à la recherche pour en trouver un autre.',
    key: 'clubDetails.refusal.clubGone',
  },
  noRole: {
    fallback: 'Ton compte n’a pas encore de rôle. Termine ton inscription pour pouvoir dire qu’un club est le tien.',
    key: 'clubDetails.refusal.noRole',
  },
  sessionExpired: {
    fallback: 'Ta session a expiré. Reconnecte-toi, puis renvoie ta demande.',
    key: 'clubDetails.refusal.sessionExpired',
  },
  unknown: {
    fallback: 'Ta demande n’est pas partie. Réessaie dans un instant.',
    key: 'clubDetails.refusal.unknown',
  },
});

/** Le serveur dit « You already have a pending claim request » (club.ts:654). */
const DEJA_DEMANDE = /already have a pending claim/i;

/**
 * La situation, deduite du seul statut HTTP. N est consultee QUE lorsque le
 * serveur n a envoye aucun code.
 * @param {number | null} status Le statut HTTP.
 * @param {string} message Le message brut du serveur, en anglais.
 * @returns {keyof typeof REFUS_PAR_SITUATION} La situation.
 */
const situationDuStatut = (status, message) => {
  if (status === 401) return 'sessionExpired';
  if (status === 403) return 'noRole';
  if (status === 404) return 'clubGone';
  if (status === 400 && DEJA_DEMANDE.test(message)) return 'alreadyAsked';
  return 'unknown';
};

/**
 * La phrase a montrer quand « c est mon club » est refuse.
 * @param {any} error L erreur, telle que l intercepteur la rejette.
 * @param {(key: string, fallback?: string) => string} t La traduction.
 * @returns {{ message: string, situation: string }} La phrase et sa situation.
 */
export const resolveClubAffiliationRefusal = (error, t) => {
  // 1. Le serveur a nomme son refus : sa phrase est plus precise que la notre.
  //    ⚠️ On lui passe le CODE SEUL, jamais l erreur entiere : avec le statut,
  //    `getApiErrorTranslation` retomberait sur « Accès refusé. » — exactement
  //    le mur que ce module existe pour retirer.
  const code = getServerErrorCode(error);
  const phraseDuServeur = code ? getApiErrorTranslation({ details: { code } }) : '';
  if (phraseDuServeur) {
    return { message: phraseDuServeur, situation: `serverCode:${code}` };
  }

  // 2. Aucun code : on lit le statut, et on nomme ce qu il veut dire ICI.
  const situation = situationDuStatut(
    getErrorStatus(error),
    String(error?.message || ''),
  );
  const entree = REFUS_PAR_SITUATION[situation];

  return { message: t(entree.key, entree.fallback), situation };
};

export default resolveClubAffiliationRefusal;
