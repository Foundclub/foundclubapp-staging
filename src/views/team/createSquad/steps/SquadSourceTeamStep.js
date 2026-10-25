import i18next from 'i18next';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';

import { getTeamById } from '@/services/team/teamService';

const mapSectionOption = (section) => {
  // C04 Q4-16 — sans accents : « Féminine » ne contenait pas « fem » et devenait Masculin.
  const value = String(section?.name || section?.label || section?.value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (value.includes('mix')) {
    return { label: i18next.t('squadSourceTeamStep.sections.mixed', 'Mixte'), value: 'mixed' };
  }
  if (value.includes('fem')) {
    return {
      label: i18next.t('squadSourceTeamStep.sections.female', 'Feminin'),
      value: 'female',
    };
  }
  return { label: i18next.t('squadSourceTeamStep.sections.male', 'Masculin'), value: 'male' };
};

function SquadSourceTeamStep({
  data, onNext, onPrev, updateData, user,
}) {
  const { Colors, Fonts } = useTheme();
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  // P12-16 : seule la derniere equipe choisie a le droit d'importer.
  const lastRequestRef = useRef(0);

  const options = useMemo(
    () => (Array.isArray(user?.trainedTeams)
      ? user.trainedTeams.map((team) => ({
        label: team?.name || i18next.t('squadSourceTeamStep.teamFallback', 'Equipe'),
        value: team?.documentId || team?.id,
      }))
      : []),
    [user?.trainedTeams],
  );

  const selectedValue = data?.sourceTeam?.label || '';
  const isValid = Boolean(data?.sourceTeam?.value);

  const handleSelectTeam = async (item) => {
    updateData('sourceTeam', item || null);
    lastRequestRef.current += 1;
    const requestId = lastRequestRef.current;
    if (!item?.value) return;

    setIsLoading(true);
    setLoadError('');
    try {
      const team = await getTeamById(item.value);
      if (requestId !== lastRequestRef.current) return;
      updateData('sourceTeamDetails', team || null);
      if (team?.name) updateData('name', team.name);
      if (team?.section) updateData('section', mapSectionOption(team.section));
      if (team?.city) updateData('city', team.city);
      if (team?.address && typeof team.address === 'object') {
        updateData('address', team.address);
      }
    } catch (error) {
      if (requestId !== lastRequestRef.current) return;
      console.error('Error importing source team:', error);
      setLoadError(t(
        'squadSourceTeamStep.importError',
        "Impossible d'importer cette équipe pour le moment.",
      ));
    } finally {
      if (requestId === lastRequestRef.current) setIsLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, paddingHorizontal: 16 }}>
      <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 100 }}>
        <Text style={[Fonts.h1, { color: Colors.neutral00, marginBottom: 20, textAlign: 'center' }]}>
          {t('squadSourceTeamStep.title', 'Quelle équipe importer ?')}
        </Text>
        <Text style={[Fonts.p2, { color: Colors.neutral300, marginBottom: 24, textAlign: 'center' }]}>
          {t(
            'squadSourceTeamStep.subtitle',
            'Choisis ton équipe classique pour recuperer le nom et les membres dans League.',
          )}
        </Text>

        <AutocompleteSelect
          isLoading={isLoading}
          isSearchable={false}
          options={options}
          placeholder={t('squadSourceTeamStep.placeholder', 'Sélectionner une équipe')}
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
          title={t('squadSourceTeamStep.continue', 'Continuer')}
          variant="Primary"
        />
        <Button
          onPress={onPrev}
          title={t('squadSourceTeamStep.back', 'Retour')}
          variant="Secondary"
        />
      </View>
    </View>
  );
}

export default SquadSourceTeamStep;
