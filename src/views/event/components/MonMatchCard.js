import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import localeDesFormats from '@/theme/strings/localeDesFormats';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';
import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';
import { describeDraftRemaining } from '@/components/organisms/matchStats/matchStatsPromptModel';
import { getFigureKeys, toFigure } from '@/views/matchStats/playerMatchResponseModel';

import texteInsecable from '@/utils/texteInsecable';

/**
 * ST-MONMATCH (écran 12, design des statistiques validé le 02/10, parcours 4 « Le joueur
 * répond ») — « MON MATCH », SUR LA PAGE DU MATCH, VU PAR LE JOUEUR.
 *
 * UNE SEULE carte au lieu de « Mes stats » et « Mon retour coach » : sa réponse (à donner,
 * en brouillon, envoyée — avec ses chiffres, enfin visibles), puis le retour de
 * l'entraîneur, NOMMÉ et dit privé. Sans retour : une ligne une fois la réponse envoyée,
 * rien avant (plus de carte vide « En attente / Pas encore partagé »). Arrivé par la
 * notification « Retour de Karim », le retour passe EN PREMIER, surligné, « Nouveau ».
 *
 * 🔒 Le joueur ne voit QUE lui : la carte ne lit que SA réponse (`my-match-response`) et
 * l'avis qui lui est destiné (`myCoachReview`), jamais la feuille de l'équipe
 * (`report.coachPlayerReviews`, `playerResponses`) — décisions SECU-STATS et `profil A`.
 * Témoin de fuite : `EventDetailsN4PostMatch.test.js` (ST-MONMATCH).
 *
 * ⛔ PUREMENT PRÉSENTIELLE : aucune requête, aucun service. Les ~32 suites d'`EventDetails`
 * doublent `@tanstack/react-query` sans `useQuery` : un hook de requête ici les ferait
 * toutes tomber. La fiche lui passe ce qu'elle a déjà lu.
 */

/**
 * « 1 oct. » et « 22:28 ».
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
 * Une note sur 10 donnée, ou rien.
 * @param {unknown} valeur - La note.
 * @returns {number | null} - La note, ou `null`.
 */
const lireUneNote = (valeur) => {
  const note = Number(valeur);
  return valeur !== null && valeur !== undefined && Number.isFinite(note) && note > 0 ? note : null;
};

/**
 * La carte « Mon match » du joueur.
 * @param {object} props - Les propriétés.
 * @param {boolean} [props.arriveParLeRetour] - Ouverte par la notification du retour.
 * @param {string} [props.entraineur] - Le prénom de l'entraîneur (« Karim »).
 * @param {boolean} [props.estOccupee] - La réponse se relit : les gestes attendent.
 * @param {() => void} props.onRepondre - Ouvre le questionnaire du joueur.
 * @param {any} [props.reponse] - SA réponse (`my-match-response`, champ `response`).
 * @param {{ comment?: string | null, rating?: number | null } | null} [props.retourDuCoach]
 *   - L'avis de l'entraîneur pour LUI (`myCoachReview`).
 * @param {string} [props.sport] - 'football' ou 'basketball'.
 * @returns {import('react').ReactElement} - La carte.
 */
