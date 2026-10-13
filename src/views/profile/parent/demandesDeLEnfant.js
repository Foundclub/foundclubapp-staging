/**
 * PAR-L5L6 (13/10, design parent E04 et E07) — CE QUE LES DEMANDES DISENT D UN ENFANT.
 *
 * Une seule lecture sert « Mes enfants » et la fiche : `GET /club-interest-requests/mine`
 * avec `includeChildRequests` et `includeHistory`, SANS club (la route l accepte). Le serveur
 * rend les demandes du parent ; celles d un enfant portent `declaredChild` (son identifiant et
 * son prenom, rien de plus). Ce fichier ne touche ni le reseau ni un ecran : il repond a des
 * questions, et un temoin le lit sans rien monter.
 *
 * 🧾 Ce que le serveur ecrit (admin `club-interest-request.ts`, `decideChildInterestRequest`) :
 *   · en attente  : `status: 'pending'` ;
 *   · acceptee    : `status: 'responded'` + `presetKey: 'child_accepted'` + `respondedAt` —
 *                   et l equipe passe SUR LA FICHE de l enfant ;
 *   · refusee     : la demande est EFFACEE (il n en reste rien a lire).
 */

/** La marque d une demande d enfant ACCEPTEE (meme chaine que le serveur). */
export const CHILD_ACCEPTED_PRESET_KEY = 'child_accepted';

/**
 * L identifiant d une valeur peuplee, ou rien.
 * @param {any} valeur - Une entite (`{ documentId }`) ou rien.
 * @returns {string} - L identifiant, ou une chaine vide.
 */
const idDe = (valeur) => String(valeur?.documentId || '').trim();

/**
 * Le moment d une demande, pour les trier (la plus recente d abord).
 * @param {any} demande - La demande.
 * @returns {number} - L instant, 0 si illisible.
 */
const instantDe = (demande) => {
  const instant = Date.parse(String(demande?.respondedAt || demande?.createdAt || ''));
  return Number.isFinite(instant) ? instant : 0;
};

/**
 * Les demandes de CET enfant, la plus recente d abord.
 * @param {string} enfantId - Le `documentId` de la fiche.
 * @param {any} lignes - Les demandes lues (`data` de la reponse), ou rien.
 * @returns {any[]} - Ses demandes ; aucune si l enfant ou la liste manque.
 */
export const demandesDe = (enfantId, lignes) => {
  const id = String(enfantId || '').trim();
  if (!id || !Array.isArray(lignes)) return [];
  return lignes
    .filter((demande) => idDe(demande?.declaredChild) === id)
    .sort((a, b) => instantDe(b) - instantDe(a));
};

/**
 * Les demandes encore EN ATTENTE.
 * @param {any[]} demandes - Les demandes d un enfant.
 * @returns {any[]} - Celles qui attendent une reponse.
 */
export const enAttente = (demandes) => (Array.isArray(demandes) ? demandes : [])
  .filter((demande) => demande?.status === 'pending');

/**
 * La demande ACCEPTEE qui a mis l enfant dans CETTE equipe, s il y en a une.
 * @param {any[]} demandes - Les demandes d un enfant.
 * @param {string} equipeId - L equipe de sa fiche.
 * @returns {any | null} - La demande acceptee, ou rien.
 */
export const acceptationPour = (demandes, equipeId) => {
  const id = String(equipeId || '').trim();
  if (!id) return null;
  return (Array.isArray(demandes) ? demandes : []).find((demande) => (
    demande?.status === 'responded'
    && demande?.presetKey === CHILD_ACCEPTED_PRESET_KEY
    && idDe(demande?.team) === id
  )) || null;
};

/**
 * Le club d une demande : celui de son equipe, a defaut celui de la demande.
 * @param {any} demande - La demande.
 * @returns {string} - Le nom du club, ou une chaine vide.
 */
export const clubDeLaDemande = (demande) => String(
  demande?.team?.club?.name || demande?.club?.name || '',
).trim();

/**
 * 🚦 L ETAT D UN ENFANT, celui que dit sa pastille dans « Mes enfants » (E04).
 *
 * Dans cet ordre, et c est voulu : une equipe sur la fiche prime (c est ce qui est VRAI
 * aujourd hui) ; puis une demande qui attend ; sinon, pas encore d equipe.
 * @param {any} enfant - La fiche (`GET /declared-children/mine`).
 * @param {any[]} demandes - Ses demandes (`demandesDe`).
 * @returns {{ ton: 'ok' | 'attente' | 'neutre', club: string, equipes: string[],
 *   enAttente: number }} - Le ton de la pastille, et le club et l equipe a nommer.
 */
export const etatDeLEnfant = (enfant, demandes) => {
  const equipe = String(enfant?.team?.name || '').trim();
  if (idDe(enfant?.team) || equipe) {
    const acceptee = acceptationPour(demandes, idDe(enfant?.team));
    return {
      club: String(enfant?.club?.name || '').trim() || clubDeLaDemande(acceptee),
      enAttente: 0,
      equipes: equipe ? [equipe] : [],
      ton: 'ok',
    };
  }
  const attente = enAttente(demandes);
  if (attente.length > 0) {
    // Une seule demande : on la nomme. Plusieurs : le nombre suffit, la fiche les detaille.
    const seule = attente.length === 1 ? attente[0] : null;
    const equipeDemandee = String(seule?.team?.name || '').trim();
    return {
      club: seule ? clubDeLaDemande(seule) : '',
      enAttente: attente.length,
      equipes: equipeDemandee ? [equipeDemandee] : [],
      ton: 'attente',
    };
  }
  return {
    club: '', enAttente: 0, equipes: [], ton: 'neutre',
  };
};
