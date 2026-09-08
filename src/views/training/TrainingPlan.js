import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import EmptyState from '@/components/atoms/emptyState/EmptyState';
import ClubCardSurface from '@/components/molecules/clubCard/ClubCardSurface';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import { formatSessionDate } from '@/components/organisms/training/TrainingSessionRow';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { getPendingSessions } from '@/services/training/trainingLocalStore';

import { useMyTraining } from '@/hooks/useTraining';

/**
 * « MON ENTRAÎNEMENT » — TROIS CHOSES, et rien d'autre.
 *
 * 🔎 CE QUE CET ÉCRAN MONTRAIT AVANT, et pourquoi ça ne marchait pas : la liste
 * des huit journées, du haut en bas. Le seul geste qui compte — commencer la
 * séance du jour — s'y noyait, et l'écran n'avait AUCUN bouton d'action : la
 * seule façon d'avancer était de deviner qu'il fallait toucher la bonne rangée.
 *
 * 🔎 CE QU'IL MONTRE MAINTENANT, dans cet ordre :
 *   1. LA PROCHAINE SÉANCE, en grand, avec son bouton — le jour même, l'étiquette
 *      devient « Aujourd'hui » et le bouton « Commencer ma séance » ;
 *   2. OÙ J'EN SUIS — la barre, « n séances faites sur 8 », et la date de fin ;
 *   3. DEUX PORTES — toutes mes séances, mon carnet.
 * La liste des huit journées est passée derrière la première porte.
 *
 * 🔎 L'ORDRE DES SÉANCES est celui du serveur, jamais celui des dates : une
 * journée reportée garde sa place, sinon le planning se réorganiserait sous les
 * yeux à chaque report.
 */

/**
 * Une porte : un titre, ce qu'elle contient, et un chevron.
 * @param {object} props
 * @param {string} [props.accent] la couleur du liseré, pour la porte à ne pas rater
 * @param {() => void} props.onPress ce que la porte ouvre
 * @param {string} props.subtitle ce qu'on trouve derrière
 * @param {string} props.title le nom de la porte
 * @returns {React.ReactElement} la rangée cliquable
 */
function Porte({
  accent = undefined, onPress, subtitle, title,
}) {
  const { Colors, Fonts, Spaces } = useTheme();

  return (
    <TouchableOpacity accessibilityRole="button" onPress={onPress}>
      <ClubCardSurface
        style={[
          Spaces.gap[4],
          {
            borderColor: accent || withAlpha(Colors.primary500, 0.25),
            borderRadius: 12,
            borderWidth: 1,
            padding: 14,
          },
        ]}
      >
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}>
          <View style={[Spaces.gap[2], { flex: 1 }]}>
            <Text style={[Fonts.p2, { color: Colors.neutral00 }]}>{title}</Text>
            <Text style={[Fonts.caption, { color: Colors.neutral300 }]}>{subtitle}</Text>
          </View>
          <Text style={[Fonts.p2, { color: Colors.primary500 }]}>›</Text>
        </View>
      </ClubCardSurface>
    </TouchableOpacity>
  );
}

