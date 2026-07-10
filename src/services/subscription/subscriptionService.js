import client from '@/services/client';

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
  const response = await client.get('/subscriptions/catalog');
  return getResponsePayload(response);
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
