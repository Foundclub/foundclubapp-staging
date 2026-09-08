import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import accordFrancais from '@/theme/strings/accordFrancais';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import TrainingProgressBar from '@/components/organisms/training/TrainingProgressBar';
import { formatSessionDate } from '@/components/organisms/training/TrainingSessionRow';
import ScreenContainer from '@/components/templates/ScreenContainer';
import { avancement, etapeCourante, etapesDuJour } from '@/views/training/trainingEtapes';

import { RouteNames } from '@/navigation/routeNames';

import { useMyTraining, useUpdateTrainingSession } from '@/hooks/useTraining';

/**
 * « MAINTENANT » — le tableau de bord d'une séance en cours.
 *
 * 🔎 UNE SEULE QUESTION SE POSE ICI, et c'est celle qu'on se pose vraiment sur un
 * terrain, entre deux essais, avec un partenaire qui attend : QU'EST-CE QUE JE FAIS
 * MAINTENANT ? Rien d'autre n'a sa place. Le protocole se lit la veille, les mesures
 * se saisissent dans l'écran du test, le carnet se relit le soir.
 *
 * 🔎 POURQUOI C'EST LA PLACE DU VILLAGE. Onze pages du parcours guidé — la mise en
 * place, chaque essai, chaque récupération, la fin d'un test — reviennent ici. Sans
 * ce point de retour, on circule d'un test à l'autre à l'aveugle : l'écran d'un test
 * ne dit ni ce qui précède, ni ce qui suit, ni combien il en reste.
 *
 * 🪤 « OÙ J'EN SUIS » NE SE COMPTE PAS EN TESTS. Un test de douze essais reste « pas
 * fait » pendant quarante minutes : la barre ne bouge pas, et on croit avoir perdu sa
 * séance. Le compte se fait donc en ÉTAPES — une mise en place, puis un essai — et
 * c'est `trainingEtapes.js` qui les calcule, à part, où ça se teste sans écran.
 */

/** Les couleurs de la frise, par état. Trois, pas cinq : on la lit d'un coup d'œil. */
const TEINTES = { current: 'primary500', done: 'success500', todo: 'neutral600' };

/**
 * Le nom d'une étape, écrit pareil dans la frise et sur la carte « Maintenant ».
 *
 * 🔎 Il vit ici plutôt qu'en deux endroits : la carte et la frise nomment LA MÊME
 * étape à quelques centimètres l'une de l'autre. Deux libellés recopiés finissent
 * par diverger, et on croit alors qu'ils désignent deux choses différentes.
 * @param {Record<string, any>} etape l'étape à nommer
 * @param {(clef: string, options?: any) => string} t la traduction
 * @returns {string} le libellé de l'étape
 */
/**
 * DEPUIS COMBIEN DE TEMPS LA SEANCE EST OUVERTE.
 *
 * 🐞 DEFAUT VU A L ECRAN LE 2026-09-08 : « T+2352 min ». Une seance ouverte
 * l avant-veille et jamais terminee affichait trente-neuf heures EN MINUTES, en
 * vert, comme une performance. Personne ne lit un nombre pareil.
 *
 * Trois paliers, parce que le chiffre ne sert pas a la meme chose selon l echelle :
 * pendant la seance, la minute compte (« T+42 min ») ; au-dela de deux heures on
 * pense en heures ; au-dela d un jour, la seule information utile est « ca traine
 * depuis des jours », et c est un rappel, plus un chronometre.
 * @param {number} minutes le temps ecoule depuis le depart
 * @param {(clef: string, options?: Record<string, any>) => string} t la traduction
 * @returns {string} le temps ecoule, a l echelle qui se lit
 */
const depuisQuand = (minutes, t) => {
  if (minutes >= 1440) {
    return t('training.now.elapsedLong', { days: Math.floor(minutes / 1440) });
  }
  if (minutes >= 120) {
    return t('training.now.elapsedHours', {
      hours: Math.floor(minutes / 60),
      minutes: String(minutes % 60).padStart(2, '0'),
    });
  }
  return t('training.now.elapsed', { count: minutes });
};

