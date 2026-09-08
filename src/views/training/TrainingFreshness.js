import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useMyTraining, useUpdateTrainingSession } from '@/hooks/useTraining';

/**
 * « COMMENT TU TE SENS ? » — la barrière posée avant chaque journée qui mesure.
 *
 * 🔎 POURQUOI CET ÉCRAN EXISTE, ET POURQUOI IL BLOQUE. Un test athlétique ne
 * mesure quelque chose que si le corps est dans un état comparable d'une fois sur
 * l'autre. Un joueur qui a dormi quatre heures et qui court son 10 m ne mesure pas
 * sa vitesse : il mesure sa nuit. Le chiffre entre quand même au carnet, il a l'air
 * d'un progrès ou d'une chute, et il pourrit toute la série. D'où la barrière : on
 * répond AVANT de sortir le matériel, et le verdict décide si la séance a lieu.
 *
 * ⛔ LE MOT « FRAÎCHEUR » N'APPARAÎT NULLE PART. Le pack de design le bannit devant
 * l'utilisateur, et il a raison : personne ne dit « je fais mon contrôle de
 * fraîcheur ». L'écran pose la question comme on la poserait de vive voix.
 *
 * 🔎 CE QUI EST STOCKÉ, ET OÙ. Les cinq notes, le total et le verdict partent dans
 * le champ `freshness` de la séance — un champ JSON qui existait DÉJÀ côté serveur
 * et que le contrôleur acceptait déjà (`training-enrollment.ts:253`). Aucune
 * migration : c'est ce qui rend l'écran livrable seul. C'est aussi ce qui permet au
 * carnet de savoir, plus tard, qu'une séance a tourné en version allégée — la
 * marque se DÉDUIT de `freshness.decision`, elle n'a pas besoin de sa propre case.
 */

/**
 * Les cinq questions, dans l'ordre du pack.
 *
 * 🔎 L'ORDRE N'EST PAS ALPHABÉTIQUE : il va du plus factuel (le sommeil, qu'on sait
 * chiffrer) au plus flou (l'humeur). On répond mieux à une question difficile après
 * s'être échauffé sur les faciles.
 */
const QUESTIONS = ['sleep', 'fatigue', 'soreness', 'stress', 'mood'];

/** Les cinq notes possibles. 1 = le pire, 5 = le mieux, pour TOUTES les questions. */
const NOTES = [1, 2, 3, 4, 5];

/** Sous ce total sur 25, on reporte. */
const SEUIL_TOTAL = 15;

/** À cette note de courbatures ou en dessous, on reporte, quel que soit le total. */
const SEUIL_COURBATURES = 2;

/** Une note qui alerte : elle s'allume en or au lieu du bleu. */
const ALERTE = 2;

/**
 * LE VERDICT — la seule règle qui décide si la séance a lieu.
 *
 * 🪤 LES COURBATURES ONT UN DROIT DE VETO, et ce n'est pas un détail de confort :
 * un joueur peut afficher 18 sur 25 en dormant bien et en étant serein, tout en
 * étant à 2 en courbatures. Sa force explosive est alors mesurablement plus basse,
 * et le test enregistrerait une chute qui ne dit rien de son niveau. Le total seul
 * laisserait passer ce cas — d'où la deuxième condition.
 * @param {Record<string, number>} notes les cinq notes, par clef de question
 * @returns {{total: number, verdict: 'go'|'postpone'|'restricted'}|null} le verdict,
 *   ou `null` tant que les cinq questions n'ont pas de réponse
 */
export const verdictDeForme = (notes) => {
  const donnees = QUESTIONS.map((clef) => notes?.[clef]).filter((note) => Number.isFinite(note));
  if (donnees.length < QUESTIONS.length) return null;

  const total = donnees.reduce((somme, note) => somme + note, 0);
  if (total < SEUIL_TOTAL || notes.soreness <= SEUIL_COURBATURES) {
    return { total, verdict: 'postpone' };
  }
  // Entre les deux, la séance a lieu mais on coupe les séries lourdes : c'est la
  // version allégée. Le seuil est le total « juste au-dessus du report ».
  if (total < SEUIL_TOTAL + 4) return { total, verdict: 'restricted' };
  return { total, verdict: 'go' };
};

/**
 * Une ligne de question : son intitulé, ses cinq cases, et les deux mots des bouts.
 * @param {object} props Les propriétés de la ligne.
 * @param {string} props.clef La clef de la question (`sleep`, `fatigue`, …).
 * @param {(note: number) => void} props.onChange Enregistre la note choisie.
 * @param {number} [props.valeur] La note déjà choisie, s'il y en a une.
 * @returns {React.ReactElement} une question avec son échelle de 1 à 5
 */
