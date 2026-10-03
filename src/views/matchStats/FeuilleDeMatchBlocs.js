import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable, Switch, Text, TextInput, View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';
import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';
import MemberAvatar from '@/components/molecules/memberAvatar/MemberAvatar';

import {
  colonnesDeLaLigne,
  direLeCompte,
  direSaReponse,
  direUnChiffre,
  joindreLesNoms,
  NOTES_SUR_DIX,
  repriseDeSaReponse,
} from './feuilleDeMatchModel';

// ==========================================================================
// 📐 ST-MATCH10 (écran 10 du design des statistiques validé le 02/10, planches
// P3-editeur-tel et P3-editeur-ordi) — LES BLOCS DE LA FEUILLE DE MATCH.
//
// Purement présentiels : aucune requête, aucun service, aucune navigation (la
// feuille d'un joueur s'ouvre dans une `BottomModal`, un portail HORS de la
// navigation : `useNavigation` y planterait — piège COLL-FIX-PLANNING G4).
// L'écran (`MatchStatsEditor.js`) garde les données, les bornes et les envois.
// ==========================================================================

const chiffre = (/** @type {any} */ valeur) => Number.parseInt(String(valeur ?? '0'), 10) || 0;

/**
 * Les surfaces de la feuille : une carte, un champ.
 * @returns {{ carte: object, champ: object, encart: object }} Les styles.
 */
export const useSurfacesFeuille = () => {
  const { Colors } = useTheme();
  return useMemo(() => ({
    carte: {
      backgroundColor: withAlpha(Colors.primary700, 0.55),
      borderColor: withAlpha(Colors.primary500, 0.24),
      borderRadius: 20,
      borderWidth: 1,
    },
    champ: {
      backgroundColor: withAlpha(Colors.primary800, 0.85),
      borderColor: withAlpha(Colors.primary500, 0.24),
      borderRadius: 12,
      borderWidth: 1,
    },
    encart: {
      backgroundColor: withAlpha(Colors.neutral00, 0.04),
      borderColor: withAlpha(Colors.neutral00, 0.09),
      borderRadius: 16,
      borderWidth: 1,
    },
  }), [Colors]);
};

/**
 * Un compteur « − 90 + » (44 points par bouton, saisie au clavier possible).
 * @param {object} props - Les propriétés.
 * @param {boolean} [props.desactive] - Lecture seule.
 * @param {string} props.descriptionMoins - Ce que fait « − », pour un lecteur d'écran.
 * @param {string} props.descriptionPlus - Ce que fait « + ».
 * @param {boolean} [props.grand] - Le compteur du score.
 * @param {string} [props.libelle] - Le mot au-dessus.
 * @param {(texte: string) => void} props.onChangeText - La frappe.
 * @param {() => void} props.onMoins - « − ».
 * @param {() => void} props.onPlus - « + ».
 * @param {boolean} [props.plusDesactive] - La borne est atteinte.
 * @param {string} props.valeur - La valeur, en texte.
 * @returns {import('react').ReactElement} Le compteur.
 */
export function Compteur({
  desactive = false,
  descriptionMoins,
  descriptionPlus,
  grand = false,
  libelle = '',
  onChangeText,
  onMoins,
  onPlus,
  plusDesactive = false,
  valeur,
}) {
  const { Alignments, Fonts, Spaces } = useTheme();
  const surfaces = useSurfacesFeuille();
  const moinsEteint = desactive || chiffre(valeur) <= 0;
  const plusEteint = desactive || plusDesactive;
  /**
   * Un bouton « − » ou « + ».
   * @param {string} signe - Le signe affiché.
   * @param {string} description - Ce qu'il fait, pour un lecteur d'écran.
   * @param {boolean} eteint - Éteint.
   * @param {() => void} action - L'appui.
   * @returns {import('react').ReactElement} Le bouton.
   */
  const bouton = (signe, description, eteint, action) => (
    <Pressable
      accessibilityLabel={description}
      accessibilityRole="button"
      accessibilityState={{ disabled: eteint }}
      disabled={eteint}
      hitSlop={4}
      onPress={action}
      style={[Alignments.center, { height: 44, opacity: eteint ? 0.4 : 1, width: 44 }]}
    >
      <Text style={[Fonts.h4Bold, Fonts.primary200]}>{signe}</Text>
    </Pressable>
  );
  return (
    <View style={[Spaces.gap[8], Alignments.fill]}>
      {libelle ? (
        <Text numberOfLines={1} style={[Fonts.p3Bold, Fonts.neutral100]}>{libelle}</Text>
      ) : null}
      <View
        style={[
          surfaces.champ, Alignments.row, Alignments.alignCenter,
          { minHeight: grand ? 56 : 48 },
        ]}
      >
        {bouton('−', descriptionMoins, moinsEteint, onMoins)}
        <TextInput
          accessibilityLabel={libelle || descriptionPlus}
          editable={!desactive}
          keyboardType="number-pad"
          maxLength={3}
          onChangeText={onChangeText}
          selectTextOnFocus
          style={[
            grand ? Fonts.h2Bold : Fonts.h4Bold,
            desactive ? Fonts.neutral200 : Fonts.neutral00,
            Fonts.textCenter,
            { flex: 1, minWidth: 28, paddingVertical: 0 },
          ]}
          value={String(valeur ?? '')}
        />
        {bouton('+', descriptionPlus, plusEteint, onPlus)}
      </View>
    </View>
  );
}

