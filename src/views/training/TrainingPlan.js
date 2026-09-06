import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import EmptyState from '@/components/atoms/emptyState/EmptyState';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useMyTraining } from '@/hooks/useTraining';

/**
 * « MON ENTRAINEMENT » — le planning des journées, dans l'ordre.
 *
 * 🔎 CE QUI DÉCIDE DE L'ORDRE : `displayOrder`, pas la date. Une journée reportée
 * garde sa place dans la progression même si sa date recule, sinon le planning se
 * réorganiserait sous les yeux à chaque report.
 */

const STATUS_COLORS = {
  done: 'success500',
  in_progress: 'primary500',
  planned: 'neutral500',
  postponed: 'gold500',
  skipped: 'neutral600',
};

/**
 * Met une date ISO sous la forme lisible d'une seance.
 * @param {string|null|undefined} iso la date rendue par le serveur
 * @returns {string} la date affichable, vide si elle est absente ou illisible
 */
const formatDate = (iso) => {
  if (!iso) return '';
  const date = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', weekday: 'short' });
};

/**
 * Une ligne du planning : le code et le titre de la journée, sa date, son lieu,
 * sa durée et son statut, avec un liseré appuyé quand c'est la prochaine séance.
 * @param {object} props
 * @param {boolean} props.isNext Vrai pour la prochaine séance à faire, mise en avant.
 * @param {() => void} props.onPress Ouvre le détail de la journée.
 * @param {Record<string, any>} props.session La séance affichée
 *   (sa journée, sa date prévue, son statut).
 * @returns {React.ReactElement} la ligne cliquable d'une séance
 */
function SessionRow({ isNext, onPress, session }) {
  const { Colors, Fonts, Spaces } = useTheme();
  const { t } = useTranslation();
  const day = session?.day || {};
  const etat = /** @type {keyof STATUS_COLORS} */ (session?.status);
  const statusColor = Colors[/** @type {keyof Colors} */ (STATUS_COLORS[etat] || 'neutral500')];

  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={onPress}
      style={[
        Spaces.gap[4],
        {
          backgroundColor: Colors.neutral800,
          borderColor: isNext ? Colors.primary500 : Colors.neutral700,
          borderRadius: 12,
          borderWidth: isNext ? 2 : 1,
          padding: 14,
        },
      ]}
    >
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}>
        <View style={{
          backgroundColor: statusColor, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2,
        }}
        >
          <Text style={[Fonts.captionBold, { color: Colors.neutral00 }]}>{day.code}</Text>
        </View>
        <Text
          numberOfLines={2}
          style={[Fonts.p2, { color: Colors.neutral00, flex: 1 }]}
        >
          {day.title}
        </Text>
      </View>

      <View style={{ alignItems: 'center', flexDirection: 'row', gap: 10 }}>
        <Text style={[Fonts.caption, { color: Colors.neutral300 }]}>
          {formatDate(session.plannedDate)}
        </Text>
        {Boolean(day.place) && (
          <Text style={[Fonts.caption, { color: Colors.neutral400 }]}>{day.place}</Text>
        )}
        {Boolean(day.durationMinutes) && (
          <Text style={[Fonts.caption, { color: Colors.neutral400 }]}>
            {day.durationMinutes}
            {' '}
            min
          </Text>
        )}
        <Text style={[Fonts.caption, { color: statusColor, marginLeft: 'auto' }]}>
          {t(`training.status.${session.status || 'planned'}`)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

/**
 * L'écran « Mon entraînement » : la progression du programme suivi, la prochaine
 * séance mise en avant, puis toutes les journées dans l'ordre du planning.
 * @param {object} props
 * @param {Record<string, any>} props.navigation
 * @returns {React.ReactElement} le planning de l'entraînement choisi
 */
function TrainingPlan({ navigation }) {
  const { Colors, Fonts, Spaces } = useTheme();
  const { t } = useTranslation();
  const {
    enrollment, error, isLoading, nextSession, progress, refetch, sessions,
  } = useMyTraining();

  const openSession = useCallback((/** @type {Record<string, any>|null} */ session) => {
    navigation.navigate(RouteNames.TrainingDay, {
      dayId: session?.day?.documentId,
      sessionId: session?.documentId,
      title: session?.day?.title,
    });
  }, [navigation]);

  return (
    <ScreenContainer bgImage="bg2">
      <WithDataWrapper error={error} isLoading={isLoading} onRetry={refetch}>
        {enrollment ? (
          <View style={Spaces.gap[16]}>
            <View style={Spaces.gap[4]}>
              <Text style={[Fonts.h2Bold, { color: Colors.neutral00 }]}>
                {enrollment.program?.title || t('training.plan.title')}
              </Text>
              <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
                {t('training.plan.progress', {
                  count: progress.done,
                  done: progress.done,
                  total: progress.total,
                })}
              </Text>
              <View style={{
                backgroundColor: Colors.neutral700, borderRadius: 3, height: 6, overflow: 'hidden',
              }}
              >
                <View
                  style={{
                    backgroundColor: Colors.primary500,
                    height: 6,
                    width: `${Math.round(progress.ratio * 100)}%`,
                  }}
                />
              </View>
            </View>

            {Boolean(nextSession) && (
              <View style={Spaces.gap[8]}>
                <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>
                  {t('training.plan.nextUp')}
                </Text>
                <SessionRow
                  isNext
                  onPress={() => openSession(nextSession)}
                  session={nextSession || {}}
                />
              </View>
            )}

            <View style={Spaces.gap[12]}>
              {sessions.map((session) => (
                <SessionRow
                  isNext={false}
                  key={session.documentId}
                  onPress={() => openSession(session)}
                  session={session}
                />
              ))}
            </View>

            <Button
              onPress={() => navigation.navigate(RouteNames.TrainingLogbook)}
              title={t('training.logbook.title')}
              variant="Secondary"
            />
          </View>
        ) : (
          <EmptyState
            actionLabel={t('training.plan.empty.action')}
            description={t('training.plan.empty.description')}
            onAction={() => navigation.navigate(RouteNames.TrainingCatalog)}
            title={t('training.plan.empty.title')}
          />
        )}
      </WithDataWrapper>
    </ScreenContainer>
  );
}

export default TrainingPlan;
