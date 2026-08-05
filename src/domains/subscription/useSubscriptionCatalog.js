import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import {
  getSubscriptionCatalogEntries,
  resolveSubscriptionCatalogPrices,
} from '@/domains/subscription/subscriptionBilling';
import { readRevenueCatStorePricesInCents } from '@/domains/subscription/subscriptionRevenueCat';

import { getSubscriptionCatalog } from '@/services/subscription/subscriptionService';

import { createLogger } from '@/utils/logger/logger';

/**
 * Point UNIQUE de lecture du catalogue d'abonnement (L39).
 *
 * Les quatre surfaces de vente (carrousel, recap du tour guide, feuille de mur
 * payant, comparatif) lisaient chacune le catalogue pour leur compte — et deux
 * d'entre elles recopiaient meme la lecture de l'enveloppe. Elles passent
 * desormais toutes par ici, et recoivent donc toutes le prix du STORE.
 *
 * ⚠️ `isLoading` ne suit QUE le catalogue serveur, jamais le store. Un store qui
 * ne repond pas doit laisser l'ecran vendable avec les prix du serveur ; s'il
 * pouvait bloquer le chargement, une panne de store rendrait la surface de
 * vente muette — exactement ce que ce lot doit empecher.
 */

const CATALOG_STALE_TIME_MS = 1000 * 60 * 10;

const logger = createLogger('subscription-price');

let lastReportedSignature = '';

/** Jest uniquement : reinitialise l'etat module entre deux tests. */
export const resetSubscriptionPriceReportForTests = () => {
  lastReportedSignature = '';
};

/**
 * Journalise les desaccords entre le store et le catalogue serveur.
 *
 * Rien a dire = rien d'ecrit : une alarme qui sonne toujours n'est plus lue. Et
 * un meme desaccord n'est journalise qu'une fois, sinon chaque rendu de chaque
 * surface le repeterait.
 * @param {{ mismatches: any[]; missingFromStorePlanCodes: string[] }} divergences
 * @returns {void}
 */
const reportSubscriptionPriceDivergences = ({ mismatches, missingFromStorePlanCodes }) => {
  if (mismatches.length === 0 && missingFromStorePlanCodes.length === 0) {
    return;
  }

  const signature = JSON.stringify({ mismatches, missingFromStorePlanCodes });
  if (signature === lastReportedSignature) {
    return;
  }
  lastReportedSignature = signature;

  if (mismatches.length > 0) {
    logger.warn('le store et le catalogue serveur ne disent pas le meme prix', {
      ecarts: mismatches.map((mismatch) => ({
        planCode: mismatch.planCode,
        prixServeurEurCents: mismatch.serverPriceEurCents,
        prixStoreEurCents: mismatch.storePriceEurCents,
        sourceRetenue: mismatch.retainedSource,
      })),
    });
  }

  if (missingFromStorePlanCodes.length > 0) {
    // Reglage de boutique, pas un defaut de code : ces paliers gardent le prix
    // du serveur et restent vendables, mais quelqu'un doit les configurer.
    logger.warn('des paliers du catalogue serveur sont absents du store', {
      paliersAbsents: missingFromStorePlanCodes,
    });
  }
};

/**
 * Catalogue d'abonnement pret a afficher : prix du store quand il repond, prix
 * du serveur sinon.
 * @param {{ enabled?: boolean }} [options]
 * @returns {{
 *   entries: any[];
 *   error: any;
 *   isError: boolean;
 *   isLoading: boolean;
 *   refetch: () => void;
 * }}
 */
export const useSubscriptionCatalog = ({ enabled = true } = {}) => {
  const catalogQuery = useQuery({
    enabled,
    queryFn: getSubscriptionCatalog,
    queryKey: ['subscription-catalog'],
    staleTime: CATALOG_STALE_TIME_MS,
  });

  const serverEntries = useMemo(
    () => getSubscriptionCatalogEntries(catalogQuery.data),
    [catalogQuery.data],
  );
  const planCodesSignature = serverEntries
    .map((entry) => String(entry?.planCode || ''))
    .filter(Boolean)
    .join('|');

  const storePricesQuery = useQuery({
    enabled: enabled && planCodesSignature.length > 0,
    queryFn: () => readRevenueCatStorePricesInCents(serverEntries),
    queryKey: ['subscription-store-prices', planCodesSignature],
    staleTime: CATALOG_STALE_TIME_MS,
  });

  const resolvedCatalog = useMemo(
    () => resolveSubscriptionCatalogPrices({
      serverEntries,
      storePricesEurCents: storePricesQuery.data,
    }),
    [serverEntries, storePricesQuery.data],
  );

  useEffect(() => {
    reportSubscriptionPriceDivergences(resolvedCatalog);
  }, [resolvedCatalog]);

  return {
    entries: resolvedCatalog.entries,
    error: catalogQuery.error,
    isError: Boolean(catalogQuery.isError),
    isLoading: Boolean(catalogQuery.isLoading),
    refetch: () => {
      catalogQuery.refetch?.();
      storePricesQuery.refetch?.();
    },
  };
};

export default useSubscriptionCatalog;
