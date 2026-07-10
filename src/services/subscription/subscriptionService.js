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
 * @param {Record<string, any>} payload
 * @returns {Promise<any>}
 */
export const restoreSubscriptionPurchases = async (payload = {}) => {
  const response = await client.post('/subscriptions/purchases/restore', payload);
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
