import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import useTheme from '@/theme/themeContext';
import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import Button from '@/components/atoms/button/Button';
import { getCategories } from '@/services/category/categoryService';

const SquadCategoryStep = ({ data, updateData, onNext, onPrev }) => {
  const { Colors, Fonts } = useTheme();

  const [categories, setCategories] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchCategories = async () => {
      try {
        const result = await getCategories();
        // Map to format { label: name, value: documentId }
        const options = result.map(c => ({
          label: c.name,
          value: c.documentId
        }));
        setCategories(options);
      } catch (error) {
        console.error('Error fetching categories:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  const isValid = useMemo(() => {
    return !!data.category;
  }, [data.category]);

  return (
    <View style={{ flex: 1, paddingHorizontal: 16 }}>
       <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 100 }}>
          <Text style={[Fonts.h1, { color: Colors.neutral00, textAlign: 'center', marginBottom: 40 }]}>
             Dans quelle catégorie ?
          </Text>

          <AutocompleteSelect
            placeholder="Sélectionner une catégorie"
            options={categories}
            value={data.category?.label}
            setValue={(item) => updateData('category', item)}
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

export default SquadCategoryStep;
