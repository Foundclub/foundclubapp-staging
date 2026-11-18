import { Platform } from 'react-native';

import { resolveAppSiteOrigin, resolveWebAppOrigin } from '@/utils/shareLinks';

import { LEGAL_TOURNAMENT_TERMS_PATH } from '@/config/legalUrls';
import LinksPlatform from '@/platform/links';

/**
 * T-FINITIONS (16/11, « 3- A ») — « Conditions d'inscription » : la même page publique du site
 * (`/conditions-tournoi`) sur la page de paiement d'une place ET sur la fiche d'un tournoi payant.
 * T-PAGES-6b (18/11) : au téléphone, le site de l'environnement de l'app (l'app de recette ouvrait
 * la production) ; sur le site, celui qui sert la page.
 * Témoin : components/__tests__/tournamentTerms.TPAGES6b.environnement.test.js.
 * @param {{ appEnv?: string, os?: string, webUrl?: string }} [params] - Pour les témoins.
 * @returns {string} L'adresse des conditions.
 */
export const tournamentTermsUrl = ({ appEnv, os = Platform.OS, webUrl } = {}) => {
  const origine = os === 'web'
    ? resolveWebAppOrigin({ webUrl })
    : resolveAppSiteOrigin({ appEnv, webUrl });
  return `${origine}${LEGAL_TOURNAMENT_TERMS_PATH}`;
};

export const TOURNAMENT_TERMS_URL = tournamentTermsUrl();

/**
 * Ouvre les conditions d'inscription. T-PAGES-6b (18/11) : avec l'identifiant du tournoi, la
 * page reçoit `?tournoi=<id>` et « Revenir au tournoi » ramène à sa fiche. Seul un texte ou un
 * nombre est un identifiant : branchée telle quelle sur `onPress`, la fonction reçoit l'événement
 * du toucher, et l'adresse reste celle d'avant.
 * @param {unknown} [eventId] - L'identifiant du tournoi, facultatif.
 * @returns {any}
 */
export const openTournamentTerms = (eventId) => {
  const estUnId = typeof eventId === 'string' || typeof eventId === 'number';
  const id = estUnId ? String(eventId).trim() : '';
  const adresse = tournamentTermsUrl();
  return LinksPlatform.openUrl(id ? `${adresse}?tournoi=${encodeURIComponent(id)}` : adresse);
};

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
