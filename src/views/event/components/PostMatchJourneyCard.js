import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

/**
 * N4 (D6) — LA CARTE « APRÈS LE MATCH », maquette 05 · 5C.
 *
 * 🧨 CE QU ELLE REPARE : apres un match, la page proposait SEPT libelles
 * differents pour un seul et meme bouton (« Enregistrer le score », « Saisir
 * les stats du match », « Mettre à jour après score officiel », « En attente
 * de l'équipe »…), decides par un `useMemo` de sept branches. Le coach lisait
 * un mot different a chaque visite sans jamais voir OU il en etait : il y a
 * trois etapes apres un match, et rien ne les nommait.
 *
 * ⇒ Les sept libelles se fondent en UNE chaine (« Stats du match ») pour la
 * rangee du menu et la modale d invite ; l ETAT, lui, devient ce parcours :
 *   1. le Score           — « 3 - 1 · saisi à la main »
 *   2. les Statistiques   — « Buteurs, passeurs, temps de jeu »
 *   3. les Retours        — « 4 sur 12 ont répondu »
 * Un seul bouton, sur l etape courante : c est la prochaine chose a faire.
 *
 * ✅ « SAISI PAR TOI À 20:12 » DE LA MAQUETTE EST RENDU DEPUIS LE LOT P5. Il a
 * manque longtemps, et c etait un manque de DONNEE, pas un oubli : la charge
 * `matchStats.score` ne portait ni auteur ni horodatage. Le serveur les avait
 * pourtant en base (`savedBy` / `savedAt`) et ne les exposait pas ; sa projection
 * rend maintenant `recordedBy` et `recordedAt`, pour une saisie A LA MAIN
 * uniquement.
 *
 * ⚠️ Quand l auteur manque — score officiel d une federation, ou score saisi
 * AVANT que le serveur ne l expose — la carte retombe sur l ORIGINE du score
 * (`source`), son affichage d avant. On ne devine pas un auteur.
 *
 * ⛔ ELLE EST PUREMENT PRESENTIELLE : aucune requete, aucun service. Elle recoit
 * des faits et rend un dessin — c est ce qui permet de la tester seule, sans
 * monter les 8 000 lignes de `EventDetails`.
 */

/** Les trois etapes, dans l ordre du parcours. Cet ordre EST le sens. */
const ETAPES = ['score', 'stats', 'responses'];

/**
 * Ou en est-on du parcours.
 *
 * 🔒 `verificationRequise` RENVOIE a l etape 2, meme quand le rapport est
 * finalise : le score officiel a change apres la publication, et les stats
 * publiees ne correspondent plus. Se dire « complet » a ce moment-la serait
 * exactement le mensonge que la carte doit empecher.
 * @param {{ scoreDisponible: boolean, statsFinalisees: boolean,
 *  verificationRequise: boolean, toutesLesReponses: boolean }} faits - L etat mesure.
 * @returns {{ courante: string, faites: string[] }} - L etape courante et celles finies.
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
 * @typedef {{ documentId?: string, firstname?: string } | null} ScoreAuteur
 */

/**
 * La carte-parcours de l apres-match.
 * @param {object} props - Les proprietes du composant.
 * @param {boolean} [props.boutonDesactive] - La porte est-elle fermee.
 * @param {string} [props.monDocumentId] - Qui regarde, pour ecrire « toi ».
 * @param {string} [props.motif] - POURQUOI elle est fermee, quand elle l est.
 * @param {(cle: string) => void} props.onPressEtape - Ouvrir l etape courante.
 * @param {number} [props.reponsesAttendues] - Combien de joueur·se·s sont attendus.
 * @param {number} [props.reponsesRecues] - Combien ont repondu.
 * @param {ScoreAuteur} [props.scoreAuteur] - L auteur de la saisie.
 * @param {boolean} [props.scoreDisponible] - Le score est-il enregistre.
 * @param {string} [props.scoreLibelle] - Le score, tel que l ecran l affiche deja.
 * @param {string} [props.scoreOrigine] - `manual`, `external_sync`, ou rien.
 * @param {string} [props.scoreSaisiA] - Quand il a ete saisi (date ISO).
 * @param {boolean} [props.statsFinalisees] - Le rapport est-il publie.
 * @param {boolean} [props.verificationRequise] - Le score officiel a-t-il change depuis.
 * @returns {import('react').ReactElement} - La carte.
 */
