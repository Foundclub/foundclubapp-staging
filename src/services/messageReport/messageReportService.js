import client from '../client';

/**
 * Creates a message report.
 * @param {CreateMessageReportData} data - The data for creating the message report.
 * @returns {Promise<any>} A promise that resolves to the created message report.
 */
export const createMessageReport = async (data) => {
  const response = await client.post('/chat-message-reports', { data });
  return response.data;
};
