import React, { useMemo } from 'react';
import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';

import { getCategories } from '@/services/category/categoryService';

/**
 *
 * @param root0
 * @param root0.data
 * @param root0.onNext
 * @param root0.onPrev
 * @param root0.updateData
 */
function SquadCategoryStep({
  data, onNext, onPrev, updateData,
}) {
  const { Colors, Fonts } = useTheme();

  const [categories, setCategories] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState('');

  React.useEffect(() => {
    const fetchCategories = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const result = await getCategories();
        // Map to format { label: name, value: documentId }
        const options = result.map((c) => ({
          label: c.name,
          value: c.documentId,
        }));
        setCategories(options);
      } catch (error) {
        setLoadError("Impossible de charger les categories League pour le moment.");
        setCategories([]);
        console.error('Error fetching catégories:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  const isValid = useMemo(() => !!data.category, [data.category]);

  return (
    <View style={{ flex: 1, paddingHorizontal: 16 }}>
      <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 100 }}>
        <Text style={[Fonts.h1, { color: Colors.neutral00, marginBottom: 40, textAlign: 'center' }]}>
          Dans quelle catégorie ?
        </Text>

        <AutocompleteSelect
          isLoading={loading}
          isSearchable={false}
          options={categories}
          placeholder="Sélectionner une catégorie"
          setValue={(item) => updateData('category', item)}
          value={data.category?.label}
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
          title="Continuer"
          variant="Primary"
        />
        <Button
          onPress={onPrev}
          title="Retour"
          variant="Secondary"
        />
      </View>
    </View>
  );
}

export default SquadCategoryStep;
