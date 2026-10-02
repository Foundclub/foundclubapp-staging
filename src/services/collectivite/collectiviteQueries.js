import {
  useMutation, useQueries, useQuery, useQueryClient,
} from '@tanstack/react-query';

import { getFacilityPlanning } from '@/services/facility/facilityService';

import { getPlanningDefaultDate, getPlanningRange } from '@/utils/planning/planningSlots';

import {
  addAdminCollectiviteGestionnaire,
  attachAdminCollectiviteClub,
  createAdminCollectivite,
  createManagerRequest,
  decideManagerRequest,
  detachAdminCollectiviteClub,
  getAdminCollectivite,
  getAdminCollectivites,
  getAdminManagerRequests,
  getCollectiviteClub,
  getCollectiviteClubs,
  getCollectiviteInstallations,
  getCollectiviteInvitationLink,
  getCollectiviteInvitationPreview,
  getCollectiviteInvitations,
  getCollectiviteRequests,
  getMyClubsForCollectiviteInvitation,
  getMyCollectivites,
  getMyManagerRequests,
  inviteClubByFoundClub,
  previewAdminCollectiviteActive,
  remindCollectiviteInvitation,
  removeAdminCollectiviteGestionnaire,
  requestCollectiviteAttach,
  rotateCollectiviteInvitationLink,
  saveCollectiviteInstallation,
  searchAdminCollectiviteTargets,
  searchCollectivitesForSignup,
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
 * COLL-ACCUEIL (01/10) — « Cette semaine » de l accueil de la Ville : le planning de la
 * semaine en cours de CHAQUE installation, par la lecture du planning d une installation
 * (lot 1b, `/facilities/:id/planning`, gardee par can-read-facility-planning qui admet le
 * gestionnaire). Meme clef que l ecran du planning : l accueil et le planning disent la
 * meme chose, et le second s ouvre sans relire.
 * ponytail: une lecture par installation — une Ville en a quelques-unes ; au-dela d une
 * dizaine, une route « semaine de toutes mes installations » (lot C2b) la remplacera.
 * @param {unknown} installations - Les installations (`useCollectiviteInstallations`).
 * @param {{ enabled?: boolean }} [options] - `enabled` faux : aucun appel.
 * @returns {Array<{ installation: any, query: any }>} Une lecture par installation.
 */
export const useCollectiviteWeek = (installations, { enabled = true } = {}) => {
  const liste = Array.isArray(installations) ? installations : [];
  const range = getPlanningRange(getPlanningDefaultDate(), 'week');
  const queries = useQueries({
    queries: liste.map((installation) => ({
      enabled: enabled && Boolean(installation?.documentId),
      queryFn: () => getFacilityPlanning(String(installation?.documentId), range),
      queryKey: [
        'planning', 'fullscreen', 'facility', installation?.documentId, range.from, range.to,
      ],
      staleTime: 60_000,
    })),
  });
  return liste.map((installation, index) => ({ installation, query: queries[index] }));
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

// ─── COLL-CLUBS (01/10/2026) : INVITER UN CLUB ABSENT ──────────────────────────────────

/**
 * La clef du lien d invitation d une collectivite.
 * @param {string | null | undefined} collectiviteId - documentId.
 * @returns {Array<string | null | undefined>} La clef.
 */
export const collectiviteInvitationLinkQueryKey = (collectiviteId) => [
  'collectivite', collectiviteId, 'invitation-link',
];

/**
 * La clef des invitations en cours d une collectivite.
 * @param {string | null | undefined} collectiviteId - documentId.
 * @returns {Array<string | null | undefined>} La clef.
 */
export const collectiviteInvitationsQueryKey = (collectiviteId) => [
  'collectivite', collectiviteId, 'invitations',
];

/**
 * Le lien d invitation de la Ville.
 * @param {string | null | undefined} collectiviteId - documentId.
 * @param {QueryOptions} [options] - Options react-query.
 * @returns {any} Le resultat react-query ; `data` vaut `{ token }` ou null.
 */
export const useCollectiviteInvitationLink = (collectiviteId, options = {}) => useQuery({
  enabled: Boolean(collectiviteId),
  queryFn: async () => (await getCollectiviteInvitationLink(String(collectiviteId)))?.data ?? null,
  queryKey: collectiviteInvitationLinkQueryKey(collectiviteId),
  staleTime: 5 * 60 * 1000,
  ...options,
});

/**
 * « Changer le lien » : le nouveau lien remplace l ancien dans le cache.
 * @returns {any} La mutation ; variables `{ collectiviteId }`.
 */
export const useRotateCollectiviteInvitationLink = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (/** @type {{ collectiviteId: string }} */ { collectiviteId }) => (
      await rotateCollectiviteInvitationLink(collectiviteId)
    )?.data ?? null,
    onSuccess: (data, variables) => {
      queryClient.setQueryData(collectiviteInvitationLinkQueryKey(variables?.collectiviteId), data);
    },
  });
};

/**
 * Les invitations en cours de la Ville.
 * @param {string | null | undefined} collectiviteId - documentId.
 * @param {QueryOptions} [options] - Options react-query.
 * @returns {RowsQuery} Le resultat react-query ; `data` est un tableau.
 */
export const useCollectiviteInvitations = (collectiviteId, options = {}) => useQuery({
  enabled: Boolean(collectiviteId),
  queryFn: async () => unwrapRows(await getCollectiviteInvitations(String(collectiviteId))),
  queryKey: collectiviteInvitationsQueryKey(collectiviteId),
  staleTime: 60_000,
  ...options,
});

/**
 * Un geste sur les invitations, puis la relecture de leur liste.
 * @param {(variables: any) => Promise<any>} mutationFn - Le geste du service.
 * @returns {any} La mutation ; variables avec `collectiviteId`.
 */
