import {
  useMutation, useQueries, useQuery, useQueryClient,
} from '@tanstack/react-query';

import {
  addAdminCollectiviteGestionnaire,
  attachAdminCollectiviteClub,
  createAdminCollectivite,
  detachAdminCollectiviteClub,
  getAdminCollectivite,
  getAdminCollectivites,
  getCollectiviteClub,
  getCollectiviteClubs,
  getCollectiviteInstallations,
  getCollectiviteRequests,
  getMyCollectivites,
  previewAdminCollectiviteActive,
  removeAdminCollectiviteGestionnaire,
  saveCollectiviteInstallation,
  searchAdminCollectiviteTargets,
  setAdminCollectiviteActive,
} from './collectiviteService';

/**
 * COLLECTIVITES 1c (2026-09-29) — les lectures et l ecriture de « Ma collectivite ».
 *
 * Les demandes vivent sous la clef `['facility-override-requests', ...]` : accepter ou
 * refuser passe par les mutations du lot 3a (`facilityQueries`), qui invalident deja ce
 * prefixe — les deux listes (en attente, traitees) et la pastille de l accueil suivent
 * sans code en plus.
 */

/** @typedef {import('@tanstack/react-query').UseQueryResult<any[], Error>} RowsQuery */
/** @typedef {Record<string, any>} QueryOptions */

/**
 * Les lignes d une reponse `{ data: [...] }`, ou un tableau vide.
 * @param {any} response - La reponse du service.
 * @returns {any[]} Les lignes.
 */
const unwrapRows = (response) => (Array.isArray(response?.data) ? response.data : []);

export const MY_COLLECTIVITES_QUERY_KEY = ['collectivites', 'mine'];

/**
 * La clef des demandes d une collectivite (prefixe partage avec le lot 3a).
 * @param {string | null | undefined} collectiviteId - documentId.
 * @param {'pending' | 'decided'} status - En attente ou traitees.
 * @returns {Array<string | null | undefined>} La clef.
 */
export const collectiviteRequestsQueryKey = (collectiviteId, status) => [
  'facility-override-requests', 'collectivite', collectiviteId, status,
];

/**
 * La clef des installations d une collectivite.
 * @param {string | null | undefined} collectiviteId - documentId.
 * @returns {Array<string | null | undefined>} La clef.
 */
export const collectiviteInstallationsQueryKey = (collectiviteId) => [
  'collectivite', collectiviteId, 'installations',
];

/**
 * La clef des clubs rattaches a une collectivite.
 * @param {string | null | undefined} collectiviteId - documentId.
 * @returns {Array<string | null | undefined>} La clef.
 */
export const collectiviteClubsQueryKey = (collectiviteId) => [
  'collectivite', collectiviteId, 'clubs',
];

/**
 * Les collectivites que je gere : la porte d entree s ouvre si la liste n est pas vide.
 * @param {QueryOptions} [options] - Options react-query.
 * @returns {RowsQuery} Le resultat react-query ; `data` est un tableau.
 */
export const useMyCollectivites = (options = {}) => useQuery({
  queryFn: async () => unwrapRows(await getMyCollectivites()),
  queryKey: MY_COLLECTIVITES_QUERY_KEY,
  staleTime: 5 * 60 * 1000,
  ...options,
});

/**
 * Les demandes d une collectivite.
 * @param {string | null | undefined} collectiviteId - documentId.
 * @param {'pending' | 'decided'} status - En attente ou traitees.
 * @param {QueryOptions} [options] - Options react-query.
 * @returns {RowsQuery} Le resultat react-query ; `data` est un tableau.
 */
export const useCollectiviteRequests = (collectiviteId, status, options = {}) => useQuery({
  enabled: Boolean(collectiviteId),
  queryFn: async () => unwrapRows(await getCollectiviteRequests(String(collectiviteId), status)),
  queryKey: collectiviteRequestsQueryKey(collectiviteId, status),
  staleTime: 15_000,
  ...options,
});

/**
 * Les installations d une collectivite.
 * @param {string | null | undefined} collectiviteId - documentId.
 * @param {QueryOptions} [options] - Options react-query.
 * @returns {RowsQuery} Le resultat react-query ; `data` est un tableau.
 */
export const useCollectiviteInstallations = (collectiviteId, options = {}) => useQuery({
  enabled: Boolean(collectiviteId),
  queryFn: async () => unwrapRows(await getCollectiviteInstallations(String(collectiviteId))),
  queryKey: collectiviteInstallationsQueryKey(collectiviteId),
  staleTime: 60_000,
  ...options,
});

