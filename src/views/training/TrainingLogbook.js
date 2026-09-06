import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import EmptyState from '@/components/atoms/emptyState/EmptyState';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { useTrainingExport } from '@/hooks/useTraining';

/**
 * LE CARNET — toutes les mesures, une par ligne, prêtes à coller.
 *
 * 🔎 POURQUOI DU TEXTE BRUT ET PAS UN JOLI TABLEAU : le guide de terrain décrit ce
 * format exact (`date;jour;test;mesure;unite;cote;essai;valeur;valide;...`). C'est
 * ce qui permet de coller le carnet dans une conversation pour faire analyser le
 * profil, puis de le réimporter. Un tableau graphique serait plus beau et
 * inutilisable pour ça.
 * @returns {React.ReactElement} L'écran du carnet : le texte brut des mesures,
 * son compteur de lignes, et le bouton qui le copie dans le presse-papiers.
 */
function TrainingLogbook() {
  const { Colors, Fonts, Spaces } = useTheme();
  const { t } = useTranslation();
  const {
    data, error, isLoading, refetch,
  } = useTrainingExport({ enabled: true });
  const [copied, setCopied] = useState(false);

  const csv = data?.csv || '';
  const rows = data?.rows || 0;

  /**
   * Le presse-papiers est charge A LA DEMANDE, comme partout ailleurs dans ce depot
   * (`shareLocalFile.native.js:52`, `Conversation.js`, `SuperAdminEntryList.js`) :
   * la dependance est facultative, et un build sans elle ne doit pas casser l ecran.
   * Le carnet reste selectionnable a la main dans tous les cas.
   */
  const copy = useCallback(() => {
    if (!csv) return;
    try {
      // eslint-disable-next-line global-require
      const maybeModule = require('@react-native-clipboard/clipboard');
      const clipboard = maybeModule?.default || maybeModule;
      if (!clipboard?.setString) return;
      clipboard.setString(csv);
      setCopied(true);
    } catch (_error) {
      // Sans presse-papiers, le texte reste selectionnable : on ne dit rien de faux.
    }
  }, [csv]);

  return (
    <ScreenContainer bgImage="bg2">
      <WithDataWrapper error={error} isLoading={isLoading} onRetry={refetch}>
        <View style={Spaces.gap[16]}>
          <View style={Spaces.gap[4]}>
            <Text style={[Fonts.h2Bold, { color: Colors.neutral00 }]}>
              {t('training.logbook.title')}
            </Text>
            <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
              {t('training.logbook.description')}
            </Text>
            <Text style={[Fonts.caption, { color: Colors.neutral400 }]}>
              {t('training.logbook.rows', { count: rows })}
            </Text>
          </View>

          {rows > 0 ? (
            <View style={Spaces.gap[12]}>
              <ScrollView
                horizontal
                style={{
                  backgroundColor: Colors.neutral900,
                  borderColor: Colors.neutral700,
                  borderRadius: 8,
                  borderWidth: 1,
                  maxHeight: 320,
                  padding: 10,
                }}
              >
                <ScrollView>
                  <Text
                    selectable
                    style={[
                      Fonts.caption,
                      { color: Colors.neutral200, fontFamily: 'monospace' },
                    ]}
                  >
                    {csv}
                  </Text>
                </ScrollView>
              </ScrollView>

              <Button
                onPress={copy}
                title={copied ? t('training.logbook.copied') : t('training.actions.copyLogbook')}
                variant="Primary"
              />
            </View>
          ) : (
            <EmptyState
              description={t('training.logbook.empty')}
              title={t('training.logbook.title')}
            />
          )}
        </View>
      </WithDataWrapper>
    </ScreenContainer>
  );
}

export default TrainingLogbook;
