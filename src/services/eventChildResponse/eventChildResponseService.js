import client from '../client';

/**
 * Read replies for the current parent's children.
 * @param {string} eventId
 * @returns {Promise<any[]>}
 */
export const getMyChildEventResponses = async (eventId) => {
  const response = await client.get(`/events/${encodeURIComponent(eventId)}/child-responses/mine`);
  return Array.isArray(response?.data?.data) ? response.data.data : [];
};

/**
 * Read replies for authorized event staff.
 * @param {string} eventId
 * @returns {Promise<any[]>}
 */
export const getChildEventResponsesForOrganizer = async (eventId) => {
  const response = await client.get(`/events/${encodeURIComponent(eventId)}/child-responses`);
  return Array.isArray(response?.data?.data) ? response.data.data : [];
};

/**
 * Save one child's response.
 * @param {string} eventId
 * @param {{ child: string, answer: string }} response
 * @returns {Promise<any>}
 */
export const answerForChild = async (eventId, response) => {
  const result = await client.post(`/events/${encodeURIComponent(eventId)}/child-responses`, {
    data: { answer: response.answer, child: response.child },
  });
  return result?.data?.data;
};