/**
 * @param {object} props
 * @param {Record<string, any>} props.navigation
 * @returns {React.ReactElement} le tableau de bord de l'entraînement suivi
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

  const chiffres = useMemo(() => {
    const liste = Array.isArray(sessions) ? sessions : [];
    // La date de fin se calcule SUR LE TELEPHONE : c'est la derniere date prevue,
    // deja chargee. Rien a demander au serveur.
    const derniere = liste.length ? liste[liste.length - 1]?.plannedDate : null;
    const mesures = liste.reduce(
      (total, session) => total + (Array.isArray(session.results) ? session.results.length : 0),
      0,
    );
    return { fin: formatSessionDate(derniere), mesures };
  }, [sessions]);

  // 🪤 L'app n'a AUCUN detecteur de reseau — seulement l'etat du socket, qui n'est
  // pas la meme chose. Le signal honnete est donc celui qui compte vraiment pour
  // le joueur : des mesures attendent d'etre envoyees, et elles sont en securite.
  const enAttente = getPendingSessions().length > 0;

  // Le jour meme, l'ecran change de mot : on ne « prepare » plus, on commence.
  const jourJ = useMemo(() => {
    if (!nextSession?.plannedDate) return false;
    const prevue = new Date(`${String(nextSession.plannedDate).slice(0, 10)}T00:00:00`);
    if (Number.isNaN(prevue.getTime())) return false;
    const aujourdHui = new Date();
    aujourdHui.setHours(0, 0, 0, 0);
    return prevue.getTime() <= aujourdHui.getTime();
  }, [nextSession]);

  return (
    <ScreenContainer bgImage="bg2" bottomInsetMode="tab-scene">
      <ScrollView
        contentContainerStyle={[Spaces.paddingBottom[40]]}
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
      >
        <WithDataWrapper error={error} isLoading={isLoading} onRetry={refetch}>
          {/*
            🪤 `SkeletonLoader` fait scintiller SES ENFANTS. Tant que l'écran ne
            rendait sa carcasse qu'avec une inscription en main, le chargement
            montrait l'état VIDE en train de scintiller — la forme du squelette ne
            ressemblait donc pas à celle de l'écran qui allait arriver. On rend la
            carcasse aussi pendant le chargement : les blocs sont là, sans texte.
          */}
          {enrollment || isLoading ? (
            <View style={Spaces.gap[16]}>
              <View style={Spaces.gap[2]}>
                <Text style={[Fonts.h2Bold, { color: Colors.neutral00 }]}>
                  {t('training.plan.title')}
                </Text>
                <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
                  {enrollment?.program?.title || ''}
                </Text>
              </View>

              {enAttente && (
                <View style={{
                  backgroundColor: withAlpha(Colors.gold500, 0.12),
                  borderColor: Colors.gold500,
                  borderRadius: 10,
                  borderWidth: 1,
                  padding: 12,
                }}
                >
                  <Text style={[Fonts.caption, { color: Colors.gold500 }]}>
                    {t('training.plan.offline')}
                  </Text>
                </View>
              )}

              {/* 1 — LA PROCHAINE SÉANCE, et son bouton. */}
              {nextSession ? (
                <ClubCardSurface
                  style={[
                    Spaces.gap[8],
                    {
                      borderColor: Colors.primary500,
                      borderRadius: 12,
                      borderWidth: 2,
                      padding: 16,
                    },
                  ]}
                >
                  <Text style={[Fonts.caption, { color: Colors.primary500 }]}>
                    {jourJ
                      ? t('training.plan.today')
                      : t('training.plan.nextUp', { date: formatSessionDate(nextSession.plannedDate) })}
                  </Text>
                  <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>
                    {nextSession.day?.title || ''}
                  </Text>
                  <Text style={[Fonts.caption, { color: Colors.neutral300 }]}>
                    {[nextSession.day?.place, nextSession.day?.durationMinutes
                      ? `${nextSession.day.durationMinutes} min` : null]
                      .filter(Boolean).join(' · ')}
                  </Text>
                  <Button
                    onPress={() => openSession(nextSession)}
                    title={jourJ ? t('training.actions.startSession') : t('training.actions.prepare')}
                    variant="Primary"
                  />
                  {!jourJ && (
                    <Button
                      onPress={() => openSession(nextSession)}
                      title={t('training.actions.startNow')}
                      variant="SecondaryLight"
                    />
                  )}
                  {/* La phrase qui enleve la pression : personne n'est en retard. */}
                  <Text style={[Fonts.caption, { color: withAlpha(Colors.neutral00, 0.6) }]}>
                    {t('training.plan.dateHint')}
                  </Text>
                </ClubCardSurface>
              ) : null}

              {/* 2 — OÙ J'EN SUIS. */}
              <View style={Spaces.gap[4]}>
                <View style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}>
                  <Text style={[Fonts.p3, { color: Colors.neutral300, flex: 1 }]}>
                    {t('training.plan.progress', {
                      count: progress.done,
                      done: progress.done,
                      total: progress.total,
                    })}
                  </Text>
                  {Boolean(chiffres.fin) && (
                    <Text style={[Fonts.caption, { color: Colors.neutral400 }]}>
                      {t('training.plan.endsOn', { date: chiffres.fin })}
                    </Text>
                  )}
                </View>
                <View style={{
                  backgroundColor: Colors.neutral700,
                  borderRadius: 3,
                  height: 6,
                  overflow: 'hidden',
                }}
                >
                  <View
                    style={{
                      backgroundColor: Colors.primary500,
                      height: 6,
                      width: `${Math.round((progress.ratio || 0) * 100)}%`,
                    }}
                  />
                </View>
              </View>

              {/* 3 — LES PORTES. */}
              <View style={Spaces.gap[8]}>
                <Porte
                  onPress={() => navigation.navigate(RouteNames.TrainingSessions)}
                  subtitle={t('training.plan.doors.sessionsSubtitle', {
                    count: progress.total,
                  })}
                  title={t('training.plan.days')}
                />
                <Porte
                  onPress={() => navigation.navigate(RouteNames.TrainingLogbook)}
                  subtitle={t('training.plan.doors.logbookSubtitle', { count: chiffres.mesures })}
                  title={t('training.plan.doors.logbook')}
                />
              </View>
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
      </ScrollView>
    </ScreenContainer>
  );
}

export default TrainingPlan;
