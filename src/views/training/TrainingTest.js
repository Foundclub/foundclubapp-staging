import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import TrainingBlocks, { TrainingLinks } from '@/components/organisms/training/TrainingBlocks';
import TrainingMeasureInput from '@/components/organisms/training/TrainingMeasureInput';
import TrainingTimer from '@/components/organisms/training/TrainingTimer';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useMyTraining, useTrainingResults } from '@/hooks/useTraining';

/**
 * LE TUNNEL D'UN TEST — l'écran qu'on tient à la main sur un terrain.
 *
 * 🔎 DEUX ONGLETS, ET C'EST LA DÉCISION D'ERGONOMIE LA PLUS IMPORTANTE DE L'ÉCRAN.
 *   · « Faire » : le protocole, le chronomètre, la saisie. C'est ce qu'on regarde
 *     entre deux essais, avec les mains sales et trente secondes devant soi.
 *   · « Comprendre » : pourquoi ce test, la mise en place cotée, comment lire le
 *     résultat, la vidéo du geste. Ça se lit avant de partir, ou une fois.
 * Tout mettre sur une seule page obligerait à faire défiler quatre écrans de texte
 * pour retrouver la case où taper 31,4.
 *
 * 📴 CHAQUE SAISIE EST ÉCRITE EN LOCAL D'ABORD. L'envoi au serveur est un geste
 * séparé, et son échec n'efface rien : le compteur « en attente » reste visible et
 * les mesures repartiront plus tard.
 */

const RECOVERY_PRESETS = [30, 60, 90, 120, 180, 240, 300, 480];

const GROUP_ORDER = ['performance', 'contexte', 'calcule'];
const GROUP_LABELS = {
  calcule: 'training.measures.computed',
  contexte: 'training.measures.context',
  performance: 'training.measures.performance',
};

/**
 * Un onglet du bandeau « Faire / Comprendre » : il annonce aux lecteurs d'écran
 * lequel des deux est sélectionné, et se remplit de couleur quand c'est le sien.
 * @param {object} props
 * @param {boolean} props.active vrai quand c'est l'onglet actuellement affiché
 * @param {string} props.label le libellé visible de l'onglet
 * @param {() => void} props.onPress appelé quand on appuie sur l'onglet
 * @returns {React.ReactElement} l'onglet cliquable
 */
