import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import localeDesFormats from '@/theme/strings/localeDesFormats';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Icone from '@/components/atoms/SvgIcon/SvgIcon';

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
 * ST-RETOURS (planche 21, etat 4) — LA PORTE DE « TU AS NOTE CETTE SEANCE ».
 * Un MEMBRE de l equipe qui n encadre pas, sur un entrainement termine. La meme absence
 * d information vaut NON. Le serveur ne rend de toute facon que SA note.
 * @param {object} [conditions] - L etat de l ecran.
 * @param {boolean} [conditions.canEdit] - Le lecteur encadre la seance.
 * @param {boolean} [conditions.isFinished] - La seance est terminee.
 * @param {boolean} [conditions.isTeamMember] - Le lecteur est membre de l equipe.
 * @param {boolean} [conditions.isTraining] - C est un entrainement.
 * @returns {boolean} - Vrai quand la ligne peut apparaitre.
 */
export const peutRelireSaNote = (conditions) => Boolean(
  conditions
  && conditions.isTraining
  && conditions.isFinished
  && conditions.isTeamMember
  && !conditions.canEdit,
);

/**
 * Le texte d un commentaire, ou rien du tout.
 * @param {unknown} valeur - Le commentaire brut.
 * @returns {string} - Le commentaire nettoye, vide s il n y en a pas.
 */
const texteDuCommentaire = (valeur) => String(
  valeur === null || valeur === undefined ? '' : valeur,
).trim();

/** Les tranches de la repartition (planche 21, etat 3). */
const TRANCHES = [
  { high: 10, low: 9, tone: 'haut' },
  { high: 8, low: 7, tone: 'haut' },
  { high: 6, low: 5, tone: 'moyen' },
  { high: 4, low: 1, tone: 'bas' },
];

/**
 * ST-RETOURS — combien d avis dans chaque tranche. Calcule par l app depuis les avis rendus :
 * le serveur n a rien a ajouter (et la liste est deja anonyme).
 * @param {any[]} avis - Les avis.
 * @returns {{ count: number, high: number, low: number, tone: string }[]} - Les tranches.
 */
export const repartirLesNotes = (avis) => TRANCHES.map((tranche) => ({
  ...tranche,
  count: (Array.isArray(avis) ? avis : []).filter((item) => {
    const note = Number(item?.rating);
    return Number.isFinite(note) && note >= tranche.low && note <= tranche.high;
  }).length,
}));

/**
 * Une moyenne lisible, a la francaise : « 7,6 ».
 * @param {unknown} valeur - La moyenne.
 * @returns {string} - La moyenne, ou un tiret.
 */
const formaterMoyenne = (valeur) => {
  const nombre = Number(valeur);
  if (valeur === null || valeur === undefined || !Number.isFinite(nombre)) return '-';
  return new Intl.NumberFormat(localeDesFormats(), { maximumFractionDigits: 1 }).format(nombre);
};

/**
 * La ligne « qui peut lire » : un cadenas, et la phrase.
 * @param {object} props - Les proprietes.
 * @param {string} props.text - La phrase.
 * @returns {import('react').ReactElement} - La ligne.
 */
function LigneAnonymat({ text }) {
  const { Alignments, Colors, Fonts } = useTheme();
  return (
    <View style={[Alignments.row, { gap: 8 }]}>
      <Icone
        color={Colors.neutral300}
        height={14}
        name="shield"
        style={{ marginTop: 2 }}
        width={14}
      />
      <Text style={[Fonts.p3, Fonts.neutral300, { flex: 1 }]}>{text}</Text>
    </View>
  );
}

/**
 * Le bloc « Avis des joueurs » de la fiche d un entrainement, cote encadrant.
 *
 * 🔢 IL NE DECIDE PAS DU SEUIL — c est le serveur qui le fait, et c est voulu :
 * sous le seuil il ne rend PAS `reviews`, donc il n y a rien a cacher ici.
 *
 * ST-RETOURS (02/10, planche 21 du design valide) : la moyenne en grand, la repartition,
 * « n avis sur m presents » (`presentCount`, rendu par le serveur), chaque mot avec sa note,
 * les notes sans mot regroupees ; plus de « Il en faut 2 » (le seuil vaut 1 depuis le 10/09).
 * @param {object} props - Les proprietes.
 * @param {any} props.donnees - La reponse de `GET /events/:id/training-reviews`.
 * @returns {import('react').ReactElement} - Le bloc.
 */
