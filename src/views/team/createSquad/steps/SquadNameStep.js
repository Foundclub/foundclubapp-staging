import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Text, TouchableOpacity, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Input from '@/components/molecules/input/Input';

import { checkTeamNameUnique } from '@/services/leagueTeam/leagueTeamService';

const NAME_MIN_LENGTH = 3;
const NAME_CHECK_DEBOUNCE_MS = 400;

const sanitizeTeamName = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const buildSuggestionCandidates = (baseName) => {
  const clean = sanitizeTeamName(baseName);
  if (!clean) return [];

  const currentYear = new Date().getFullYear();
  return [
    `${clean} FC`,
    `${clean} Club`,
    `${clean} ${currentYear}`,
    `${clean} Elite`,
    `${clean} United`,
  ];
};

/**
 *
 * @param root0
 * @param root0.data
 * @param root0.onNext
 * @param root0.updateData
 */
function SquadNameStep({ data, onNext, updateData }) {
  const { Colors, Fonts } = useTheme();
  const [nameCheckState, setNameCheckState] = useState('idle'); // idle | checking | available | taken | error
  const [nameMessage, setNameMessage] = useState('');
  const [nameSuggestions, setNameSuggestions] = useState([]);
  const normalizedName = useMemo(() => sanitizeTeamName(data.name), [data.name]);

  useEffect(() => {
    let isCancelled = false;

    const runNameCheck = async () => {
      if (normalizedName.length < NAME_MIN_LENGTH) {
        setNameCheckState('idle');
        setNameMessage('');
        setNameSuggestions([]);
        return;
      }

      setNameCheckState('checking');
      setNameMessage('Verification du nom...');
      setNameSuggestions([]);

      try {
        const isUnique = await checkTeamNameUnique(normalizedName);
        if (isCancelled) return;

        if (isUnique) {
          setNameCheckState('available');
          setNameMessage('Nom disponible.');
          setNameSuggestions([]);
          return;
        }

        setNameCheckState('taken');
        setNameMessage('Ce nom est déjà pris. Choisis un autre nom.');

        const candidates = buildSuggestionCandidates(normalizedName);
        const availabilityChecks = await Promise.all(
          candidates.map(async (candidate) => ({
            candidate,
            isUnique: await checkTeamNameUnique(candidate),
          })),
        );
        if (isCancelled) return;

        const availableSuggestions = availabilityChecks
          .filter((entry) => entry.isUnique)
          .map((entry) => entry.candidate)
          .slice(0, 3);

        setNameSuggestions(availableSuggestions);
      } catch (_error) {
        if (isCancelled) return;
        setNameCheckState('error');
        setNameMessage('Impossible de vérifier le nom maintenant. Réessaie.');
        setNameSuggestions([]);
      }
    };

    const timer = setTimeout(runNameCheck, NAME_CHECK_DEBOUNCE_MS);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [normalizedName]);

  const canContinue = useMemo(() => (
    normalizedName.length >= NAME_MIN_LENGTH && nameCheckState === 'available'
  ), [nameCheckState, normalizedName.length]);

  return (
    <View style={{ flex: 1, paddingHorizontal: 16 }}>
      <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 100 }}>
        <Text style={[Fonts.h1, { color: Colors.neutral00, marginBottom: 40, textAlign: 'center' }]}>
          Quel est le nom de votre squad ?
        </Text>

        <Input
          autoFocus
          error={nameCheckState === 'taken' || nameCheckState === 'error' ? nameMessage : ''}
          onChangeText={(text) => updateData('name', text)}
          placeholder="Ex: FC Les Champions"
          placeholderTextColor={Colors.neutral500}
          style={{ textAlign: 'center' }}
          value={data.name}
        />

        {nameCheckState === 'checking' ? (
          <View style={{
            alignItems: 'center', flexDirection: 'row', justifyContent: 'center', marginTop: 12,
          }}
          >
            <ActivityIndicator color={Colors.primary500} size="small" />
            <Text style={[Fonts.p3, { color: Colors.neutral200, marginLeft: 8 }]}>
              {nameMessage}
            </Text>
          </View>
        ) : null}

        {nameCheckState === 'available' ? (
          <Text style={[Fonts.p3, { color: Colors.success500, marginTop: 12, textAlign: 'center' }]}>
            {nameMessage}
          </Text>
        ) : null}

        {nameSuggestions.length > 0 ? (
          <View style={{ marginTop: 14 }}>
            <Text style={[Fonts.p3Bold, { color: Colors.neutral200, marginBottom: 8, textAlign: 'center' }]}>
              Suggestions disponibles
            </Text>
            <View style={{
              alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center',
            }}
            >
              {nameSuggestions.map((suggestion) => (
                <TouchableOpacity
                  key={suggestion}
                  onPress={() => updateData('name', suggestion)}
                  style={{
                    backgroundColor: 'rgba(1, 179, 244, 0.12)',
                    borderColor: 'rgba(1, 179, 244, 0.45)',
                    borderRadius: 999,
                    borderWidth: 1,
                    marginHorizontal: 4,
                    marginVertical: 4,
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                  }}
                >
                  <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}
      </View>

      <Button
        disabled={!canContinue}
        onPress={() => {
          updateData('name', normalizedName);
          onNext();
        }}
        style={{ marginBottom: 20 }}
        title="Continuer"
        variant="Primary"
      />
    </View>
  );
}

export default SquadNameStep;
