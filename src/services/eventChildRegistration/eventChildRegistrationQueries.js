// @ts-nocheck
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
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
 * L organisateur accepte ou refuse.
 * @param {string} eventId - L evenement.
 * @returns {object} La mutation (`mutateAsync({ decision, registrationId, reason })`).
 */
export const useDecideChildRegistration = (eventId) => useRegistrationMutation(
  eventId,
  (variables) => decideChildRegistration(variables),
);
