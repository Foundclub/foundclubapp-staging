import React, { useMemo } from 'react';
import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';

import { getActivities } from '@/services/activity/activityService';

/**
 *
 * @param root0
 * @param root0.data
 * @param root0.onNext
 * @param root0.onPrev
 * @param root0.updateData
 */
function SquadSportStep({
  data, onNext, onPrev, updateData,
}) {
  const { Colors, Fonts, Spaces } = useTheme();

  const [sports, setSports] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState('');

  const fetchSports = React.useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const activities = await getActivities({
        filters: {
          isLeague: {
            $eq: true,
          },
        },
      });
      const options = activities.map((a) => ({
        label: a.name,
        value: a.documentId,
      }));
      setSports(options);
    } catch (error) {
      console.error('Error fetching sports:', error);
      setLoadError("Impossible de charger les sports League pour le moment.");
      setSports([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchSports();
  }, [fetchSports]);

  const isValid = useMemo(() => !!data.sport, [data.sport]);

  return (
    <View style={{ flex: 1, paddingHorizontal: 16 }}>
      <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 100 }}>
        <Text style={[Fonts.h1, { color: Colors.neutral00, marginBottom: 40, textAlign: 'center' }]}>
          Quel est votre sport ?
        </Text>

        <AutocompleteSelect
          isLoading={loading}
          isSearchable={false}
          options={sports}
          placeholder="Sélectionner un sport"
          setValue={(item) => updateData('sport', item)}
          value={data.sport?.label}
        />
        {loadError ? (
          <View style={{ marginTop: 16 }}>
            <Text style={[Fonts.p3, { color: Colors.error500, marginBottom: 10, textAlign: 'center' }]}>
              {loadError}
            </Text>
            <Button
              onPress={fetchSports}
              title="Recharger"
              variant="Secondary"
            />
          </View>
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

export default SquadSportStep;
