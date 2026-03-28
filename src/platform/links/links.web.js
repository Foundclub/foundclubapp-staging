import { buildWebPath } from '@/navigation/webRoutes';

export const openUrl = async (url) => {
  if (typeof window === 'undefined') return;
  window.open(url, '_blank', 'noopener,noreferrer');
};

export const buildDeepLink = (routeName, params = {}) => buildWebPath(routeName, params, {
  absolute: true,
});

export default {
  buildDeepLink,
  openUrl,
};
