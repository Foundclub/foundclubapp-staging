import {
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';

import LeagueLegalAcceptanceModal from '@/components/organisms/league/LeagueLegalAcceptanceModal';

function useLeagueLegalAcceptance() {
  const resolverRef = useRef(null);
  const [request, setRequest] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const closeRequest = useCallback((payload = null) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setRequest(null);
    setIsSubmitting(false);
    if (resolve) resolve(payload);
  }, []);

  const requestLeagueLegalAcceptance = useCallback((config) => new Promise((resolve) => {
    resolverRef.current = resolve;
    setRequest(config || {});
  }), []);

  const modal = useMemo(() => (
    <LeagueLegalAcceptanceModal
      isSubmitting={isSubmitting}
      isVisible={Boolean(request)}
      metadata={request?.metadata}
      onAccept={(payload) => {
        setIsSubmitting(true);
        closeRequest(payload);
      }}
      onClose={() => closeRequest(null)}
      scope={request?.scope}
      sourceScreen={request?.sourceScreen}
      targetDocumentId={request?.targetDocumentId}
      targetLabel={request?.targetLabel}
      targetType={request?.targetType}
    />
  ), [closeRequest, isSubmitting, request]);

  return {
    leagueLegalAcceptanceModal: modal,
    requestLeagueLegalAcceptance,
  };
}

export default useLeagueLegalAcceptance;
