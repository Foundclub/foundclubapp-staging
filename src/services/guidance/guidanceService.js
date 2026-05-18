// @ts-nocheck
import client from '@/services/client';

export const patchGuidanceState = async (guidanceState, options = {}) => {
  const response = await client.patch('/app-guidance/me', {
    data: guidanceState,
    ...(options?.replace ? { replace: true } : {}),
  });

  return response?.data?.data || response?.data || null;
};
