import { useTranslation } from 'react-i18next';

import { closureRefusalText } from '@/domains/facilityClosure/facilityClosureDisplay';

import { useGetFacilityOccupancy } from '@/services/facility/facilityQueries';

import preventionDuCreneau from './preventionDuCreneau';
import useMairieDecideALaCreation from './useMairieDecideALaCreation';

/**
 * La fenêtre d'une séance : le jour et ses heures, la fin le lendemain si elle passe minuit.
 * @param {any} jour - Le jour (Date ou chaîne).
 * @param {any} debut - L'heure de début (Date).
 * @param {any} fin - L'heure de fin (Date).
 * @returns {{ end: string | null, start: string | null }} Les deux bornes ISO.
 */
export const fenetreDeLaSeance = (jour, debut, fin) => {
  const poser = (/** @type {any} */ heure) => {
    if (!jour || !heure) return null;
    const date = new Date(jour);
    const temps = new Date(heure);
    if (Number.isNaN(date.getTime()) || Number.isNaN(temps.getTime())) return null;
    date.setHours(temps.getHours(), temps.getMinutes(), 0, 0);
    return date;
  };
  const start = poser(debut);
  const end = poser(fin);
  if (start && end && end <= start) end.setDate(end.getDate() + 1);
  return { end: end ? end.toISOString() : null, start: start ? start.toISOString() : null };
};

/**
 * 🗓️ DATESDABORD (25/10/2026, décision d'Adel « 6- B ») — LE LIEU D'ABORD, LE JUGEMENT À LA DATE :
 * l'installation est choisie à l'étape « Lieu » ; à l'étape « Date & horaire », chaque horaire
 * touché relit la place (`/facilities/:id/occupancy`, la fermeture comprise) et la mairie
 * (`useMairieDecideALaCreation`), et dit « Ce créneau est libre » ou « Attention, ce créneau est
 * déjà pris : … » (`preventionDuCreneau`). Sur un gymnase de la Ville, le créneau du club et la
 * mairie font foi (SPEC-PLACE) : pas de « libre / pris » sans la réponse de la mairie.
 * Sans réponse du serveur (en lecture, en panne) : rien n'est promis, « Suivant » attend.
 * Témoin : __tests__/EventWizardLogistics.DATESDABORD.prevention.test.js.
 * @param {any} etat - L'état du tunnel (équipe, type, installation, série).
 * @param {{ date: any, debut: any, fin: any, actif?: boolean }} seance - Le jour et les heures
 *   en cours de saisie ; `actif` faux : rien n'est lu (un tournoi sur plusieurs jours).
 * @returns {{
 *   bloque: boolean, enLecture: boolean, enPanne: boolean, fermeture: string | null,
 *   mairie: string | null, prevention: { pris: boolean, texte: string } | null,
 *   relire: () => any,
 * }} Ce que l'étape dit et ce qui bloque « Suivant ».
 */
const useJugementDuCreneau = (etat, {
  actif = true, date, debut, fin,
}) => {
  const { t } = useTranslation();
  const installation = actif ? (etat?.facility || null) : null;
  const fenetre = installation ? fenetreDeLaSeance(date, debut, fin) : { end: null, start: null };
  const place = useGetFacilityOccupancy(installation, fenetre, {
    refetchOnMount: 'always',
    staleTime: 0,
  });
  const decision = useMairieDecideALaCreation(
    {
      ...etat, date, endTime: fin, startTime: debut,
    },
    installation,
  );
  const lue = place.data?.data || null;
  const bloque = Boolean(installation && lue?.blocked);
  const enPanne = Boolean(installation && place.isError);
  const enLecture = Boolean(installation && !enPanne && (
    !fenetre.start || !fenetre.end || place.isFetching || place.isLoading
  ));
  const occupation = installation && !bloque && !enLecture && !enPanne && lue
    ? { ...lue, isShared: Boolean(etat?.facilityShared) }
    : null;

  let mairie = null;
  if (installation && decision.mairie) {
    mairie = t(
      'collectiviteDemandes.decision.mairieLibre',
      'Hors des créneaux de ton club : la mairie décidera, même s’il reste de la place.',
    );
    if (decision.tuAcceptes) {
      mairie = t(
        'collectiviteDemandes.decision.tuAcceptes',
        'Ta demande partira à la Ville ; tu pourras l’accepter toi-même dans Demandes.',
      );
    } else if (decision.complet) {
      mairie = t(
        'collectiviteDemandes.club.quandMeme',
        'Tu peux demander quand même : la mairie décidera.',
      );
    }
  }

  const prevention = decision.deLaVille
    ? null
    : preventionDuCreneau(t, {
      gestionnaire: (occupation?.isShared && etat?.team?.club?.parentMultisport?.name)
        || etat?.team?.club?.name
        || t('eventWizard.steps.location.prevention.tonClub', 'ton club'),
      mairie: decision.mairie,
      occupation,
      typeName: etat?.type?.name,
    });

  return {
    bloque,
    enLecture,
    enPanne,
    fermeture: bloque ? closureRefusalText(t, lue?.closure || null, lue?.facility?.name) : null,
    mairie,
    prevention,
    relire: () => place.refetch(),
  };
};

export default useJugementDuCreneau;
