// @ts-nocheck
import client from '@/services/client';

export const patchGuidanceState = async (guidanceState) => {
  const response = await client.patch('/app-guidance/me', {
    data: guidanceState,
  });

  return response?.data?.data || response?.data || null;
};
