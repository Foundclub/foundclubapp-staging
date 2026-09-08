import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import TrainingSessionRow, { formatSessionDate } from '@/components/organisms/training/TrainingSessionRow';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useMyTraining, useUpdateTrainingSession } from '@/hooks/useTraining';

/**
 * « TOUTES MES SÉANCES » — les huit journées, dans l'ordre du planning.
 *
 * 🔎 POURQUOI CET ÉCRAN EXISTE. Le pack de design sort DÉLIBÉRÉMENT la liste des
 * huit journées de « Mon entraînement » pour la mettre derrière une porte : le
 * premier écran ne doit montrer que trois choses — la prochaine séance, où j'en
 * suis, et trois portes. Une liste de huit rangées au premier écran noyait le
 * seul geste qui compte : commencer la séance du jour.
 *
 * 🔎 L'ORDRE EST CELUI DU SERVEUR, jamais celui des dates : une journée reportée
 * garde sa place dans la progression, sinon le planning se réorganiserait sous
 * les yeux à chaque report.
 */

/** De combien de jours on peut décaler une séance, en un geste. */
const DECALAGES = [1, 2, 7];

/**
 * @param {object} props
 * @param {Record<string, any>} props.navigation
 * @returns {React.ReactElement} la liste de toutes les séances du programme suivi
 */
function TrainingSessions({ navigation }) {
  const { Colors, Fonts, Spaces } = useTheme();
  const { t } = useTranslation();
  const {
    error, isLoading, nextSession, refetch, sessions,
  } = useMyTraining();
  const decaler = useUpdateTrainingSession();

  const [aDecaler, setADecaler] = useState(/** @type {Record<string, any>|null} */ (null));
  // Le programme prescrit des ECARTS entre ses journees (« au moins 24 h apres le
  // dernier entrainement »). Repousser une seule seance les ecrase en silence :
  // la suivante se retrouve collee a celle qu on vient de bouger. Le choix est
  // donc explicite, et il est PRE-COCHE — c est ce qui preserve le protocole.
  const [enChaine, setEnChaine] = useState(true);

  const openSession = useCallback((/** @type {Record<string, any>} */ session) => {
    navigation.navigate(RouteNames.TrainingDay, {
      dayId: session?.day?.documentId,
      sessionId: session?.documentId,
      title: session?.day?.title,
    });
  }, [navigation]);

  /**
   * Repousse la séance choisie de N jours.
   * @param {number} jours de combien de jours on repousse
   * @returns {void} rien : la feuille se ferme et la liste se relit
   */
  const repousser = (jours) => {
    if (!aDecaler?.documentId || !aDecaler?.plannedDate) return;
    const nouvelle = new Date(`${String(aDecaler.plannedDate).slice(0, 10)}T00:00:00`);
    nouvelle.setDate(nouvelle.getDate() + jours);
    // 🪤 PAS `toISOString()` : il reconvertit en UTC, et minuit local a l est de
    // Greenwich retombe la VEILLE. Un « +1 jour » rendait donc la meme date, en
    // silence. On recompose la date avec les morceaux LOCAUX.
    const iso = [
      nouvelle.getFullYear(),
      String(nouvelle.getMonth() + 1).padStart(2, '0'),
      String(nouvelle.getDate()).padStart(2, '0'),
    ].join('-');
    decaler.mutate(
      {
        payload: { plannedDate: iso, shiftFollowing: enChaine },
        sessionDocumentId: aDecaler.documentId,
      },
      { onSettled: () => setADecaler(null) },
    );
  };

  /**
   * Saute la seance choisie : elle reste dans la liste, en demi-teinte.
   * @returns {void} rien : la feuille se ferme et la liste se relit
   */
  const sauter = () => {
    if (!aDecaler?.documentId) return;
    decaler.mutate(
      { payload: { status: 'skipped' }, sessionDocumentId: aDecaler.documentId },
      { onSettled: () => setADecaler(null) },
    );
  };

  return (
    <ScreenContainer bgImage="bg2" bottomInsetMode="tab-scene">
      <ScrollView
        contentContainerStyle={[Spaces.paddingBottom[40]]}
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
      >
        <View style={Spaces.gap[16]}>
          <View style={Spaces.gap[4]}>
            <Text style={[Fonts.h2Bold, { color: Colors.neutral00 }]}>
              {t('training.sessions.title')}
            </Text>
            {/*
              La phrase qui enlève la pression : le programme conseille un ordre,
              il ne l'impose pas. Sans elle, une date passée se lit comme un retard.
            */}
            <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
              {t('training.sessions.lead')}
            </Text>
          </View>

          <WithDataWrapper error={error} isLoading={isLoading} onRetry={refetch}>
            <View style={Spaces.gap[12]}>
              {(Array.isArray(sessions) ? sessions : []).map((session) => (
                <View key={session.documentId} style={Spaces.gap[4]}>
                  <TrainingSessionRow
                    isNext={session.documentId === nextSession?.documentId}
                    onPress={() => openSession(session)}
                    session={session}
                  />
                  <TouchableOpacity
                    accessibilityRole="button"
                    onPress={() => setADecaler(session)}
                    style={{ alignSelf: 'flex-end', paddingHorizontal: 8, paddingVertical: 4 }}
                  >
                    <Text style={[Fonts.caption, { color: Colors.primary500 }]}>
                      {t('training.actions.postpone')}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </WithDataWrapper>
        </View>
      </ScrollView>

      <BottomModal close={() => setADecaler(null)} isVisible={Boolean(aDecaler)}>
        <View style={[Spaces.gap[12], Spaces.paddingBottom[24]]}>
          <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>
            {t('training.postpone.title', { date: formatSessionDate(aDecaler?.plannedDate) })}
          </Text>
          {/*
            🔗 Le décalage EN CHAÎNE, pré-coché. Le programme prescrit des écarts
            entre ses journées ; repousser une seule séance les écrase en silence.
            Le serveur sait maintenant décaler les suivantes du même nombre de
            jours (`shiftFollowing`), et les écarts sont préservés tels quels.
          */}
          <TouchableOpacity
            accessibilityRole="checkbox"
            accessibilityState={{ checked: enChaine }}
            onPress={() => setEnChaine((avant) => !avant)}
            style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}
          >
            <View style={{
              backgroundColor: enChaine ? Colors.primary500 : 'transparent',
              borderColor: Colors.primary500,
              borderRadius: 4,
              borderWidth: 1,
              height: 18,
              width: 18,
            }}
            />
            <Text style={[Fonts.p3, { color: Colors.neutral300, flex: 1 }]}>
              {t('training.postpone.scope')}
            </Text>
          </TouchableOpacity>
          {DECALAGES.map((jours) => (
            <Button
              isLoading={decaler.isPending}
              key={jours}
              onPress={() => repousser(jours)}
              title={t('training.postpone.byDays', { count: jours })}
              variant="SecondaryLight"
            />
          ))}
          <Button
            isLoading={decaler.isPending}
            onPress={sauter}
            title={t('training.actions.skipSession')}
            variant="SecondaryLight"
          />
          <Text style={[Fonts.caption, { color: withAlpha(Colors.neutral00, 0.6) }]}>
            {t('training.postpone.hint')}
          </Text>
        </View>
      </BottomModal>
    </ScreenContainer>
  );
}

export default TrainingSessions;