function Question({ clef, onChange, valeur }) {
  const { Colors, Fonts, Spaces } = useTheme();
  const { t } = useTranslation();

  return (
    <View style={Spaces.gap[8]}>
      <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>
        {t(`training.freshness.items.${clef}`)}
      </Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {NOTES.map((note) => {
          const choisie = valeur === note;
          // 🎨 LA COULEUR DIT L'ALERTE, PAS LA POSITION : 1 et 2 s'allument en or,
          // 3 à 5 en bleu. Un joueur qui coche deux cases or voit tout de suite,
          // sans lire le total, que la séance est en train de basculer.
          const teinte = note <= ALERTE ? Colors.gold500 : Colors.primary500;
          return (
            <TouchableOpacity
              // 🔊 La note SEULE ne dit rien a une personne qui n a que la voix :
              // « Sommeil, 3 » ne se comprend qu en voyant les deux mots des bouts.
              // L etiquette porte donc le mot de l echelle, pas seulement le chiffre.
              accessibilityLabel={[
                t(`training.freshness.items.${clef}`),
                note,
                t(`training.freshness.scale.${note}`),
              ].join(' ')}
              accessibilityRole="button"
              accessibilityState={{ selected: choisie }}
              key={note}
              onPress={() => onChange(note)}
              style={{
                alignItems: 'center',
                backgroundColor: choisie ? withAlpha(teinte, 0.18) : 'transparent',
                borderColor: choisie ? teinte : withAlpha(Colors.primary500, 0.25),
                borderRadius: 10,
                borderWidth: choisie ? 2 : 1,
                flex: 1,
                // 56 points : le pack l'impose parce qu'on répond debout, avec les
                // doigts froids, avant de s'échauffer. Une case de 32 se rate.
                height: 56,
                justifyContent: 'center',
              }}
            >
              <Text style={[Fonts.h4Bold, { color: choisie ? teinte : Colors.neutral300 }]}>
                {note}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {/*
          Les deux bouts de l'échelle, écrits sous elle. Sans eux, « 1 » ne veut
          rien dire — et le sens CHANGE d'une question à l'autre : 5 en courbatures
          veut dire « aucune », 5 en sommeil veut dire « très bon ».
        */}
        <Text style={[Fonts.caption, { color: Colors.neutral400 }]}>
          {t(`training.freshness.ends.${clef}.low`)}
        </Text>
        <Text style={[Fonts.caption, { color: Colors.neutral400 }]}>
          {t(`training.freshness.ends.${clef}.high`)}
        </Text>
      </View>
    </View>
  );
}

/**
 * L'écran lui-même.
 * @param {object} props
 * @param {Record<string, any>} props.navigation
 * @param {Record<string, any>} [props.route]
 * @returns {React.ReactElement} l'écran des cinq questions de forme
 */
function TrainingFreshness({ navigation, route }) {
  const { Colors, Fonts, Spaces } = useTheme();
  const { t } = useTranslation();
  const sessionId = route?.params?.sessionId;

  const {
    error, isLoading, refetch, sessions,
  } = useMyTraining();
  const enregistrer = useUpdateTrainingSession();

  const [notes, setNotes] = useState(/** @type {Record<string, number>} */ ({}));
  const [echec, setEchec] = useState(false);

  const session = useMemo(
    () => sessions.find((item) => item.documentId === sessionId) || null,
    [sessionId, sessions],
  );

  const bilan = useMemo(() => verdictDeForme(notes), [notes]);

  const repondre = useCallback((/** @type {string} */ clef, /** @type {number} */ note) => {
    setNotes((precedentes) => ({ ...precedentes, [clef]: note }));
  }, []);

  /**
   * Enregistre les réponses sur la séance, puis fait ce qui suit le verdict.
   * @param {'in_progress'|'postponed'} etat l'état où passe la séance
   * @returns {Promise<void>} rien
   */
  const conclure = useCallback(async (etat) => {
    if (!session?.documentId || !bilan) return;
    setEchec(false);
    try {
      await enregistrer.mutateAsync({
        payload: {
          // Les cinq notes voyagent AVEC leur verdict : recalculer la règle plus
          // tard donnerait un autre résultat le jour où les seuils bougent, et le
          // carnet mentirait rétroactivement sur des séances déjà faites.
          freshness: { answers: notes, decision: bilan.verdict, total: bilan.total },
          status: etat,
        },
        sessionDocumentId: session.documentId,
      });
    } catch (souci) {
      setEchec(true);
      return;
    }
    if (etat === 'postponed') {
      // On n'abandonne pas la personne sur un « c'est reporté » : on l'emmène là
      // où elle CHOISIT de combien, avec la question de la chaîne déjà posée.
      navigation.navigate(RouteNames.TrainingSessions, { postponeSessionId: session.documentId });
      return;
    }
    // ⛔ PAS la fiche de la journee : elle sert a LIRE. Une seance qui demarre
    // s ouvre sur le tableau de bord, le seul ecran qui reponde a « je fais quoi
    // maintenant ? ». C est la porte d entree que le pack decrit.
    navigation.navigate(RouteNames.TrainingSessionNow, { sessionId: session.documentId });
  }, [bilan, enregistrer, navigation, notes, session]);

  const couleurVerdict = bilan && {
    go: Colors.success500,
    postpone: Colors.gold500,
    restricted: Colors.primary400,
  }[bilan.verdict];

  return (
    <ScreenContainer bgImage="bg2" bottomInsetMode="tab-scene">
      <ScrollView
        contentContainerStyle={[Spaces.paddingBottom[24]]}
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
      >
        <WithDataWrapper error={error} isLoading={isLoading} onRetry={refetch}>
          <View style={Spaces.gap[16]}>
            <Text style={[Fonts.h2Bold, { color: Colors.neutral00 }]}>
              {t('training.freshness.title')}
            </Text>

            {/*
              Le carton d'introduction est EN OR, pas en gris : il ne décrit pas
              l'écran, il dit ce que les réponses vont décider. Une consigne qui a
              une conséquence ne se lit pas comme un texte d'aide.
            */}
            <View
              style={{
                backgroundColor: withAlpha(Colors.gold500, 0.12),
                borderLeftColor: Colors.gold500,
                borderLeftWidth: 3,
                borderRadius: 8,
                padding: 12,
              }}
            >
              <Text style={[Fonts.p3, { color: Colors.neutral100 }]}>
                {t('training.freshness.intro')}
              </Text>
            </View>

            <View style={Spaces.gap[16]}>
              {QUESTIONS.map((clef) => (
                <Question
                  clef={clef}
                  key={clef}
                  onChange={(note) => repondre(clef, note)}
                  valeur={notes[clef]}
                />
              ))}
            </View>

            {/*
              LE TOTAL RESTE UN TIRET tant que les cinq questions n'ont pas de
              réponse. Un total partiel qui monte de 3 en 3 se lit comme un score
              en train d'être mauvais : la personne s'auto-corrige pour éviter le
              report, et la mesure perd exactement ce qu'elle cherchait.
            */}
            <View
              style={{
                alignItems: 'center',
                borderColor: withAlpha(bilan && bilan.total < SEUIL_TOTAL
                  ? Colors.gold500 : Colors.primary500, 0.4),
                borderRadius: 12,
                borderWidth: 1,
                paddingVertical: 16,
              }}
            >
              <Text style={[Fonts.caption, { color: Colors.neutral400 }]}>
                {t('training.freshness.totalLabel')}
              </Text>
              <Text
                style={{
                  color: bilan && bilan.total < SEUIL_TOTAL ? Colors.gold500 : Colors.neutral00,
                  fontSize: 40,
                  fontWeight: '700',
                  lineHeight: 46,
                }}
              >
                {bilan ? bilan.total : '—'}
              </Text>
              <Text style={[Fonts.caption, { color: Colors.neutral400 }]}>
                {t('training.freshness.totalMax')}
              </Text>
            </View>

            {bilan && (
              <View
                style={{
                  backgroundColor: withAlpha(couleurVerdict, 0.12),
                  borderColor: withAlpha(couleurVerdict, 0.5),
                  borderRadius: 12,
                  borderWidth: 1,
                  gap: 6,
                  padding: 14,
                }}
              >
                <Text style={[Fonts.h4Bold, { color: couleurVerdict }]}>
                  {t(`training.freshness.decisionTitle.${bilan.verdict}`)}
                </Text>
                <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>
                  {t(`training.freshness.decision.${bilan.verdict}`)}
                </Text>
              </View>
            )}

            {echec && (
              <Text style={[Fonts.p3, { color: Colors.error500 }]}>
                {t('training.freshness.saveFailed')}
              </Text>
            )}

            {/*
              LES DEUX SORTIES DU REPORT. « Je la fais quand même » n'est pas une
              faiblesse du garde-fou : c'est ce qui empêche la personne de mentir
              sur ses réponses pour débloquer le bouton. Elle passe, mais son état
              réel est enregistré, et le carnet saura pourquoi la mesure détonne.
            */}
            {bilan?.verdict === 'postpone' ? (
              <View style={Spaces.gap[8]}>
                <Button
                  isLoading={enregistrer.isPending}
                  onPress={() => conclure('postponed')}
                  title={t('training.freshness.postponeAction')}
                  variant="Secondary"
                />
                <Button
                  onPress={() => conclure('in_progress')}
                  title={t('training.freshness.anyway')}
                  variant="Ghost"
                />
              </View>
            ) : (
              <Button
                // ⛔ ÉTEINT tant que les cinq réponses ne sont pas là : commencer
                // une séance sans avoir répondu, c'est n'avoir aucun garde-fou.
                disabled={!bilan}
                isLoading={enregistrer.isPending}
                onPress={() => conclure('in_progress')}
                title={t(bilan?.verdict === 'restricted'
                  ? 'training.freshness.startLight'
                  : 'training.freshness.start')}
                variant="Primary"
              />
            )}
          </View>
        </WithDataWrapper>
      </ScrollView>
    </ScreenContainer>
  );
}

export default TrainingFreshness;
