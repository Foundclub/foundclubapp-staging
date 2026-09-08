import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView,
  Text,
  View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import EmptyState from '@/components/atoms/emptyState/EmptyState';
import ClubCardSurface from '@/components/molecules/clubCard/ClubCardSurface';
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

  const journees = Array.isArray(program.daysSummary) ? program.daysSummary : [];
  const durees = journees.map((j) => j.durationMinutes).filter(Boolean);
  const lieux = [...new Set(journees.map((j) => j.place).filter(Boolean))];

  return (
    <ClubCardSurface
      style={[
        Spaces.gap[8],
        {
          borderColor: current ? Colors.primary500 : withAlpha(Colors.primary500, 0.25),
          borderRadius: 12,
          borderWidth: current ? 2 : 1,
          padding: 16,
        },
      ]}
    >
      {/*
        La pastille est SEULE sur sa ligne, au-dessus du titre. Collée à droite du
        titre, elle le rognait et se lisait comme une étiquette de plus.
      */}
      {current && (
        <View style={{ alignSelf: 'flex-start' }}>
          <View style={{
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
        </View>
      )}

      <Text style={[Fonts.h3Bold, { color: Colors.neutral00 }]}>{program.title}</Text>

      {Boolean(program.subtitle) && (
        <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
          {program.subtitle}
          {program.sessionsCount && program.durationDays
            ? ` — ${t('training.catalog.rhythm', {
              days: program.durationDays,
              sessions: program.sessionsCount,
            })}`
            : ''}
        </Text>
      )}

      {/* Trois GROS pavés : le chiffre se lit d'un coup d'œil, le mot l'explique. */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[
          [program.sessionsCount || 0, t('training.catalog.stat.days')],
          [program.testsCount || 0, t('training.catalog.stat.tests')],
          [
            t(`training.program.level.${program.level || 'intermediaire'}`),
            t('training.catalog.stat.level'),
          ],
        ].map(([valeur, mot]) => (
          <View
            key={String(mot)}
            style={{
              alignItems: 'center',
              borderColor: withAlpha(Colors.primary500, 0.25),
              borderRadius: 10,
              borderWidth: 1,
              flex: 1,
              paddingVertical: 10,
            }}
          >
            <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>{String(valeur)}</Text>
            <Text style={[Fonts.caption, { color: Colors.neutral400 }]}>{mot}</Text>
          </View>
        ))}
      </View>

      {/*
        La frise des rendez-vous : une pastille par journée, dans l'ordre. Elle dit
        d'un regard combien de fois on sort, et sous quel code.
      */}
      {journees.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {journees.map((journee) => (
            <View
              key={journee.code}
              style={{
                borderColor: withAlpha(Colors.primary500, 0.4),
                borderRadius: 999,
                borderWidth: 1,
                paddingHorizontal: 8,
                paddingVertical: 2,
              }}
            >
              <Text style={[Fonts.caption, { color: Colors.primary200 }]}>{journee.code}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Ce que ça demande : où l'on va, et combien de temps ça prend. */}
      {durees.length > 0 && (
        <Text style={[Fonts.caption, { color: Colors.neutral400 }]}>
          {t('training.catalog.demands', {
            max: Math.max(...durees),
            min: Math.min(...durees),
            places: lieux.join(' et '),
          })}
        </Text>
      )}

      {/*
        Un vrai bouton en pied de carte, séparé par un trait. Sans lui, il fallait
        deviner qu'on pouvait appuyer sur la carte.
      */}
      <View style={{
        backgroundColor: withAlpha(Colors.primary500, 0.25), height: 1, marginTop: 4,
      }}
      />
      <Button
        onPress={onPress}
        title={current ? t('training.actions.resume') : t('training.catalog.seeDetail')}
        variant={current ? 'Primary' : 'SecondaryLight'}
      />
    </ClubCardSurface>
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

          <WithDataWrapper
            error={error}
            errorMessage={t('training.catalog.error.description')}
            isLoading={isLoading}
            onRetry={refetch}
          >
            {/* 🪤 `SkeletonLoader` fait scintiller SES ENFANTS : sans cette condition,
                le chargement montrait l etat VIDE en train de scintiller, et le
                squelette ne ressemblait pas a l ecran qui allait arriver. */}
            {(Array.isArray(programs) && programs.length > 0) || isLoading ? (
              <View style={Spaces.gap[12]}>
                {/* Ce qui est publie, et combien : une liste a un element ne doit
                    pas se lire comme une liste incomplete. */}
                <Text style={[Fonts.caption, { color: Colors.neutral400 }]}>
                  {t('training.catalog.published', { count: programs?.length || 0 })}
                </Text>
                {(Array.isArray(programs) ? programs : []).map((program) => (
                  <ProgramCard
                    current={program.documentId === currentProgramId}
                    key={program.documentId}
                    onPress={() => openProgram(program)}
                    program={program}
                  />
                ))}
                {/* La legende qui explique pourquoi il n y en a qu un, et ce qui
                    se passe quand on en choisit un. */}
                <Text style={[Fonts.caption, { color: Colors.neutral400 }]}>
                  {t('training.catalog.legend', { count: programs?.length || 0 })}
                </Text>
              </View>
            ) : (
              <EmptyState
                actionLabel={t('training.catalog.empty.action')}
                description={t('training.catalog.empty.description')}
                onAction={() => navigation.goBack()}
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
