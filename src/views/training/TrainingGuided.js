import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import TrainingAttemptCard from '@/components/organisms/training/TrainingAttemptCard';
import TrainingBlocks, { RichText } from '@/components/organisms/training/TrainingBlocks';
import TrainingStepRail from '@/components/organisms/training/TrainingStepRail';
import TrainingTimer from '@/components/organisms/training/TrainingTimer';
import ScreenContainer from '@/components/templates/ScreenContainer';
import {
  ARRETS, arretsDuTest, dureeEchauffement, etatsDuRuban, gesteEnTroisLignes,
  lignesDeMiseEnPlace, mesuresQuiAttendentLaVideo, RECUP_PAR_DEFAUT, situer,
} from '@/views/training/trainingParcours';
import { mesuresDeLaCarte, mesuresParFamille } from '@/views/training/trainingTestModel';

import allerDansLOnglet from '@/navigation/allerDansLOnglet';
import { RouteNames } from '@/navigation/routeNames';

import { useMyTraining, useTrainingResults, useUpdateTrainingSession } from '@/hooks/useTraining';

/**
 * LE PARCOURS GUIDÉ D'UN TEST — une file d'arrêts, un geste par écran.
 *
 * 🔎 POURQUOI UN SEUL ÉCRAN POUR CINQ PAGES DU PACK. Le pack dessine cinq arrêts —
 * « Avant de commencer », « L'échauffement », « Un essai », « La récupération », « La
 * fin d'un test » — et il les relie tous par le même ruban d'étapes, le même bandeau de
 * titre, le même bouton « Pourquoi ? » et le même bouton unique en bas. Cinq routes
 * auraient recopié ce cadre cinq fois, avec cinq chargements et cinq états d'erreur à
 * tenir en accord. Ici, un `step` en paramètre choisit le CORPS ; tout le reste est
 * écrit une fois. C'est la même décision que pour les onglets de la fiche d'une journée.
 *
 * 🪤 CE QUI REND CE PARCOURS UTILE, ET SANS QUOI IL NE SERT À RIEN : après chaque essai
 * on tombe sur une page pleine où le compte à rebours TOURNE DÉJÀ. La récupération n'est
 * plus un chiffre qu'on oublie de lancer, c'est un arrêt qu'on traverse. Le protocole se
 * perdait essai après essai sans que rien ne le dise.
 */

/**
 * Un titre de section, écrit pareil partout.
 * @param {object} props
 * @param {string} props.children le texte du titre
 * @returns {React.ReactElement} le titre
 */
function Titre({ children }) {
  const { Colors, Fonts } = useTheme();
  return <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>{children}</Text>;
}

/**
 * L'écran lui-même.
 * @param {object} props
 * @param {Record<string, any>} props.navigation
 * @param {Record<string, any>} [props.route]
 * @returns {React.ReactElement} l'arrêt courant du parcours guidé
 */
