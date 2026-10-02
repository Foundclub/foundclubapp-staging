import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import localeDesFormats from '@/theme/strings/localeDesFormats';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';

/**
 * N4 (D6) puis ST-MATCH (écran 7, design des statistiques validé le 02/10) — LA
 * CARTE « APRÈS LE MATCH », CÔTÉ ENCADREMENT.
 *
 * Trois étapes — le score, la feuille de match, les retours des joueurs — et UN
 * bouton, celui de l'étape courante (pack « Détail d'un événement », 05C).
 *
 * ST-MATCH y ajoute ce que le design demande :
 *   · avant la fin, plus de bouton éteint : « Tout s'ouvre à la fin du match, … » ;
 *   · l'étape dans le surtitre (« Après le match · étape 2 sur 3 ») ;
 *   · « saisi par toi le 1 oct. à 22:35 » au lieu de « saisi à la main » ;
 *   · « Brouillon commencé à 22:36 », « Feuille publiée le 1 oct. à 22:39 » (au lieu
 *     de « Version v1 » et d'une date brute) ;
 *   · l'étape 3 nomme qui manque et porte « Relancer » ;
 *   · les deux notes sur une ligne (« Ta note », « Les joueurs · 1 note »), le mot de
 *     l'entraîneur dessous ;
 *   · la vérification dit CE QUI a changé (« La fédération indique 2 - 2 ; ta feuille
 *     dit 2 - 1 »), en orange.
 * Retirés : « Version v1 », la date brute, « 1 note collective prise en compte »,
 * les boutons éteints sans motif.
 *
 * ⛔ ELLE EST PUREMENT PRÉSENTIELLE : aucune requête, aucun service. Elle reçoit des
 * faits et rend un dessin — c'est ce qui permet de la tester seule. Le site
 * (`EventDetails.web.js`) la rend aussi, avec moins de faits : chaque nouvelle
 * propriété est facultative et se tait quand elle manque.
 */

/** Les trois étapes, dans l'ordre du parcours. Cet ordre EST le sens. */
const ETAPES = ['score', 'stats', 'responses'];

/**
 * Où en est-on du parcours.
 *
 * 🔒 `verificationRequise` RENVOIE à l'étape 2, même quand le rapport est
 * finalisé : le score officiel a changé après la publication, et les stats
 * publiées ne correspondent plus. Se dire « complet » à ce moment-là serait
 * exactement le mensonge que la carte doit empêcher.
 * @param {{ scoreDisponible: boolean, statsFinalisees: boolean,
 *  verificationRequise: boolean, toutesLesReponses: boolean }} faits - L'état mesuré.
 * @returns {{ courante: string, faites: string[] }} - L'étape courante et celles finies.
 */
export const resoudreLeParcours = ({
  scoreDisponible,
  statsFinalisees,
  toutesLesReponses,
  verificationRequise,
}) => {
  if (!scoreDisponible) return { courante: 'score', faites: [] };
  if (verificationRequise || !statsFinalisees) return { courante: 'stats', faites: ['score'] };
  if (!toutesLesReponses) return { courante: 'responses', faites: ['score', 'stats'] };
  return { courante: '', faites: ETAPES };
};

/**
 * « le 1 oct. à 22:35 » — un moment raconté au lecteur, dans SON heure.
 * @param {string} iso - Une date ISO.
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
 * @typedef {{ documentId?: string, firstname?: string } | null} ScoreAuteur
 */

