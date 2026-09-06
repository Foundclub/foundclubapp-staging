import { useCallback, useMemo, useState } from 'react';
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
import TrainingBlocks, { RichText } from '@/components/organisms/training/TrainingBlocks';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useMyTraining, useUpdateTrainingSession } from '@/hooks/useTraining';

/**
 * UNE JOURNÉE — ce qu'on fait, dans quel ordre, et ce qui la rend valide.
 *
 * 🔎 L'ORDRE DES SECTIONS N'EST PAS DÉCORATIF : les repères (« à savoir avant de
 * partir ») viennent AVANT la chronologie, parce qu'ils disent ce qui invalide la
 * séance. Lire « pas de café ce matin » après le premier test ne sert à rien.
 */

/**
 * Section repliable : une journée porte beaucoup de texte, l'écran doit rester lisible.
 * @param {object} props Les propriétés de la section.
 * @param {React.ReactNode} props.children Le contenu montré uniquement quand la section
 *   est dépliée.
 * @param {boolean} [props.defaultOpen] Déplie la section dès le premier affichage.
 * @param {string} props.title L'intitulé cliquable qui plie et déplie la section.
 * @returns {React.ReactElement} une section dépliable avec son entête cliquable
 */
function Section({ children, defaultOpen = false, title }) {
  const { Colors, Fonts, Spaces } = useTheme();
  const [open, setOpen] = useState(defaultOpen);

  return (
    <View
      style={[
        Spaces.gap[8],
        { borderTopColor: Colors.neutral700, borderTopWidth: 1, paddingTop: 12 },
      ]}
    >
      <TouchableOpacity
        accessibilityRole="button"
        onPress={() => setOpen((value) => !value)}
        style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}
      >
        <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>{title}</Text>
        <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>{open ? '−' : '+'}</Text>
      </TouchableOpacity>
      {open ? children : null}
    </View>
  );
}

/**
 * Ligne cliquable d'un test dans la liste du jour : elle montre son code, son nom, sa
 * durée estimée et son caractère facultatif, et se borde de vert dès qu'il est fait.
 * @param {object} props Les propriétés de la ligne.
 * @param {boolean} props.done Vrai quand un résultat a déjà été enregistré pour ce test.
 * @param {() => void} props.onPress Ouvre l'écran de saisie du test.
 * @param {Record<string, any>} props.test Le test du catalogue
 *   (code, nom, durée, caractère facultatif).
 * @returns {React.ReactElement} une ligne cliquable décrivant un test
 */
