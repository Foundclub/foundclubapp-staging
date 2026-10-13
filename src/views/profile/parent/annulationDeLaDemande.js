import { getErrorStatus, getServerErrorCode } from '@/utils/errors/displayError';

/**
 * PAR-L8 (13/10, design parent E19, planche 8) — CE QUE VEUT DIRE LE REFUS D UNE ANNULATION.
 *
 * Le serveur (admin `club-interest-request.ts`, `cancel`) relit la demande sous le verrou de
 * l enfant, que l acceptation prend aussi (decision d Adel du 12/10 : l acceptation au meme
 * moment GAGNE). Ses refus, et ce que l ecran en dit :
 *   · close, `details.code` = CLUB_INTEREST_REQUEST_ALREADY_RESPONDED :
 *       `accepted: true` → « acceptee » (l enfant est dans l equipe, rien n est annule) ;
 *       sinon            → « repondue » ;
 *   · effacee (refusee, deja annulee), `details.code` = CLUB_INTEREST_REQUEST_GONE → « repondue » ;
 *   · un 404 SANS ce code, ou un 403 : un serveur d AVANT, sans la route ou sans le droit →
 *     « indisponible » (un message clair, jamais un plantage) ;
 *   · le reste (pas de reseau, abandon, panne) → « echec » : on peut reessayer.
 * Aucun texte ici : l ecran choisit la phrase (`myChildren.cancelRequest.*`).
 */

/** Le serveur : la demande est close (le club a repondu). */
export const CODE_DEMANDE_CLOSE = 'CLUB_INTEREST_REQUEST_ALREADY_RESPONDED';
/** Le serveur : la demande n existe plus. */
export const CODE_DEMANDE_DISPARUE = 'CLUB_INTEREST_REQUEST_GONE';

/** @typedef {'acceptee' | 'repondue' | 'indisponible' | 'echec'} SituationDAnnulation */

/**
 * La situation que dit un refus d annulation.
 * @param {any} erreur - L erreur, telle que l intercepteur la rejette (ou la forme axios brute).
 * @returns {SituationDAnnulation} - La situation.
 */
export const situationDeLAnnulation = (erreur) => {
  const code = getServerErrorCode(erreur);
  if (code === CODE_DEMANDE_CLOSE) {
    const details = erreur?.details || erreur?.response?.data?.error?.details;
    return details?.accepted === true ? 'acceptee' : 'repondue';
  }
  if (code === CODE_DEMANDE_DISPARUE) return 'repondue';
  const statut = getErrorStatus(erreur);
  if (statut === 403 || statut === 404) return 'indisponible';
  return 'echec';
};
