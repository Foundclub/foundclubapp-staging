import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * T3-TICKETS-VILLE (03/11/2026, fiche 20 option B) — les questions d'un club à sa Ville. Le
 * serveur est le SEUL juge (admin `src/api/collectivite-question`) : qui écrit (un dirigeant du
 * club), à quelle Ville (celle du rattachement), qui lit, qui traite (la Ville). L'app envoie, puis
 * dit le refus. Le client se charge à l'appel : importer ce module ne charge pas le réseau.
 */

const client = async () => (await import('../client')).default;
const CLEF = 'collectivite-questions';
const QUART_DE_MINUTE = 15_000;

/**
 * Les questions du club (ses dirigeants).
 * @param {string | null | undefined} clubId - documentId du club.
 * @returns {any} Le résultat react-query ; `data` est la réponse entière (`{ data, meta }`).
 */
export const useClubQuestions = (clubId) => useQuery({
  enabled: Boolean(clubId),
  queryFn: async () => (await (await client()).get(`/clubs/${clubId}/collectivite-questions`)).data,
  queryKey: [CLEF, 'club', clubId],
  staleTime: QUART_DE_MINUTE,
});

/**
 * La boîte de la Ville.
 * @param {string | null | undefined} collectiviteId - documentId de la collectivité.
 * @returns {any} Le résultat react-query ; `data` est la réponse entière (`{ data, meta }`).
 */
export const useCollectiviteQuestions = (collectiviteId) => useQuery({
  enabled: Boolean(collectiviteId),
  queryFn: async () => (
    await (await client()).get(`/collectivites/${collectiviteId}/questions`)
  ).data,
  queryKey: [CLEF, 'collectivite', collectiviteId],
  staleTime: QUART_DE_MINUTE,
});

/**
 * Une question (la Ville, ou un dirigeant du club).
 * @param {string | null | undefined} questionId - documentId de la question.
 * @returns {any} Le résultat react-query ; `data` est la réponse entière (`{ data, meta }`).
 */
export const useCollectiviteQuestion = (questionId) => useQuery({
  enabled: Boolean(questionId),
  queryFn: async () => (await (await client()).get(`/collectivite-questions/${questionId}`)).data,
  queryKey: [CLEF, 'fiche', questionId],
  retry: false,
  staleTime: QUART_DE_MINUTE,
});

/**
 * Écrire à sa Ville.
 * @param {string | null | undefined} clubId - documentId du club.
 * @returns {any} La mutation ; elle reçoit le texte.
 */
export const useSubmitClubQuestion = (clubId) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (/** @type {string} */ text) => (
      await (await client()).post(`/clubs/${clubId}/collectivite-questions`, { data: { text } })
    ).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [CLEF] }),
  });
};

/**
 * La Ville change le statut, et peut laisser un mot.
 * @param {string | null | undefined} questionId - documentId de la question.
 * @returns {any} La mutation ; elle reçoit `{ status, note }`.
 */
export const useSetQuestionStatus = (questionId) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (/** @type {{ status: string, note?: string }} */ data) => (
      await (await client()).put(`/collectivite-questions/${questionId}/status`, { data })
    ).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [CLEF] }),
  });
};
