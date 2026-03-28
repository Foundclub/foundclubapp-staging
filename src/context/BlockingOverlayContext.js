import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

const defaultBlockingOverlayContext = {
  activePromptId: null,
  dequeuePrompt: () => {},
  enqueuePrompt: () => {},
};

const BlockingOverlayContext = createContext(defaultBlockingOverlayContext);

const sortRequests = (requests) => [...requests].sort((left, right) => {
  if ((right?.priority || 0) !== (left?.priority || 0)) {
    return (right?.priority || 0) - (left?.priority || 0);
  }
  return (left?.order || 0) - (right?.order || 0);
});

/**
 * @param {{ children: React.ReactNode }} props
 * @returns {import('react').ReactElement}
 */
export function BlockingOverlayProvider({ children }) {
  const requestOrderRef = useRef(0);
  const [requests, setRequests] = useState([]);

  const enqueuePrompt = useCallback((id, priority = 0) => {
    if (!id) return;

    setRequests((previousRequests) => {
      const existingRequest = previousRequests.find((request) => request.id === id);
      if (existingRequest) {
        if (existingRequest.priority === priority) {
          return previousRequests;
        }
        return sortRequests(previousRequests.map((request) => (
          request.id === id
            ? {
              ...request,
              priority,
            }
            : request
        )));
      }

      const nextOrder = requestOrderRef.current + 1;
      requestOrderRef.current = nextOrder;
      return sortRequests([
        ...previousRequests,
        {
          id,
          order: nextOrder,
          priority,
        },
      ]);
    });
  }, []);

  const dequeuePrompt = useCallback((id) => {
    if (!id) return;

    setRequests((previousRequests) => {
      const nextRequests = previousRequests.filter((request) => request.id !== id);
      return nextRequests.length === previousRequests.length
        ? previousRequests
        : nextRequests;
    });
  }, []);

  const value = useMemo(() => ({
    activePromptId: requests[0]?.id || null,
    dequeuePrompt,
    enqueuePrompt,
  }), [dequeuePrompt, enqueuePrompt, requests]);

  return React.createElement(
    BlockingOverlayContext.Provider,
    { value },
    children,
  );
}

export const useBlockingOverlayContext = () => useContext(BlockingOverlayContext);

export const useBlockingOverlayPrompt = (id, enabled, priority = 0) => {
  const { activePromptId, dequeuePrompt, enqueuePrompt } = useBlockingOverlayContext();

  React.useEffect(() => {
    if (!enabled) {
      dequeuePrompt(id);
      return undefined;
    }

    enqueuePrompt(id, priority);
    return () => dequeuePrompt(id);
  }, [dequeuePrompt, enabled, enqueuePrompt, id, priority]);

  return Boolean(enabled) && activePromptId === id;
};
