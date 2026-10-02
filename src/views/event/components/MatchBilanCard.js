import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import localeDesFormats from '@/theme/strings/localeDesFormats';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';

/**
 * ST-MATCH (écran 7, design des statistiques validé le 02/10) — LE BILAN DE
 * L'ENTRAÎNEUR, VU PAR LE JOUEUR ET PAR LE DIRIGEANT.
 *
 * L'état SECU-STATS (en production le 01/10) est la base : le joueur n'ouvre plus
 * l'éditeur et ne reçoit ni l'avis privé de l'entraîneur sur un coéquipier, ni
 * l'auto-évaluation d'un autre. Ce que la carte lui montre vient de la lecture
 * DÉJÀ filtrée par le serveur : la note de l'équipe selon l'entraîneur, le mot de
 * l'entraîneur, la date de publication, les buteurs, et la moyenne des notes des
 * joueurs — retenue sous 3 réponses (« moyenne B », décision d'Adel du 02/10).
 *
 * Remplace, chez le joueur, le bouton éteint « Rapport finalisé le … » (la carte des
 * trois étapes de l'entraîneur, qui ne sont pas les siennes) et, avant la
 * publication, le « Enregistrer le score » éteint (défaut 11).
 * Chez le dirigeant qui n'entraîne pas (« score A ») : il ne lit pas la feuille (le
 * serveur la lui refuse), il sait QUI la saisit et où trouver les résultats.
 *
 * ⛔ PUREMENT PRÉSENTIELLE : aucune requête, aucun service.
 */

/**
 * « le 1 oct. à 22:39 ».
 * @param {string | null | undefined} iso - Une date ISO.
 * @returns {{ date: string, time: string } | null} - Le jour et l'heure, ou rien.
 */
const lireLeMoment = (iso) => {
  if (!iso) return null;
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return null;
  return {
    date: instant.toLocaleDateString(localeDesFormats(), { day: 'numeric', month: 'short' }),
    time: instant.toLocaleTimeString(localeDesFormats(), { hour: '2-digit', minute: '2-digit' }),
  };
};

/**
 * @typedef {{ average: number | null, count: number, hidden?: boolean }} MoyenneJoueurs
 */

/**
 * La carte du bilan, côté joueur ou dirigeant.
 * @param {object} props - Les propriétés.
 * @param {boolean} [props.avantLaFin] - Le match n'est pas fini.
 * @param {string} [props.buteurs] - « Hugo L. · 1 but sans buteur », déjà composé.
 * @param {string} [props.entraineur] - Le prénom de l'entraîneur (« Karim »).
 * @param {string} [props.finDuMatch] - « sam. 5 sept. à 20:00 ».
 * @param {'joueur' | 'dirigeant'} [props.mode] - Qui lit.
 * @param {MoyenneJoueurs | null} [props.moyenneJoueurs] - La moyenne des notes des
 *   joueurs, telle que le serveur la rend à CE lecteur.
 * @param {string} [props.motDuCoach] - Le mot de l'entraîneur sur le collectif.
 * @param {number | null} [props.noteEquipe] - La note de l'équipe selon l'entraîneur.
 * @param {(() => void) | null} [props.onVoirLesResultats] - Les résultats de l'équipe.
 * @param {boolean} [props.publiee] - La feuille est-elle publiée.
 * @param {string} [props.publieeLe] - Quand (ISO).
 * @param {string} [props.equipe] - Le nom de l'équipe (« U15 »).
 * @returns {import('react').ReactElement} - La carte.
 */
