/**
 * AFFIL A2/A3 — CE QUE DIT LA FENETRE QUAND LA DEMANDE EST PARTIE.
 *
 * Recette d Adel, le 2026-08-28 : « Je n ai meme pas eu de pop-up de
 * felicitation, ca m a juste passe a l etape suivante, et sur mon profil je ne
 * suis toujours pas affilie. »
 *
 * 🎯 TROIS ISSUES, TROIS PHRASES — et jusqu ici elles etaient INDISCERNABLES a
 * l ecran. Envoyer une demande qui attend un dirigeant, envoyer une demande qui
 * part en verification, et DEVENIR dirigeant sur-le-champ ne sont pas la meme
 * chose ; l app les traitait pareil, et depuis l onboarding elle n en disait
 * aucune.
 *
 * ⛔ AUCUN TEXTE EN DUR ICI : chaque phrase est une clef de `fr.js`, et le repli
 * passe par `defaultValue` — le motif deja tenu par `clubAffiliationRefusal.js`,
 * dont ce fichier est le miroir cote succes.
 *
 * ---------------------------------------------------------------------------
 * 🔑 LA PHRASE DU SERVEUR GAGNE, ET CE N EST PAS ARBITRAIRE
 * ---------------------------------------------------------------------------
 * Le serveur renvoie deja `meta.affiliation` depuis U03/D3
 * (`club-membership-request.ts`) : `outcome`, `clubName`, et une phrase
 * francaise. Il est le SEUL a savoir ce qui s est reellement passe — c est lui
 * qui a compte les dirigeants vivants et decide d affilier ou non. Deviner
 * par-dessus lui, c est exactement ce que faisait l ecran avant ce lot :
 * `ClubDetails.js` comparait le club du profil RE-LU au club regarde pour
 * deduire un « joinedImmediately ». Une deduction qui depend d un
 * rafraichissement est fausse des que ce rafraichissement est lent.
 *
 * ⚠️ LE REPLI N INVENTE PAS D ISSUE. Sans enveloppe, on ne pretend pas savoir si
 * la personne est affiliee : on dit que la demande est partie. Une felicitation
 * fausse est pire que pas de felicitation.
 */

/** Une issue, un titre, une phrase. `unknown` est le repli. */
const RESULTAT_PAR_ISSUE = /** @type {const} */ ({
  auto_affiliated: {
    messageFallback: 'Tu es maintenant dirigeant de {{club}}.',
    messageKey: 'clubDetails.affiliation.autoAffiliated.description',
    titleFallback: 'C’est fait !',
    titleKey: 'clubDetails.affiliation.autoAffiliated.title',
  },
  pending_admin_review: {
    messageFallback: 'Ta demande de gestion de {{club}} est partie.'
      + ' Tu n’es pas encore dirigeant : un administrateur FoundClub doit la valider.',
    messageKey: 'clubDetails.affiliation.pendingAdminReview.description',
    titleFallback: 'Demande envoyée',
    titleKey: 'clubDetails.affiliation.pendingAdminReview.title',
  },
  pending_manager_review: {
    messageFallback: 'Ta demande est partie. Un dirigeant de {{club}} doit la valider.',
    messageKey: 'clubDetails.affiliation.pendingManagerReview.description',
    titleFallback: 'Demande envoyée',
    titleKey: 'clubDetails.affiliation.pendingManagerReview.title',
  },
  unknown: {
    messageFallback: 'Ta demande est partie.',
    messageKey: 'clubDetails.affiliation.unknown.description',
    titleFallback: 'Demande envoyée',
    titleKey: 'clubDetails.affiliation.unknown.title',
  },
});

/** Les issues que le serveur sait nommer. Toute autre valeur retombe sur `unknown`. */
const ISSUES_CONNUES = Object.keys(RESULTAT_PAR_ISSUE);

/**
 * L enveloppe `meta.affiliation`, ou `null`.
 *
 * ⚠️ Elle voyage dans `meta` et non dans `data` : `transformResponse(entity, meta)`
 * de Strapi range son second argument la. Le service de l app rend le corps
 * complet (`response.data`), donc l enveloppe arrive telle quelle.
 * @param {any} reponse - Ce que la mutation a resolu.
 * @returns {any} L enveloppe, ou `null`.
 */
export const extractAffiliationEnvelope = (reponse) => {
  const enveloppe = reponse?.meta?.affiliation || reponse?.affiliation || null;
  return (enveloppe && typeof enveloppe === 'object') ? enveloppe : null;
};

/**
 * La personne vient-elle d etre rattachee au club, pour de vrai ?
 *
 * 🔒 Une seule source : l issue nommee par le serveur. C est ce drapeau qui
 * remplace la deduction « le club du profil re-lu est-il celui-ci ».
 * @param {any} reponse - Ce que la mutation a resolu.
 * @returns {boolean} `true` si le serveur a affilie d office.
 */
export const isAutoAffiliated = (reponse) => (
  extractAffiliationEnvelope(reponse)?.outcome === 'auto_affiliated'
);

/**
 * Le titre et la phrase a afficher apres une demande d affiliation reussie.
 * @param {any} reponse - Ce que la mutation a resolu.
 * @param {(cle: string, options?: any) => string} t - Le traducteur de l ecran.
 * @param {{ clubName?: string }} [contexte] - Le nom du club, quand l ecran le connait.
 * @returns {{ message: string, outcome: string, title: string }} Quoi afficher.
 */
export const resolveClubAffiliationOutcome = (reponse, t, contexte = {}) => {
  const enveloppe = extractAffiliationEnvelope(reponse);
  const issueBrute = String(enveloppe?.outcome || '').trim();
  const issue = ISSUES_CONNUES.includes(issueBrute) ? issueBrute : 'unknown';
  const modele = RESULTAT_PAR_ISSUE[/** @type {keyof typeof RESULTAT_PAR_ISSUE} */ (issue)];

  const nomDuClub = String(
    enveloppe?.clubName || contexte?.clubName || '',
  ).trim() || 'ce club';

  // La phrase du serveur d abord : elle est ecrite au plus pres de ce qui vient
  // de se passer. Le repli traduit ne sert que lorsqu il n y en a aucune.
  const phraseDuServeur = String(enveloppe?.message || '').trim();

  return {
    message: phraseDuServeur || t(modele.messageKey, {
      club: nomDuClub,
      defaultValue: modele.messageFallback,
    }),
    outcome: issue,
    title: t(modele.titleKey, { defaultValue: modele.titleFallback }),
  };
};

export default resolveClubAffiliationOutcome;