function PostMatchJourneyCard({
  boutonDesactive = false,
  monDocumentId = '',
  motif = '',
  onPressEtape,
  reponsesAttendues = 0,
  reponsesRecues = 0,
  scoreAuteur = null,
  scoreDisponible = false,
  scoreLibelle = '',
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
  const { courante, faites } = resoudreLeParcours({
    scoreDisponible,
    statsFinalisees,
    toutesLesReponses,
    verificationRequise,
  });

  const origineDuScore = () => {
    if (scoreOrigine === 'external_sync') {
      return t('eventDetails.postMatch.scoreOfficial', 'score officiel');
    }
    if (scoreOrigine === 'manual') {
      return t('eventDetails.postMatch.scoreManual', 'saisi à la main');
    }

    return '';
  };

  /**
   * L heure de la saisie, en HH:MM.
   *
   * Horloge LOCALE, volontairement : ce n est pas une decision de droit (celles-la
   * lisent `serverNow`, cf. `eventMatchClock.js`), c est un moment raconte au
   * lecteur, dans son heure a lui.
   * @returns {string} - `20:12`, ou vide si l horodatage est illisible.
   */
  const heureDeSaisie = () => {
    if (!scoreSaisiA) return '';
    const instant = new Date(scoreSaisiA);
    if (Number.isNaN(instant.getTime())) return '';

    const heures = String(instant.getHours()).padStart(2, '0');
    const minutes = String(instant.getMinutes()).padStart(2, '0');

    return `${heures}:${minutes}`;
  };

  /**
   * « saisi par toi a 20:12 », ou « saisi par Camille a 20:12 ».
   *
   * Rend une chaine VIDE des qu il manque de quoi la dire honnetement : pas
   * d heure, ou personne a nommer. L appelant retombe alors sur l origine.
   * @returns {string} - La phrase, ou vide.
   */
  const auteurDuScore = () => {
    const heure = heureDeSaisie();
    if (!heure) return '';

    const documentId = scoreAuteur?.documentId || '';
    if (documentId && documentId === monDocumentId) {
      return t('eventDetails.postMatch.scoreRecordedByMe', 'saisi par toi à {{time}}')
        .replace('{{time}}', heure);
    }

    const prenom = scoreAuteur?.firstname || '';
    if (!prenom) return '';

    return t('eventDetails.postMatch.scoreRecordedBy', 'saisi par {{name}} à {{time}}')
      .replace('{{name}}', prenom)
      .replace('{{time}}', heure);
  };

  const sousTitreDuScore = () => {
    if (!scoreDisponible) return t('eventDetails.postMatch.scoreTodo', 'À enregistrer');
    // L auteur prime sur l origine : « saisi par toi a 20:12 » dit deja que c est
    // une saisie a la main, et il dit QUI, ce que l origine ne pouvait pas dire.
    const complement = auteurDuScore() || origineDuScore();

    return complement ? `${scoreLibelle} · ${complement}` : scoreLibelle;
  };

  const sousTitreDesReponses = () => {
    if (!reponsesAttendues) {
      return t('eventDetails.postMatch.responsesNone', 'Personne n’a encore répondu');
    }

    return t('eventDetails.postMatch.responsesCount', '{{received}} sur {{total}} ont répondu')
      .replace('{{received}}', String(reponsesRecues))
      .replace('{{total}}', String(reponsesAttendues));
  };

  /** @type {Record<string, { sousTitre: string, titre: string }>} */
  const CONTENU = {
    responses: {
      sousTitre: sousTitreDesReponses(),
      titre: t('eventDetails.postMatch.responsesTitle', 'Retours des joueurs'),
    },
    score: {
      sousTitre: sousTitreDuScore(),
      titre: t('eventDetails.postMatch.scoreTitle', 'Score'),
    },
    stats: {
      sousTitre: t('eventDetails.postMatch.statsSubtitle', 'Buteurs, passeurs, temps de jeu'),
      titre: t('eventDetails.postMatch.statsTitle', 'Statistiques de l’équipe'),
    },
  };

  const libelleDuBouton = () => {
    if (courante === 'score') {
      return t('eventDetails.postMatch.actionScore', 'Enregistrer le score');
    }
    if (courante === 'stats') {
      return verificationRequise
        ? t('eventDetails.postMatch.actionReview', 'Mettre à jour')
        : t('eventDetails.postMatch.actionStats', 'Saisir les stats');
    }
    if (courante === 'responses') {
      return t('eventDetails.postMatch.actionResponses', 'Voir les retours');
    }

    // Le parcours est fini : le bouton ne demande plus rien, il donne acces.
    return t('eventDetails.postMatch.actionDone', 'Voir les stats du match');
  };

  // L en-tete dit OU on en est, en toutes lettres. « Étape 2 sur 3 » se lit
  // sans avoir a compter les pastilles.
  const rangCourant = ETAPES.indexOf(courante) + 1;
  const enTete = rangCourant
    ? t('eventDetails.postMatch.step', 'Étape {{n}} sur 3').replace('{{n}}', String(rangCourant))
    : t('eventDetails.postMatch.complete', 'C’est complet');

  return (
    <View
      style={[
        ApplicationStyle.backgroundColor.primary900,
        ApplicationStyle.borderRadius24,
        ApplicationStyle.borderColor.primary500,
        ApplicationStyle.borderWidth1,
        Spaces.padding[16],
        Spaces.gap[16],
      ]}
      testID="post-match-journey"
    >
      <View style={[Spaces.gap[4]]}>
        <Text style={[Fonts.p4Bold, Fonts.primary500]}>
          {t('eventDetails.postMatch.header', 'APRÈS LE MATCH')}
        </Text>
        <Text style={[Fonts.h4Bold, Fonts.neutral00]} testID="post-match-step">
          {enTete}
        </Text>
      </View>

      <View style={[Spaces.gap[12]]}>
        {ETAPES.map((cle, index) => {
          const estFaite = faites.includes(cle);
          const estCourante = cle === courante;
          let couleurPastille = Colors.neutral300;
          if (estFaite) couleurPastille = Colors.success500;
          else if (estCourante) couleurPastille = Colors.primary500;

          return (
            <View
              key={cle}
              style={[Alignments.row, Spaces.gap[12]]}
              testID={`post-match-step-${cle}`}
            >
              <View
                style={{
                  alignItems: 'center',
                  backgroundColor: withAlpha(couleurPastille, 0.16),
                  borderColor: withAlpha(couleurPastille, 0.45),
                  borderRadius: 999,
                  borderWidth: 1,
                  height: 32,
                  justifyContent: 'center',
                  width: 32,
                }}
              >
                <Text style={[Fonts.p3Bold, { color: couleurPastille }]}>
                  {estFaite ? '✓' : String(index + 1)}
                </Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    Fonts.p2Bold,
                    { color: estCourante || estFaite ? Colors.neutral00 : Colors.neutral300 },
                  ]}
                >
                  {CONTENU[cle].titre}
                </Text>
                <Text style={[Fonts.p4, Fonts.neutral300]}>
                  {CONTENU[cle].sousTitre}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* ⛔ LE MOTIF D UNE PORTE FERMEE NE DISPARAIT PAS. C est l etat le plus
          frequent avant la fin du match (« Les stats seront disponibles à la
          fin du match »), et une porte grisee qui ne dit pas POURQUOI ne se
          comprend pas. Il vivait sous l ancien bouton ; il vit ici. */}
      {boutonDesactive && motif ? (
        <Text style={[Fonts.p4, Fonts.neutral200]} testID="post-match-motif">
          {motif}
        </Text>
      ) : null}

      {/* 🪤 LE `testID` VIT SUR CE `View`, PAS SUR LE `Button` : l'atome
          `Button` ne declare NI ne transmet `testID` (son JSDoc s'arrete a
          `accessibilityRole`). Le poser dessus ne l'aurait mis nulle part dans
          la vraie app — seules les doublures de test l'auraient vu, et les
          temoins seraient passes au vert sur une fiction. */}
      <View testID="post-match-action">
        <Button
          disabled={boutonDesactive}
          onPress={() => onPressEtape(courante || 'responses')}
          size="sm"
          title={libelleDuBouton()}
          variant={courante ? 'Primary' : 'Secondary'}
        />
      </View>
    </View>
  );
}

export default PostMatchJourneyCard;
