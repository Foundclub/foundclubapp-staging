import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';

import { getTeamById } from '@/services/team/teamService';

const mapSectionOption = (section) => {
  const value = String(section?.name || section?.label || section?.value || '').trim().toLowerCase();
  if (value.includes('mix')) return { label: 'Mixte', value: 'mixed' };
  if (value.includes('fem')) return { label: 'Feminin', value: 'female' };
  return { label: 'Masculin', value: 'male' };
};

function SquadSourceTeamStep({
  data, onNext, onPrev, updateData, user,
}) {
  const { Colors, Fonts } = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const options = useMemo(
    () => (Array.isArray(user?.trainedTeams)
      ? user.trainedTeams.map((team) => ({
        label: team?.name || 'Equipe',
        value: team?.documentId || team?.id,
      }))
      : []),
    [user?.trainedTeams],
  );

  const selectedValue = data?.sourceTeam?.label || '';
  const isValid = Boolean(data?.sourceTeam?.value);

  const handleSelectTeam = async (item) => {
    updateData('sourceTeam', item || null);
    if (!item?.value) return;

    setIsLoading(true);
    setLoadError('');
    try {
      const team = await getTeamById(item.value);
      updateData('sourceTeamDetails', team || null);
      if (team?.name) updateData('name', team.name);
      if (team?.section) updateData('section', mapSectionOption(team.section));
      if (team?.city) updateData('city', team.city);
      if (team?.address && typeof team.address === 'object') {
        updateData('address', team.address);
      }
    } catch (error) {
      console.error('Error importing source team:', error);
      setLoadError("Impossible d'importer cette équipe pour le moment.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, paddingHorizontal: 16 }}>
      <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 100 }}>
        <Text style={[Fonts.h1, { color: Colors.neutral00, marginBottom: 20, textAlign: 'center' }]}>
          Quelle équipe importer ?
        </Text>
        <Text style={[Fonts.p2, { color: Colors.neutral300, marginBottom: 24, textAlign: 'center' }]}>
          Choisis ton équipe classique pour recuperer le nom et les membres dans League.
        </Text>

        <AutocompleteSelect
          isLoading={isLoading}
          isSearchable={false}
          options={options}
          placeholder="Sélectionner une équipe"
          setValue={handleSelectTeam}
          value={selectedValue}
        />

        {loadError ? (
          <Text style={[Fonts.p3, { color: Colors.error500, marginTop: 12, textAlign: 'center' }]}>
            {loadError}
          </Text>
        ) : null}
      </View>

      <View style={{ gap: 10, marginBottom: 20 }}>
        <Button
          disabled={!isValid || isLoading}
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

export default SquadSourceTeamStep;
