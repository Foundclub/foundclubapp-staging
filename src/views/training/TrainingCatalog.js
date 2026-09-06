import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import EmptyState from '@/components/atoms/emptyState/EmptyState';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useMyTraining, useTrainingCatalog } from '@/hooks/useTraining';

/**
 * « RECHERCHER UN ENTRAINEMENT » — la deuxième carte de la section Entraînement.
 *
 * Liste les programmes publiés. Le programme déjà choisi porte une pastille : sans
 * elle, on ne saurait pas, depuis cette liste, lequel on suit déjà.
 * @param {object} props Les propriétés de la carte.
 * @param {boolean} props.current Vrai si ce programme est celui déjà suivi (pastille).
 * @param {() => void} props.onPress Appelé quand la carte est touchée.
 * @param {Record<string, any>} props.program Le programme à présenter
 *   (titre, sous-titre, compteurs, niveau).
 * @returns {React.ReactElement} la carte tactile d'un programme du catalogue
 */
function ProgramCard({ current, onPress, program }) {
  const { Colors, Fonts, Spaces } = useTheme();
  const { t } = useTranslation();

  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={onPress}
      style={[
        Spaces.gap[8],
        {
          backgroundColor: Colors.neutral800,
          borderColor: current ? Colors.primary500 : Colors.neutral700,
          borderRadius: 12,
          borderWidth: 1,
          padding: 14,
        },
      ]}
    >
      <View
        style={{
          alignItems: 'flex-start',
          flexDirection: 'row',
          justifyContent: 'space-between',
        }}
      >
        <Text style={[Fonts.h4Bold, { color: Colors.neutral00, flex: 1 }]}>{program.title}</Text>
        {current && (
          <View
            style={{
              backgroundColor: Colors.primary500,
              borderRadius: 6,
              paddingHorizontal: 8,
              paddingVertical: 3,
            }}
          >
            <Text style={[Fonts.caption, { color: Colors.neutral00 }]}>
              {t('training.status.in_progress')}
            </Text>
          </View>
        )}
      </View>

      {Boolean(program.subtitle) && (
        <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>{program.subtitle}</Text>
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
    </TouchableOpacity>
  );
}

/**
 * Écran « Rechercher un entraînement » : le catalogue des programmes publiés.
 *
 * Chaque programme s'y affiche en carte ; toucher une carte ouvre son détail. Si
 * aucun programme n'est publié, l'écran le dit au lieu de rester vide.
 * @param {object} props
 * @param {Record<string, any>} props.navigation
 * @returns {React.ReactElement} l'écran de catalogue
 */
function TrainingCatalog({ navigation }) {
  const { Colors, Fonts, Spaces } = useTheme();
  const { t } = useTranslation();
  const {
    data: programs, error, isLoading, refetch,
  } = useTrainingCatalog();
  const { enrollment } = useMyTraining();

  const currentProgramId = enrollment?.program?.documentId;

  const openProgram = useCallback((/** @type {Record<string, any>} */ program) => {
    navigation.navigate(RouteNames.TrainingProgramDetail, {
      programId: program.documentId,
      title: program.title,
    });
  }, [navigation]);

  return (
    <ScreenContainer bgImage="bg2" bottomInsetMode="tab-scene">
      <View style={Spaces.gap[16]}>
        <View style={Spaces.gap[4]}>
          <Text style={[Fonts.h2Bold, { color: Colors.neutral00 }]}>
            {t('training.catalog.title')}
          </Text>
          <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
            {t('training.catalog.subtitle')}
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={[Spaces.paddingBottom[40]]}
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}

        >

          <WithDataWrapper error={error} isLoading={isLoading} onRetry={refetch}>
            {Array.isArray(programs) && programs.length > 0 ? (
              <View style={Spaces.gap[12]}>
                {programs.map((program) => (
                  <ProgramCard
                    current={program.documentId === currentProgramId}
                    key={program.documentId}
                    onPress={() => openProgram(program)}
                    program={program}
                  />
                ))}
              </View>
            ) : (
              <EmptyState
                description={t('training.catalog.empty.description')}
                title={t('training.catalog.empty.title')}
              />
            )}
          </WithDataWrapper>
        </ScrollView>
      </View>
    </ScreenContainer>
  );
}

export default TrainingCatalog;
