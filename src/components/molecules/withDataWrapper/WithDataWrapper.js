import { QueryClientContext } from '@tanstack/react-query';
import { useCallback, useContext } from 'react';
import { View } from 'react-native';

import ErrorWrapper from '@/components/atoms/errorWrapper/ErrorWrapper';
import SkeletonLoader from '@/components/atoms/skeletonLoader/SkeletonLoader';

/**
 * U06 — LE PAVE ROUGE PROPOSE ENFIN DE REESSAYER.
 *
 * 🧨 Le defaut mesure : `ErrorWrapper` sait rendre un bouton « Reessayer » depuis
 * toujours (prop `onRetry`), mais ce composant — le SEUL chemin emprunte par les
 * 30 fichiers d'ecran qui affichent un etat d'erreur — ne la lui passait jamais.
 * Un hoquet reseau de 2 secondes devenait donc un cul-de-sac.
 *
 * La correction est ici, UNE fois (§1 bis), et pas ecran par ecran. Deux niveaux :
 *   1. l'ecran fournit `onRetry` — il sait exactement quoi relancer, il gagne ;
 *   2. sinon, on relance les requetes react-query REELLEMENT en echec.
 *
 * ⛔ AUCUN BOUTON INERTE : sans `onRetry` et sans requete en echec dans le cache,
 * aucun bouton n'est rendu — il n'aurait rien a relancer.
 *
 * ⚠️ `QueryClientContext` plutot que `useQueryClient()` : ce dernier LEVE une
 * exception hors d'un `QueryClientProvider`, et ce composant est monte par des
 * dizaines de tests qui n'en posent pas. Le contexte nu rend `undefined`.
 */

/**
 * Une requete react-query qui a REELLEMENT echoue — la seule qu'il vaille la
 * peine de relancer.
 * @param {import('@tanstack/react-query').Query} query - La requete du cache.
 * @returns {boolean} Est-elle en echec ?
 */
const isFailedQuery = (query) => query?.state?.status === 'error';

/**
 * Content wrapper component that handles loading and error states.
 * @param {object} props
 * @param {import('react').ReactNode} props.children
 * @param {boolean} props.isLoading
 * @param {unknown} [props.error]
 * @param {string} [props.backgroundColor]
 * @param {() => void} [props.onRetry] - Relance choisie par l'ecran. Prioritaire.
 * @param {string} [props.retryLabel]
 * @param {Array<import('react-native').ViewStyle>} [props.wrapperStyle]
 * @returns {import('react').ReactElement}
 */
function WithDataWrapper({
  backgroundColor,
  children,
  error,
  isLoading,
  onRetry = undefined,
  retryLabel = 'Réessayer',
  wrapperStyle,
}) {
  const queryClient = useContext(QueryClientContext);

  // PERF3 — le balayage est BORNÉ aux requêtes OBSERVÉES (`type: 'active'`) :
  // sans ce filtre, une requête en échec dont l'écran est démonté (gcTime 5 min)
  // repartait aussi — le seul balayage non borné de l'app, déclenché par le
  // bouton « Réessayer ». La promesse est rendue à ErrorWrapper, qui grise le
  // bouton tant que la relance est en vol (anti-rebond).
  const retryFailedQueries = useCallback(
    () => queryClient?.refetchQueries({ predicate: isFailedQuery, type: 'active' }),
    [queryClient],
  );

  const hasFailedQuery = Boolean(
    queryClient?.getQueryCache()
      .findAll({ predicate: isFailedQuery, type: 'active' })
      .length,
  );
  const handleRetry = onRetry || (hasFailedQuery ? retryFailedQueries : undefined);

  if (isLoading) {
    return (
      <SkeletonLoader
        backgroundColor={backgroundColor}
        isActive
        wrapperStyle={wrapperStyle}
      >
        {children}
      </SkeletonLoader>
    );
  }

  if (error) {
    return (
      <ErrorWrapper
        error={error}
        onRetry={handleRetry}
        retryLabel={retryLabel}
        wrapperStyle={wrapperStyle}
      >
        {children}
      </ErrorWrapper>
    );
  }

  return <View style={wrapperStyle}>{children}</View>;
}

export default WithDataWrapper;