function MatchBilanCard({
  avantLaFin = false,
  buteurs = '',
  entraineur = '',
  equipe = '',
  finDuMatch = '',
  mode = 'joueur',
  motDuCoach = '',
  moyenneJoueurs = null,
  noteEquipe = null,
  onVoirLesResultats = null,
  publiee = false,
  publieeLe = '',
}) {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const nom = entraineur || t('stMatch.bilan.coachFallback', 'l’entraîneur');
  const publication = lireLeMoment(publieeLe);

  const cadre = (/** @type {boolean} */ vif) => [
    ApplicationStyle.borderRadius24,
    Spaces.padding[16],
    Spaces.gap[12],
    {
      backgroundColor: withAlpha(Colors.primary700, 0.55),
      borderColor: vif ? Colors.primary500 : withAlpha(Colors.primary500, 0.24),
      borderWidth: 1,
    },
  ];

  // 🏛️ Le dirigeant qui n'entraîne pas (« score A ») : qui saisit, où sont les résultats.
  if (mode === 'dirigeant') {
    return (
      <View style={cadre(false)} testID="st-match-bilan-dirigeant">
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {entraineur
            ? t(
              'stMatch.bilan.managerWho',
              'Le score et la feuille sont saisis par l’entraîneur de l’équipe, {{name}}.',
              { name: entraineur, ...SANS_ECHAPPEMENT },
            )
            : t(
              'stMatch.bilan.managerWhoUnnamed',
              'Le score et la feuille sont saisis par l’entraîneur de l’équipe.',
            )}
        </Text>
        {onVoirLesResultats ? (
          <TouchableOpacity
            accessibilityRole="link"
            onPress={onVoirLesResultats}
            style={[
              Alignments.row,
              Alignments.alignCenter,
              Alignments.justifySpaceBetween,
              { minHeight: 44 },
            ]}
          >
            <Text style={[Fonts.p2Bold, Fonts.primary500]}>
              {equipe
                ? t('stMatch.bilan.teamResults', 'Les résultats de {{team}}', {
                  team: equipe, ...SANS_ECHAPPEMENT,
                })
                : t('stMatch.bilan.teamResultsUnnamed', 'Les résultats de l’équipe')}
            </Text>
            <SvgIcon color={Colors.primary500} height={12} name="arrow-right" width={12} />
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  // ⏳ Avant la fin : la carte dit quand tout s'ouvrira (rien à faire, rien d'éteint).
  if (avantLaFin) {
    return (
      <View style={cadre(false)} testID="st-match-bilan-avant">
        <Text style={[Fonts.p4Bold, Fonts.primary500, Fonts.uppercase]}>
          {t('stMatch.bilan.eyebrowBefore', 'Après le match')}
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {finDuMatch
            ? t(
              'stMatch.bilan.opensAt',
              'Score, statistiques et retours s’ouvriront à la fin du match, {{when}}.',
              { when: finDuMatch, ...SANS_ECHAPPEMENT },
            )
            : t(
              'stMatch.bilan.opensAtEnd',
              'Score, statistiques et retours s’ouvriront à la fin du match.',
            )}
        </Text>
      </View>
    );
  }

  const titre = t('stMatch.bilan.title', 'Le bilan de {{name}}', {
    name: nom, ...SANS_ECHAPPEMENT,
  });
  const enTete = (/** @type {import('react').ReactNode} */ aDroite) => (
    <View
      style={[
        Alignments.row,
        Alignments.alignCenter,
        Alignments.justifySpaceBetween,
        Spaces.gap[8],
      ]}
    >
      <Text style={[Fonts.p4Bold, Fonts.primary500, Fonts.uppercase, { flexShrink: 1 }]}>
        {titre}
      </Text>
      {aDroite}
    </View>
  );

  // 📝 État 1 — en préparation : une phrase, plus de bouton éteint (défaut 11).
  if (!publiee) {
    return (
      <View style={cadre(false)} testID="st-match-bilan-preparation">
        {enTete((
          <View
            style={[
              Spaces.paddingHorizontal[8],
              Spaces.paddingVertical[4],
              { backgroundColor: withAlpha(Colors.neutral00, 0.1), borderRadius: 999 },
            ]}
          >
            <Text style={[Fonts.p4Bold, Fonts.neutral100]}>
              {t('stMatch.bilan.inPreparation', 'En préparation')}
            </Text>
          </View>
        ))}
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {t(
            'stMatch.bilan.preparing',
            '{{name}} prépare la feuille du match. Tu la liras ici dès qu’il la publie.',
            {
              name: entraineur || t('stMatch.bilan.coachFallbackCapital', 'L’entraîneur'),
              ...SANS_ECHAPPEMENT,
            },
          )}
        </Text>
      </View>
    );
  }

  // 🏁 Publiée — le bilan collectif, et lui seul.
  const tuiles = [];
  if (Number(noteEquipe) > 0) {
    tuiles.push({
      cle: 'equipe',
      libelle: t('stMatch.bilan.teamByCoach', 'L’équipe, selon {{name}}', {
        name: nom, ...SANS_ECHAPPEMENT,
      }),
      valeur: `${noteEquipe}/10`,
    });
  }
  const moyenneVisible = moyenneJoueurs?.average !== null && moyenneJoueurs?.average !== undefined
    && !moyenneJoueurs?.hidden;
  tuiles.push({
    cle: 'joueurs',
    libelle: moyenneVisible
      ? t('stMatch.bilan.playersRating', {
        count: Number(moyenneJoueurs?.count || 0),
        defaultValue_one: 'Vos notes · {{count}} réponse',
        defaultValue_other: 'Vos notes · {{count}} réponses',
      })
      : t('stMatch.bilan.playersRatingHidden', 'Vos notes : dès 3 réponses'),
    valeur: moyenneVisible ? `${moyenneJoueurs?.average}/10` : '—',
  });

  return (
    <View style={cadre(true)} testID="st-match-bilan-publie">
      {enTete(publication ? (
        <Text style={[Fonts.p3, Fonts.neutral300]}>
          {t('stMatch.bilan.publishedOn', 'Publié le {{date}} à {{time}}', {
            ...publication, ...SANS_ECHAPPEMENT,
          })}
        </Text>
      ) : null)}
      <View style={[Alignments.row, Spaces.gap[8]]}>
        {tuiles.map((tuile) => (
          <View
            key={tuile.cle}
            style={[
              ApplicationStyle.borderRadius16,
              Spaces.padding[12],
              Spaces.gap[4],
              {
                backgroundColor: withAlpha(Colors.neutral00, 0.04),
                borderColor: withAlpha(Colors.neutral00, 0.09),
                borderWidth: 1,
                flex: 1,
              },
            ]}
          >
            <Text style={[Fonts.h4Black, Fonts.neutral00]}>{tuile.valeur}</Text>
            <Text style={[Fonts.p3, Fonts.neutral300]}>{tuile.libelle}</Text>
          </View>
        ))}
      </View>
      {motDuCoach ? <Text style={[Fonts.p2, Fonts.neutral100]}>{motDuCoach}</Text> : null}
      {buteurs ? (
        <View style={[Alignments.row, Spaces.gap[4]]}>
          <SvgIcon color={Colors.neutral300} height={14} name="soccer-ball" width={14} />
          <Text style={[Fonts.p3, Fonts.neutral200, { flexShrink: 1 }]}>{buteurs}</Text>
        </View>
      ) : null}
      <Text style={[Fonts.p3, Fonts.neutral300]}>
        {t(
          'stMatch.bilan.privacy',
          'Ton retour individuel est dans « Mon match ». '
            + 'Ceux des autres joueurs restent entre eux et {{name}}.',
          { name: nom, ...SANS_ECHAPPEMENT },
        )}
      </Text>
    </View>
  );
}

export default MatchBilanCard;
