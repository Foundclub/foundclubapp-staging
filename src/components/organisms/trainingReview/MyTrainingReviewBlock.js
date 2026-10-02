import { MyTrainingReviewNote } from '@/components/organisms/trainingReview/TrainingReviewsCard';

import { useGetMyTrainingReview } from '@/services/trainingReview/trainingReviewQueries';

/**
 * ST-RETOURS (02/10, planche 21 etat 4) — sur la fiche d un entrainement termine, le joueur
 * relit SA note : « Tu as noté cette séance : 8/10 ». Jamais les avis des autres.
 *
 * ⚠️ Un composant a part, monte SEULEMENT quand la porte `peutRelireSaNote` est ouverte :
 * la lecture ne part jamais pour un encadrant, et les temoins de la fiche (qui doublent
 * `trainingReviewQueries` sans cette lecture) ne la rencontrent pas.
 * @param {object} props - Les proprietes.
 * @param {string} props.eventId - L entrainement.
 * @param {string | null} [props.trainerFirstname] - Le prenom de l entraineur.
 * @returns {import('react').ReactElement | null} - La ligne, ou rien s il n a pas note.
 */
function MyTrainingReviewBlock({ eventId, trainerFirstname = null }) {
  const { data } = useGetMyTrainingReview(eventId);
  return <MyTrainingReviewNote review={data} trainerFirstname={trainerFirstname} />;
}

export default MyTrainingReviewBlock;
