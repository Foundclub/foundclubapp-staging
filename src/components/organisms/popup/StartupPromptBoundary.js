import { useEffect } from 'react';

import { usePopupManager } from '@/context/PopupManagerContext';

/**
 * @param {{ children: import('react').ReactNode }} props
 * @returns {import('react').ReactElement}
 */
function StartupPromptBoundary({ children }) {
  const { isStartupWindowActive, shownStartupBlockingPopupId } = usePopupManager();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // eslint-disable-next-line no-underscore-dangle
    window.__FC_STARTUP_PROMPT_WINDOW__ = {
      isStartupWindowActive,
      shownStartupBlockingPopupId,
    };
  }, [isStartupWindowActive, shownStartupBlockingPopupId]);

  return children;
}

export default StartupPromptBoundary;