function Tab({ active, label, onPress }) {
  const { Colors, Fonts } = useTheme();
  return (
    <TouchableOpacity
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{
        backgroundColor: active ? Colors.primary500 : 'transparent',
        borderRadius: 8,
        flex: 1,
        paddingVertical: 10,
      }}
    >
      <Text
        style={[
          Fonts.p3,
          { color: active ? Colors.neutral00 : Colors.neutral300, textAlign: 'center' },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/**
 * Une rubrique titrée du test (protocole, cas d'invalidation, mise en place…) :
 * elle disparaît entièrement quand le serveur n'a envoyé aucun bloc pour elle.
 * @param {object} props
 * @param {Array<Record<string, any>>} props.blocks les blocs de contenu riche à afficher
 * @param {string} props.title le titre posé au-dessus des blocs
 * @returns {React.ReactElement|null} la rubrique titrée, ou rien s'il n'y a aucun bloc
 */
function Block({ blocks, title }) {
  const { Colors, Fonts, Spaces } = useTheme();
  if (!Array.isArray(blocks) || !blocks.length) return null;
  return (
    <View style={Spaces.gap[8]}>
      <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>{title}</Text>
      <TrainingBlocks blocks={blocks} />
    </View>
  );
}

/**
 * L'écran d'un test sur le terrain : ses deux onglets, le chronomètre de
 * récupération, la saisie des mesures et l'envoi différé de ce qui a été noté
 * pendant que le réseau manquait.
 * @param {object} props
 * @param {Record<string, any>} props.navigation
 * @param {Record<string, any>} props.route
 * @returns {React.ReactElement} le tunnel d'un test
 */
function TrainingTest({ navigation, route }) {
  const { Colors, Fonts, Spaces } = useTheme();
  const { t } = useTranslation();

  const sessionId = route?.params?.sessionId;
  const [index, setIndex] = useState(Number(route?.params?.testIndex) || 0);
  // On peut arriver ici pour COMPRENDRE, pas pour faire : la fiche d une journee
  // ouvre le « Pourquoi » depuis sa liste, la veille, quand on a le temps de lire.
  const [tab, setTab] = useState(route?.params?.tab === 'learn' ? 'learn' : 'do');
  const [recovery, setRecovery] = useState(120);
  /** @type {[Record<string, Record<string, any>>, Function]} */
  const [values, setValues] = useState({});
  const [saveFailed, setSaveFailed] = useState(false);
  const [syncError, setSyncError] = useState(false);

  const {
    enrollment, error, isLoading, refetch, sessions,
  } = useMyTraining();
  const results = useTrainingResults(sessionId);

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
  const tests = useMemo(() => {
    const brutes = day?.tests;
    return Array.isArray(brutes) ? [...brutes] : [];
  }, [day]);
  const test = tests[index] || null;

  /** Les valeurs affichées viennent du serveur ET du local, le local non envoyé gagnant. */
  useEffect(() => {
    if (!test?.documentId || !sessionId) return;
    const brutes = session?.results;
    const merged = results.merge(Array.isArray(brutes) ? [...brutes] : []);
    /** @type {Record<string, Record<string, any>>} */
    const forThisTest = {};
    /** @type {Record<string, any>[]} */ (Object.values(merged)).forEach((row) => {
      const rowTestId = row.test?.documentId || row.testDocumentId;
      if (rowTestId !== test.documentId) return;
      forThisTest[`${row.measureKey}|${row.attempt ?? 1}|${row.side || 'none'}`] = row;
    });
    setValues(forThisTest);
    // `results` est recréé à chaque rendu : le dépendre relancerait la boucle sans fin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.results, sessionId, test?.documentId]);

  const measuresByGroup = useMemo(() => {
    const all = Array.isArray(test?.measures) ? test.measures : [];
    return GROUP_ORDER.map((group) => ({
      group,
      measures: /** @type {Record<string, any>[]} */ (all)
        .filter((measure) => (measure.group || 'performance') === group),
    })).filter((entry) => entry.measures.length > 0);
  }, [test]);

  const record = useCallback((/** @type {Record<string, any>} */ row) => {
    if (!test?.documentId) return;
    const full = { ...row, testDocumentId: test.documentId };
    // Si le telephone refuse d'ecrire, on le DIT et on n'affiche pas la valeur
    // comme enregistree : un chiffre vert sur une saisie perdue est le pire cas.
    try {
      results.record(full);
    } catch {
      setSaveFailed(true);
      return;
    }
    setSaveFailed(false);
    setValues((/** @type {Record<string, any>} */ previous) => ({
      ...previous,
      [`${row.measureKey}|${row.attempt ?? 1}|${row.side || 'none'}`]: { ...full, isValid: true },
    }));
  }, [results, test]);

  const toggleInvalid = useCallback((/** @type {Record<string, any>} */ row) => {
    if (!test?.documentId) return;
    const key = `${row.measureKey}|${row.attempt ?? 1}|${row.side || 'none'}`;
    const current = values[key] || {};
    const next = {
      ...current, ...row, isValid: current.isValid === false, testDocumentId: test.documentId,
    };
    try {
      results.record(next);
    } catch {
      setSaveFailed(true);
      return;
    }
    setSaveFailed(false);
    setValues((/** @type {Record<string, any>} */ previous) => ({ ...previous, [key]: next }));
  }, [results, test, values]);

  const valuesFor = useCallback((/** @type {string} */ measureKey) => {
    /** @type {Record<string, Record<string, any>>} */
    const out = {};
    Object.entries(values).forEach(([key, row]) => {
      const [rowKey, attempt, side] = key.split('|');
      if (rowKey === measureKey) out[`${attempt}|${side}`] = row;
    });
    return out;
  }, [values]);

  const send = useCallback(async () => {
    setSyncError(false);
    try {
      await results.sync.mutateAsync();
    } catch {
      setSyncError(true);
    }
  }, [results]);

  const pending = results.pendingCount();

  return (
    <ScreenContainer bgImage="bg2" bottomInsetMode="screen">
      <ScrollView
        contentContainerStyle={[Spaces.paddingBottom[40]]}
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
      >
        <WithDataWrapper error={error} isLoading={isLoading} onRetry={refetch}>
          {test ? (
            <View style={Spaces.gap[16]}>
              <View style={Spaces.gap[4]}>
                <Text style={[Fonts.caption, { color: Colors.primary400 }]}>
                  {t('training.test.step', { current: index + 1, total: tests.length })}
                </Text>
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
                  <Text style={[Fonts.h3Bold, { color: Colors.neutral00, flex: 1 }]}>
                    {test.name}
                  </Text>
                </View>
              </View>

              <View style={{
                backgroundColor: Colors.neutral800,
                borderRadius: 10,
                flexDirection: 'row',
                padding: 4,
              }}
              >
                <Tab
                  active={tab === 'do'}
                  label={t('training.test.protocol')}
                  onPress={() => setTab('do')}
                />
                <Tab
                  active={tab === 'learn'}
                  label={t('training.test.why')}
                  onPress={() => setTab('learn')}
                />
              </View>

              {tab === 'do' ? (
                <View style={Spaces.gap[16]}>
                  <Block blocks={test.protocol} title={t('training.test.protocol')} />
                  <Block blocks={test.invalidIf} title={t('training.test.invalidIf')} />

                  <View style={Spaces.gap[8]}>
                    <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>
                      {t('training.timer.recovery')}
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {RECOVERY_PRESETS.map((seconds) => (
                        <TouchableOpacity
                          accessibilityRole="button"
                          key={seconds}
                          onPress={() => setRecovery(seconds)}
                          style={{
                            backgroundColor: recovery === seconds
                              ? Colors.primary500 : 'transparent',
                            borderColor: recovery === seconds
                              ? Colors.primary500 : Colors.neutral600,
                            borderRadius: 8,
                            borderWidth: 1,
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                          }}
                        >
                          <Text
                            style={[
                              Fonts.caption,
                              {
                                color: recovery === seconds
                                  ? Colors.neutral00
                                  : Colors.neutral300,
                              },
                            ]}
                          >
                            {seconds >= 60 ? `${seconds / 60} min` : `${seconds} s`}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TrainingTimer seconds={recovery} />
                  </View>

                  <View style={Spaces.gap[12]}>
                    <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>
                      {t('training.test.results')}
                    </Text>
                    {saveFailed && (
                      <Text style={[Fonts.p3, { color: Colors.error500 }]}>
                        {t('training.sync.localFailed')}
                      </Text>
                    )}
                    {measuresByGroup.map(({ group, measures }) => (
                      <View key={group} style={Spaces.gap[12]}>
                        <Text style={[Fonts.captionBold, { color: Colors.neutral400 }]}>
                          {t(GROUP_LABELS[/** @type {keyof GROUP_LABELS} */ (group)])}
                        </Text>
                        {measures.map((measure) => (
                          <TrainingMeasureInput
                            key={measure.key}
                            measure={measure}
                            onRecord={record}
                            onToggleInvalid={toggleInvalid}
                            values={valuesFor(measure.key)}
                          />
                        ))}
                      </View>
                    ))}
                  </View>

                  {pending > 0 && (
                  <View style={Spaces.gap[8]}>
                    <Text style={[Fonts.caption, { color: Colors.gold500 }]}>
                      {t('training.sync.offline', { count: pending })}
                    </Text>
                    {syncError && (
                      <Text style={[Fonts.caption, { color: Colors.error500 }]}>
                        {t('training.sync.failed')}
                      </Text>
                    )}
                    <Button
                      isLoading={results.sync.isPending}
                      onPress={send}
                      title={t('training.actions.sync')}
                      variant="Primary"
                    />
                  </View>
                  )}
                </View>
              ) : (
                <View style={Spaces.gap[16]}>
                  <Block blocks={test.why} title={t('training.test.why')} />
                  <Block blocks={test.setup} title={t('training.test.setup')} />
                  <Block blocks={test.reading} title={t('training.test.reading')} />
                  {Array.isArray(test.links) && test.links.length > 0 && (
                  <View style={Spaces.gap[8]}>
                    <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>
                      {t('training.test.links')}
                    </Text>
                    <TrainingLinks links={test.links} />
                  </View>
                  )}
                </View>
              )}

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Button
                    disabled={index === 0}
                    onPress={() => { setIndex((value) => Math.max(0, value - 1)); setTab('do'); }}
                    title={t('training.actions.previous')}
                    variant="Secondary"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    disabled={index >= tests.length - 1}
                    onPress={() => {
                      setIndex((value) => Math.min(tests.length - 1, value + 1));
                      setTab('do');
                    }}
                    title={t('training.actions.nextTest')}
                    variant="Primary"
                  />
                </View>
              </View>

              {/*
                🔎 LE POINT DE RETOUR. Le pack fait revenir ONZE pages du parcours
                guide sur le tableau de bord : c est la place du village, le seul
                endroit qui dise ce qui precede, ce qui suit et combien il reste.
                Un simple retour en arriere ne suffit pas — on peut etre arrive ici
                par le lien « Pourquoi » de la veille, et le tableau de bord n a
                alors aucun sens : la seance n a pas commence.
              */}
              {session?.status === 'in_progress' ? (
                <Button
                  onPress={() => navigation.navigate(RouteNames.TrainingSessionNow, { sessionId })}
                  title={t('training.now.back')}
                  variant="Secondary"
                />
              ) : (
                index >= tests.length - 1 && (
                  <Button
                    onPress={() => navigation.goBack()}
                    title={t('training.actions.finishTest')}
                    variant="Secondary"
                  />
                )
              )}
            </View>
          ) : null}
        </WithDataWrapper>
      </ScrollView>
    </ScreenContainer>
  );
}

export default TrainingTest;
