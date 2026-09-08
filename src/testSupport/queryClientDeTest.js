import { QueryClient } from '@tanstack/react-query';

/**
 * 🧨 LE CLIENT REACT-QUERY DES TEMOINS — ET POURQUOI IL EXISTE.
 *
 * La CI de l'app a ete ROUGE du 2026-09-03 au 2026-09-08, VINGT executions
 * d'affilee, avec ce journal :
 *
 * Tests: 5965 passed, 5965 total
 * Jest did not exit one second after the test run has completed.
 * Process completed with exit code 1
 *
 * ⚠️ AUCUN TEMOIN N ETAIT ROUGE. Ce n'est pas un test qui echoue : c'est Jest
 * qui ne peut pas s'eteindre. Il tourne cinq minutes dans le vide, puis GitHub
 * le tue.
 *
 * LA CAUSE, nommee par `jest --ci --runInBand --detectOpenHandles` :
 *
 * Jest has detected the following open handles
 * ●  Timeout
 * at Mutation.scheduleGc (@tanstack/query-core/src/removable.ts:15:25)
 *
 * react-query arme un `setTimeout` de nettoyage par requete ET par mutation —
 * `gcTime`, cinq minutes par defaut. Les temoins reglaient ce delai sur les
 * QUERIES et l'oubliaient sur les MUTATIONS, ou l'oubliaient tout court. Chaque
 * client de test laissait donc derriere lui des minuteurs vivants.
 *
 * ⛔ CE N'EST PAS `--forceExit`. Cette option rendrait la CI verte en MASQUANT
 * la fuite — qui existe aussi dans la vraie app. Elle est interdite ici, et
 * c'est ecrit dans la memoire du projet.
 *
 * 🎯 CE FABRICANT EST LE SEUL ENDROIT A CORRIGER. Avant lui, le reglage etait
 * recopie dans 66 appels repartis sur 50 fichiers : deux tentatives de
 * correction automatique ont echoue avant qu'on renonce a la voie de
 * l'expression reguliere. Un reglage recopie 66 fois finit toujours par
 * diverger quelque part.
 *
 * 🔑 LES OPTIONS DE L'APPELANT SONT ETALEES EN DERNIER, ET C'EST DELIBERE :
 * un temoin qui pose `gcTime: 0` le fait EXPRES — il mesure l'eviction du cache.
 * Ses valeurs doivent gagner sur nos defauts, jamais l'inverse.
 * @param {import('@tanstack/react-query').QueryClientConfig} [config]
 *   La configuration du temoin, telle qu'il l'ecrirait pour `new QueryClient`.
 * @returns {QueryClient} Un client qui ne laisse aucun minuteur derriere lui.
 */
export const creerQueryClientDeTest = (config = {}) => new QueryClient({
  ...config,
  defaultOptions: {
    ...config.defaultOptions,
    mutations: {
      gcTime: Infinity,
      retry: false,
      ...(config.defaultOptions?.mutations || {}),
    },
    queries: {
      gcTime: Infinity,
      retry: false,
      ...(config.defaultOptions?.queries || {}),
    },
  },
});

export default creerQueryClientDeTest;