/**
 * La carte-parcours de l'après-match.
 * @param {object} props - Les propriétés du composant.
 * @param {boolean} [props.avantLaFin] - Le match n'est pas fini : rien ne s'ouvre encore.
 * @param {boolean} [props.boutonDesactive] - La porte est-elle fermée.
 * @param {string} [props.feuilleBrouillonDepuis] - Le brouillon a été commencé (ISO).
 * @param {string} [props.feuillePublieeLe] - La feuille a été publiée (ISO).
 * @param {string} [props.finDuMatch] - « sam. 5 sept. à 20:00 », pour dire quand tout s'ouvre.
 * @param {string[]} [props.manquants] - Les prénoms de ceux qui n'ont pas répondu.
 * @param {string} [props.monDocumentId] - Qui regarde, pour écrire « toi ».
 * @param {{ average: number | null, count: number } | null} [props.moyenneJoueurs]
 *   - La moyenne des notes des joueurs.
 * @param {string} [props.motDuCoach] - Le mot de l'entraîneur sur le collectif.
 * @param {string} [props.motif] - POURQUOI la porte est fermée, quand elle l'est.
 * @param {number | null} [props.noteEquipe] - La note de l'entraîneur sur le collectif.
 * @param {(cle: string) => void} props.onPressEtape - Ouvrir l'étape courante.
 * @param {(() => void) | null} [props.onRelancer] - Relancer ceux qui manquent.
 * @param {boolean} [props.relanceEnCours] - Une relance part.
 * @param {number} [props.reponsesAttendues] - Combien de joueur·se·s sont attendus.
 * @param {number} [props.reponsesRecues] - Combien ont répondu.
 * @param {ScoreAuteur} [props.scoreAuteur] - L'auteur de la saisie.
 * @param {string} [props.scoreDeLaFeuille] - Le score que dit la feuille publiée.
 * @param {boolean} [props.scoreDisponible] - Le score est-il enregistré.
 * @param {string} [props.scoreLibelle] - Le score, tel que l'écran l'affiche déjà.
 * @param {string} [props.scoreOfficiel] - Le score officiel, quand il a changé.
 * @param {string} [props.scoreOrigine] - `manual`, `external_sync`, ou rien.
 * @param {string} [props.scoreSaisiA] - Quand il a été saisi (date ISO).
 * @param {boolean} [props.statsFinalisees] - Le rapport est-il publié.
 * @param {boolean} [props.verificationRequise] - Le score officiel a-t-il changé depuis.
 * @returns {import('react').ReactElement} - La carte.
 */