const useGesteInvitation = (mutationFn) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: collectiviteInvitationsQueryKey(variables?.collectiviteId),
      });
    },
  });
};

/**
 * « Par FoundClub » : variables `{ collectiviteId, clubName, clubContact }`.
 * @returns {any} La mutation.
 */
export const useInviteClubByFoundClub = () => useGesteInvitation(inviteClubByFoundClub);

/**
 * « Relancer » : variables `{ collectiviteId, invitationId }`.
 * @returns {any} La mutation.
 */
export const useRemindCollectiviteInvitation = () => useGesteInvitation(
  remindCollectiviteInvitation,
);

/**
 * La page publique du lien : la Ville qui invite et ses installations. Sans compte.
 * @param {string | null | undefined} token - Le code du lien.
 * @returns {any} Le resultat react-query ; `data` vaut `{ collectivite, installations }` ou null.
 */
export const useCollectiviteInvitationPreview = (token) => useQuery({
  enabled: Boolean(token),
  queryFn: async () => (await getCollectiviteInvitationPreview(String(token)))?.data ?? null,
  queryKey: ['collectivite-invitation', token, 'preview'],
  retry: false,
  staleTime: 5 * 60 * 1000,
});

/**
 * Les clubs que je dirige, pour demander leur rattachement a la Ville du lien.
 * @param {string | null | undefined} token - Le code du lien.
 * @param {QueryOptions} [options] - Options react-query.
 * @returns {RowsQuery} Le resultat react-query ; `data` est un tableau.
 */
export const useMyClubsForCollectiviteInvitation = (token, options = {}) => useQuery({
  enabled: Boolean(token),
  queryFn: async () => unwrapRows(await getMyClubsForCollectiviteInvitation(String(token))),
  queryKey: ['collectivite-invitation', token, 'my-clubs'],
  staleTime: 0,
  ...options,
});

/**
 * Demander le rattachement : variables `{ token, clubId }`.
 * @returns {any} La mutation ; `data` vaut `{ status, outsideCommune }`.
 */
export const useRequestCollectiviteAttach = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (/** @type {{ clubId: string, token: string }} */ variables) => (
      await requestCollectiviteAttach(variables)
    )?.data ?? null,
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ['collectivite-invitation', variables?.token, 'my-clubs'],
      });
    },
  });
};

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

// ─── COLL-ACCUEIL (01/10/2026) : LA DEMANDE DE GESTIONNAIRE ────────────────────────────

export const MY_MANAGER_REQUESTS_QUERY_KEY = ['collectivite-manager-requests', 'mine'];

/**
 * MES demandes de gestionnaire (l ecran d attente, l arrivee d un compte Ville seule).
 * @param {QueryOptions} [options] - Options react-query.
 * @returns {RowsQuery} Le resultat react-query ; `data` est un tableau.
 */
export const useMyManagerRequests = (options = {}) => useQuery({
  queryFn: async () => unwrapRows(await getMyManagerRequests()),
  queryKey: MY_MANAGER_REQUESTS_QUERY_KEY,
  staleTime: 30_000,
  ...options,
});

/**
 * Les collectivites DEJA sur FoundClub dont le nom contient le texte (3 lettres au moins).
 * @param {string} query - Le texte tape.
 * @returns {RowsQuery} Le resultat react-query ; `data` est un tableau.
 */
export const useCollectiviteSignupSearch = (query) => {
  const texte = String(query || '').trim();
  return useQuery({
    enabled: texte.length >= 3,
    queryFn: async () => unwrapRows(await searchCollectivitesForSignup(texte)),
    queryKey: ['collectivite-manager-requests', 'search', texte.toLowerCase()],
    staleTime: 60_000,
  });
};

/**
 * Envoie MA demande, puis relit mes demandes.
 * @param {QueryOptions} [options] - Options react-query (`onSuccess` compris).
 * @returns {any} La mutation.
 */
export const useCreateManagerRequest = (options = {}) => {
  const queryClient = useQueryClient();
  const { onSuccess, ...rest } = options;
  return useMutation({
    mutationFn: createManagerRequest,
    onSuccess: async (data, variables, context) => {
      await queryClient.invalidateQueries({ queryKey: MY_MANAGER_REQUESTS_QUERY_KEY });
      onSuccess?.(data, variables, context);
    },
    ...rest,
  });
};

/**
 * La clef de la file de la console : sous le prefixe des collectivites de la console, pour
 * qu accepter (qui peut CREER une collectivite) relise aussi la liste et les fiches.
 * @param {'pending' | 'decided'} status - L onglet.
 * @returns {Array<string>} La clef.
 */
export const adminManagerRequestsQueryKey = (status) => [
  ...ADMIN_COLLECTIVITES_QUERY_KEY, 'demandes-de-gestionnaire', status,
];

/**
 * La file des demandes de gestionnaire (console super-admin).
 * @param {'pending' | 'decided'} status - L onglet.
 * @param {QueryOptions} [options] - Options react-query.
 * @returns {RowsQuery} Le resultat react-query ; `data` est un tableau.
 */
export const useAdminManagerRequests = (status, options = {}) => useQuery({
  queryFn: async () => unwrapRows(await getAdminManagerRequests(status)),
  queryKey: adminManagerRequestsQueryKey(status),
  staleTime: 0,
  ...options,
});

/**
 * Accepter ou refuser une demande ; variables `{ decision, requestId, data }`. Relit la file,
 * la liste et les fiches des collectivites.
 * @param {QueryOptions} [options] - Options react-query.
 * @returns {any} La mutation.
 */
export const useDecideManagerRequest = (options) => useGesteSuperAdmin(
  decideManagerRequest,
  options,
);