/**
 * PLANNING-PORTRAIT (01/10) — la collectivite que JE gere et qui POSSEDE cette
 * installation, ou null. Ce sont les deux lectures du serveur (mes collectivites, puis
 * leurs installations, memes clefs que ci-dessus) : l app ne deduit rien du role du
 * compte. Un compte qui ne gere aucune collectivite ne fait qu un appel, deja en cache
 * si « Mon compte » l a fait.
 * @param {string | null | undefined} facilityId - documentId de l installation.
 * @param {{ enabled?: boolean }} [options] - `enabled` faux : aucun appel.
 * @returns {string | null} documentId de la collectivite, ou null.
 */
export const useManagingCollectiviteId = (facilityId, { enabled = true } = {}) => {
  const mine = useMyCollectivites({ enabled: enabled && Boolean(facilityId) });
  const collectivites = Array.isArray(mine.data) ? mine.data : [];
  const installations = useQueries({
    queries: collectivites.map(({ documentId }) => ({
      queryFn: async () => unwrapRows(await getCollectiviteInstallations(String(documentId))),
      queryKey: collectiviteInstallationsQueryKey(documentId),
      staleTime: 60_000,
    })),
  });
  const index = installations.findIndex((query) => (
    Array.isArray(query.data)
    && query.data.some((installation) => installation?.documentId === facilityId)
  ));
  return index >= 0 ? collectivites[index]?.documentId || null : null;
};

/**
 * Les clubs rattaches a une collectivite.
 * @param {string | null | undefined} collectiviteId - documentId.
 * @param {QueryOptions} [options] - Options react-query.
 * @returns {RowsQuery} Le resultat react-query ; `data` est un tableau.
 */
export const useCollectiviteClubs = (collectiviteId, options = {}) => useQuery({
  enabled: Boolean(collectiviteId),
  queryFn: async () => unwrapRows(await getCollectiviteClubs(String(collectiviteId))),
  queryKey: collectiviteClubsQueryKey(collectiviteId),
  staleTime: 5 * 60 * 1000,
  ...options,
});

/**
 * COLL-CLUBS (01/10/2026) — la clef de la fiche d un club rattache. Elle COMMENCE par celle de
 * la liste (`collectiviteClubsQueryKey`) : relire la liste relit aussi les fiches.
 * @param {string | null | undefined} collectiviteId - documentId de la collectivite.
 * @param {string | null | undefined} clubId - documentId du club.
 * @returns {Array<string | null | undefined>} La clef.
 */
export const collectiviteClubQueryKey = (collectiviteId, clubId) => [
  ...collectiviteClubsQueryKey(collectiviteId), clubId,
];

/**
 * COLL-CLUBS (01/10/2026) — la fiche d un club rattache, cote mairie.
 * @param {string | null | undefined} collectiviteId - documentId de la collectivite.
 * @param {string | null | undefined} clubId - documentId du club.
 * @param {QueryOptions} [options] - Options react-query.
 * @returns {any} Le resultat react-query ; `data` est la fiche, ou null.
 */
export const useCollectiviteClub = (collectiviteId, clubId, options = {}) => useQuery({
  enabled: Boolean(collectiviteId && clubId),
  queryFn: async () => {
    const response = await getCollectiviteClub(String(collectiviteId), String(clubId));
    return response?.data ?? null;
  },
  queryKey: collectiviteClubQueryKey(collectiviteId, clubId),
  staleTime: 60_000,
  ...options,
});

/**
 * Cree (sans `facilityId`) ou modifie une installation, puis relit la liste.
 * @param {QueryOptions} [options] - Options react-query (`onSuccess` compris).
 * @returns {any} La mutation ; variables `{ collectiviteId, data, facilityId? }`.
 */
export const useSaveCollectiviteInstallation = (options = {}) => {
  const queryClient = useQueryClient();
  const { onSuccess, ...rest } = options;
  return useMutation({
    mutationFn: saveCollectiviteInstallation,
    onSuccess: async (data, variables, context) => {
      await queryClient.invalidateQueries({
        queryKey: collectiviteInstallationsQueryKey(variables?.collectiviteId),
      });
      onSuccess?.(data, variables, context);
    },
    ...rest,
  });
};

// ─── CONSOLE SUPER-ADMIN (D61, 2026-09-29) ─────────────────────────────────────────────

/** Prefixe commun a la liste et aux details : un geste les relit tous depuis le serveur. */
export const ADMIN_COLLECTIVITES_QUERY_KEY = ['superadmin', 'collectivites'];

/**
 * La clef du detail d une collectivite.
 * @param {string | null | undefined} collectiviteId - documentId.
 * @returns {Array<string | null | undefined>} La clef.
 */
export const adminCollectiviteQueryKey = (collectiviteId) => [
  ...ADMIN_COLLECTIVITES_QUERY_KEY, collectiviteId,
];

/**
 * Toutes les collectivites (console super-admin). `data` est la reponse ENTIERE
 * (`{ data, meta }`) : l ecran lit le total pour dire s il en manque.
 * @param {QueryOptions} [options] - Options react-query.
 * @returns {any} Le resultat react-query.
 */
