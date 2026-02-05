import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import useTheme from '@/theme/themeContext';
import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import Button from '@/components/atoms/button/Button';
import { getSections } from '@/services/section/sectionService';

const SquadSectionStep = ({ data, updateData, onNext, onPrev }) => {
  const { Colors, Fonts } = useTheme();

  const [sections, setSections] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchSections = async () => {
      try {
        const result = await getSections();
        // Map to format { label: name, value: documentId }
        const options = result.map(s => ({
          label: s.name,
          value: s.documentId
        }));
        setSections(options);
      } catch (error) {
        console.error('Error fetching sections:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSections();
  }, []);

  const isValid = useMemo(() => {
    return !!data.section;
  }, [data.section]);

  return (
    <View style={{ flex: 1, paddingHorizontal: 16 }}>
       <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 100 }}>
          <Text style={[Fonts.h1, { color: Colors.neutral00, textAlign: 'center', marginBottom: 40 }]}>
             Pour quelle section ?
          </Text>

          <AutocompleteSelect
            placeholder="Sélectionner une section"
            options={sections}
            value={data.section?.label}
            setValue={(item) => updateData('section', item)}
            isSearchable={false}
            isLoading={loading}
          />
       </View>

      <View style={{ marginBottom: 20, gap: 10 }}>
        <Button
            title="Continuer"
            onPress={onNext}
            disabled={!isValid}
            variant="Primary"
        />
        <Button
            title="Retour"
            onPress={onPrev}
            variant="Secondary"
        />
      </View>
    </View>
  );
};

export default SquadSectionStep;
