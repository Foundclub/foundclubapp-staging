// @ts-nocheck
/**
 * cardConsent — helpers du garde-fou mineurs pour la carte partageable.
 * Destination repo : app/src/domains/playerCard/cardConsent.js
 *
 * Reexporte evaluateMinorGuard (logique pure) et fournit des selecteurs d'UI
 * derives (peut partager / peut telecharger / doit demander le consentement).
 * Le payload de declaration parentale reutilise l'existant
 * (constants/parentalDeclaration.js) via buildCardConsentPayload.
 */
import { evaluateMinorGuard, MINOR_CARD_PUBLISH_AGE } from '@/domains/playerCard/cardModel';

import {
  buildMinorParentalDeclarationPayload,
} from '@/constants/parentalDeclaration';

export { evaluateMinorGuard, MINOR_CARD_PUBLISH_AGE };

/**
 * Etat d'UI du garde-fou pour la carte.
 * @param {object} user userData
 * @param {Date} [now]
 * @returns {{
 *   guard: ReturnType<typeof evaluateMinorGuard>,
 *   canShare: boolean,
 *   canDownload: boolean,
 *   isLockedPreview: boolean,
 *   mustRequestConsent: boolean,
 * }}
 */
export const getCardConsentState = (user = {}, now = new Date()) => {
  const guard = evaluateMinorGuard(user, now);
  const canShare = guard.canPublish;
  return {
    canDownload: canShare,
    canShare,
    guard,
    // Aperçu verrouille = mineur sous le seuil sans consentement.
    isLockedPreview: !canShare,
    mustRequestConsent: guard.requiresConsent && !guard.hasConsent,
  };
};

/**
 * Construit le payload de declaration parentale specifique carte, en reutilisant
 * le builder onboarding existant (scope/hash/version conserves).
 * @param {object} params
 * @param {string} [params.targetDocumentId] documentId du profil enfant
 * @returns {object} payload a envoyer au service de declaration parentale
 */
export const buildCardConsentPayload = ({ targetDocumentId = null } = {}) => (
  buildMinorParentalDeclarationPayload({
    metadata: { feature: 'shareable_card' },
    sourceScreen: 'player_card_consent',
    targetDocumentId,
    targetType: 'user_profile',
  })
);

export default getCardConsentState;