const nommer = (etape, t) => (etape.type === 'prep'
  // 🎯 LE CODE DU TEST, PAS SON TITRE, et pour DEUX raisons mesurées le 2026-09-08.
  //
  // 1. LISIBILITÉ. La ligne portait « <titre du test> — mise en place », coupée à
  //    une seule ligne. Sur « Calibrations caméra — 10 min, pendant ton
  //    échauffement », le suffixe qui distingue les étapes tombait dans les points
  //    de suspension : les quatre premières étapes de la journée s'affichaient
  //    RIGOUREUSEMENT identiques. On ne savait plus laquelle était laquelle.
  //
  // 2. ÉCHAPPEMENT. i18next échappe les valeurs interpolées : chaque « / » d'un
  //    titre ressortait en « &#x2F; » à l'écran — « Rotations de hanche assis
  //    90°&#x2F;90° » était affiché tel quel. Le dépôt connaît ce piège
  //    (`TeamDetails.js`, motif maison) ; un code de test n'a pas de « / ».
  //
  // Le titre, lui, est rendu tel quel sur une seconde ligne, sans interpolation.
  ? t('training.now.step.prep', { test: etape.testCode })
  : t('training.now.step.attempt', {
    current: etape.essai, test: etape.testCode, total: etape.total,
  }));

/**
 * Une pastille de la frise verticale.
 * @param {object} props Les propriétés de la pastille.
 * @param {boolean} props.dernier Vrai pour la dernière : elle ne tire pas de fil.
 * @param {Record<string, any>} props.etape L'étape représentée.
 * @param {() => void} props.onPress Ouvre l'endroit qui correspond à son état.
 * @param {number} props.rang Sa position, affichée quand elle reste à faire.
 * @returns {React.ReactElement} une ligne de la frise
 */