export const useAdminCollectivites = (options = {}) => useQuery({
  queryFn: getAdminCollectivites,
  queryKey: ADMIN_COLLECTIVITES_QUERY_KEY,
  staleTime: 0,
  ...options,
});

/**
 * Une collectivite, avec ses clubs, ses gestionnaires et ses installations.
 * @param {string | null | undefined} collectiviteId - documentId.
 * @param {QueryOptions} [options] - Options react-query.
 * @returns {any} Le resultat react-query ; `data` est la ligne, ou null.
 */
export const useAdminCollectivite = (collectiviteId, options = {}) => useQuery({
  enabled: Boolean(collectiviteId),
  queryFn: () => getAdminCollectivite(String(collectiviteId)),
  queryKey: adminCollectiviteQueryKey(collectiviteId),
  staleTime: 0,
  ...options,
});

/**
 * Chercher un club a rattacher ou un compte a nommer : rien avant 2 lettres.
 * @param {'club' | 'user'} kind - Ce qu on cherche.
 * @param {string} query - Le texte tape.
 * @returns {RowsQuery} Le resultat react-query ; `data` est un tableau.
 */
export const useAdminCollectiviteSearch = (kind, query) => {
  const texte = String(query || '').trim();
  return useQuery({
    enabled: texte.length >= 2,
    queryFn: async () => unwrapRows(await searchAdminCollectiviteTargets(kind, texte)),
    queryKey: [...ADMIN_COLLECTIVITES_QUERY_KEY, 'search', kind, texte],
    staleTime: 30_000,
  });
};

/**
 * Un geste super-admin, puis la RELECTURE de la liste et des details : l ecran affiche
 * l etat que le serveur rend, jamais celui qu il a demande.
 * @param {(variables: any) => Promise<any>} mutationFn - Le geste du service.
 * @param {QueryOptions} [options] - Options react-query (`onSuccess` compris).
 * @returns {any} La mutation.
 */
const useGesteSuperAdmin = (mutationFn, options = {}) => {
  const queryClient = useQueryClient();
  const { onSuccess, ...rest } = options;
  return useMutation({
    mutationFn,
    onSuccess: async (data, variables, context) => {
      await queryClient.invalidateQueries({ queryKey: ADMIN_COLLECTIVITES_QUERY_KEY });
      onSuccess?.(data, variables, context);
    },
    ...rest,
  });
};

/**
 * Activer ou couper ; variables `{ collectiviteId, isActive }`.
 * @param {QueryOptions} [options] - Options react-query.
 * @returns {any} La mutation.
 */
export const useSetAdminCollectiviteActive = (options) => useGesteSuperAdmin(
  setAdminCollectiviteActive,
  options,
);

/**
 * TEXTES-COLLECTIVITES (01/10) — l apercu d activer / couper ; variables
 * `{ collectiviteId, isActive }`. Ne relit rien : il n ecrit rien.
 * @param {QueryOptions} [options] - Options react-query.
 * @returns {any} La mutation.
 */
export const usePreviewAdminCollectiviteActive = (options = {}) => useMutation({
  mutationFn: previewAdminCollectiviteActive,
  ...options,
});

/**
 * Rattacher un club ; variables `{ collectiviteId, clubId }`.
 * @param {QueryOptions} [options] - Options react-query.
 * @returns {any} La mutation.
 */
export const useAttachAdminCollectiviteClub = (options) => useGesteSuperAdmin(
  attachAdminCollectiviteClub,
  options,
);

/**
 * Detacher un club ; variables `{ collectiviteId, clubId }`.
 * @param {QueryOptions} [options] - Options react-query.
 * @returns {any} La mutation.
 */
export const useDetachAdminCollectiviteClub = (options) => useGesteSuperAdmin(
  detachAdminCollectiviteClub,
  options,
);

/**
 * Nommer un gestionnaire ; variables `{ collectiviteId, userId }`.
 * @param {QueryOptions} [options] - Options react-query.
 * @returns {any} La mutation.
 */
export const useAddAdminCollectiviteGestionnaire = (options) => useGesteSuperAdmin(
  addAdminCollectiviteGestionnaire,
  options,
);

/**
 * Retirer un gestionnaire ; variables `{ collectiviteId, userId }`.
 * @param {QueryOptions} [options] - Options react-query.
 * @returns {any} La mutation.
 */
export const useRemoveAdminCollectiviteGestionnaire = (options) => useGesteSuperAdmin(
  removeAdminCollectiviteGestionnaire,
  options,
);

/**
 * Creer une collectivite ; variables = le corps lu par `readCollectiviteCreateForm`.
 * @param {QueryOptions} [options] - Options react-query.
 * @returns {any} La mutation.
 */
export const useCreateAdminCollectivite = (options) => useGesteSuperAdmin(
  createAdminCollectivite,
  options,
);
