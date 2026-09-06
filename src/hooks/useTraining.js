import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import {
  clearLocalSession,
  getUnsyncedResults,
  markResultsSynced,
  mergeResults,
  putLocalResult,
  removeLocalResult,
} from '@/services/training/trainingLocalStore';
import {
  chooseTrainingProgram,
  exportTrainingResults,
  getMyTraining,
  getTrainingProgram,
  getTrainingPrograms,
  leaveTrainingProgram,
  saveTrainingResults,
  updateTrainingSession,
} from '@/services/training/trainingService';

/**
 * Une mesure telle que le carnet local l'exige : le test et la grandeur sont
 * la CLE, ils ne peuvent pas manquer.
 * @typedef {{
 *   attempt?: number, measureKey: string, side?: string, testDocumentId: string
 * }} MesureSaisie
 */

export const TRAINING_MINE_KEY = ['training', 'mine'];
export const TRAINING_CATALOG_KEY = ['training', 'catalog'];
/**
 * La clef de cache d'un programme.
 * @param {string} documentId Identifiant Strapi du programme.
 * @returns {string[]} la clef react-query du programme
 */
export const trainingProgramKey = (documentId) => ['training', 'program', documentId];

/**
 * ⚠️ PIEGE MAISON : `invalidateQueries` ne relit RIEN quand la requete est en veille
 * (aucun composant monte ne l'observe). Apres chaque mutation on invalide POUR les
 * ecrans montes, et on relit explicitement la requete « mon entrainement », qui est
 * celle dont depend la carte de l'accueil.
 * @returns {() => Promise<void>} La fonction a appeler apres une mutation pour remettre
 *   « mon entrainement » a jour, meme si aucun ecran monte ne l'observe.
 */
const useRefreshTraining = () => {
  const queryClient = useQueryClient();
  return useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: TRAINING_MINE_KEY });
    await queryClient.refetchQueries({ queryKey: TRAINING_MINE_KEY, type: 'all' });
  }, [queryClient]);
};

/**
 * Le catalogue des programmes publies.
 * @param {object} [options] Options d'appel du hook.
 * @param {boolean} [options.enabled] Faux pour ne pas interroger le serveur.
 * @returns {import('@tanstack/react-query').UseQueryResult<Array<Record<string, any>>>} La requete
 *   du
 *   catalogue ; `data` liste les programmes publies, tableau vide s'il n'y en a aucun.
 */
export const useTrainingCatalog = ({ enabled = true } = {}) => useQuery({
  enabled,
  queryFn: getTrainingPrograms,
  queryKey: TRAINING_CATALOG_KEY,
  staleTime: 5 * 60 * 1000,
});

/**
 * Un programme et tout son contenu.
 * @param {string} documentId Identifiant du programme a charger.
 * @param {object} [options] Options d'appel du hook.
 * @param {boolean} [options.enabled] Faux pour ne pas interroger le serveur.
 * @returns {import('@tanstack/react-query').UseQueryResult<Record<string, any>|null>} La requete du
 *   programme ; `data` vaut `null` tant que le serveur n'a rien rendu.
 */
export const useTrainingProgram = (documentId, { enabled = true } = {}) => useQuery({
  enabled: enabled && Boolean(documentId),
  queryFn: () => getTrainingProgram(documentId),
  queryKey: trainingProgramKey(documentId),
  staleTime: 5 * 60 * 1000,
});

/**
 * « Mon entrainement ». Rend aussi les seances triees et la PROCHAINE seance a faire :
 * c'est cette derniere que la carte de l'accueil affiche, et la calculer ici evite
 * que chaque ecran la recalcule a sa facon.
 * @param {object} [options] Options d'appel du hook.
 * @param {boolean} [options.enabled] Faux pour ne pas interroger le serveur.
 * @returns {import('@tanstack/react-query').UseQueryResult<Record<string, any>|null> & {
 *   enrollment: Record<string, any>|null,
 *   nextSession: Record<string, any>|null,
 *   progress: { done: number, ratio: number, total: number },
 *   sessions: Array<Record<string, any>>,
 * }} La requete, augmentee de l'inscription, des seances triees, de la prochaine
 *   seance a faire et de l'avancement.
 */
export const useMyTraining = ({ enabled = true } = {}) => {
  const query = useQuery({
    enabled,
    queryFn: getMyTraining,
    queryKey: TRAINING_MINE_KEY,
    staleTime: 60 * 1000,
  });

  const enrollment = query.data || null;

  const sessions = useMemo(() => {
    /** @type {Record<string, any>[]} */
    const brutes = enrollment?.sessions;
    const list = Array.isArray(brutes) ? /** @type {Record<string, any>[]} */ ([...brutes]) : [];
    return list.sort((a, b) => {
      const orderA = a?.day?.displayOrder ?? 0;
      const orderB = b?.day?.displayOrder ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      return String(a?.plannedDate || '').localeCompare(String(b?.plannedDate || ''));
    });
  }, [enrollment]);

  const nextSession = useMemo(
    () => sessions.find((s) => s.status === 'in_progress')
      || sessions.find((s) => s.status === 'planned')
      || null,
    [sessions],
  );

  const progress = useMemo(() => {
    const done = sessions.filter((s) => s.status === 'done').length;
    return { done, ratio: sessions.length ? done / sessions.length : 0, total: sessions.length };
  }, [sessions]);

  return {
    ...query, enrollment, nextSession, progress, sessions,
  };
};