function TestRow({ done, onPress, test }) {
  const { Colors, Fonts, Spaces } = useTheme();
  const { t } = useTranslation();

  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={onPress}
      style={[
        Spaces.gap[4],
        {
          backgroundColor: Colors.neutral800,
          borderColor: done ? Colors.success500 : Colors.neutral700,
          borderRadius: 10,
          borderWidth: 1,
          padding: 12,
        },
      ]}
    >
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}>
        <View style={{
          backgroundColor: Colors.neutral700,
          borderRadius: 6,
          paddingHorizontal: 8,
          paddingVertical: 2,
        }}
        >
          <Text style={[Fonts.captionBold, { color: Colors.neutral100 }]}>{test.code}</Text>
        </View>
        <Text
          numberOfLines={2}
          style={[Fonts.p2, { color: Colors.neutral00, flex: 1 }]}
        >
          {test.name}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {Boolean(test.estimatedMinutes) && (
          <Text style={[Fonts.caption, { color: Colors.neutral400 }]}>
            {test.estimatedMinutes}
            {' '}
            min
          </Text>
        )}
        {test.isOptional && (
          <Text style={[Fonts.caption, { color: Colors.gold500 }]}>
            {t('training.test.optional')}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

/**
 * Écran d'une journée du programme : ses repères, la liste de ses tests, ses blocs de
 * contenu dépliables, et les boutons qui démarrent puis terminent la séance.
 * @param {object} props
 * @param {Record<string, any>} props.navigation
 * @param {Record<string, any>} props.route
 * @returns {React.ReactElement} l'écran d'une journée
 */
function TrainingDay({ navigation, route }) {
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

  /** La journée du catalogue porte le contenu ; la séance ne porte que l'état. */
  const day = useMemo(() => {
    const dayId = session?.day?.documentId || route?.params?.dayId;
    /** @type {Record<string, any>[]} */
    const days = Array.isArray(enrollment?.program?.days) ? enrollment?.program?.days : [];
    return days.find((item) => item.documentId === dayId) || session?.day || null;
  }, [enrollment, route?.params?.dayId, session]);

  const tests = Array.isArray(day?.tests) ? day.tests : [];

  const doneTestCodes = useMemo(() => {
    /** @type {Record<string, any>[]} */
    const brutes = session?.results;
    const results = /** @type {Record<string, any>[]} */ (Array.isArray(brutes) ? [...brutes] : []);
    return new Set(results.map((row) => row?.test?.code).filter(Boolean));
  }, [session]);

  const start = useCallback(async () => {
    if (!session?.documentId) return;
    await updateSession.mutateAsync({
      payload: { status: 'in_progress' },
      sessionDocumentId: session.documentId,
    });
  }, [session, updateSession]);

  const finish = useCallback(async () => {
    if (!session?.documentId) return;
    await updateSession.mutateAsync({
      payload: { status: 'done' },
      sessionDocumentId: session.documentId,
    });
    navigation.goBack();
  }, [navigation, session, updateSession]);

  const openTest = useCallback((/** @type {number} */ index) => {
    navigation.navigate(RouteNames.TrainingTest, {
      dayId: day?.documentId,
      sessionId,
      testIndex: index,
    });
  }, [day, navigation, sessionId]);

  return (
    <ScreenContainer bgImage="bg2" bottomInsetMode="tab-scene">
      <ScrollView
        contentContainerStyle={[Spaces.paddingBottom[40]]}
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
      >
        <WithDataWrapper error={error} isLoading={isLoading} onRetry={refetch}>
          {day ? (
            <View style={Spaces.gap[16]}>
              <View style={Spaces.gap[4]}>
                {Boolean(day.kicker) && (
                <RichText
                  color={Colors.neutral00}
                  style={[Fonts.caption, { color: Colors.primary400 }]}
                  text={day.kicker}
                />
                )}
                <Text style={[Fonts.h2Bold, { color: Colors.neutral00 }]}>{day.title}</Text>
                {Boolean(day.lead) && (
                <RichText
                  color={Colors.neutral00}
                  style={[Fonts.p3, { color: Colors.neutral300 }]}
                  text={day.lead}
                />
                )}
                <Text style={[Fonts.caption, { color: Colors.neutral400 }]}>
                  {t('training.day.progress', {
                    count: doneTestCodes.size, done: doneTestCodes.size, total: tests.length,
                  })}
                </Text>
              </View>

              {day.requiresFreshnessCheck && (
              <View
                style={{
                  backgroundColor: Colors.neutral800,
                  borderLeftColor: Colors.gold500,
                  borderLeftWidth: 3,
                  borderRadius: 6,
                  padding: 10,
                }}
              >
                <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>
                  {t('training.day.freshnessRequired')}
                </Text>
              </View>
              )}

              <View style={Spaces.gap[8]}>
                <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>
                  {t('training.day.testsTitle')}
                </Text>
                {/** @type {Record<string, any>[]} */ (tests).map((test, index) => (
                  <TestRow
                    done={doneTestCodes.has(test.code)}
                    key={test.documentId || test.code}
                    onPress={() => openTest(index)}
                    test={test}
                  />
                ))}
              </View>

              {Array.isArray(day.markers) && day.markers.length > 0 && (
              <Section defaultOpen title={t('training.day.markers')}>
                <View style={Spaces.gap[8]}>
                  {/** @type {Record<string, any>[]} */ (day.markers).map((marker) => (
                    <View key={marker.label} style={Spaces.gap[4]}>
                      <Text style={[Fonts.captionBold, { color: Colors.primary400 }]}>
                        {marker.label}
                      </Text>
                      <RichText
                        color={Colors.neutral00}
                        style={[Fonts.p3, { color: Colors.neutral300 }]}
                        text={marker.value}
                      />
                    </View>
                  ))}
                </View>
              </Section>
              )}

              <Section title={t('training.day.timeline')}>
                <TrainingBlocks blocks={day.timeline} />
              </Section>

              <Section title={t('training.day.warmup')}>
                <TrainingBlocks blocks={day.warmup} />
              </Section>

              <Section title={t('training.day.logbook')}>
                <TrainingBlocks blocks={day.logbook} />
              </Section>

              {session?.status === 'done' ? (
                <Text style={[Fonts.p3, { color: Colors.success500 }]}>
                  {t('training.day.alreadyDone')}
                </Text>
              ) : (
                <View style={Spaces.gap[8]}>
                  {session?.status !== 'in_progress' && (
                  <Button
                    isLoading={updateSession.isPending}
                    onPress={start}
                    title={t('training.actions.startDay')}
                    variant="Primary"
                  />
                  )}
                  {session?.status === 'in_progress' && (
                  <Button
                    isLoading={updateSession.isPending}
                    onPress={finish}
                    title={t('training.actions.finishDay')}
                    variant="Secondary"
                  />
                  )}
                </View>
              )}
            </View>
          ) : null}
        </WithDataWrapper>
      </ScrollView>
    </ScreenContainer>
  );
}

export default TrainingDay;
