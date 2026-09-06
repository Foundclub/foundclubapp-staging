import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView,
  Text,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useChooseTrainingProgram, useMyTraining, useTrainingProgram } from '@/hooks/useTraining';

/**
 * Une journée du programme, telle que le serveur la rend.
 * @typedef {Record<string, any>} TrainingDay
 * @property {string} [code] - Le code court affiché dans la pastille.
 * @property {string} [documentId] - Identifiant Strapi, clef de la liste.
 * @property {number} [durationMinutes] - Durée annoncée de la journée, en minutes.
 * @property {string} [place] - Le lieu exigé : terrain, salle, extérieur.
 * @property {unknown[]} [tests] - Les tests contenus dans la journée.
 * @property {string} [title] - L'intitulé de la journée.
 */

/**
 * UNE JOURNÉE DU PROGRAMME, résumée sur une seule ligne de la liste.
 *
 * 🔎 CE QU'ELLE PERMET DE JUGER SANS OUVRIR LA JOURNÉE : son code et son intitulé,
 * puis en dessous le lieu, la durée et le nombre de tests. C'est ce trio qui dit
 * s'il faut un terrain, une salle, ou seulement une heure devant soi.
 * @param {object} props
 * @param {TrainingDay} props.day - La journée à résumer.
 * @returns {React.ReactElement} une ligne de journée
 */
function DayRow({ day }) {
  const { Colors, Fonts, Spaces } = useTheme();
  const { t } = useTranslation();
  return (
    <View
      style={[
        Spaces.gap[4],
        {
          borderTopColor: Colors.neutral700,
          borderTopWidth: 1,
          paddingVertical: 10,
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
          <Text style={[Fonts.captionBold, { color: Colors.neutral100 }]}>{day.code}</Text>
        </View>
        <Text style={[Fonts.p2, { color: Colors.neutral00, flex: 1 }]}>{day.title}</Text>
      </View>
      <Text style={[Fonts.caption, { color: Colors.neutral400 }]}>
        {[
          day.place,
          day.durationMinutes ? `${day.durationMinutes} min` : null,
          t('training.program.tests', {
            count: Array.isArray(day.tests) ? day.tests.length : 0,
          }),
        ].filter(Boolean).join(' · ')}
      </Text>
    </View>
  );
}

/**
 * LA FICHE D'UN PROGRAMME, et le bouton « Choisir cet entraînement ».
 *
 * 🔎 CE QU'ELLE MONTRE AVANT DE S'ENGAGER : le nombre de journées et de tests, le
 * matériel exigé, et la liste des journées avec leur lieu et leur durée. Quelqu'un
 * qui n'a ni terrain ni salle doit pouvoir le voir ici, pas au troisième jour.
 * @param {object} props
 * @param {{ navigate: (name: string, params?: Record<string, any>) => void }} props.navigation
 *   La navigation, pour filer vers le plan une fois le programme choisi.
 * @param {{ params: { programId: string } }} props.route
 *   La route : `params.programId` désigne le programme à afficher.
 * @returns {React.ReactElement} la fiche d'un programme
 */
function TrainingProgramDetail({ navigation, route }) {
  const { Colors, Fonts, Spaces } = useTheme();
  const { t } = useTranslation();
  const programId = route?.params?.programId;

  const {
    data: program, error, isLoading, refetch,
  } = useTrainingProgram(programId);
  const { enrollment } = useMyTraining();
  const choose = useChooseTrainingProgram();
  const [failed, setFailed] = useState(false);

  const alreadyChosen = enrollment?.program?.documentId === programId;

  const onChoose = useCallback(async () => {
    setFailed(false);
    try {
      await choose.mutateAsync({ programDocumentId: programId });
      navigation.navigate(RouteNames.TrainingPlan);
    } catch {
      setFailed(true);
    }
  }, [choose, navigation, programId]);

  return (
    <ScreenContainer bgImage="bg2" bottomInsetMode="tab-scene">
      <ScrollView
        contentContainerStyle={[Spaces.paddingBottom[40]]}
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
      >
        <WithDataWrapper error={error} isLoading={isLoading} onRetry={refetch}>
          {program ? (
            <View style={Spaces.gap[16]}>
              <View style={Spaces.gap[4]}>
                <Text style={[Fonts.h2Bold, { color: Colors.neutral00 }]}>{program.title}</Text>
                {Boolean(program.subtitle) && (
                <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>{program.subtitle}</Text>
                )}
              </View>

              {Boolean(program.summary) && (
              <Text style={[Fonts.p2, { color: Colors.neutral200 }]}>{program.summary}</Text>
              )}

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                <Text style={[Fonts.caption, { color: Colors.neutral400 }]}>
                  {t('training.program.days', { count: program.sessionsCount || 0 })}
                </Text>
                <Text style={[Fonts.caption, { color: Colors.neutral400 }]}>
                  {t('training.program.tests', { count: program.testsCount || 0 })}
                </Text>
                <Text style={[Fonts.caption, { color: Colors.neutral400 }]}>
                  {t(`training.program.level.${program.level || 'intermediaire'}`)}
                </Text>
              </View>

              {Boolean(program.equipmentSummary) && (
              <View style={Spaces.gap[4]}>
                <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>
                  {t('training.program.equipment')}
                </Text>
                <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
                  {program.equipmentSummary}
                </Text>
              </View>
              )}

              <View style={Spaces.gap[4]}>
                <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>
                  {t('training.program.contains')}
                </Text>
                {(Array.isArray(program.days) ? program.days : []).map((day) => (
                  <DayRow day={day} key={day.documentId || day.code} />
                ))}
              </View>

              {failed && (
              <Text style={[Fonts.p3, { color: Colors.error500 }]}>
                {t('training.catalog.error.description')}
              </Text>
              )}

              {alreadyChosen ? (
                <Button
                  onPress={() => navigation.navigate(RouteNames.TrainingPlan)}
                  title={t('training.actions.resume')}
                  variant="Primary"
                />
              ) : (
                <View style={Spaces.gap[8]}>
                  <Text style={[Fonts.caption, { color: Colors.neutral400 }]}>
                    {t('training.program.startsToday')}
                  </Text>
                  <Button
                    isLoading={choose.isPending}
                    onPress={onChoose}
                    title={t('training.actions.choose')}
                    variant="Primary"
                  />
                </View>
              )}
            </View>
          ) : null}
        </WithDataWrapper>
      </ScrollView>
    </ScreenContainer>
  );
}

export default TrainingProgramDetail;
