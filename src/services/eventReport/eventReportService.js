import client from '../client';

/**
 * Creates an event report.
 * @param {CreateEventReportData} data - The data for creating the event report.
 * @returns {Promise<any>} A promise that resolves to the created event report.
 */
export const createEventReport = async (data) => {
  const response = await client.post('/event-reports', { data });
  return response.data;
};
