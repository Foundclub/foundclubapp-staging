import AsyncStorage from '@react-native-async-storage/async-storage';

import client from '@/services/client';

// Cache catalogue persistant (handoff item 14) : le paywall affiche les prix
// immediatement meme hors ligne, avec le dernier catalogue connu.
const SUBSCRIPTION_CATALOG_CACHE_KEY = 'fc:subscription-catalog:v1';

/**
 * @param {import('axios').AxiosResponse<any>} response
 * @returns {any}
 */
const getResponsePayload = (response) => response?.data || null;

/**
 * Jalon du funnel paywall (handoff 12-13). Fire-and-forget : le tracking ne
 * doit jamais bloquer ni casser un flux utilisateur.
 * @param {string} eventName
 * @param {Record<string, any>} [payload]
 * @returns {void}
 */
export const trackSubscriptionFunnelEvent = (eventName, payload = {}) => {
  client.post('/subscriptions/funnel-events', {
    data: {
      ...payload,
      eventName,
    },
  }).catch(() => {});
};

export const getSubscriptionCatalog = async () => {
  try {
    const response = await client.get('/subscriptions/catalog');
    const payload = getResponsePayload(response);
    if (payload) {
      AsyncStorage.setItem(SUBSCRIPTION_CATALOG_CACHE_KEY, JSON.stringify(payload)).catch(() => {});
    }
    return payload;
  } catch (error) {
    const cached = await AsyncStorage.getItem(SUBSCRIPTION_CATALOG_CACHE_KEY).catch(() => null);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (parseError) {
        // cache illisible : on retombe sur l'erreur reseau d'origine
      }
    }
    throw error;
  }
};

/**
 * @param {Record<string, any>} payload
 * @returns {Promise<any>}
 */
export const validateSubscriptionPurchase = async (payload) => {
  const response = await client.post('/subscriptions/purchases/validate', payload);
  return getResponsePayload(response);
};

/**
 * Rail web (Stripe via RevenueCat) : ouverture de la session Stripe Checkout.
 * @param {Record<string, any>} payload
 * @returns {Promise<{ id?: string; url?: string }>}
 */
export const createStripeWebCheckoutSession = async (payload) => {
  const response = await client.post('/subscriptions/stripe/checkout-session', payload);
  return getResponsePayload(response);
};

/**
 * Rail web : au retour de paiement, transmet l'abonnement Stripe a RevenueCat.
 * @param {{ sessionId: string }} payload
 * @returns {Promise<any>}
 */
export const finalizeStripeWebCheckoutSession = async (payload) => {
  const response = await client.post('/subscriptions/stripe/checkout-session/finalize', payload);
  return getResponsePayload(response);
};

/**
 * @param {Record<string, any>} payload
 * @returns {Promise<any>}
 */
export const restoreSubscriptionPurchases = async (payload = {}) => {
  const response = await client.post('/subscriptions/purchases/restore', payload);
  return getResponsePayload(response);
};

/**
 * S12-B/D5 — AUGMENTER LE NOMBRE DE LICENCIES COUVERTS, EN COURS D'ABONNEMENT.
 *
 * Le serveur facture la difference au prorata immediatement (Stripe
 * `proration_behavior: always_invoice`), met a jour le plafond local que lit le
 * portier d'adhesions, puis synchronise RevenueCat pour le prochain
 * renouvellement — dans cet ordre (subscription-stripe.ts:269-315).
 *
 * ⚠️ Il REFUSE toute diminution en v1 : elle prendra effet au renouvellement.
 * L'ecran ne la propose donc pas.
 * @param {{ licenseeCount: number; subscriptionDocumentId: string }} payload
 * @returns {Promise<{
 *   licenseeCount: number;
 *   previousLicenseeCount: number;
 *   status: string;
 * }>} Reponse SUPERSET du contrat (elle porte aussi stripeSubscriptionId et
 *   subscriptionDocumentId) : la lire en `toMatchObject`, jamais en egalite stricte.
 */
export const increaseSubscriptionLicenseeCount = async (payload) => {
  const response = await client.post('/subscriptions/licensee-count/increase', payload);
  return getResponsePayload(response);
};

/**
 * @param {Record<string, any>} payload
 * @returns {Promise<any>}
 */
export const changeSubscriptionPlan = async (payload) => {
  const response = await client.post('/subscriptions/change-plan', payload);
  return getResponsePayload(response);
};

/**
 * LE BOUTON « DEBLOQUER MON OFFRE » — lot ESSAI, decision d'Adel du 28/08.
 *
 * AUCUN PARAMETRE, ET C'EST VOLONTAIRE : le serveur prend le club DU COMPTE
 * AUTHENTIFIE, jamais un identifiant venu du telephone. Laisser le client
 * choisir le club ferait d'un cadeau une porte ouverte (offrir l'illimite au
 * club d'un autre, ou en boucle sur des clubs successifs).
 * @returns {Promise<{granted: boolean, reason: string, subscriptionDocumentId: string | null}>} Le verdict du serveur.
 */
export const claimOnboardingGift = async () => {
  const response = await client.post('/subscriptions/gift/claim', {});
  return getResponsePayload(response);
};

/**
 * LA PORTE DE SORTIE DU CLIENT WEB - lot ABO-FIX / R3.
 *
 * AUCUN PARAMETRE, ET C'EST LA MEME RAISON QUE LE CADEAU : le serveur prend
 * l'abonnement web DU COMPTE AUTHENTIFIE. Laisser le telephone nommer un
 * identifiant client Stripe ouvrirait le portail de facturation de quelqu'un
 * d'autre - factures et moyen de paiement compris.
 *
 * ⚠️ CETTE ROUTE NE JETTE PAS QUAND LE PORTAIL EST INDISPONIBLE : elle repond
 * 200 avec `available: false` et un motif. Il n'y a AUCUNE cle Stripe en
 * production aujourd'hui, et un ecran « Mon abonnement » ne doit pas casser
 * pour une fonction qui ne concerne que les abonnes web.
 * @returns {Promise<{available: boolean, reason: string, url: string|null}>} Le verdict.
 */
export const openSubscriptionBillingPortal = async () => {
  const response = await client.post('/subscriptions/stripe/billing-portal', {});
  return getResponsePayload(response);
};