/**
 * Une note sur 10 : dix pastilles de 44 points, une seule cochée (le même dessin
 * pour la note de l'équipe et celle d'un joueur : défaut ⑩ du relevé).
 * @param {object} props - Les propriétés.
 * @param {boolean} [props.desactive] - Lecture seule.
 * @param {string} props.libelle - « Ta note de l'équipe », « Ta note pour Hugo ».
 * @param {(note: number) => void} props.onChoisir - Le choix.
 * @param {number | null} props.valeur - La note cochée.
 * @returns {import('react').ReactElement} La grille.
 */
export function NotesSurDix({
  desactive = false, libelle, onChoisir, valeur,
}) {
  const { Alignments, Colors, Fonts } = useTheme();
  const { t } = useTranslation();
  return (
    <View
      accessibilityLabel={libelle}
      accessibilityRole="radiogroup"
      style={[Alignments.row, Alignments.wrap, { gap: 6 }]}
    >
      {NOTES_SUR_DIX.map((note) => {
        const cochee = valeur === note;
        return (
          <Pressable
            accessibilityLabel={t('stMatch.feuille.ratingA11y', '{{label}} : {{value}} sur 10', {
              label: libelle, value: note, ...SANS_ECHAPPEMENT,
            })}
            accessibilityRole="radio"
            accessibilityState={{ checked: cochee, disabled: desactive }}
            disabled={desactive}
            key={note}
            onPress={() => onChoisir(note)}
            style={[
              Alignments.center,
              {
                backgroundColor: cochee ? Colors.primary500 : withAlpha(Colors.primary700, 0.6),
                borderColor: cochee ? Colors.primary500 : withAlpha(Colors.primary500, 0.24),
                borderRadius: 12,
                borderWidth: 1,
                flexBasis: '17%',
                flexGrow: 1,
                minHeight: 44,
                opacity: desactive && !cochee ? 0.55 : 1,
              },
            ]}
          >
            <Text style={[Fonts.p2Bold, cochee ? Fonts.primary900 : Fonts.neutral00]}>{note}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * L'ALERTE UNIQUE (état 6) et celle du score officiel (état 9) : un titre, des phrases.
 * @param {object} props - Les propriétés.
 * @param {string[]} props.lignes - Les phrases.
 * @param {string} props.titre - Le titre.
 * @returns {import('react').ReactElement} L'alerte.
 */
export function AlerteFeuille({ lignes, titre }) {
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={[
        Spaces.gap[8],
        Spaces.padding[16],
        {
          backgroundColor: withAlpha(Colors.warning500, 0.1),
          borderColor: withAlpha(Colors.warning500, 0.45),
          borderRadius: 16,
          borderWidth: 1,
        },
      ]}
    >
      <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
        <SvgIcon color={Colors.warning400} height={16} name="flag" width={16} />
        <Text style={[Fonts.p2Bold, Fonts.warning400, Alignments.fill]}>{titre}</Text>
      </View>
      {lignes.map((ligne) => (
        <Text key={ligne} style={[Fonts.p2, Fonts.neutral100]}>{ligne}</Text>
      ))}
    </View>
  );
}

/**
 * LA LIGNE PAR JOUEUR (états 2, 3 et 6) : minutes, buts, passes ; le détail au toucher.
 * @param {object} props - Les propriétés.
 * @param {Set<string>} props.aVerifier - Les lignes nommées par l'alerte.
 * @param {boolean} [props.colonneReponse] - Ordinateur, un joueur ouvert (planche O2) : la
 *   réponse dans SA colonne, au lieu de la 2e ligne sous le nom et de « Ta note ».
 * @param {any[]} props.lignes - Les lignes en cours de saisie.
 * @param {Map<string, number | null>} props.notesDuCoach - Ta note, par ligne (ordinateur).
 * @param {(cle: string) => void} props.onOuvrir - Ouvre la feuille du joueur.
 * @param {boolean} props.ordinateur - La colonne « Ta note » en plus.
 * @param {Map<string, any>} props.reponses - Les réponses, par joueur.
 * @param {string | null} props.selection - La ligne ouverte (ordinateur).
 * @param {string} props.sport - Le sport.
 * @returns {import('react').ReactElement} Le tableau.
 */
export function TableauDesJoueurs({
  aVerifier, colonneReponse = false, lignes, notesDuCoach, onOuvrir, ordinateur, reponses, selection,
  sport,
}) {
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const colonnes = colonnesDeLaLigne(sport);
  const cles = sport === 'basketball'
    ? ['points', 'assists', 'rebounds', 'threePointsMade']
    : ['goals', 'assists', 'goalsConceded'];
  /** @type {Record<string, string>} */
  const entetes = {
    assists: t('stMatch.feuille.col.assists', 'Pas.'),
    goals: t('stMatch.feuille.col.goals', 'Buts'),
    minutesPlayed: t('stMatch.feuille.col.minutes', 'Min'),
    points: t('stMatch.feuille.col.points', 'Pts'),
  };
  const cellule = { textAlign: /** @type {'center'} */ ('center'), width: 40 };
  // 📐 ST-MATCH10-BIS (point 7) — la colonne « Réponse » de la planche O2.
  const celluleReponse = { width: 112 };
  return (
    <View>
      <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8], { paddingBottom: 8 }]}>
        <View style={{ width: 32 }} />
        <Text style={[Fonts.p4Bold, Fonts.neutral300, Alignments.fill]}>
          {t('stMatch.feuille.col.player', 'Joueur')}
        </Text>
        {colonneReponse ? (
          <Text style={[Fonts.p4Bold, Fonts.neutral300, celluleReponse]}>
            {t('stMatch.feuille.col.answer', 'Réponse')}
          </Text>
        ) : null}
        {colonnes.map((cle) => (
          <Text key={cle} style={[Fonts.p4Bold, Fonts.neutral300, cellule]}>{entetes[cle]}</Text>
        ))}
        {ordinateur && !colonneReponse ? (
          <Text style={[Fonts.p4Bold, Fonts.neutral300, { textAlign: 'center', width: 56 }]}>
            {t('stMatch.feuille.col.myRating', 'Ta note')}
          </Text>
        ) : null}
      </View>
      {lignes.map((ligne) => {
        const reponse = reponses.get(ligne.userDocumentId) || null;
        const aRepondu = reponse?.status === 'submitted';
        const douteuse = aVerifier.has(ligne.key);
        // 📐 ST-MATCH10-BIS (point 3, « feuille convoqués A ») : un joueur ajouté hors
        // convocation reste sur la feuille avec ses minutes ; personne ne l'attend.
        let etat = reponse?.convoked === false
          ? t('stMatch.feuille.row.notConvoked', 'Hors convocation')
          : t('stMatch.feuille.row.notAnswered', 'Pas encore répondu');
        if (douteuse) {
          etat = t('stMatch.feuille.row.toCheck', 'À vérifier');
        } else if (aRepondu) {
          etat = t('stMatch.feuille.row.answered', 'A répondu');
        }
        const sousTitre = !douteuse && aRepondu && repriseDeSaReponse(ligne, cles)
          ? t('stMatch.feuille.row.answeredTaken', 'A répondu · repris de sa réponse')
          : etat;
        // La colonne dit « — » pour qui n'a pas encore répondu, comme la planche.
        const reponseCourte = douteuse || aRepondu || reponse?.convoked === false ? etat : '—';
        const note = notesDuCoach.get(ligne.key);
        return (
          <Pressable
            accessibilityLabel={t(
              'stMatch.feuille.row.a11y',
              '{{name}} : {{figures}}. {{state}}.',
              {
                figures: colonnes
                  .map((cle) => direUnChiffre(cle, chiffre(ligne?.[cle]), t))
                  .join(', '),
                name: ligne.label,
                state: etat,
                ...SANS_ECHAPPEMENT,
              },
            )}
            accessibilityRole="button"
            key={ligne.key}
            onPress={() => onOuvrir(ligne.key)}
            style={[
              Alignments.row,
              Alignments.alignCenter,
              Spaces.gap[8],
              Spaces.paddingVertical[8],
              {
                backgroundColor: selection === ligne.key
                  ? withAlpha(Colors.primary500, 0.12)
                  : 'transparent',
                borderTopColor: withAlpha(Colors.neutral300, 0.18),
                borderTopWidth: 1,
                minHeight: 52,
              },
            ]}
          >
            <MemberAvatar
              firstname={ligne.firstname || ligne.label}
              lastname={ligne.lastname || ''}
              size={32}
            />
            <View style={Alignments.fill}>
              <Text numberOfLines={1} style={[Fonts.p2Bold, Fonts.neutral00]}>{ligne.label}</Text>
              {colonneReponse ? null : (
                <Text
                  numberOfLines={1}
                  style={[Fonts.p4, douteuse ? Fonts.warning400 : Fonts.neutral300]}
                >
                  {sousTitre}
                </Text>
              )}
            </View>
            {colonneReponse ? (
              <Text
                numberOfLines={1}
                style={[Fonts.p3, douteuse ? Fonts.warning400 : Fonts.neutral100, celluleReponse]}
              >
                {reponseCourte}
              </Text>
            ) : null}
            {colonnes.map((cle) => {
              const valeur = chiffre(ligne?.[cle]);
              const marque = cle !== 'minutesPlayed' && valeur > 0;
              let couleur = Fonts.neutral100;
              if (douteuse && marque) couleur = Fonts.warning400;
              else if (marque) couleur = Fonts.neutral00;
              return (
                <Text key={cle} style={[marque ? Fonts.p2Bold : Fonts.p2, couleur, cellule]}>
                  {valeur}
                </Text>
              );
            })}
            {ordinateur && !colonneReponse ? (
              <Text style={[Fonts.p2, Fonts.neutral100, { textAlign: 'center', width: 56 }]}>
                {note ? String(note) : '—'}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * LA FEUILLE D'UN JOUEUR (état 4 ; panneau de droite sur ordinateur, état 2) : sa
 * réponse, ses chiffres repris, puis TON retour, dit privé.
 * @param {object} props - Les propriétés.
 * @param {(cle: string, ecart: number) => void} props.onAjuster - « − » / « + » d'un chiffre.
 * @param {(cle: string, texte: string) => void} props.onChiffre - La frappe d'un chiffre.
 * @param {(valeur: boolean) => void} props.onCleanSheet - L'interrupteur du clean sheet.
 * @param {(texte: string) => void} props.onCommentaire - Ton commentaire.
 * @param {() => void} props.onFermer - Ferme la feuille.
 * @param {(note: number) => void} props.onNote - Ta note.
 * @param {boolean} props.lectureSeule - La feuille est publiée.
 * @param {any} props.ligne - Sa ligne en cours de saisie.
 * @param {(cle: string) => number} props.maximum - La borne de chaque chiffre.
 * @param {{ date: string, time: string } | null} props.moment - Quand il a répondu.
 * @param {any} props.reponse - Sa réponse.
 * @param {any} props.retour - Ton retour (note, commentaire).
 * @param {string} props.sport - Le sport.
 * @returns {import('react').ReactElement} La feuille.
 */
export function FicheDuJoueur({
  lectureSeule, ligne, maximum, moment, onAjuster, onChiffre, onCleanSheet, onCommentaire, onFermer,
  onNote, reponse, retour, sport,
}) {
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const surfaces = useSurfacesFeuille();
  const prenom = String(ligne?.firstname || String(ligne?.label || '').split(' ')[0] || '').trim();
  const aRepondu = reponse?.status === 'submitted';
  const chiffresRepondus = ligne?.responseFigures || null;
  const cleQuiMarque = sport === 'basketball' ? 'points' : 'goals';
  const commentaireLibelle = t(
    'stMatch.feuille.privateComment',
    'Commentaire privé pour ce joueur',
  );

  const tuiles = [];
  if (aRepondu && reponse?.selfRating !== null && reponse?.selfRating !== undefined) {
    tuiles.push({
      cle: 'self',
      libelle: t('stMatch.feuille.tile.selfRating', 'sa note'),
      valeur: `${reponse.selfRating}/10`,
    });
  }
  if (aRepondu && reponse?.teamRating !== null && reponse?.teamRating !== undefined) {
    tuiles.push({
      cle: 'team',
      libelle: t('stMatch.feuille.tile.teamRating', 'l’équipe'),
      valeur: `${reponse.teamRating}/10`,
    });
  }
  if (aRepondu && chiffresRepondus) {
    const marques = chiffre(chiffresRepondus?.sportPayload?.[cleQuiMarque]);
    tuiles.push({
      cle: 'min',
      libelle: t('playerMatchResponseScreen.minutesUnit', 'min'),
      valeur: String(chiffre(chiffresRepondus?.minutesPlayed)),
    });
    tuiles.push({
      cle: 'marque',
      libelle: cleQuiMarque === 'points'
        ? t('stMatch.rappel.figures.points', {
          count: marques, defaultValue_one: 'point', defaultValue_other: 'points',
        })
        : t('stMatch.rappel.figures.goals', {
          count: marques, defaultValue_one: 'but', defaultValue_other: 'buts',
        }),
      valeur: String(marques),
    });
  }

  /** @type {Record<string, string[]>} */
  const libelles = {
    assists: [
      t('stMatch.feuille.counter.assists', 'Passes'),
      t('playerMatchResponseScreen.minus.assists', 'Une passe de moins'),
      t('playerMatchResponseScreen.plus.assists', 'Une passe de plus'),
    ],
    goals: [
      t('matchStatsEditor.goals', 'Buts'),
      t('playerMatchResponseScreen.minus.goals', 'Un but de moins'),
      t('playerMatchResponseScreen.plus.goals', 'Un but de plus'),
    ],
    goalsConceded: [
      t('matchStatsEditor.goalsConceded', 'Buts encaissés'),
      t('playerMatchResponseScreen.minus.goalsConceded', 'Un but encaissé de moins'),
      t('playerMatchResponseScreen.plus.goalsConceded', 'Un but encaissé de plus'),
    ],
    minutesPlayed: [
      t('stMatch.feuille.counter.minutes', 'Minutes'),
      t('playerMatchResponseScreen.fewerMinutes', 'Moins de minutes'),
      t('playerMatchResponseScreen.moreMinutes', 'Plus de minutes'),
    ],
    points: [
      t('matchStatsEditor.points', 'Points'),
      t('playerMatchResponseScreen.minus.points', 'Un point de moins'),
      t('playerMatchResponseScreen.plus.points', 'Un point de plus'),
    ],
    rebounds: [
      t('matchStatsEditor.rebounds', 'Rebonds'),
      t('playerMatchResponseScreen.minus.rebounds', 'Un rebond de moins'),
      t('playerMatchResponseScreen.plus.rebounds', 'Un rebond de plus'),
    ],
    threePointsMade: [
      t('matchStatsEditor.threePointers', '3 pts'),
      t('playerMatchResponseScreen.minus.threePointsMade', 'Un panier à 3 points de moins'),
      t('playerMatchResponseScreen.plus.threePointsMade', 'Un panier à 3 points de plus'),
    ],
  };
  const compteur = (/** @type {string} */ cle) => {
    const [libelle, moins, plus] = libelles[cle];
    return (
      <View key={cle} style={{ flexBasis: '30%', flexGrow: 1 }}>
        <Compteur
          desactive={lectureSeule}
          descriptionMoins={moins}
          descriptionPlus={plus}
          libelle={libelle}
          onChangeText={(texte) => onChiffre(cle, texte)}
          onMoins={() => onAjuster(cle, -1)}
          onPlus={() => onAjuster(cle, 1)}
          plusDesactive={chiffre(ligne?.[cle]) >= maximum(cle)}
          valeur={ligne?.[cle]}
        />
      </View>
    );
  };
  const premiers = sport === 'basketball'
    ? ['minutesPlayed', 'points', 'assists', 'rebounds', 'threePointsMade']
    : ['minutesPlayed', 'goals', 'assists'];

  return (
    <View style={Spaces.gap[12]}>
      <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12]]}>
        <MemberAvatar
          firstname={ligne?.firstname || ligne?.label}
          lastname={ligne?.lastname || ''}
          size={40}
        />
        <View style={Alignments.fill}>
          <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00]}>
            {ligne?.label}
          </Text>
          <Text style={[Fonts.p3, Fonts.neutral300]}>
            {aRepondu && moment
              ? t('stMatch.feuille.answeredOn', 'A répondu le {{date}} à {{time}}', {
                ...moment, ...SANS_ECHAPPEMENT,
              })
              : t('stMatch.feuille.row.notAnswered', 'Pas encore répondu')}
          </Text>
        </View>
        <Pressable
          accessibilityLabel={t('stMatch.rappel.close', 'Fermer')}
          accessibilityRole="button"
          hitSlop={8}
          onPress={onFermer}
          style={[Alignments.center, { height: 44, width: 44 }]}
        >
          <SvgIcon color={Colors.neutral200} height={18} name="close" width={18} />
        </Pressable>
      </View>

      {tuiles.length ? (
        <View style={[Alignments.row, Spaces.gap[8]]}>
          {tuiles.map((tuile) => (
            <View
              key={tuile.cle}
              style={[surfaces.encart, Spaces.padding[8], Alignments.fill, Alignments.alignCenter]}
            >
              <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{tuile.valeur}</Text>
              <Text style={[Fonts.p4, Fonts.neutral300]}>{tuile.libelle}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {aRepondu && String(reponse?.selfComment || '').trim() ? (
        <Text style={[Fonts.p2, Fonts.neutral100, { fontStyle: 'italic' }]}>
          {t('stMatch.feuille.quote', '« {{text}} »', {
            text: String(reponse.selfComment).trim(), ...SANS_ECHAPPEMENT,
          })}
        </Text>
      ) : null}

      <View style={[Alignments.row, Alignments.wrap, Spaces.gap[8]]}>
        {premiers.map(compteur)}
      </View>
      {sport === 'basketball' ? null : (
        <View style={[Alignments.row, Alignments.alignEnd, Spaces.gap[8]]}>
          {compteur('goalsConceded')}
          <View
            style={[
              surfaces.champ,
              Alignments.row,
              Alignments.alignCenter,
              Spaces.gap[8],
              Spaces.paddingHorizontal[12],
              { flexBasis: '30%', flexGrow: 1, minHeight: 48 },
            ]}
          >
            <Text numberOfLines={1} style={[Fonts.p3Bold, Fonts.neutral00, Alignments.fill]}>
              {t('matchStatsEditor.cleanSheet', 'Clean sheet')}
            </Text>
            <Switch
              accessibilityLabel={t('matchStatsEditor.cleanSheet', 'Clean sheet')}
              disabled={lectureSeule}
              onValueChange={onCleanSheet}
              thumbColor={Colors.neutral00}
              trackColor={{ false: Colors.neutral600, true: Colors.primary500 }}
              value={Boolean(ligne?.cleanSheet)}
            />
          </View>
        </View>
      )}

      <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
        {t('stMatch.feuille.feedbackTo', 'Ton retour à {{name}}', {
          name: prenom, ...SANS_ECHAPPEMENT,
        })}
      </Text>
      <NotesSurDix
        desactive={lectureSeule}
        libelle={t('stMatch.feuille.ratingFor', 'Ta note pour {{name}}', {
          name: prenom, ...SANS_ECHAPPEMENT,
        })}
        onChoisir={onNote}
        valeur={retour?.rating ?? null}
      />
      <TextInput
        accessibilityLabel={commentaireLibelle}
        editable={!lectureSeule}
        maxLength={1200}
        multiline
        onChangeText={onCommentaire}
        placeholder={commentaireLibelle}
        placeholderTextColor={Colors.neutral400}
        style={[
          surfaces.champ,
          Fonts.p2,
          Fonts.neutral00,
          Spaces.padding[12],
          { minHeight: 72, textAlignVertical: 'top' },
        ]}
        value={retour?.comment || ''}
      />
      <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
        <GlyphIcon color={Colors.neutral300} name="lock" size={16} />
        <Text style={[Fonts.p3, Fonts.neutral300, Alignments.fill]}>
          {t(
            'stMatch.feuille.privacyPlayer',
            'Lu par {{name}} et, s’il est mineur, ses parents. Jamais par ses coéquipiers.',
            { name: prenom, ...SANS_ECHAPPEMENT },
          )}
        </Text>
      </View>
    </View>
  );
}

/**
 * L'ONGLET RETOURS (état 5) : le compte, qui manque et « Relancer », qui a répondu.
 * @param {object} props - Les propriétés.
 * @param {number} props.attendues - Les joueurs de la feuille.
 * @param {(() => void) | null} props.onRelancer - La relance (match d'un événement).
 * @param {number} props.recues - Les réponses envoyées.
 * @param {boolean} props.relanceEnCours - La relance part.
 * @param {any[]} props.reponses - Les réponses, telles que le serveur les résume.
 * @returns {import('react').ReactElement} L'onglet.
 */
export function BlocRetours({
  attendues, onRelancer, recues, relanceEnCours, reponses,
}) {
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const surfaces = useSurfacesFeuille();
  const repondu = reponses.filter((reponse) => reponse?.status === 'submitted');
  const manquants = reponses.filter((reponse) => reponse?.status !== 'submitted');
  // 📐 ST-MATCH10-BIS (point 3) — « feuille convoqués A » : TOUT l'effectif compte (« 2 sur
  // 11 ont répondu »), mais le serveur ne relance que les convoqués (« c oui »). Le bouton
  // compte donc ceux qu'il relancera, et la feuille dit qui ne l'est pas. Un serveur
  // d'avant ne marque personne (`convoked` absent) : tous restent relançables.
  const aRelancer = manquants.filter((reponse) => reponse?.convoked !== false);
  const horsConvocation = manquants
    .filter((reponse) => reponse?.convoked === false)
    .map((reponse) => reponse?.label)
    .filter(Boolean);
  const part = attendues > 0 ? Math.round((recues / attendues) * 100) : 0;

  if (!attendues) {
    return (
      <Text style={[Fonts.p2, Fonts.neutral200]}>
        {t(
          'stMatch.feuille.noPlayersToAnswer',
          'Aucun joueur n’attend de questionnaire pour ce match.',
        )}
      </Text>
    );
  }

  return (
    <View style={Spaces.gap[12]}>
      <View style={Spaces.gap[8]}>
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{direLeCompte(recues, attendues, t)}</Text>
        <View
          accessibilityRole="progressbar"
          accessibilityValue={{ max: attendues, min: 0, now: recues }}
          style={{
            backgroundColor: withAlpha(Colors.neutral00, 0.08),
            borderRadius: 999,
            height: 6,
            overflow: 'hidden',
          }}
        >
          <View style={{
            backgroundColor: Colors.success500,
            borderRadius: 999,
            height: '100%',
            width: `${part}%`,
          }}
          />
        </View>
      </View>

      {manquants.length ? (
        <View style={[surfaces.encart, Spaces.padding[12], Spaces.gap[8]]}>
          <Text style={[Fonts.p3Bold, Fonts.neutral300]}>
            {t('stMatch.feuille.missingTitle', 'Manquent · {{n}}', { n: manquants.length })}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral100]}>
            {manquants.map((reponse) => reponse?.label).filter(Boolean).join(', ')}
          </Text>
          {horsConvocation.length ? (
            <Text style={[Fonts.p3, Fonts.neutral300]}>
              {t('stMatch.feuille.notConvokedNoReminder', {
                count: horsConvocation.length,
                defaultValue_one: '{{names}} n’est pas convoqué : la relance ne part qu’aux convoqués.',
                // eslint-disable-next-line max-len
                defaultValue_other: '{{names}} ne sont pas convoqués : la relance ne part qu’aux convoqués.',
                names: joindreLesNoms(horsConvocation, t),
                ...SANS_ECHAPPEMENT,
              })}
            </Text>
          ) : null}
          {onRelancer && aRelancer.length ? (
            <Button
              disabled={relanceEnCours}
              icon="bell"
              isLoading={relanceEnCours}
              onPress={onRelancer}
              title={t('stMatch.carte.remind', {
                count: aRelancer.length,
                defaultValue_one: 'Relancer {{count}} joueur',
                defaultValue_other: 'Relancer les {{count}}',
              })}
              variant="Primary"
            />
          ) : null}
        </View>
      ) : null}

      {repondu.length ? (
        <View style={Spaces.gap[8]}>
          <Text style={[Fonts.p3Bold, Fonts.neutral300]}>
            {t('stMatch.feuille.answeredTitle', 'Ont répondu · {{n}}', { n: repondu.length })}
          </Text>
          <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
            <View style={{ width: 32 }} />
            <Text style={[Fonts.p4Bold, Fonts.neutral300, Alignments.fill]}>
              {t('stMatch.feuille.col.player', 'Joueur')}
            </Text>
            <Text style={[Fonts.p4Bold, Fonts.neutral300, { textAlign: 'center', width: 40 }]}>
              {t('stMatch.feuille.col.self', 'Lui')}
            </Text>
            <Text style={[Fonts.p4Bold, Fonts.neutral300, { textAlign: 'center', width: 40 }]}>
              {t('stMatch.feuille.col.team', 'Éq.')}
            </Text>
          </View>
          {repondu.map((reponse) => {
            const [prenom, ...nom] = String(reponse?.label || '').split(' ');
            return (
              <View
                key={reponse?.userDocumentId || reponse?.label}
                style={[
                  Alignments.row,
                  Alignments.alignCenter,
                  Spaces.gap[8],
                  Spaces.paddingVertical[8],
                  { borderTopColor: withAlpha(Colors.neutral300, 0.18), borderTopWidth: 1 },
                ]}
              >
                <MemberAvatar firstname={prenom} lastname={nom.join(' ')} size={32} />
                <View style={Alignments.fill}>
                  <Text numberOfLines={1} style={[Fonts.p2Bold, Fonts.neutral00]}>
                    {reponse?.label}
                  </Text>
                  <Text numberOfLines={1} style={[Fonts.p4, Fonts.neutral300]}>
                    {direSaReponse(reponse, t)}
                  </Text>
                </View>
                <Text style={[Fonts.p2, Fonts.neutral100, { textAlign: 'center', width: 40 }]}>
                  {reponse?.selfRating ?? '—'}
                </Text>
                <Text style={[Fonts.p2, Fonts.neutral100, { textAlign: 'center', width: 40 }]}>
                  {reponse?.teamRating ?? '—'}
                </Text>
              </View>
            );
          })}
          <Text style={[Fonts.p3, Fonts.neutral300]}>
            {t(
              'stMatch.feuille.legend',
              '« Lui » : sa note ; « Éq. » : sa note de l’équipe.',
            )}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * LA FEUILLE PUBLIÉE (état 8) : le score, les deux notes, ton mot, ce qui est parti.
 * @param {object} props - Les propriétés.
 * @param {string} props.adversaire - « Adversaire ».
 * @param {string} props.equipe - Le nom de l'équipe.
 * @param {string} props.etiquetteDuScore - « Score saisi » ou « Score officiel ».
 * @param {string} props.ligneOk - « Hugo a reçu ton retour. 1 sur 1 a répondu. »
 * @param {{ libelle: string, valeur: string }} props.moyenne - La note des joueurs
 *   (« moyenne B »).
 * @param {string} props.motDuCoach - Ton mot à l'équipe.
 * @param {number | null} props.noteEquipe - Ta note de l'équipe.
 * @param {string} props.score - « 2 - 1 ».
 * @returns {import('react').ReactElement} Le bilan.
 */
export function BilanPublie({
  adversaire, equipe, etiquetteDuScore, ligneOk, motDuCoach, moyenne, noteEquipe, score,
}) {
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const surfaces = useSurfacesFeuille();
  const tuiles = [
    {
      cle: 'equipe',
      libelle: t('stMatch.feuille.teamRating', 'Ta note de l’équipe'),
      valeur: Number(noteEquipe) > 0 ? `${noteEquipe}/10` : '—',
    },
    { cle: 'joueurs', libelle: moyenne.libelle, valeur: moyenne.valeur },
  ];
  const nomDEquipe = [Fonts.p2Bold, Fonts.neutral100, Alignments.fill, Fonts.textCenter];
  return (
    <View style={Spaces.gap[16]}>
      <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
        <Text numberOfLines={2} style={nomDEquipe}>{equipe}</Text>
        <View style={[Alignments.alignCenter, { minWidth: 96 }]}>
          <Text style={[Fonts.h2Bold, Fonts.neutral00]}>{score}</Text>
          <Text style={[Fonts.p4, Fonts.neutral300]}>{etiquetteDuScore}</Text>
        </View>
        <Text numberOfLines={2} style={nomDEquipe}>{adversaire}</Text>
      </View>
      <View style={[Alignments.row, Spaces.gap[8]]}>
        {tuiles.map((tuile) => (
          <View
            key={tuile.cle}
            style={[surfaces.encart, Spaces.padding[12], Spaces.gap[4], Alignments.fill]}
          >
            <Text style={[Fonts.h4Black, Fonts.neutral00]}>{tuile.valeur}</Text>
            <Text style={[Fonts.p3, Fonts.neutral300]}>{tuile.libelle}</Text>
          </View>
        ))}
      </View>
      {motDuCoach ? (
        <Text
          style={[
            Fonts.p2,
            Fonts.neutral100,
            { borderLeftColor: Colors.primary500, borderLeftWidth: 2, paddingLeft: 8 },
          ]}
        >
          {motDuCoach}
        </Text>
      ) : null}
      {ligneOk ? (
        <View
          style={[
            Alignments.row, Alignments.alignCenter, Spaces.gap[8],
            surfaces.encart, Spaces.padding[12],
          ]}
        >
          <SvgIcon color={Colors.success200} height={16} name="check" width={16} />
          <Text style={[Fonts.p2, Fonts.neutral100, Alignments.fill]}>{ligneOk}</Text>
        </View>
      ) : null}
    </View>
  );
}
