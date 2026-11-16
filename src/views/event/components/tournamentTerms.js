import { buildPublicWebUrl } from '@/utils/shareLinks';

import { LEGAL_TOURNAMENT_TERMS_PATH, LEGAL_TOURNAMENT_TERMS_URL } from '@/config/legalUrls';
import LinksPlatform from '@/platform/links';

// T-FINITIONS (16/11, « 3- A ») — « Conditions d'inscription » : la même page publique du site
// (`/conditions-tournoi`) sur la page de paiement d'une place ET sur la fiche d'un tournoi payant.
export const TOURNAMENT_TERMS_URL = buildPublicWebUrl(
  /** @type {any} */ ({ path: LEGAL_TOURNAMENT_TERMS_PATH }),
) || LEGAL_TOURNAMENT_TERMS_URL;

/**
 * Ouvre les conditions d'inscription.
 * @returns {any}
 */
export const openTournamentTerms = () => LinksPlatform.openUrl(TOURNAMENT_TERMS_URL);

/**
 * Un tournoi est payant par son réglage seul (`tournamentConfig.entryFeeCents`, comme le serveur).
 * @param {any} event
 * @returns {boolean}
 */
export const isPaidTournament = (event) => Number(event?.tournamentConfig?.entryFeeCents) > 0;

/**
 * Le prix d'une place, en euros (`entryFeeCents / 100`) ; null si le tournoi est gratuit.
 * @param {any} event
 * @returns {number | null}
 */
export const tournamentEntryFeeEuros = (event) => (isPaidTournament(event)
  ? Number(event.tournamentConfig.entryFeeCents) / 100
  : null);

/**
 * Le nombre de joueurs payés qui valide une équipe : même lecture que le serveur
 * (admin `tournament-payment.js`, `paidThreshold` : `paidMembersToValidate`, 5 par défaut).
 * @param {any} event
 * @returns {number}
 */
export const tournamentPaidThreshold = (event) => {
  const value = Math.round(Number(event?.tournamentConfig?.paidMembersToValidate));
  return Number.isFinite(value) && value > 0 ? value : 5;
};

/**
 * Le libellé « validation des équipes » d'un tournoi payant en mode manuel ; null sinon.
 * @param {any} event
 * @param {(key: string, fallback: string, options?: any) => string} t
 * @returns {string | null}
 */
export const paidValidationLabel = (event, t) => (
  isPaidTournament(event) && event?.tournamentConfig?.registrationMode !== 'auto'
    ? t('eventDetails.validatedAtPaidPlayer', 'Équipe validée au {{count}}ᵉ joueur payé', {
      count: tournamentPaidThreshold(event),
    })
    : null
);
