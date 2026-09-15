import i18next from 'i18next';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';

import { getSections } from '@/services/section/sectionService';

/**
 *
 * @param root0
 * @param root0.data
 * @param root0.onNext
 * @param root0.onPrev
 * @param root0.updateData
 */
function SquadSectionStep({
  data, onNext, onPrev, updateData,
}) {
  const { Colors, Fonts } = useTheme();
  const { t } = useTranslation();

  const [sections, setSections] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState('');

  React.useEffect(() => {
    const fetchSections = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const result = await getSections();
        // Map to format { label: name, value: documentId }
        const options = result.map((s) => ({
          label: s.name,
          value: s.documentId,
        }));
        setSections(options);
      } catch (error) {
        setLoadError(i18next.t(
          'squadSectionStep.loadError',
          'Impossible de charger les sections League pour le moment.',
        ));
        setSections([]);
        console.error('Error fetching sections:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSections();
  }, []);

  const isValid = useMemo(() => !!data.section, [data.section]);

  return (
    <View style={{ flex: 1, paddingHorizontal: 16 }}>
      <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 100 }}>
        <Text style={[Fonts.h1, { color: Colors.neutral00, marginBottom: 40, textAlign: 'center' }]}>
          {t('squadSectionStep.title', 'Pour quelle section ?')}
        </Text>

        <AutocompleteSelect
          isLoading={loading}
          isSearchable={false}
          options={sections}
          placeholder={t('squadSectionStep.placeholder', 'Sélectionner une section')}
          setValue={(item) => updateData('section', item)}
          value={data.section?.label}
        />
        {loadError ? (
          <Text style={[Fonts.p3, { color: Colors.error500, marginTop: 12, textAlign: 'center' }]}>
            {loadError}
          </Text>
        ) : null}
      </View>

      <View style={{ gap: 10, marginBottom: 20 }}>
        <Button
          disabled={!isValid}
          onPress={onNext}
          title={t('squadSectionStep.continue', 'Continuer')}
          variant="Primary"
        />
        <Button
          onPress={onPrev}
          title={t('squadSectionStep.back', 'Retour')}
          variant="Secondary"
        />
      </View>
    </View>
  );
}

export default SquadSectionStep;
