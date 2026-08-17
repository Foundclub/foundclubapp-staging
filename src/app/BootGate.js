import { useEffect, useMemo } from 'react';

import ErrorScreen from '@/views/Error';

import { persistDiagnosticError } from '@/utils/bootDiagnostics';

import AppUpdateGate from '@/app/AppUpdateGate';
import {
  getRuntimeEndpointsLog,
  resolveRuntimeEndpoints,
} from '@/config/runtimeUrls';

const buildConfigError = (errors) => new Error(
  `[CONFIG][runtime-endpoints] ${errors.join(' ')}`,
);

/**
 * Les deux portes du demarrage : configuration reseau valide, puis version de
 * l'app encore acceptee par le serveur.
 * @param {object} root0
 * @param {import('react').ReactNode} root0.children
 * @returns {import('react').ReactElement}
 */
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

  // S09 — la seconde porte, au meme etage que celle-ci et juste apres elle :
  // la configuration est valide, on peut demander au serveur si cette version
  // de l'app est encore acceptee. Elle laisse passer par defaut (voir
  // `AppUpdateGate`) ; quand elle bloque, `children` n'est jamais monte, donc
  // aucune pile de navigation n'existe derriere l'ecran.
  return <AppUpdateGate>{children}</AppUpdateGate>;
}

export default BootGate;