function PostMatchJourneyCard({
  avantLaFin = false,
  boutonDesactive = false,
  feuilleBrouillonDepuis = '',
  feuillePublieeLe = '',
  finDuMatch = '',
  manquants = [],
  monDocumentId = '',
  motDuCoach = '',
  motif = '',
  moyenneJoueurs = null,
  noteEquipe = null,
  onPressEtape,
  onRelancer = null,
  relanceEnCours = false,
  reponsesAttendues = 0,
  reponsesRecues = 0,
  scoreAuteur = null,
  scoreDeLaFeuille = '',
  scoreDisponible = false,
  scoreLibelle = '',
  scoreOfficiel = '',
  scoreOrigine = '',
  scoreSaisiA = '',
  statsFinalisees = false,
  verificationRequise = false,
}) {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();

  const toutesLesReponses = reponsesAttendues > 0 && reponsesRecues >= reponsesAttendues;
  const { courante, faites } = avantLaFin
    ? { courante: '', faites: [] }
    : resoudreLeParcours({
      scoreDisponible,
      statsFinalisees,
      toutesLesReponses,
      verificationRequise,
    });
  const estComplet = !avantLaFin && !courante;
  const estCalme = avantLaFin || estComplet;

  // « 2 - 1 · saisi par toi le 1 oct. à 22:35 » — l'auteur prime sur l'origine ; sans
  // auteur, on n'invente personne : le score seul, ou « score officiel ».
  const detailDuScore = () => {
    if (avantLaFin) return t('stMatch.carte.scoreBefore', 'Toi, à la fin du match');
    if (!scoreDisponible) return t('stMatch.carte.scoreTodo', 'À saisir');
    const moment = lireLeMoment(scoreSaisiA);
    const documentId = scoreAuteur?.documentId || '';
    const prenom = String(scoreAuteur?.firstname || '').trim();
    let complement = '';
    if (moment && documentId && documentId === monDocumentId) {
      complement = t('stMatch.carte.scoreByMe', 'saisi par toi le {{date}} à {{time}}', {
        ...moment, ...SANS_ECHAPPEMENT,
      });
    } else if (moment && prenom) {
      complement = t('stMatch.carte.scoreBy', 'saisi par {{name}} le {{date}} à {{time}}', {
        ...moment, name: prenom, ...SANS_ECHAPPEMENT,
      });
    } else if (scoreOrigine === 'external_sync') {
      complement = t('stMatch.carte.scoreOfficial', 'score officiel');
    }
    return complement ? `${scoreLibelle} · ${complement}` : scoreLibelle;
  };

  const detailDeLaFeuille = () => {
    if (avantLaFin) return t('stMatch.carte.sheetDetail', 'Ta note, les buteurs, le temps de jeu');
    if (!scoreDisponible) return t('stMatch.carte.sheetAfterScore', 'Après le score');
    if (faites.includes('stats')) {
      const publiee = lireLeMoment(feuillePublieeLe);
      return publiee
        ? t('stMatch.carte.sheetPublishedOn', 'Le {{date}} à {{time}}', {
          ...publiee, ...SANS_ECHAPPEMENT,
        })
        : t('stMatch.carte.sheetPublished', 'Publiée');
    }
    if (verificationRequise) {
      return t('stMatch.carte.sheetRepublish', 'À vérifier, puis republier');
    }
    const brouillon = lireLeMoment(feuilleBrouillonDepuis);
    return brouillon
      ? t('stMatch.carte.sheetDraftSince', 'Brouillon commencé à {{time}}', {
        time: brouillon.time, ...SANS_ECHAPPEMENT,
      })
      : t('stMatch.carte.sheetDetail', 'Ta note, les buteurs, le temps de jeu');
  };

  const detailDesReponses = () => {
    if (avantLaFin) {
      return t(
        'stMatch.carte.responsesBefore',
        'Ils reçoivent le questionnaire à la fin du match',
      );
    }
    if (!reponsesAttendues) {
      return t('eventDetails.postMatch.responsesNone', 'Personne n’a encore répondu');
    }
    // L'accord suit ceux qui ONT répondu : « 1 sur 3 a répondu », « 4 sur 12 ont répondu ».
    const compte = t('stMatch.carte.responsesCount', {
      count: reponsesRecues,
      defaultValue_one: '{{count}} sur {{total}} a répondu',
      defaultValue_other: '{{count}} sur {{total}} ont répondu',
      total: reponsesAttendues,
      ...SANS_ECHAPPEMENT,
    });
    if (courante !== 'responses' || !manquants.length) return compte;
    return `${compte} · ${t('stMatch.carte.missing', 'manquent {{names}}', {
      names: manquants.join(', '),
      ...SANS_ECHAPPEMENT,
    })}`;
  };

  /** @type {Record<string, { detail: string, titre: string }>} */
  const CONTENU = {
    responses: {
      detail: detailDesReponses(),
      titre: t('eventDetails.postMatch.responsesTitle', 'Retours des joueurs'),
    },
    score: {
      detail: verificationRequise && scoreOfficiel && scoreDeLaFeuille
        ? t(
          'stMatch.carte.officialChangedDetail',
          'La fédération indique {{official}} ; ta feuille dit {{sheet}}',
          { official: scoreOfficiel, sheet: scoreDeLaFeuille, ...SANS_ECHAPPEMENT },
        )
        : detailDuScore(),
      titre: verificationRequise
        ? t('stMatch.carte.officialChanged', 'Score officiel changé')
        : t('eventDetails.postMatch.scoreTitle', 'Score'),
    },
    stats: {
      detail: detailDeLaFeuille(),
      titre: faites.includes('stats')
        ? t('stMatch.carte.sheetPublishedTitle', 'Feuille publiée')
        : t('stMatch.carte.sheetTitle', 'Feuille de match'),
    },
  };

  const rangCourant = ETAPES.indexOf(courante) + 1;
  let surtitre = t('stMatch.carte.header', 'Après le match');
  if (verificationRequise && !avantLaFin) {
    surtitre = t('stMatch.carte.headerReview', 'Après le match · à vérifier');
  } else if (estComplet) {
    surtitre = t('stMatch.carte.headerComplete', 'Après le match · c’est complet');
  } else if (rangCourant) {
    surtitre = t('stMatch.carte.headerStep', 'Après le match · étape {{n}} sur 3', {
      n: rangCourant, ...SANS_ECHAPPEMENT,
    });
  }

  const libelleDuBouton = () => {
    if (courante === 'score') return t('stMatch.carte.actionScore', 'Saisir le score');
    if (courante === 'stats') {
      if (verificationRequise) return t('stMatch.carte.actionReview', 'Vérifier la feuille');
      if (feuilleBrouillonDepuis) return t('stMatch.carte.actionResume', 'Reprendre la feuille');
      return t('stMatch.carte.actionSheet', 'Saisir la feuille');
    }
    return t('stMatch.carte.actionSeeSheet', 'Voir la feuille');
  };

  const notes = [];
  if (statsFinalisees && Number(noteEquipe) > 0) {
    notes.push({
      cle: 'coach',
      libelle: t('stMatch.carte.myRating', 'Ta note'),
      valeur: `${noteEquipe}/10`,
    });
  }
  if (statsFinalisees && Number(moyenneJoueurs?.count) > 0) {
    notes.push({
      cle: 'joueurs',
      libelle: t('stMatch.carte.playersRating', {
        count: Number(moyenneJoueurs?.count),
        defaultValue_one: 'Les joueurs · {{count}} note',
        defaultValue_other: 'Les joueurs · {{count}} notes',
      }),
      valeur: moyenneJoueurs?.average != null ? `${moyenneJoueurs.average}/10` : '—',
    });
  }

  const avecRelance = courante === 'responses' && Boolean(onRelancer) && manquants.length > 0;

  // 🪤 LE `testID` VIT SUR CE `View`, PAS SUR LE `Button` : l'atome `Button` ne
  // déclare NI ne transmet `testID`.
  const blocDAction = (
    <View
      style={avecRelance ? [Alignments.row, Spaces.gap[8]] : null}
      testID="post-match-action"
    >
      <View style={avecRelance ? { flex: 1 } : null}>
        <Button
          disabled={boutonDesactive}
          onPress={() => onPressEtape(courante || 'stats')}
          size="sm"
          title={libelleDuBouton()}
          variant={courante && courante !== 'responses' ? 'Primary' : 'Secondary'}
        />
      </View>
      {avecRelance ? (
        <View style={{ flex: 1 }} testID="post-match-relancer">
          <Button
            disabled={relanceEnCours}
            isLoading={relanceEnCours}
            onPress={() => onRelancer?.()}
            size="sm"
            title={t('stMatch.carte.remind', {
              count: manquants.length,
              defaultValue_one: 'Relancer {{count}} joueur',
              defaultValue_other: 'Relancer les {{count}}',
            })}
            variant="Primary"
          />
        </View>
      ) : null}
    </View>
  );

  return (
    <View
      style={[
        ApplicationStyle.borderRadius24,
        Spaces.padding[16],
        Spaces.gap[16],
        {
          backgroundColor: withAlpha(Colors.primary900, 0.7),
          borderColor: estCalme ? withAlpha(Colors.primary500, 0.4) : Colors.primary500,
          borderWidth: 1,
        },
      ]}
      testID="post-match-journey"
    >
      <Text style={[Fonts.p4Bold, Fonts.primary500, Fonts.uppercase]} testID="post-match-step">
        {surtitre}
      </Text>

      {avantLaFin && finDuMatch ? (
        <Text style={[Fonts.p2, Fonts.neutral200]} testID="post-match-avant-la-fin">
          {t('stMatch.carte.opensAt', 'Tout s’ouvre à la fin du match, {{when}}.', {
            when: finDuMatch, ...SANS_ECHAPPEMENT,
          })}
        </Text>
      ) : null}

      <View style={[Spaces.gap[12]]}>
        {ETAPES.map((cle, index) => {
          const estFaite = faites.includes(cle);
          const estCourante = cle === courante;
          const enAlerte = cle === 'score' && verificationRequise && !avantLaFin;
          let couleurPastille = Colors.neutral600;
          let couleurTexte = Colors.neutral300;
          if (enAlerte) {
            couleurPastille = Colors.warning500;
            couleurTexte = Colors.warning400;
          } else if (estFaite) {
            couleurPastille = Colors.success500;
            couleurTexte = Colors.success500;
          } else if (estCourante) {
            couleurPastille = Colors.primary500;
            couleurTexte = Colors.primary200;
          }
          let pastille = (
            <Text style={[Fonts.p2Bold, { color: couleurTexte }]}>{String(index + 1)}</Text>
          );
          if (enAlerte || estFaite) {
            pastille = (
              <SvgIcon
                color={couleurTexte}
                height={14}
                name={enAlerte ? 'flag' : 'check'}
                width={14}
              />
            );
          }

          return (
            <View
              key={cle}
              style={[Alignments.row, Spaces.gap[12]]}
              testID={`post-match-step-${cle}`}
            >
              <View
                style={{
                  alignItems: 'center',
                  backgroundColor: estFaite || estCourante || enAlerte
                    ? withAlpha(couleurPastille, 0.14)
                    : 'transparent',
                  borderColor: estFaite || enAlerte
                    ? withAlpha(couleurPastille, 0.45)
                    : couleurPastille,
                  borderRadius: 16,
                  borderWidth: 1,
                  height: 32,
                  justifyContent: 'center',
                  width: 32,
                }}
              >
                {pastille}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
                  {CONTENU[cle].titre}
                </Text>
                <Text style={[Fonts.p3, Fonts.neutral300]}>
                  {CONTENU[cle].detail}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* ⛔ LE MOTIF D'UNE PORTE FERMÉE NE DISPARAÎT PAS (score officiel attendu,
          lecteur qui ne gère pas l'équipe…). Avant la fin du match, ce n'est plus une
          porte fermée : la carte dit quand tout s'ouvre, sans bouton. */}
      {boutonDesactive && motif && !avantLaFin ? (
        <Text style={[Fonts.p3, Fonts.neutral200]} testID="post-match-motif">
          {motif}
        </Text>
      ) : null}

      {avantLaFin || estComplet ? null : blocDAction}

      {notes.length ? (
        <View style={[Spaces.gap[12]]} testID="post-match-notes">
          <View style={{ backgroundColor: withAlpha(Colors.neutral00, 0.08), height: 1 }} />
          <View style={[Alignments.row, Spaces.gap[8]]}>
            {notes.map((note) => (
              <View
                key={note.cle}
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
                <Text style={[Fonts.h4Black, Fonts.neutral00]}>{note.valeur}</Text>
                <Text style={[Fonts.p3, Fonts.neutral300]}>{note.libelle}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
      {statsFinalisees && motDuCoach ? (
        <Text style={[Fonts.p2, Fonts.neutral100]} testID="post-match-mot">
          {motDuCoach}
        </Text>
      ) : null}

      {/* C'est complet : « Voir la feuille » vient APRÈS le bilan (planche, état 5). */}
      {estComplet ? blocDAction : null}
    </View>
  );
}

export default PostMatchJourneyCard;
