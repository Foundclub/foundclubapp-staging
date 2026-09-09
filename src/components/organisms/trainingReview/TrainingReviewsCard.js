import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

/**
 * 🚪 LA PORTE DU BLOC « AVIS DES JOUEURS ».
 *
 * Trois conditions, et il en faut TROIS. Elle vit ici plutot que fondue dans les
 * 8 000 lignes d `EventDetails` pour qu on puisse la lire — et la tester — sans
 * monter l ecran entier. Temoins AVIS-APP/1 et AVIS-APP/2.
 *
 * ⛔ L absence d information vaut NON : un evenement pas encore charge ne doit
 * pas faire clignoter un bloc qui ne le concerne peut-etre pas.
 * @param {{ canEdit?: boolean, isFinished?: boolean, isTraining?: boolean }} [conditions]
 *   - L etat de l ecran.
 * @returns {boolean} - Vrai quand le bloc doit apparaitre.
 */
export const peutVoirLesAvisDEntrainement = (conditions) => Boolean(
  conditions
  && conditions.isTraining
  && conditions.isFinished
  && conditions.canEdit,
);

/**
 * Le texte d un commentaire, ou rien du tout.
 * @param {unknown} valeur - Le commentaire brut.
 * @returns {string} - Le commentaire nettoye, vide s il n y en a pas.
 */
const texteDuCommentaire = (valeur) => String(
  valeur === null || valeur === undefined ? '' : valeur,
).trim();

/**
 * Le bloc « Avis des joueurs » de la fiche d un entrainement, cote encadrant.
 *
 * 🔢 IL NE DECIDE PAS DU SEUIL — c est le serveur qui le fait, et c est voulu :
 * sous deux avis il ne rend PAS `reviews`, donc il n y a rien a cacher ici.
 * Cette carte se contente de DIRE pourquoi elle ne montre rien.
 * @param {object} props - Les proprietes.
 * @param {any} props.donnees - La reponse de `GET /events/:id/training-reviews`.
 * @returns {import('react').ReactElement} - Le bloc.
 */
function TrainingReviewsCard({ donnees }) {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Fonts, Spaces,
  } = useTheme();

  const count = Number(donnees?.count || 0);
  const minimum = Number(donnees?.minimumReviews || 2);
  const avis = Array.isArray(donnees?.reviews) ? donnees.reviews : [];
  const seuilAtteint = Boolean(donnees?.thresholdReached) && avis.length > 0;

  return (
    <View style={[Spaces.gap[12]]}>
      <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
        {t('eventDetails.trainingReview.title')}
      </Text>

      <View
        style={[
          ApplicationStyle.card,
          ApplicationStyle.borderRadius16,
          Spaces.padding[16],
          Spaces.gap[12],
        ]}
      >
        {count === 0 ? (
          <Text style={[Fonts.p3, Fonts.neutral100]}>
            {t('eventDetails.trainingReview.empty')}
          </Text>
        ) : null}

        {count > 0 && !seuilAtteint ? (
          <Text style={[Fonts.p3, Fonts.neutral100]}>
            {t('eventDetails.trainingReview.waiting', { count, minimum })}
          </Text>
        ) : null}

        {seuilAtteint ? (
          <>
            <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                {t('eventDetails.trainingReview.average')}
              </Text>
              <Text style={[Fonts.h4Bold, Fonts.primary200]}>
                {`${donnees?.average ?? '-'}`}
              </Text>
            </View>

            {avis.map((item, index) => {
              const commentaire = texteDuCommentaire(item?.comment);
              return (
                <View
                  // Un avis anonyme n a PAS d identifiant, et c est exactement le
                  // point (voir le serialiseur du serveur) : la clef ne peut donc
                  // etre que la position dans une liste qui ne se reordonne pas.
                  // eslint-disable-next-line react/no-array-index-key
                  key={`avis-${index}`}
                  style={[
                    ApplicationStyle.borderRadius16,
                    Spaces.padding[12],
                    Spaces.gap[8],
                    ApplicationStyle.backgroundColor.primary700,
                  ]}
                >
                  <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
                    {t('eventDetails.trainingReview.outOfTen', { rating: item?.rating })}
                  </Text>
                  <Text style={[Fonts.p4, Fonts.neutral100]}>
                    {commentaire || t('eventDetails.trainingReview.noComment')}
                  </Text>
                </View>
              );
            })}
          </>
        ) : null}
      </View>
    </View>
  );
}

export default TrainingReviewsCard;