function TrainingReviewsCard({ donnees }) {
  const { t } = useTranslation();
  const {
    Alignments, Colors, Fonts,
  } = useTheme();

  const count = Number(donnees?.count || 0);
  const presents = Number(donnees?.presentCount);
  const aDesPresents = donnees?.presentCount !== null && donnees?.presentCount !== undefined
    && Number.isFinite(presents);
  const avis = Array.isArray(donnees?.reviews) ? donnees.reviews : [];
  const avecMot = avis.filter((item) => texteDuCommentaire(item?.comment));
  const sansMot = avis.length - avecMot.length;
  const repartition = repartirLesNotes(avis);
  const plusGrandeTranche = Math.max(1, ...repartition.map((tranche) => tranche.count));
  const tauxDeReponse = aDesPresents
    ? t('stRetours.card.reviewsOfPresent', { count: presents, reviews: count })
    : t('stRetours.card.reviewsCount', { count });

  const couleurDeTranche = (/** @type {string} */ tone) => {
    if (tone === 'bas') return Colors.error500;
    if (tone === 'moyen') return Colors.warning500;
    return Colors.success500;
  };

  let corps;
  if (count === 0) {
    corps = <Text style={[Fonts.p2, Fonts.neutral200]}>{t('stRetours.card.empty')}</Text>;
  } else if (avis.length === 1) {
    const seul = avis[0];
    const mot = texteDuCommentaire(seul?.comment);
    corps = (
      <>
        <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween]}>
          <Text style={[Fonts.h1Black, Fonts.neutral00]}>
            {`${seul?.rating ?? '-'}`}
            <Text style={[Fonts.p2, Fonts.neutral300]}>{t('stRetours.card.outOfTenSuffix')}</Text>
          </Text>
          <Text style={[Fonts.p3, Fonts.neutral300]}>{tauxDeReponse}</Text>
        </View>
        {mot ? (
          <View
            style={{
              backgroundColor: withAlpha(Colors.neutral00, 0.05),
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 12,
            }}
          >
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              {t('stRetours.card.singleQuote', { text: mot, ...SANS_ECHAPPEMENT })}
            </Text>
          </View>
        ) : null}
      </>
    );
  } else if (avis.length > 1) {
    corps = (
      <>
        <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween]}>
          <Text style={[Fonts.h1Black, Fonts.neutral00, { fontSize: 40, lineHeight: 48 }]}>
            {formaterMoyenne(donnees?.average)}
          </Text>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[Fonts.p3, Fonts.neutral300]}>{t('stRetours.card.averageHint')}</Text>
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{tauxDeReponse}</Text>
          </View>
        </View>

        <View
          accessibilityLabel={t('stRetours.card.distributionA11y', {
            parts: repartition.map((tranche) => t('stRetours.card.bucketA11y', {
              count: tranche.count,
              high: tranche.high,
              low: tranche.low,
            })).join(' ; '),
            ...SANS_ECHAPPEMENT,
          })}
          accessibilityRole="image"
          style={{ gap: 6 }}
          testID="training-reviews-distribution"
        >
          {repartition.map((tranche) => (
            <View key={tranche.low} style={[Alignments.row, Alignments.alignCenter, { gap: 8 }]}>
              <Text style={[Fonts.p4Bold, Fonts.neutral300, { width: 40 }]}>
                {`${tranche.low} – ${tranche.high}`}
              </Text>
              <View
                style={{
                  backgroundColor: withAlpha(Colors.neutral00, 0.1),
                  borderRadius: 3,
                  flex: 1,
                  height: 6,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    backgroundColor: couleurDeTranche(tranche.tone),
                    borderRadius: 3,
                    height: 6,
                    width: `${Math.round((tranche.count / plusGrandeTranche) * 100)}%`,
                  }}
                />
              </View>
              <Text style={[Fonts.p3Bold, Fonts.neutral100, { textAlign: 'right', width: 20 }]}>
                {tranche.count}
              </Text>
            </View>
          ))}
        </View>

        {avecMot.length ? (
          <View style={{ backgroundColor: withAlpha(Colors.neutral00, 0.08), height: 1 }} />
        ) : null}

        {avecMot.map((item, index) => (
          <View
            // Un avis anonyme n a PAS d identifiant, et c est exactement le
            // point (voir le serialiseur du serveur) : la clef ne peut donc
            // etre que la position dans une liste qui ne se reordonne pas.
            // eslint-disable-next-line react/no-array-index-key
            key={`avis-${index}`}
            style={[Alignments.row, { alignItems: 'flex-start', gap: 8 }]}
          >
            <View
              style={{
                backgroundColor: withAlpha(Colors.neutral00, 0.06),
                borderColor: withAlpha(Colors.neutral00, 0.2),
                borderRadius: 24,
                borderWidth: 1,
                paddingHorizontal: 12,
                paddingVertical: 4,
              }}
            >
              <Text style={[Fonts.p4Bold, Fonts.neutral200]}>{`${item?.rating ?? '-'}/10`}</Text>
            </View>
            <Text style={[Fonts.p2, Fonts.neutral100, { flex: 1 }]}>
              {texteDuCommentaire(item?.comment)}
            </Text>
          </View>
        ))}

        {sansMot > 0 ? (
          <Text style={[Fonts.p3, Fonts.neutral300]}>
            {t('stRetours.card.noCommentCount', { count: sansMot })}
          </Text>
        ) : null}
      </>
    );
  } else {
    // Des avis, mais pas la liste (un seuil remonte un jour) : on dit le nombre, sans mentir.
    corps = <Text style={[Fonts.p2, Fonts.neutral200]}>{tauxDeReponse}</Text>;
  }

  return (
    <View style={{ gap: 12 }}>
      <Text style={[Fonts.h3Bold, Fonts.neutral00]}>{t('stRetours.card.title')}</Text>
      <View
        style={{
          backgroundColor: withAlpha(Colors.primary700, 0.55),
          borderColor: withAlpha(Colors.primary500, 0.24),
          borderRadius: 24,
          borderWidth: 1,
          gap: 12,
          padding: 16,
        }}
      >
        {corps}
        <LigneAnonymat text={t('stRetours.card.anonymous')} />
      </View>
    </View>
  );
}