function MonMatchCard({
  arriveParLeRetour = false,
  entraineur = '',
  estOccupee = false,
  onRepondre,
  reponse = null,
  retourDuCoach = null,
  sport = 'football',
}) {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();

  const statut = ['draft', 'submitted'].includes(reponse?.status) ? reponse.status : null;
  const participation = reponse?.participation || null;
  const noteDuCoach = lireUneNote(retourDuCoach?.rating);
  const motDuCoach = String(retourDuCoach?.comment || '').trim();
  const aUnRetour = noteDuCoach !== null || Boolean(motDuCoach);
  const retourEnPremier = arriveParLeRetour && aUnRetour;

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

  const pastille = (/** @type {string} */ libelle, /** @type {'cyan' | 'vert'} */ ton) => (
    <View
      style={[
        Spaces.paddingHorizontal[8],
        Spaces.paddingVertical[4],
        {
          backgroundColor: withAlpha(ton === 'vert' ? Colors.success500 : Colors.primary500, 0.14),
          borderRadius: 999,
        },
      ]}
    >
      {/* FINITIONS (Android 16, 28/09) — une pastille épouse son texte : espaces insécables. */}
      <Text
        style={[Fonts.p4Bold, { color: ton === 'vert' ? Colors.success500 : Colors.primary500 }]}
      >
        {texteInsecable(libelle)}
      </Text>
    </View>
  );

  const surtitre = (/** @type {string} */ texte) => (
    <Text style={[Fonts.p4Bold, Fonts.primary500, Fonts.uppercase, { flexShrink: 1 }]}>
      {texte}
    </Text>
  );

  /**
   * Une rangée « à gauche … à droite ».
   * @param {import('react').ReactNode} gauche - Le surtitre.
   * @param {import('react').ReactNode} droite - La pastille ou la mention.
   * @returns {import('react').ReactElement} - La rangée.
   */
  const entre = (gauche, droite) => (
    <View
      style={[
        Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[8],
      ]}
    >
      {gauche}
      {droite}
    </View>
  );

  const nomDuRetour = entraineur
    ? t('stMatch.monMatch.feedbackTitle', 'Le retour de {{name}}', {
      name: entraineur, ...SANS_ECHAPPEMENT,
    })
    : t('stMatch.monMatch.feedbackTitleUnnamed', 'Le retour de ton entraîneur');

  // 🔢 Les cases de la réponse : les chiffres seulement si le joueur a joué ET les connaît
  // (« Là sans jouer » au lieu de zéros, état 6) ; « ma note » toujours dans un brouillon
  // (« — » tant qu'elle manque), sinon seulement les notes données.
  const cases = [];
  if (participation === 'played' && reponse?.quantitativeState === 'completed') {
    const minutes = toFigure(reponse?.minutesPlayed);
    cases.push({
      cle: 'minutes',
      libelle: t('playerMatchResponseScreen.summary.minutes', {
        count: minutes, defaultValue_one: 'minute', defaultValue_other: 'minutes',
      }),
      valeur: String(minutes),
    });
    const payload = reponse?.sportPayload || {};
    const gardien = payload.goalsConceded !== undefined && payload.goalsConceded !== null;
    getFigureKeys(sport, gardien).forEach((cle) => {
      const valeur = toFigure(payload[cle]);
      cases.push({
        cle,
        libelle: t(`playerMatchResponseScreen.summary.${cle}`, { count: valeur }),
        valeur: String(valeur),
      });
    });
  }
  const maNote = lireUneNote(reponse?.selfRating);
  const noteEquipe = lireUneNote(reponse?.teamRating);
  if (participation !== 'not_involved' && (maNote !== null || statut === 'draft')) {
    cases.push({
      cle: 'self',
      libelle: t('playerMatchResponseScreen.summary.myRating', 'ma note'),
      valeur: maNote === null ? '—' : String(maNote),
    });
  }
  if (participation !== 'not_involved' && noteEquipe !== null) {
    cases.push({
      cle: 'team',
      libelle: t('playerMatchResponseScreen.summary.teamRating', 'l\'équipe'),
      valeur: String(noteEquipe),
    });
  }

  const ligneDeCases = cases.length ? (
    <View
      style={[
        Alignments.row,
        Alignments.justifySpaceBetween,
        Spaces.gap[8],
        Spaces.paddingHorizontal[16],
        Spaces.paddingVertical[12],
        ApplicationStyle.borderRadius16,
        {
          backgroundColor: withAlpha(Colors.neutral00, 0.04),
          borderColor: withAlpha(Colors.neutral00, 0.09),
          borderWidth: 1,
          flexWrap: 'wrap',
        },
      ]}
    >
      {cases.map((une) => (
        <View key={une.cle} style={[Alignments.alignCenter, { minWidth: 44 }]}>
          <Text style={[Fonts.h4Black, Fonts.neutral00]}>{une.valeur}</Text>
          <Text style={[Fonts.p4, Fonts.neutral300]}>{une.libelle}</Text>
        </View>
      ))}
    </View>
  ) : null;

  const quiLit = (/** @type {string} */ texte) => (
    <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[4], { flexShrink: 1 }]}>
      <GlyphIcon color={Colors.neutral300} name="lock" size={14} />
      <Text style={[Fonts.p4, Fonts.neutral300, { flexShrink: 1 }]}>{texte}</Text>
    </View>
  );

  const contenuDuRetour = (
    <>
      {noteDuCoach !== null ? (
        <Text style={[Fonts.h3Black, Fonts.neutral00]}>{`${noteDuCoach}/10`}</Text>
      ) : null}
      {motDuCoach ? (
        <View
          style={[
            Spaces.paddingHorizontal[16],
            Spaces.paddingVertical[12],
            {
              backgroundColor: withAlpha(Colors.neutral00, 0.05),
              borderBottomRightRadius: 12,
              borderLeftColor: Colors.primary500,
              borderLeftWidth: 2,
              borderTopRightRadius: 12,
            },
          ]}
        >
          <Text style={[Fonts.p2, Fonts.neutral100]}>{motDuCoach}</Text>
        </View>
      ) : null}
    </>
  );

  // 5 · Arrivé par la notification : le retour, seul, surligné, en premier.
  const carteDuRetour = retourEnPremier ? (
    <View
      style={[
        ...cadre(true),
        {
          borderColor: Colors.primary200,
          borderWidth: 2,
          shadowColor: Colors.primary500,
          shadowOpacity: 0.35,
          shadowRadius: 12,
        },
      ]}
      testID="st-monmatch-retour"
    >
      {entre(surtitre(nomDuRetour), pastille(t('stMatch.monMatch.new', 'Nouveau'), 'cyan'))}
      {contenuDuRetour}
      {quiLit(t('stMatch.monMatch.privateLong', 'Visible par toi et tes parents.'))}
    </View>
  ) : null;

  // 3 · Le retour sous la réponse ; 4 · une ligne s'il manque, une fois la réponse envoyée.
  let piedDuRetour = null;
  if (!retourEnPremier && aUnRetour) {
    piedDuRetour = (
      <View style={Spaces.gap[12]} testID="st-monmatch-retour">
        <View style={{ backgroundColor: withAlpha(Colors.neutral00, 0.08), height: 1 }} />
        {entre(
          surtitre(nomDuRetour),
          quiLit(t('stMatch.monMatch.privateShort', 'Toi et tes parents')),
        )}
        {contenuDuRetour}
      </View>
    );
  } else if (!aUnRetour && statut === 'submitted') {
    piedDuRetour = (
      <View style={Spaces.gap[12]}>
        <View style={{ backgroundColor: withAlpha(Colors.neutral00, 0.08), height: 1 }} />
        <Text style={[Fonts.p2, Fonts.neutral300]}>
          {entraineur
            ? t(
              'stMatch.monMatch.noFeedback',
              '{{name}} n\'a pas encore écrit de retour pour toi. Tu seras prévenu·e.',
              { name: entraineur, ...SANS_ECHAPPEMENT },
            )
            : t(
              'stMatch.monMatch.noFeedbackUnnamed',
              'Ton entraîneur n\'a pas encore écrit de retour pour toi. Tu seras prévenu·e.',
            )}
        </Text>
      </View>
    );
  }

  let corps = null;
  if (statut === 'submitted') {
    const envoi = lireLeMoment(reponse?.submittedAt || reponse?.updatedAt);
    let participationDite = '';
    if (participation === 'present_no_play') {
      participationDite = t('stMatch.monMatch.presentNoPlay', 'Là sans jouer');
    } else if (participation === 'not_involved') {
      participationDite = t('stMatch.monMatch.notInvolved', 'Pas concerné·e par ce match');
    } else if (reponse?.quantitativeState === 'unknown') {
      participationDite = entraineur
        ? t('stMatch.monMatch.unknownFigures', '{{name}} saisira tes chiffres sur la feuille.', {
          name: entraineur, ...SANS_ECHAPPEMENT,
        })
        : t(
          'stMatch.monMatch.unknownFiguresUnnamed',
          'Ton entraîneur saisira tes chiffres sur la feuille.',
        );
    }
    corps = (
      <>
        {entre(
          surtitre(t('stMatch.monMatch.eyebrow', 'Ma réponse')),
          pastille(t('stMatch.monMatch.sent', 'Envoyée'), 'vert'),
        )}
        {envoi ? (
          <Text style={[Fonts.p3, Fonts.neutral300]}>
            {t('stMatch.monMatch.sentOn', 'Le {{date}} à {{time}}', {
              ...envoi, ...SANS_ECHAPPEMENT,
            })}
          </Text>
        ) : null}
        {participationDite ? (
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{participationDite}</Text>
        ) : null}
        {ligneDeCases}
        <TouchableOpacity
          accessibilityRole="button"
          disabled={estOccupee}
          onPress={onRepondre}
          style={[
            Alignments.row,
            Alignments.alignCenter,
            Spaces.gap[8],
            { alignSelf: 'flex-start', minHeight: 44 },
          ]}
        >
          <SvgIcon color={Colors.primary500} height={14} name="edit" width={14} />
          <Text style={[Fonts.p2Bold, Fonts.primary500]}>
            {t('stMatch.monMatch.edit', 'Modifier ma réponse')}
          </Text>
        </TouchableOpacity>
      </>
    );
  } else if (statut === 'draft') {
    corps = (
      <>
        {entre(
          surtitre(t('stMatch.monMatch.eyebrow', 'Ma réponse')),
          pastille(t('stMatch.attente.draft', 'Brouillon'), 'cyan'),
        )}
        {ligneDeCases}
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {participation === 'not_involved'
            ? t('stMatch.rappel.draftRemainingSend', 'Il te reste à l\'envoyer.')
            : describeDraftRemaining(reponse)}
        </Text>
        <Button
          disabled={estOccupee}
          onPress={onRepondre}
          title={t('stMatch.rappel.resume', 'Reprendre ma réponse')}
          variant="Primary"
        />
      </>
    );
  } else {
    corps = (
      <>
        {entre(
          surtitre(t('stMatch.monMatch.eyebrow', 'Ma réponse')),
          pastille(t('stMatch.attente.toAnswer', 'À répondre'), 'cyan'),
        )}
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {entraineur
            ? t(
              'stMatch.monMatch.toAnswerBody',
              'Dis si tu as joué, tes chiffres et tes deux notes. {{name}} les lira.',
              { name: entraineur, ...SANS_ECHAPPEMENT },
            )
            : t(
              'stMatch.monMatch.toAnswerBodyUnnamed',
              'Dis si tu as joué, tes chiffres et tes deux notes. Ton entraîneur les lira.',
            )}
        </Text>
        <Button
          disabled={estOccupee}
          onPress={onRepondre}
          title={t('stMatch.monMatch.answer', 'Donner mon retour')}
          variant="Primary"
        />
      </>
    );
  }

  return (
    <View style={Spaces.gap[12]} testID="st-monmatch">
      <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
        {t('stMatch.monMatch.title', 'Mon match')}
      </Text>
      {carteDuRetour}
      <View style={cadre(statut !== 'submitted')} testID="st-monmatch-reponse">
        {corps}
        {piedDuRetour}
      </View>
    </View>
  );
}

export default MonMatchCard;
