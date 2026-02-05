import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import useTheme from '@/theme/themeContext';
import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import Button from '@/components/atoms/button/Button';
import { getActivities } from '@/services/activity/activityService';

const SquadSportStep = ({ data, updateData, onNext, onPrev }) => {
  const { Colors, Fonts, Spaces } = useTheme();

  const [sports, setSports] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchSports = async () => {
      try {
        const activities = await getActivities({
          filters: {
            isLeague: {
              $eq: true
            }
          }
        });
        // Map to format { label: name, value: documentId or id }
        // The service returns the data array directly validated
        const options = activities.map(a => ({
          label: a.name,
          value: a.documentId
        }));
        setSports(options);
      } catch (error) {
        console.error('Error fetching sports:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSports();
  }, []);

  const isValid = useMemo(() => {
    return !!data.sport;
  }, [data.sport]);

  return (
    <View style={{ flex: 1, paddingHorizontal: 16 }}>
       <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 100 }}>
          <Text style={[Fonts.h1, { color: Colors.neutral00, textAlign: 'center', marginBottom: 40 }]}>
             Quel est votre sport ?
          </Text>

          <AutocompleteSelect
            placeholder="Sélectionner un sport"
            options={sports}
            value={data.sport?.label}
            setValue={(item) => updateData('sport', item)}
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

export default SquadSportStep;