function Pastille({
  dernier, etape, onPress, rang,
}) {
  const { Colors, Fonts } = useTheme();
  const { t } = useTranslation();
  const teinte = Colors[/** @type {keyof Colors} */ (TEINTES[etape.etat])];

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected: etape.etat === 'current' }}
      onPress={onPress}
      style={{ flexDirection: 'row', gap: 10 }}
    >
      <View style={{ alignItems: 'center', width: 24 }}>
        <View style={{
          alignItems: 'center',
          backgroundColor: etape.etat === 'todo' ? 'transparent' : teinte,
          borderColor: teinte,
          borderRadius: 12,
          borderWidth: 1,
          height: 24,
          justifyContent: 'center',
          width: 24,
        }}
        >
          <Text style={[Fonts.caption, {
            color: etape.etat === 'todo' ? Colors.neutral400 : Colors.neutral00,
          }]}
          >
            {etape.etat === 'done' ? '✓' : rang}
          </Text>
        </View>
        {/* Le FIL qui relie les pastilles : sans lui, la frise se lit comme une
            pile de cartes sans rapport, et on ne voit pas qu'il y a un ordre. */}
        {!dernier && (
          <View style={{
            backgroundColor: withAlpha(Colors.primary500, 0.25),
            flex: 1,
            minHeight: 14,
            width: 1,
          }}
          />
        )}
      </View>
      <View style={{ flex: 1, gap: 2, paddingBottom: 12 }}>
        <Text
          numberOfLines={1}
          style={[
            etape.etat === 'current' ? Fonts.p3Bold : Fonts.p3,
            { color: etape.etat === 'todo' ? Colors.neutral300 : Colors.neutral00 },
          ]}
        >
          {nommer(etape, t)}
        </Text>
        {/* Le titre du test, en second : il situe, il ne distingue pas. */}
        <Text numberOfLines={1} style={[Fonts.caption, { color: Colors.neutral400 }]}>
          {etape.titre}
        </Text>
        {etape.calculSeul && etape.type === 'prep' && (
          <Text style={[Fonts.caption, { color: Colors.neutral400 }]}>
            {t('training.day.computeOnly')}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

/**
 * L'écran lui-même.
 * @param {object} props
 * @param {Record<string, any>} props.navigation
 * @param {Record<string, any>} [props.route]
 * @returns {React.ReactElement} le tableau de bord de la séance en cours
 */
function TrainingSessionNow({ navigation, route }) {
  const { Colors, Fonts, Spaces } = useTheme();
  const { t } = useTranslation();
  const sessionId = route?.params?.sessionId;

  const {
    enrollment, error, isLoading, refetch, sessions,
  } = useMyTraining();
  const updateSession = useUpdateTrainingSession();

  const session = useMemo(
    () => sessions.find((item) => item.documentId === sessionId) || null,
    [sessionId, sessions],
  );

  const day = useMemo(() => {
    const dayId = session?.day?.documentId || route?.params?.dayId;
    /** @type {Record<string, any>[]} */
    const days = Array.isArray(enrollment?.program?.days) ? enrollment?.program?.days : [];
    return days.find((item) => item.documentId === dayId) || session?.day || null;
  }, [enrollment, route?.params?.dayId, session]);

  const etapes = useMemo(
    () => etapesDuJour(day, session?.results),
    [day, session],
  );
  const courante = useMemo(() => etapeCourante(etapes), [etapes]);
  const chiffres = useMemo(() => avancement(etapes), [etapes]);

  /**
   * LE TEMPS ÉCOULÉ DEPUIS LE DÉBUT — « T+33 ».
   *
   * 🪤 Il se recalcule à la minute, pas au rendu : sans la minuterie, le compteur
   * restait figé sur la valeur du premier affichage, et sur une séance de deux
   * heures il affichait « T+0 » du début à la fin.
   */
  const [minute, setMinute] = useState(0);
  useEffect(() => {
    const battement = setInterval(() => setMinute((n) => n + 1), 60000);
    return () => clearInterval(battement);
  }, []);

  const ecoule = useMemo(() => {
    if (!session?.startedAt) return null;
    const depart = new Date(session.startedAt).getTime();
    if (!Number.isFinite(depart)) return null;
    // `minute` ne sert qu'à forcer le recalcul : sa valeur n'entre pas dans le
    // résultat, c'est l'horloge qui fait foi.
    return Math.max(0, Math.floor((Date.now() - depart) / 60000) + minute * 0);
  }, [minute, session]);

  /**
   * OÙ MÈNE UNE PASTILLE — et ce n'est pas le même endroit selon son état.
   * @param {Record<string, any>} etape l'étape touchée
   * @returns {void} rien
   */
  const ouvrir = useCallback((etape) => {
    // 🔎 UNE ÉTAPE FAITE S'OUVRE SUR L'EXPLICATION, jamais sur la saisie : on y
    // revient pour COMPRENDRE un résultat, pas pour le refaire — et l'ouvrir sur
    // la saisie inviterait à écraser une mesure valide.
    if (etape.etat === 'done') {
      navigation.navigate(RouteNames.TrainingTest, {
        dayId: day?.documentId, sessionId, tab: 'learn', testIndex: etape.testIndex,
      });
      return;
    }
    // Le reste passe par le PARCOURS GUIDÉ : c'est lui qui enchaîne la mise en
    // place, l'échauffement, l'essai et sa récupération sans jamais demander
    // « et maintenant ? ».
    navigation.navigate(RouteNames.TrainingGuided, {
      dayId: day?.documentId,
      sessionId,
      step: etape.type === 'prep' ? 'prep' : `attempt-${etape.essai}`,
      testIndex: etape.testIndex,
    });
  }, [day, navigation, sessionId]);

  const terminer = useCallback(async () => {
    if (!session?.documentId) return;
    await updateSession.mutateAsync({
      payload: { status: 'done' },
      sessionDocumentId: session.documentId,
    });
    navigation.navigate(RouteNames.TrainingDay, { sessionId: session.documentId });
  }, [navigation, session, updateSession]);

  return (
    <ScreenContainer bgImage="bg2" bottomInsetMode="tab-scene">
      <View style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[Spaces.paddingBottom[24]]}
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
        >
          <WithDataWrapper error={error} isLoading={isLoading} onRetry={refetch}>
            {day ? (
              <View style={Spaces.gap[16]}>
                <View style={Spaces.gap[4]}>
                  <View style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}>
                    <Text style={[Fonts.h2Bold, { color: Colors.neutral00, flex: 1 }]}>
                      {t('training.now.title')}
                    </Text>
                    {ecoule !== null && (
                      <Text style={[Fonts.p2Bold, { color: Colors.success500 }]}>
                        {depuisQuand(ecoule, t)}
                      </Text>
                    )}
                  </View>
                  <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
                    {[
                      formatSessionDate(session?.plannedDate),
                      day.place ? String(day.place).toLowerCase() : null,
                    ].filter(Boolean).join(' · ')}
                  </Text>
                </View>

                {/* ─── LA CARTE « MAINTENANT » ───────────────────────────────
                    Le seul pavé de l'écran qui soit en bleu plein : il dit ce
                    qu'on fait à la seconde où on regarde. */}
                <View style={{
                  backgroundColor: withAlpha(Colors.primary500, 0.18),
                  borderColor: Colors.primary500,
                  borderRadius: 12,
                  borderWidth: 1,
                  gap: 6,
                  padding: 16,
                }}
                >
                  <Text style={[Fonts.caption, { color: Colors.primary400 }]}>
                    {t('training.now.label')}
                  </Text>
                  <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>
                    {courante ? nommer(courante, t) : t('training.now.allDone')}
                  </Text>
                </View>

                <View style={Spaces.gap[4]}>
                  <View style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}>
                    <Text style={[Fonts.p3, { color: Colors.neutral300, flex: 1 }]}>
                      {t('training.now.progress', {
                        count: accordFrancais(chiffres.testsFaits),
                        done: chiffres.faites,
                        tests: chiffres.testsFaits,
                        total: chiffres.total,
                      })}
                    </Text>
                  </View>
                  <TrainingProgressBar
                    color={courante ? Colors.primary500 : Colors.success500}
                    ratio={chiffres.ratio}
                  />
                </View>

                <View style={Spaces.gap[8]}>
                  <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>
                    {t('training.now.whatNext')}
                  </Text>
                  {etapes.map((etape, rang) => (
                    <Pastille
                      dernier={rang === etapes.length - 1}
                      etape={etape}
                      key={etape.cle}
                      onPress={() => ouvrir(etape)}
                      rang={rang + 1}
                    />
                  ))}
                </View>

                <Text style={[Fonts.caption, { color: Colors.neutral400 }]}>
                  {t('training.now.hint')}
                </Text>
              </View>
            ) : null}
          </WithDataWrapper>
        </ScrollView>

        {day ? (
          <View
            style={{
              backgroundColor: 'rgba(9, 24, 35, 0.94)',
              borderTopColor: withAlpha(Colors.primary500, 0.2),
              borderTopWidth: 1,
              gap: 4,
              paddingHorizontal: 16,
              paddingTop: 12,
            }}
          >
            {/* L'UNIQUE GESTE : un bouton qui sait tout seul où reprendre. C'est
                le cœur du pack — pas « ouvrir un test », mais « continuer ». */}
            <Button
              disabled={!courante}
              onPress={() => courante && ouvrir(courante)}
              title={courante
                ? t('training.now.resume', {
                  test: courante.testCode,
                  what: courante.type === 'prep'
                    ? t('training.now.resumePrep')
                    : t('training.now.resumeAttempt', { count: courante.essai }),
                })
                : t('training.now.allDone')}
              variant="Primary"
            />
            <Button
              isLoading={updateSession.isPending}
              onPress={terminer}
              title={t('training.actions.finishDay')}
              variant="Ghost"
            />
          </View>
        ) : null}
      </View>
    </ScreenContainer>
  );
}

export default TrainingSessionNow;
