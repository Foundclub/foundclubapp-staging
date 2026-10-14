// @ts-nocheck
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  cancelChildRegistration,
  decideChildRegistration,
  getEventChildRegistrations,
  getMyChildRegistrations,
  registerChildrenToEvent,
} from './eventChildRegistrationService';

/**
 * 👪 PAR-L11b (13/10) — LES LECTURES ET LES GESTES DU BLOC « INSCRIRE MES ENFANTS ».
 *
 * Deux listes par evenement : celle du PARENT (ses enfants ici) et celle de l ORGANISATEUR
 * (tous les enfants inscrits). Apres chaque geste on `refetch()` les deux, jamais une
 * simple invalidation : le compteur et la ligne doivent etre justes quand on rouvre la
 * fiche (critere de recette L11).
 */

/**
 * La clef des inscriptions de MES enfants a cet evenement.
 * @param {string} eventId - L evenement.
 * @returns {string[]} La clef react-query.
 */
export const myChildRegistrationsKey = (eventId) => [
  'eventChildRegistrations', 'mine', eventId,
];

/**
 * 👪 PAR-L11c (14/10) — la clef de TOUTES les inscriptions de mes enfants (fiche de l enfant,
 * « Ses evenements »). Sous le meme prefixe que les listes par evenement : relire
 * `['eventChildRegistrations', 'mine']` les relit toutes.
 */
export const allMyChildRegistrationsKey = ['eventChildRegistrations', 'mine', 'all'];

/**
 * La clef des inscriptions d enfants vues par l organisateur.
 * @param {string} eventId - L evenement.
 * @returns {string[]} La clef react-query.
 */
export const eventChildRegistrationsKey = (eventId) => [
  'eventChildRegistrations', 'event', eventId,
];

/**
 * Les inscriptions de mes enfants a cet evenement.
 * @param {string} eventId - L evenement.
 * @param {object} [options] - Options react-query (`enabled`).
 * @returns {object} Le resultat react-query.
 */
export const useMyChildRegistrations = (eventId, options = {}) => useQuery({
  enabled: Boolean(eventId),
  queryFn: () => getMyChildRegistrations(eventId),
  queryKey: myChildRegistrationsKey(eventId),
  staleTime: 30 * 1000,
  ...options,
});

/**
 * 👪 PAR-L11c (14/10) — toutes les inscriptions de mes enfants (la fiche garde celles du sien).
 * @param {object} [options] - Options react-query (`enabled`).
 * @returns {object} Le resultat react-query.
 */
export const useAllMyChildRegistrations = (options = {}) => useQuery({
  queryFn: () => getMyChildRegistrations(),
  queryKey: allMyChildRegistrationsKey,
  staleTime: 30 * 1000,
  ...options,
});

/**
 * Les enfants inscrits a mon evenement (organisateur).
 * @param {string} eventId - L evenement.
 * @param {object} [options] - Options react-query (`enabled`).
 * @returns {object} Le resultat react-query.
 */
export const useEventChildRegistrations = (eventId, options = {}) => useQuery({
  enabled: Boolean(eventId),
  queryFn: () => getEventChildRegistrations(eventId),
  queryKey: eventChildRegistrationsKey(eventId),
  staleTime: 30 * 1000,
  ...options,
});

/**
 * Une mutation qui relit les deux listes (et la fiche de l evenement) apres coup.
 * @param {string} eventId - L evenement.
 * @param {(variables: any) => Promise<any>} mutationFn - Le geste serveur.
 * @param {any[]} [extraKeys] - D autres clefs a relire.
 * @returns {object} La mutation.
 */
const useRegistrationMutation = (eventId, mutationFn, extraKeys = []) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: myChildRegistrationsKey(eventId) }),
        queryClient.refetchQueries({ queryKey: eventChildRegistrationsKey(eventId) }),
        // PAR-L11c — la fiche de l enfant (« Ses evenements ») se relira a son ouverture.
        queryClient.invalidateQueries({ queryKey: allMyChildRegistrationsKey }),
        ...extraKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      ]);
    },
  });
};

/**
 * Inscrire des enfants. Une reservation change de compteur : la fiche est relue aussi.
 * @param {string} eventId - L evenement.
 * @returns {object} La mutation (`mutateAsync(childIds)`).
 */
export const useRegisterChildren = (eventId) => useRegistrationMutation(
  eventId,
  (childIds) => registerChildrenToEvent({ childIds, eventId }),
  [['event', eventId]],
);

/**
 * 👪 PAR-L11c (14/10) — le parent annule une de SES lignes (`mutate(registration)`). Ses
 * listes sont relues dans TOUS les cas, reussite ou refus : une ligne deja effacee doit
 * disparaitre aussi. La fiche de l evenement est relue : une reservation rend sa place.
 * @returns {object} La mutation.
 */
export const useCancelChildRegistration = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (registration) => cancelChildRegistration(registration?.documentId),
    onSettled: async (_data, _error, registration) => {
      const eventId = registration?.event?.documentId;
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['eventChildRegistrations', 'mine'] }),
        ...(eventId ? [queryClient.invalidateQueries({ queryKey: ['event', eventId] })] : []),
      ]);
    },
  });
};

/**
 * L organisateur accepte ou refuse.
 * @param {string} eventId - L evenement.
 * @returns {object} La mutation (`mutateAsync({ decision, registrationId, reason })`).
 */
export const useDecideChildRegistration = (eventId) => useRegistrationMutation(
  eventId,
  (variables) => decideChildRegistration(variables),
);