/**
 * ST-RETOURS (planche 21, etat 4) — CE QUE VOIT LE JOUEUR : jamais les avis des autres ;
 * une ligne lui confirme qu il a note, et que c est anonyme. Rien s il n a pas encore note.
 * @param {object} props - Les proprietes.
 * @param {any} props.review - SA note (`GET /events/:id/training-review`), ou rien.
 * @param {string | null} [props.trainerFirstname] - Le prenom de son entraineur.
 * @returns {import('react').ReactElement | null} - La ligne.
 */
export function MyTrainingReviewNote({ review, trainerFirstname = null }) {
  const { t } = useTranslation();
  const { Alignments, Colors, Fonts } = useTheme();
  if (!review || review.rating === null || review.rating === undefined) return null;
  const trainer = String(trainerFirstname || '').trim();

  return (
    <View
      style={[
        Alignments.row,
        {
          backgroundColor: withAlpha(Colors.success500, 0.1),
          borderColor: withAlpha(Colors.success500, 0.4),
          borderRadius: 12,
          borderWidth: 1,
          gap: 12,
          paddingHorizontal: 16,
          paddingVertical: 12,
        },
      ]}
      testID="my-training-review-note"
    >
      <Icone
        color={Colors.success500}
        height={20}
        name="check"
        style={{ marginTop: 2 }}
        width={20}
      />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
          {t('stRetours.card.mineTitle', { rating: review.rating })}
        </Text>
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {trainer
            ? t('stRetours.card.mineHint', { trainer, ...SANS_ECHAPPEMENT })
            : t('stRetours.card.mineHintNoName')}
        </Text>
      </View>
    </View>
  );
}

export default TrainingReviewsCard;
