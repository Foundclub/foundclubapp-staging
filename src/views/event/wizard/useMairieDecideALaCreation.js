import { format } from 'date-fns';

import { isoWeekdayOf } from '@/domains/seasonSlot/seasonSlotDisplay';

import { useManagingCollectiviteId } from '@/services/collectivite/collectiviteQueries';
import { useClubCollectiviteFacilities } from '@/services/facility/facilityQueries';
import { useSeasonSlotPreview } from '@/services/seasonSlot/seasonSlotQueries';

/**
 * Une date du tunnel (Date ou chaîne), ou null si illisible.
 * @param {unknown} valeur - La valeur du tunnel.
 * @returns {Date | null} La date.
 */
const lireDate = (valeur) => {
  if (!valeur) return null;
  const date = valeur instanceof Date ? valeur : new Date(/** @type {any} */ (valeur));
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * 🏛️ COLL-R-APP-CREATION (13/10/2026, COL-003, décision d'Adel « D2- A ») — À LA CRÉATION D'UN
 * ÉVÉNEMENT, LA MAIRIE DÉCIDERA-T-ELLE ? Hors des créneaux du club, sur une installation de la
 * Ville, le serveur crée la séance « en attente » et l'envoie à la mairie, place libre ou non
 * (SPEC-PLACE) ; si elle refuse, la séance est annulée (`deplacer A`). L'étape 4 et le
 * récapitulatif le disent AVANT « Créer » : même question que « Demander un créneau » (l'aperçu
 * COLL-FIX2, au nom du club et de l'équipe), même règle que « Modifier »
 * (`useMairieDecideDuDeplacement`). Sans réponse du serveur (ancien, en panne) : non — jamais une
 * promesse fausse.
 * ponytail: une série sur PLUSIEURS jours de la semaine est jugée sur le jour de sa première date
 * (comme la ligne « Hors de tes créneaux » d'avant) ; sortie : un aperçu par jour de la série.
 * @param {any} etat - L'état du tunnel (équipe et son club, date, heures, série).
 * @param {string | { documentId?: string } | null | undefined} installation - L'installation
 *   cochée (l'étape 4 la tient avant « Suivant ») ou celle du tunnel.
 * @returns {{ complet: boolean, deLaVille: boolean, mairie: boolean, tuAcceptes: boolean,
 *   ville: string | null }} `deLaVille` : l'installation est à une Ville du club (son nom :
 *   `ville`) ; `mairie` : le serveur a dit que la mairie décidera ; `complet` : plus de place
 *   (« Tu peux demander quand même ») ; `tuAcceptes` : ce compte gère cette Ville.
 */
const useMairieDecideALaCreation = (etat, installation) => {
  const facilityId = (
    typeof installation === 'string' ? installation : installation?.documentId
  ) || null;
  const club = etat?.team?.club?.documentId || null;
  const team = etat?.team?.documentId || null;
  const installationsDeLaVille = useClubCollectiviteFacilities(facilityId ? club : null);
  const liste = Array.isArray(installationsDeLaVille.data) ? installationsDeLaVille.data : [];
  const deLaVille = facilityId
    ? liste.find((/** @type {any} */ item) => item?.documentId === facilityId) || null
    : null;

  const jour = lireDate(etat?.date);
  const debut = lireDate(etat?.startTime);
  const fin = lireDate(etat?.endTime);
  const finDeSerie = etat?.isRecurrent ? lireDate(etat?.recurrenceEndDate) : null;
  // Un objet neuf à chaque rendu : react-query compare sa clé par VALEUR (une seule lecture).
  const validFrom = jour ? format(jour, 'yyyy-MM-dd') : null;
  const params = deLaVille && club && jour && debut && fin
    ? {
      club,
      endTime: format(fin, 'HH:mm'),
      startTime: format(debut, 'HH:mm'),
      ...(team ? { team } : {}),
      validFrom,
      validUntil: finDeSerie ? format(finDeSerie, 'yyyy-MM-dd') : validFrom,
      weekday: isoWeekdayOf(jour),
    }
    : null;

  const apercu = useSeasonSlotPreview(params ? facilityId : null, params);
  const reponse = params && !apercu.isPlaceholderData ? apercu.data?.data || null : null;
  const mairie = reponse?.decision?.outcome === 'mairie';
  const villeGeree = useManagingCollectiviteId(facilityId, { enabled: mairie });

  return {
    complet: mairie && Number(reponse?.remaining) === 0,
    deLaVille: Boolean(deLaVille),
    mairie,
    tuAcceptes: mairie && Boolean(villeGeree),
    ville: deLaVille?.collectivite?.name || null,
  };
};

export default useMairieDecideALaCreation;
