import { useEffect, useMemo } from 'react';

import ErrorScreen from '@/views/Error';

import { persistDiagnosticError } from '@/utils/bootDiagnostics';

import {
  getRuntimeEndpointsLog,
  resolveRuntimeEndpoints,
} from '@/config/runtimeUrls';

const buildConfigError = (errors) => new Error(
  `[CONFIG][runtime-endpoints] ${errors.join(' ')}`,
);

function BootGate({ children }) {
  const runtimeEndpoints = useMemo(() => resolveRuntimeEndpoints(), []);
  const errors = useMemo(
    () => (Array.isArray(runtimeEndpoints?.errors) ? runtimeEndpoints.errors : []),
    [runtimeEndpoints],
  );
  const hasBlockingError = errors.length > 0;

  useEffect(() => {
    if (!hasBlockingError) {
      return;
    }

    const error = buildConfigError(errors);
    const payload = persistDiagnosticError(error, 'BOOT_CONFIG_INVALID', {
      isFatal: true,
    });

    console.error('[BOOT] BOOT_CONFIG_INVALID', {
      ...payload,
      runtimeEndpoints: getRuntimeEndpointsLog(),
    });
  }, [errors, hasBlockingError]);

  if (hasBlockingError) {
    return (
      <ErrorScreen
        actionTitle="Recharger"
        details={__DEV__ ? errors.join('\n') : ''}
        subtitle="La configuration réseau de ce build est invalide. L'app est bloquée proprement pour éviter un crash au démarrage."
        title="Configuration invalide"
      />
    );
  }

  return children;
}

export default BootGate;