/**
 * « Je choisis cet entrainement ».
 * @returns {import('@tanstack/react-query').UseMutationResult<
 *   Record<string, any>|null, Error, { programDocumentId: string, startDate?: string }
 * >} La mutation qui cree l'inscription et ses seances, puis relit « mon entrainement ».
 */
export const useChooseTrainingProgram = () => {
  const refresh = useRefreshTraining();
  return useMutation({
    mutationFn: ({ programDocumentId, startDate }) => (
      chooseTrainingProgram(programDocumentId, startDate)
    ),
    onSuccess: refresh,
  });
};

/**
 * @typedef {import('@tanstack/react-query').UseMutationResult<
 *   Record<string, any>|null, Error, void
 * >} Desinscription
 */

/**
 * Quitter le programme en cours.
 * @returns {Desinscription} La mutation de desinscription ; les resultats
 *   deja saisis sont conserves.
 */
export const useLeaveTrainingProgram = () => {
  const refresh = useRefreshTraining();
  return useMutation({ mutationFn: leaveTrainingProgram, onSuccess: refresh });
};

/**
 * Mettre a jour une seance : etat, date, controle de fraicheur, notes.
 * @returns {import('@tanstack/react-query').UseMutationResult<
 *   Record<string, any>|null, Error, { payload: Record<string, any>, sessionDocumentId: string }
 * >} La mutation qui envoie la seance modifiee puis relit « mon entrainement ».
 */
export const useUpdateTrainingSession = () => {
  const refresh = useRefreshTraining();
  return useMutation({
    mutationFn: ({ payload, sessionDocumentId }) => (
      updateTrainingSession(sessionDocumentId, payload)
    ),
    onSuccess: refresh,
  });
};

/**
 * LA SAISIE D'UN RESULTAT — la fonction la plus utilisee de l'ecran de test.
 *
 * Elle ecrit TOUJOURS en local d'abord et rend la main tout de suite : sur un terrain,
 * une saisie ne doit jamais attendre le reseau. L'envoi au serveur suit, et son echec
 * n'efface rien : la mesure reste en attente et repartira au prochain envoi.
 * @param {string} sessionDocumentId Identifiant de la seance dont on saisit les mesures.
 * @returns {{
 *   forget: (row: Record<string, any>) => Record<string, Record<string, any>>,
 *   hasPending: () => boolean,
 *   merge: (serverResults: Array<Record<string, any>>) => Record<string, Record<string, any>>,
 *   pendingCount: () => number,
 *   record: (row: Record<string, any>) => Record<string, Record<string, any>>,
 *   reset: () => void,
 *   sync: import('@tanstack/react-query').UseMutationResult<Record<string, any>, Error, void>,
 * }} Le carnet local de la seance, et l'envoi differe de ses mesures au serveur.
 */
export const useTrainingResults = (sessionDocumentId) => {
  const refresh = useRefreshTraining();

  const record = useCallback(
    (/** @type {Record<string, any>} */ row) => putLocalResult(
      sessionDocumentId,
      /** @type {MesureSaisie} */ (row),
    ),
    [sessionDocumentId],
  );
  const forget = useCallback(
    (/** @type {Record<string, any>} */ row) => removeLocalResult(sessionDocumentId, row),
    [sessionDocumentId],
  );

  const sync = useMutation({
    mutationFn: async () => {
      const pending = getUnsyncedResults(sessionDocumentId);
      if (!pending.length) return { rejected: [], saved: 0 };
      const response = await saveTrainingResults(sessionDocumentId, pending);
      markResultsSynced(sessionDocumentId, pending);
      return response;
    },
    onSuccess: refresh,
  });

  return {
    forget,
    hasPending: () => getUnsyncedResults(sessionDocumentId).length > 0,
    merge: (serverResults) => mergeResults(serverResults, sessionDocumentId),
    pendingCount: () => getUnsyncedResults(sessionDocumentId).length,
    record,
    reset: () => clearLocalSession(sessionDocumentId),
    sync,
  };
};

/**
 * Le carnet complet, une mesure par ligne.
 * @param {object} [options] Options d'appel du hook.
 * @param {boolean} [options.enabled] Vrai pour lancer l'export ; faux par defaut, pour
 *   ne pas fabriquer le fichier tant que personne ne l'a demande.
 * @returns {import('@tanstack/react-query').UseQueryResult<{ csv: string, rows: number }>}
 *   La requete d'export ; `data.csv` est pret a coller.
 */
export const useTrainingExport = ({ enabled = false } = {}) => useQuery({
  enabled,
  queryFn: exportTrainingResults,
  queryKey: ['training', 'export'],
  staleTime: 0,
});
