/**
 * Y04 — CE QUE DIT LA FENETRE QUAND UNE DEMANDE EST ACCEPTEE.
 *
 * Demande d Adel, le 2026-08-19 : « On devrait avoir un pop-up "felicitations,
 * demande acceptee" ADAPTE EN FONCTION DE LA DEMANDE. »
 *
 * 🎯 « Adapte » est tout le sujet. Une phrase unique — « Demande acceptee » —
 * ne dit pas ce qui vient de changer, et c est justement ce qu on veut savoir :
 * accepter une adhesion fait ENTRER quelqu un dans une equipe, accepter une
 * mise a la une PUBLIE un evenement, accepter une exception d installation
 * ACCORDE un creneau. Trois consequences differentes, trois phrases.
 *
 * ⛔ AUCUN TEXTE EN DUR ICI : chaque phrase est une clef de `fr.js`, et le
 * repli passe en second argument de `t` — le motif deja tenu par tout l ecran.
 *
 * ⚠️ CE MODULE NE DECIDE PAS SI L ACTION A REUSSI. Il ne fabrique qu une phrase.
 * L appelant ne l invoque QUE dans le chemin de succes : une felicitation sur un
 * echec est le pire des deux mondes (on croit que c est fait, ca ne l est pas).
 */

/** Les types de demande qui portent une acceptation. `unknown` est le repli. */
const CELEBRATION_BY_TYPE = /** @type {const} */ ({
  club: {
    fallback: '{{name}} rejoint le club.',
    key: 'requestsHub.celebration.club',
  },
  event: {
    fallback: 'La participation est validée.',
    key: 'requestsHub.celebration.event',
  },
  featured: {
    fallback: "L'événement passe à la une.",
    key: 'requestsHub.celebration.featured',
  },
  // D92 — une proposition de match amical ne se tranche pas depuis « Demandes »,
  // elle emmene sur l annonce. La phrase existe quand meme, et c est voulu : la
  // table est la SEULE source de ces textes, et l ecran de l annonce doit
  // pouvoir s y brancher sans reecrire une phrase a lui.
  friendly: {
    fallback: 'Le match est confirmé.',
    key: 'requestsHub.celebration.friendly',
  },
  installation: {
    fallback: 'La place supplémentaire est accordée.',
    key: 'requestsHub.celebration.installation',
  },
  interest: {
    fallback: 'Ta réponse est partie.',
    key: 'requestsHub.celebration.interest',
  },
  team: {
    fallback: "{{name}} rejoint l'équipe.",
    key: 'requestsHub.celebration.team',
  },
  unknown: {
    fallback: 'La demande est acceptée.',
    key: 'requestsHub.celebration.unknown',
  },
});

/**
 * ⚠️ Le nom se remplace A LA MAIN, pas par l interpolation de i18next. Tout
 * l ecran fait deja `.replace('{{name}}', …)` (RequestsHub.js:258, :268) parce
 * que le repli passe en second argument de `t` n est PAS interpole. Ecrire une
 * autre convention ici donnerait « {{name}} rejoint l equipe » a l ecran.
 * @param {string} template La phrase, deja traduite.
 * @param {string} name Le nom a inserer, ou ''.
 * @returns {string}
 */
const fillName = (template, name) => (
  String(template || '').replace('{{name}}', name)
);

/**
 * Le titre et le texte de la fenetre a montrer apres une acceptation reussie.
 * @param {any} item L element de la liste qui vient d etre accepte.
 * @param {(key: string, fallback?: string) => string} t La traduction.
 * @returns {{ message: string, title: string }}
 */
export const buildRequestAcceptanceCelebration = (item, t) => {
  const type = String(item?.type || '').trim();
  const entry = CELEBRATION_BY_TYPE[/** @type {keyof typeof CELEBRATION_BY_TYPE} */ (type)]
    || CELEBRATION_BY_TYPE.unknown;

  // Le repli quand la demande ne nomme personne : « Quelqu un rejoint
  // l equipe » reste vrai, la et ou une chaine vide donnerait « rejoint
  // l equipe ».
  const name = String(item?.meta?.requesterName || '').trim()
    || t('requestsHub.celebration.someone', 'Un nouveau membre');

  return {
    message: fillName(t(entry.key, entry.fallback), name),
    title: t('requestsHub.celebration.title', 'Félicitations'),
  };
};

export default buildRequestAcceptanceCelebration;
