import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import TrainingProgressBar from '@/components/organisms/training/TrainingProgressBar';
import { formatSessionDate } from '@/components/organisms/training/TrainingSessionRow';
import ScreenContainer from '@/components/templates/ScreenContainer';
import { fileDesRelevés, totalARelever } from '@/views/training/trainingVideo';

import { RouteNames } from '@/navigation/routeNames';

import { useMyTraining } from '@/hooks/useTraining';

/**
 * « RELEVÉS VIDÉO » — la file du soir.
 *
 * 🔎 POURQUOI CET ÉCRAN EXISTE. Cinquante-huit des six cent dix-neuf mesures du
 * programme ne se prennent PAS sur le terrain : le nombre d'images entre le lâcher et
 * l'impact, l'angle du genou à l'appui. Elles se lisent image par image, sur un
 * logiciel, le soir. Sans liste, on les oublie — et un test dont il manque la moitié
 * des mesures ne vaut rien, alors que le terrain a bien été fait.
 *
 * 🪤 AUCUN APPEL SERVEUR NE MANQUAIT. C'est une correction d'un verdict antérieur : le
 * champ `moment` porte déjà l'information sur les 619 mesures, et « mon entraînement »
 * rend déjà le programme ET les résultats. Il manquait le CALCUL qui croise les deux —
 * il vit dans `trainingVideo.js`, à part, où il se teste sans écran.
 * @param {object} props
 * @param {Record<string, any>} props.navigation la navigation de la pile
 * @returns {React.ReactElement} la file des relevés qui attendent
 */
function TrainingVideoQueue({ navigation }) {
  const { Colors, Fonts, Spaces } = useTheme();
  const { t } = useTranslation();
  const {
    enrollment, error, isLoading, refetch, sessions,
  } = useMyTraining();

  const file = useMemo(
    () => fileDesRelevés(sessions, enrollment?.program?.days),
    [enrollment, sessions],
  );
  const total = useMemo(() => totalARelever(file), [file]);

  return (
    <ScreenContainer bgImage="bg2" bottomInsetMode="screen">
      <ScrollView
        contentContainerStyle={[Spaces.paddingBottom[24]]}
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
      >
        <WithDataWrapper error={error} isLoading={isLoading} onRetry={refetch}>
          <View style={Spaces.gap[16]}>
            <View style={Spaces.gap[4]}>
              <Text style={[Fonts.h2Bold, { color: Colors.neutral00 }]}>
                {t('training.video.title')}
              </Text>
              {/* LE COMPTE EN GROS CHIFFRE OR : c'est la seule chose qu'on veut
                  savoir en ouvrant l'écran le soir — combien il en reste. */}
              <Text style={{
                color: total > 0 ? Colors.gold500 : Colors.success500,
                fontSize: 40,
                fontWeight: '700',
                lineHeight: 46,
              }}
              >
                {total}
              </Text>
              <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
                {t(total > 0 ? 'training.video.lead' : 'training.video.allDone', { count: total })}
              </Text>
            </View>

            {file.map((jour) => (
              <View key={jour.sessionId || jour.code} style={Spaces.gap[8]}>
                <View style={{ alignItems: 'baseline', flexDirection: 'row', gap: 8 }}>
                  <View style={{
                    backgroundColor: withAlpha(Colors.primary500, 0.25),
                    borderRadius: 6,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                  }}
                  >
                    <Text style={[Fonts.captionBold, { color: Colors.primary400 }]}>
                      {jour.code}
                    </Text>
                  </View>
                  <Text style={[Fonts.p2Bold, { color: Colors.neutral00, flex: 1 }]}>
                    {formatSessionDate(jour.date)}
                  </Text>
                  {jour.tests.length > 0 && (
                    <Text style={[Fonts.caption, { color: Colors.neutral400 }]}>
                      {t('training.video.testsCount', { count: jour.tests.length })}
                    </Text>
                  )}
                </View>

                {/* 🪤 UNE JOURNÉE PAS ENCORE COMMENCÉE N'EST PAS UN TROU. Sans ce
                    cadre, elle disparaissait de la liste et on croyait avoir déjà
                    tout relevé — alors qu'on n'avait simplement rien filmé. */}
                {!jour.commencee ? (
                  <View style={{
                    borderColor: withAlpha(Colors.neutral500, 0.6),
                    borderRadius: 10,
                    borderStyle: 'dashed',
                    borderWidth: 1,
                    padding: 12,
                  }}
                  >
                    <Text style={[Fonts.caption, { color: Colors.neutral400 }]}>
                      {t('training.video.notStarted')}
                    </Text>
                  </View>
                ) : jour.tests.map((test) => (
                  <TouchableOpacity
                    accessibilityRole="button"
                    key={test.code}
                    onPress={() => navigation.navigate(RouteNames.TrainingVideoEntry, {
                      dayId: jour.dayId,
                      sessionId: jour.sessionId,
                      testIndex: test.testIndex,
                    })}
                    style={[
                      Spaces.gap[8],
                      {
                        // Le cadre prend la couleur de l'avancement : tout relevé
                        // = vert, il en reste = or. On voit où aller sans lire.
                        borderColor: test.restantes === 0
                          ? withAlpha(Colors.success500, 0.5)
                          : withAlpha(Colors.gold500, 0.5),
                        borderRadius: 10,
                        borderWidth: 1,
                        minHeight: 64,
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
                        <Text style={[Fonts.captionBold, { color: Colors.neutral100 }]}>
                          {test.code}
                        </Text>
                      </View>
                      <Text
                        numberOfLines={1}
                        style={[Fonts.p3, { color: Colors.neutral00, flex: 1 }]}
                      >
                        {test.name}
                      </Text>
                      {Boolean(test.outil) && (
                        <Text style={[Fonts.caption, { color: Colors.gold500 }]}>
                          {test.outil}
                        </Text>
                      )}
                      <Text style={[Fonts.caption, { color: Colors.neutral400 }]}>›</Text>
                    </View>
                    <Text style={[Fonts.caption, { color: Colors.neutral400 }]}>
                      {t('training.video.testLine', {
                        attempts: test.essais, count: test.essais, measures: test.total,
                      })}
                    </Text>
                    <TrainingProgressBar
                      color={test.restantes === 0 ? Colors.success500 : Colors.gold500}
                      ratio={test.ratio}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            ))}

            <Text style={[Fonts.caption, { color: Colors.neutral400 }]}>
              {t('training.video.hint')}
            </Text>
          </View>
        </WithDataWrapper>
      </ScrollView>
    </ScreenContainer>
  );
}

export default TrainingVideoQueue;