function TrainingGuided({ navigation, route }) {
  const { Colors, Fonts, Spaces } = useTheme();
  const { t } = useTranslation();

  const sessionId = route?.params?.sessionId;
  const testIndex = Number(route?.params?.testIndex) || 0;
  const [etape, setEtape] = useState(route?.params?.step || 'prep');
  const [coches, setCoches] = useState(/** @type {Record<string, boolean>} */ ({}));

  const {
    enrollment, error, isLoading, refetch, sessions,
  } = useMyTraining();
  const results = useTrainingResults(sessionId);
  const majSeance = useUpdateTrainingSession();

  const session = useMemo(
    () => sessions.find((item) => item.documentId === sessionId) || null,
    [sessionId, sessions],
  );

  const day = useMemo(() => {
    const dayId = session?.day?.documentId || route?.params?.dayId;
    /** @type {Record<string, any>[]} */
    const days = Array.isArray(enrollment?.program?.days) ? enrollment?.program?.days : [];
    return days.find((item) => item.documentId === dayId) || null;
  }, [enrollment, route?.params?.dayId, session]);

  /** @type {Record<string, any>[]} */
  const tests = useMemo(() => (Array.isArray(day?.tests) ? day.tests : []), [day]);
  const test = tests[testIndex] || null;
  const suivant = tests[testIndex + 1] || null;

  const familles = useMemo(() => mesuresParFamille(test), [test]);
  const file = useMemo(() => arretsDuTest(test), [test]);
  const { courant, suivant: arretSuivant } = useMemo(() => situer(file, etape), [etape, file]);
  const etats = useMemo(() => etatsDuRuban(file, etape), [etape, file]);
  const misesEnPlace = useMemo(() => lignesDeMiseEnPlace(test), [test]);
  const enAttenteDeVideo = useMemo(() => mesuresQuiAttendentLaVideo(test), [test]);
  const geste = useMemo(() => gesteEnTroisLignes(test), [test]);
  const minutesEchauffement = useMemo(() => dureeEchauffement(day), [day]);

  /** @type {[Record<string, Record<string, any>>, Function]} */
  const [values, setValues] = useState({});

  useEffect(() => {
    if (!test?.documentId || !sessionId) return;
    const brutes = session?.results;
    const merged = results.merge(Array.isArray(brutes) ? [...brutes] : []);
    /** @type {Record<string, Record<string, any>>} */
    const pourCeTest = {};
    /** @type {Record<string, any>[]} */ (Object.values(merged)).forEach((row) => {
      const rowTestId = row.test?.documentId || row.testDocumentId;
      if (rowTestId !== test.documentId) return;
      pourCeTest[`${row.measureKey}|${row.attempt ?? 1}|${row.side || 'none'}`] = row;
    });
    setValues(pourCeTest);
    // `results` est recréé à chaque rendu : le dépendre relancerait la boucle sans fin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.results, sessionId, test?.documentId]);

  const record = useCallback((/** @type {Record<string, any>} */ row) => {
    if (!test?.documentId) return;
    const full = { ...row, testDocumentId: test.documentId };
    try {
      results.record(full);
    } catch {
      return;
    }
    setValues((precedentes) => ({
      ...precedentes,
      // 🪤 `isValid` VIENT DE LA LIGNE, il ne se force pas à `true`. La version
      // recopiée de la fiche d'un test le forçait — parce que là-bas, marquer un
      // essai nul passait par un autre chemin. Ici la bascule passe par ce même
      // enregistrement : forcer `true` annulait le geste à l'instant où on le
      // faisait, et la carte ne passait jamais en or.
      [`${row.measureKey}|${row.attempt ?? 1}|${row.side || 'none'}`]: {
        ...full,
        isValid: full.isValid !== false,
      },
    }));
  }, [results, test]);

  const valuesFor = useCallback((/** @type {string} */ measureKey) => {
    /** @type {Record<string, Record<string, any>>} */
    const out = {};
    Object.entries(values).forEach(([key, row]) => {
      const [rowKey, attempt, side] = key.split('|');
      if (rowKey === measureKey) out[`${attempt}|${side}`] = row;
    });
    return out;
  }, [values]);

  /**
   * Les lignes déjà saisies pour un essai.
   * @param {number} essai le numéro de l'essai
   * @returns {Record<string, any>[]} ses lignes
   */
  const lignesDeLEssai = useCallback((essai) => Object.entries(values)
    .filter(([clef]) => Number(clef.split('|')[1]) === essai)
    .map(([, row]) => row), [values]);

  /** L'état de chaque essai, pour la frise du bas : bon, nul, à venir. */
  const etatsDesEssais = useMemo(() => {
    const total = file.filter((a) => a.type === ARRETS.ATTEMPT).length;
    return Array.from({ length: total }, (_, i) => {
      const lignes = lignesDeLEssai(i + 1);
      if (!lignes.length) return 'todo';
      return lignes.some((row) => row.isValid === false) ? 'void' : 'done';
    });
  }, [file, lignesDeLEssai]);

  const basculerEssai = useCallback((essai) => {
    const lignes = lignesDeLEssai(essai);
    const cibles = lignes.length
      ? lignes
      : mesuresDeLaCarte(familles).map((m) => ({
        attempt: essai, measureKey: m.key, side: m.sides ? 'left' : 'none',
      }));
    const devientNul = !lignes.some((row) => row.isValid === false);
    // 🧑‍⚖️ ON SIGNE LE VERDICT. Cette bascule est celle du TERRAIN : on l'actionne
    // sur place, parce qu'on a VU quelque chose (un plot touché, un départ anticipé).
    // L'autre juge est la vidéo, le soir, sur l'écran des relevés — et sur 22 des
    // 33 tests du programme, les deux sortes de critères coexistent sur le même
    // essai. Sans signature, le carnet garde le verdict mais pas son auteur.
    cibles.forEach((row) => record({
      ...row,
      invalidatedBy: devientNul ? 'terrain' : null,
      isValid: !devientNul,
    }));
  }, [familles, lignesDeLEssai, record]);

  const aller = useCallback((cle) => {
    if (cle) setEtape(cle);
  }, []);

  /**
   * 🔴 NOTER L ÉTAPE QU'ON VIENT DE FRANCHIR — sans ça, rien ne s'en souvient.
   *
   * Mesuré à l'écran le 2026-09-08 : on faisait la mise en place, l'échauffement,
   * l'essai 1, la récupération — on sortait du parcours, et le tableau de bord
   * affichait toujours « 0 test fait, étape 0 ». L'avancement se déduisait
   * UNIQUEMENT des mesures enregistrées, or 9 tests sur 33 n'écrivent rien sur le
   * terrain : leur seule mesure « par essai » se lit plus tard sur la vidéo. Les
   * journées E et D3 étaient à 100 % dans ce cas — faisables en entier sans laisser
   * la moindre trace.
   *
   * 🔎 Rangé dans `conditions`, le champ JSON que la séance porte déjà : c'est le
   * même chemin que les repères cochés et que les tests validés. Aucune migration,
   * et l'avancement survit au changement de téléphone.
   *
   * ⚠️ ON NE NOTE QUE CE QUI EST VRAIMENT FRANCHI, jamais un simple changement
   * d'écran : le ruban permet de REVENIR sur un essai déjà passé, et marquer là
   * l'arrêt qu'on quitte déclarerait fait un essai qu'on n'a pas terminé.
   */
  const franchir = useCallback((cleEtape) => {
    if (!session?.documentId || !cleEtape) return;
    const deja = Array.isArray(session.conditions?.stepsDone)
      ? session.conditions.stepsDone : [];
    if (deja.includes(cleEtape)) return;
    majSeance.mutate({
      payload: {
        conditions: { ...(session.conditions || {}), stepsDone: [...deja, cleEtape] },
      },
      sessionDocumentId: session.documentId,
    });
  }, [majSeance, session]);

  /**
   * Le bouton principal : on note l'arrêt qu'on termine, PUIS on avance.
   * Seuls la mise en place et les essais ont une étape au tableau de bord ;
   * l'échauffement, la récupération et la fin n'en ont pas, et n'écrivent rien.
   */
  const avancer = useCallback(() => {
    const code = test?.code;
    if (code && courant?.type === ARRETS.PREP) franchir(`${code}-prep`);
    if (code && courant?.type === ARRETS.ATTEMPT) franchir(`${code}-e${courant.essai}`);
    aller(arretSuivant?.cle);
  }, [aller, arretSuivant, courant, franchir, test]);

  /**
   * 🔎 « POURQUOI ? » SORT LE PROTOCOLE DU PARCOURS. Pendant un essai, on ne lit pas
   * quatre écrans d'explication — mais on veut pouvoir y aller en un geste, et
   * REVENIR exactement où on était. D'où un bouton, pas une rubrique dépliée.
   */
  const pourquoi = useCallback(() => {
    navigation.navigate(RouteNames.TrainingTest, {
      dayId: day?.documentId, sessionId, tab: 'learn', testIndex,
    });
  }, [day, navigation, sessionId, testIndex]);

  /**
   * VALIDER LE TEST — et c'est un vrai geste, pas une navigation déguisée.
   *
   * 🔎 Rangé dans `conditions`, le champ JSON que la séance porte déjà : aucune
   * migration, et la validation survit au changement de téléphone. C'est le même
   * chemin que les repères cochés de la veille.
   */
  const valider = useCallback(() => {
    if (!session?.documentId || !test?.code) return;
    const deja = Array.isArray(session.conditions?.validatedTests)
      ? session.conditions.validatedTests : [];
    if (deja.includes(test.code)) return;
    majSeance.mutate({
      payload: {
        conditions: { ...(session.conditions || {}), validatedTests: [...deja, test.code] },
      },
      sessionDocumentId: session.documentId,
    });
  }, [majSeance, session, test]);

  const valide = Boolean(session?.conditions?.validatedTests?.includes?.(test?.code));

  /**
   * CE QUI MANQUE POUR ENREGISTRER L'ESSAI EN COURS.
   *
   * 🪤 UN BOUTON ÉTEINT QUI NE DIT PAS POURQUOI est pire qu'un bouton qui échoue :
   * on appuie trois fois, on croit l'app cassée, et on finit par quitter l'écran
   * en perdant ce qu'on venait de faire. Celui-ci compte les cases vides et le dit.
   *
   * ⚠️ MAIS IL LAISSE PASSER UN ESSAI DÉCLARÉ NUL : un essai nul n'a par définition
   * aucune valeur, et exiger un chiffre pour avancer bloquerait exactement le cas
   * que la bascule sert à traiter.
   */
  const manquantes = useMemo(() => {
    if (courant?.type !== ARRETS.ATTEMPT) return 0;
    if (etatsDesEssais[courant.essai - 1] === 'void') return 0;
    const attendues = mesuresDeLaCarte(familles).filter((m) => m.moment === 'terrain');
    const saisies = lignesDeLEssai(courant.essai)
      .filter((row) => row.value != null || row.textValue).length;
    return Math.max(0, attendues.length - saisies);
  }, [courant, etatsDesEssais, familles, lignesDeLEssai]);
  const recuperation = Number(test?.recoverySeconds) > 0
    ? Number(test.recoverySeconds) : RECUP_PAR_DEFAUT;

  return (
    <ScreenContainer bgImage="bg2" bottomInsetMode="screen" keyboardScroll>
      <View style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[Spaces.paddingBottom[24]]}
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
        >
          <WithDataWrapper error={error} isLoading={isLoading} onRetry={refetch}>
            {test ? (
              <View style={Spaces.gap[16]}>
                {/* ─── LE BANDEAU : code, nom, chiffres, et « Pourquoi ? » ───── */}
                <View style={Spaces.gap[4]}>
                  <View style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}>
                    <View style={{
                      backgroundColor: Colors.primary500,
                      borderRadius: 6,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                    }}
                    >
                      <Text style={[Fonts.captionBold, { color: Colors.neutral00 }]}>
                        {test.code}
                      </Text>
                    </View>
                    <Text style={[Fonts.h4Bold, { color: Colors.neutral00, flex: 1 }]}>
                      {test.name}
                    </Text>
                    <TouchableOpacity
                      accessibilityLabel={t('training.guided.why')}
                      accessibilityRole="button"
                      onPress={pourquoi}
                      style={{
                        borderColor: withAlpha(Colors.primary500, 0.4),
                        borderRadius: 8,
                        borderWidth: 1,
                        justifyContent: 'center',
                        minHeight: 36,
                        paddingHorizontal: 10,
                      }}
                    >
                      <Text style={[Fonts.caption, { color: Colors.primary400 }]}>
                        {t('training.guided.why')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={[Fonts.caption, { color: Colors.neutral400 }]}>
                    {[
                      test.estimatedMinutes ? `≈ ${test.estimatedMinutes} min` : null,
                      t('training.test.attempts', { count: etatsDesEssais.length }),
                      courant?.type === ARRETS.ATTEMPT
                        ? t('training.attempt.title', {
                          current: courant.essai, total: courant.total,
                        })
                        : null,
                    ].filter(Boolean).join(' · ')}
                  </Text>
                </View>

                <TrainingStepRail arrets={file} etats={etats} onPress={(a) => aller(a.cle)} />

                {/* ─── AVANT DE COMMENCER ─────────────────────────────────── */}
                {courant?.type === ARRETS.PREP && (
                  <View style={Spaces.gap[16]}>
                    {/* La carte bleue dit EN UNE LIGNE à quoi sert le test. Sans
                        elle, on installe du matériel sans savoir ce qu'on mesure. */}
                    <View style={{
                      backgroundColor: withAlpha(Colors.primary500, 0.14),
                      borderColor: withAlpha(Colors.primary500, 0.4),
                      borderRadius: 10,
                      borderWidth: 1,
                      gap: 4,
                      padding: 12,
                    }}
                    >
                      <Text style={[Fonts.caption, { color: Colors.primary400 }]}>
                        {t('training.guided.whatWeMeasure')}
                      </Text>
                      <TrainingBlocks blocks={(test.why || []).slice(0, 1)} compact />
                    </View>

                    {/* Le schéma coté SANS changer d'onglet, avec son agrandissement. */}
                    {Array.isArray(test.setup) && (
                      <TrainingBlocks
                        blocks={test.setup.filter((b) => b?.type === 'svg')}
                        onZoom={(bloc) => navigation.navigate(RouteNames.TrainingSchema, {
                          caption: bloc.caption, svg: bloc.svg, title: test.name,
                        })}
                      />
                    )}

                    {misesEnPlace.length > 0 && (
                      <View style={Spaces.gap[8]}>
                        <View style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}>
                          <Titre>{t('training.test.setup')}</Titre>
                          <Text style={[Fonts.caption, {
                            color: Object.values(coches).filter(Boolean).length
                              === misesEnPlace.length ? Colors.success500 : Colors.neutral400,
                          }]}
                          >
                            {t('training.day.prepared', {
                              count: Object.values(coches).filter(Boolean).length,
                              done: Object.values(coches).filter(Boolean).length,
                              total: misesEnPlace.length,
                            })}
                          </Text>
                        </View>
                        {misesEnPlace.map((ligne) => (
                          <TouchableOpacity
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: Boolean(coches[ligne]) }}
                            key={ligne}
                            onPress={() => setCoches((p) => ({ ...p, [ligne]: !p[ligne] }))}
                            style={{
                              alignItems: 'flex-start',
                              borderColor: coches[ligne]
                                ? Colors.success500 : withAlpha(Colors.primary500, 0.2),
                              borderRadius: 8,
                              borderWidth: 1,
                              flexDirection: 'row',
                              gap: 8,
                              minHeight: 44,
                              padding: 10,
                            }}
                          >
                            <View style={{
                              backgroundColor: coches[ligne] ? Colors.success500 : 'transparent',
                              borderColor: coches[ligne] ? Colors.success500 : Colors.neutral500,
                              borderRadius: 4,
                              borderWidth: 1,
                              height: 18,
                              marginTop: 2,
                              width: 18,
                            }}
                            />
                            {/*
                              🐞 DEFAUT VU A L ECRAN LE 2026-09-08 : ces lignes
                              s affichaient avec leurs `**asterisques**` en toutes
                              lettres. Elles viennent des memes donnees que la fiche
                              de journee — qui, elle, passait bien par `RichText`.
                              Sur du texte technique dense, le gras porte l essentiel.
                            */}
                            <RichText
                              color={Colors.neutral00}
                              style={[Fonts.p3, { color: Colors.neutral200, flex: 1 }]}
                              text={ligne}
                            />
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                    {/* L'ENCART OR : ce qui annule un essai se lit AVANT, pas après. */}
                    {Array.isArray(test.invalidIf) && test.invalidIf.length > 0 && (
                      <View style={{
                        backgroundColor: withAlpha(Colors.gold500, 0.1),
                        borderColor: withAlpha(Colors.gold500, 0.4),
                        borderRadius: 10,
                        borderWidth: 1,
                        gap: 6,
                        padding: 12,
                      }}
                      >
                        <Text style={[Fonts.captionBold, { color: Colors.gold500 }]}>
                          {t('training.test.invalidIf')}
                        </Text>
                        <TrainingBlocks blocks={test.invalidIf} compact />
                        {enAttenteDeVideo > 0 && (
                          <Text style={[Fonts.caption, { color: Colors.neutral400 }]}>
                            {t('training.guided.judgedLater')}
                          </Text>
                        )}
                      </View>
                    )}

                    <Text style={[Fonts.caption, { color: Colors.neutral400 }]}>
                      {t('training.guided.prepHint')}
                    </Text>
                  </View>
                )}

                {/* ─── L'ÉCHAUFFEMENT ─────────────────────────────────────── */}
                {courant?.type === ARRETS.WARMUP && (
                  <View style={Spaces.gap[16]}>
                    <View style={{ alignItems: 'baseline', flexDirection: 'row', gap: 8 }}>
                      <Titre>{t('training.day.warmup')}</Titre>
                      {/* 🪤 LA DUREE N A PAS DE CHAMP, mais elle est ECRITE : le
                          tableau du deroule porte « RAMP · 18 min ». On la lit la
                          ou elle est plutot que de demander une colonne de plus. */}
                      {minutesEchauffement !== null && (
                        <Text style={[Fonts.p3Bold, { color: Colors.primary400 }]}>
                          {t('training.day.duration', { count: minutesEchauffement })}
                        </Text>
                      )}
                    </View>
                    {/* ⚠️ L'échauffement vient de la JOURNÉE : aucun test du
                        programme n'en porte, et 17 des 33 n'en ont nulle part.
                        La journée en a un pour les huit — c'est la seule source
                        qui existe, et elle est toujours là. */}
                    <TrainingBlocks blocks={day?.warmup} />
                    <Text style={[Fonts.caption, { color: Colors.neutral400 }]}>
                      {t('training.guided.warmupHint')}
                    </Text>
                  </View>
                )}

                {/* ─── UN ESSAI ───────────────────────────────────────────── */}
                {courant?.type === ARRETS.ATTEMPT && (
                  <View style={Spaces.gap[16]}>
                    {/*
                      🔎 LE GESTE, EN TROIS LIGNES MAXIMUM. Entre deux essais on
                      relit une consigne en dix secondes, debout, en soufflant. Le
                      protocole complet fait souvent quinze lignes : le montrer ici
                      revient a ne rien montrer, parce qu on ne le lit pas. Le
                      reste n est pas perdu — il est a un bouton de distance.
                    */}
                    {geste.length > 0 && (
                      <View style={Spaces.gap[8]}>
                        <Titre>{t('training.guided.gesture')}</Titre>
                        {geste.map((consigne, rang) => (
                          <View
                            key={consigne}
                            style={{ flexDirection: 'row', gap: 8 }}
                          >
                            <View style={{
                              alignItems: 'center',
                              backgroundColor: Colors.primary500,
                              borderRadius: 11,
                              height: 22,
                              justifyContent: 'center',
                              marginTop: 2,
                              width: 22,
                            }}
                            >
                              <Text style={[Fonts.caption, { color: Colors.neutral00 }]}>
                                {rang + 1}
                              </Text>
                            </View>
                            <RichText
                              color={Colors.neutral00}
                              style={[Fonts.p3, { color: Colors.neutral200, flex: 1 }]}
                              text={consigne}
                            />
                          </View>
                        ))}
                      </View>
                    )}
                    {/* 🔎 SEULEMENT LES MESURES DU TERRAIN. Pendant un essai, on ne
                        montre que ce qui se prend MAINTENANT : une case qu'on ne
                        peut pas remplir fait croire qu'on a raté quelque chose.
                        🧨 Et sur un test à UN essai, ce sont les mesures « une fois »
                        qui portent le chiffre : sans elles la carte est VIDE. */}
                    <TrainingAttemptCard
                      enCours
                      essai={courant.essai}
                      measures={mesuresDeLaCarte(familles).filter((m) => m.moment === 'terrain')}
                      nul={etatsDesEssais[courant.essai - 1] === 'void'}
                      onReason={() => {}}
                      onRecord={record}
                      onToggleInvalid={() => basculerEssai(courant.essai)}
                      raison={lignesDeLEssai(courant.essai)[0]?.invalidReason || ''}
                      total={courant.total}
                      valuesFor={valuesFor}
                    />
                    {enAttenteDeVideo > 0 && (
                      <Text style={[Fonts.caption, { color: Colors.neutral400 }]}>
                        {t('training.guided.videoLater', { count: enAttenteDeVideo })}
                      </Text>
                    )}
                    <TouchableOpacity
                      accessibilityRole="button"
                      onPress={() => aller('end')}
                      style={{ justifyContent: 'center', minHeight: 44 }}
                    >
                      <Text style={[Fonts.caption, {
                        color: Colors.neutral400, textDecorationLine: 'underline',
                      }]}
                      >
                        {t('training.guided.stopHere')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* ─── LA RÉCUPÉRATION ────────────────────────────────────── */}
                {courant?.type === ARRETS.RECOVERY && (
                  <View style={Spaces.gap[16]}>
                    <View style={{
                      backgroundColor: withAlpha(Colors.success500, 0.12),
                      borderColor: withAlpha(Colors.success500, 0.4),
                      borderRadius: 10,
                      borderWidth: 1,
                      gap: 4,
                      padding: 12,
                    }}
                    >
                      <Text style={[Fonts.p3Bold, { color: Colors.success500 }]}>
                        {t('training.guided.saved', { current: courant.essai })}
                      </Text>
                      {enAttenteDeVideo > 0 && (
                        <Text style={[Fonts.caption, { color: Colors.neutral300 }]}>
                          {t('training.guided.videoLater', { count: enAttenteDeVideo })}
                        </Text>
                      )}
                    </View>

                    {/* La minuterie part TOUTE SEULE : c'est la seule différence
                        qui compte entre un chronomètre et une récupération. */}
                    <TrainingTimer
                      autoStart
                      label={t('training.guided.prescribed', { count: recuperation })}
                      seconds={recuperation}
                    />

                    <View style={Spaces.gap[4]}>
                      <Titre>{t('training.guided.next')}</Titre>
                      <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
                        {t('training.attempt.title', {
                          current: courant.essai + 1, total: courant.total,
                        })}
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {etatsDesEssais.map((etat, rang) => (
                        <View
                          key={`bilan-${rang + 1}`}
                          style={{
                            alignItems: 'center',
                            borderColor: {
                              done: Colors.success500,
                              todo: Colors.neutral600,
                              void: Colors.gold500,
                            }[etat],
                            borderRadius: 6,
                            borderWidth: 1,
                            flexGrow: 1,
                            minWidth: 32,
                            paddingVertical: 6,
                          }}
                        >
                          <Text style={[Fonts.caption, { color: Colors.neutral300 }]}>
                            {etat === 'todo' ? '—' : rang + 1}
                          </Text>
                        </View>
                      ))}
                    </View>

                    <TouchableOpacity
                      accessibilityRole="button"
                      onPress={() => aller(`attempt-${courant.essai}`)}
                      style={{ justifyContent: 'center', minHeight: 44 }}
                    >
                      <Text style={[Fonts.caption, {
                        color: Colors.neutral400, textDecorationLine: 'underline',
                      }]}
                      >
                        {t('training.guided.redo', { count: courant.essai })}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* ─── LA FIN DU TEST ─────────────────────────────────────── */}
                {courant?.type === ARRETS.END && (
                  <View style={Spaces.gap[16]}>
                    <View style={{
                      backgroundColor: withAlpha(
                        valide ? Colors.success500 : Colors.primary500,
                        0.14,
                      ),
                      borderColor: withAlpha(valide ? Colors.success500 : Colors.primary500, 0.4),
                      borderRadius: 12,
                      borderWidth: 1,
                      gap: 6,
                      padding: 16,
                    }}
                    >
                      <Text style={[Fonts.h4Bold, {
                        color: valide ? Colors.success500 : Colors.neutral00,
                      }]}
                      >
                        {t(valide ? 'training.guided.doneTest' : 'training.guided.checkTest', {
                          test: test.code,
                        })}
                      </Text>
                      <Text style={[Fonts.caption, { color: Colors.neutral300 }]}>
                        {t('training.guided.attemptsSummary', {
                          done: etatsDesEssais.filter((e) => e === 'done').length,
                          total: etatsDesEssais.length,
                          voided: etatsDesEssais.filter((e) => e === 'void').length,
                        })}
                      </Text>
                    </View>

                    {/* Un carré par essai, cliquable : on rouvre celui qu'on veut
                        relire ou refaire, sans revenir en arrière écran par écran. */}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {etatsDesEssais.map((etat, rang) => (
                        <TouchableOpacity
                          accessibilityLabel={t('training.attempt.title', {
                            current: rang + 1, total: etatsDesEssais.length,
                          })}
                          accessibilityRole="button"
                          key={`carre-${rang + 1}`}
                          onPress={() => aller(`attempt-${rang + 1}`)}
                          style={{
                            alignItems: 'center',
                            backgroundColor: withAlpha({
                              done: Colors.success500,
                              todo: Colors.neutral600,
                              void: Colors.gold500,
                            }[etat], 0.2),
                            borderColor: {
                              done: Colors.success500,
                              todo: Colors.neutral600,
                              void: Colors.gold500,
                            }[etat],
                            borderRadius: 8,
                            borderWidth: 1,
                            flexGrow: 1,
                            justifyContent: 'center',
                            minHeight: 44,
                            minWidth: 44,
                          }}
                        >
                          <Text style={[Fonts.p3, { color: Colors.neutral00 }]}>{rang + 1}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {enAttenteDeVideo > 0 && (
                      <TouchableOpacity
                        accessibilityRole="button"
                        onPress={() => allerDansLOnglet(navigation, RouteNames.TrainingVideoQueue)}
                        style={{
                          backgroundColor: withAlpha(Colors.gold500, 0.1),
                          borderColor: withAlpha(Colors.gold500, 0.4),
                          borderRadius: 10,
                          borderWidth: 1,
                          justifyContent: 'center',
                          minHeight: 44,
                          padding: 12,
                        }}
                      >
                        <Text style={[Fonts.p3, { color: Colors.gold500 }]}>
                          {t('training.guided.videoQueue', { count: enAttenteDeVideo })}
                        </Text>
                      </TouchableOpacity>
                    )}

                    {/* Après validation, le test SUIVANT se présente en carte, avec
                        sa récupération : c'est ce qui enchaîne une séance sans
                        repasser par une liste. */}
                    {valide && suivant && (
                      <View style={Spaces.gap[8]}>
                        <Titre>{t('training.guided.nextTest')}</Titre>
                        <TouchableOpacity
                          accessibilityRole="button"
                          onPress={() => navigation.push(RouteNames.TrainingGuided, {
                            dayId: day?.documentId,
                            sessionId,
                            step: 'prep',
                            testIndex: testIndex + 1,
                          })}
                          style={{
                            alignItems: 'center',
                            borderColor: withAlpha(Colors.primary500, 0.3),
                            borderRadius: 10,
                            borderWidth: 1,
                            flexDirection: 'row',
                            gap: 8,
                            minHeight: 56,
                            paddingHorizontal: 12,
                          }}
                        >
                          <View style={{
                            backgroundColor: Colors.primary500,
                            borderRadius: 6,
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                          }}
                          >
                            <Text style={[Fonts.captionBold, { color: Colors.neutral00 }]}>
                              {suivant.code}
                            </Text>
                          </View>
                          <Text style={[Fonts.p3, { color: Colors.neutral00, flex: 1 }]}>
                            {suivant.name}
                          </Text>
                          {Boolean(suivant.estimatedMinutes) && (
                            <Text style={[Fonts.caption, { color: Colors.neutral400 }]}>
                              {`≈ ${suivant.estimatedMinutes} min`}
                            </Text>
                          )}
                        </TouchableOpacity>
                        <TrainingTimer
                          label={t('training.guided.betweenTests', { test: suivant.code })}
                          seconds={recuperation}
                        />
                      </View>
                    )}

                    <View style={{
                      backgroundColor: withAlpha(
                        results.pendingCount() > 0 ? Colors.gold500 : Colors.success500,
                        0.12,
                      ),
                      borderRadius: 8,
                      padding: 10,
                    }}
                    >
                      <Text style={[Fonts.caption, {
                        color: results.pendingCount() > 0 ? Colors.gold500 : Colors.success500,
                      }]}
                      >
                        {results.pendingCount() > 0
                          ? t('training.sync.offline', { count: results.pendingCount() })
                          : t('training.sync.allSent')}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            ) : null}
          </WithDataWrapper>
        </ScrollView>

        {/* ─── LE BOUTON UNIQUE, HORS DU DÉFILEMENT ───────────────────────── */}
        {test ? (
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
            {courant?.type === ARRETS.END ? (
              <>
                <Button
                  disabled={valide}
                  isLoading={majSeance.isPending}
                  onPress={valider}
                  title={t(valide ? 'training.guided.doneTest' : 'training.guided.validate', {
                    test: test.code,
                  })}
                  variant="Primary"
                />
                <Button
                  onPress={() => allerDansLOnglet(navigation, RouteNames.TrainingSessionNow, {
                    sessionId,
                  })}
                  title={t('training.guided.finishLater')}
                  variant="Ghost"
                />
                {/* Ce que fait chaque sortie, en une ligne : sans elle,
                    « valider » et « finir plus tard » se ressemblent, et on
                    hesite au moment ou il faudrait juste choisir. */}
                <Text style={[Fonts.caption, { color: Colors.neutral400 }]}>
                  {t('training.guided.endHint')}
                </Text>
              </>
            ) : (
              <>
                <Button
                  disabled={manquantes > 0}
                  onPress={avancer}
                  title={t(`training.guided.go.${courant?.type}`, {
                    count: (courant?.essai || 0) + 1,
                  })}
                  variant="Primary"
                />
                {manquantes > 0 && (
                  <Text style={[Fonts.caption, { color: Colors.gold500 }]}>
                    {t('training.guided.missing', { count: manquantes })}
                  </Text>
                )}
                {courant?.type === ARRETS.PREP && (
                  <Button
                    onPress={() => allerDansLOnglet(
                      navigation,
                      RouteNames.TrainingSessionNow,
                      { sessionId },
                    )}
                    title={t('training.guided.skipTest')}
                    variant="Ghost"
                  />
                )}
              </>
            )}
          </View>
        ) : null}
      </View>
    </ScreenContainer>
  );
}

export default TrainingGuided;
