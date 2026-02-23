import { ScrollView, Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

/**
 * @param {{ data: any; onPrev: () => void; onSubmit: () => void; isLoading?: boolean }} props
 */
function SquadSummaryStep({
  data, isLoading = false, onPrev, onSubmit,
}) {
  const { Colors, Fonts, Spaces } = useTheme();

  /** @param {string} dayValue */
  const getDayLabel = (dayValue) => {
    /** @type {Record<string, string>} */
    const DAYS = {
      friday: 'Vendredi',
      monday: 'Lundi',
      saturday: 'Samedi',
      sunday: 'Dimanche',
      thursday: 'Jeudi',
      tuesday: 'Mardi',
      wednesday: 'Mercredi',
    };
    return DAYS[dayValue] || dayValue;
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={[Spaces.gap[24]]}>
        <Text style={[Fonts.p1, { color: Colors.neutral00 }]}>
          Voici le récapitulatif de votre Squad. Tout est bon ?
        </Text>

        {/* Identity Card */}
        <View style={{ backgroundColor: Colors.neutral800, borderRadius: 12, padding: 16 }}>
          <Text style={[Fonts.h4, { color: Colors.gold500, marginBottom: 8 }]}>Identité</Text>

          <View style={{ marginBottom: 8 }}>
            <Text style={{ color: Colors.neutral500, fontSize: 12 }}>Nom de l'équipe</Text>
            <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>{data.name}</Text>
          </View>

          <View style={{ marginBottom: 8 }}>
            <Text style={{ color: Colors.neutral500, fontSize: 12 }}>Sport</Text>
            <Text style={[Fonts.p1, { color: Colors.neutral00 }]}>{data.sport?.label}</Text>
          </View>

          <View style={{ marginBottom: 8 }}>
            <Text style={{ color: Colors.neutral500, fontSize: 12 }}>Catégorie</Text>
            <Text style={[Fonts.p1, { color: Colors.neutral00 }]}>{data.category?.label || 'Non spécifié'}</Text>
          </View>

          <View style={{ marginBottom: 8 }}>
            <Text style={{ color: Colors.neutral500, fontSize: 12 }}>Section</Text>
            <Text style={[Fonts.p1, { color: Colors.neutral00 }]}>{data.section?.label || 'Non spécifié'}</Text>
          </View>

          <View>
            <Text style={{ color: Colors.neutral500, fontSize: 12 }}>Localisation</Text>
            <Text style={[Fonts.p1, { color: Colors.neutral00 }]}>{data.address?.label}</Text>
            <Text style={[Fonts.p2, { color: Colors.neutral500 }]}>
              Rayon :
              {data.radius || 20}
              {' '}
              km
            </Text>
          </View>
        </View>

        {/* Slots Card */}
        <View style={{ backgroundColor: Colors.neutral800, borderRadius: 12, padding: 16 }}>
          <Text style={[Fonts.h4, { color: Colors.gold500, marginBottom: 8 }]}>
            Créneaux (
            {data.slots?.length || 0}
            )
          </Text>
          {data.slots?.map((/** @type {any} */ slot, /** @type {number} */ index) => (
            <View key={index} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ color: Colors.neutral00 }}>{getDayLabel(slot.day)}</Text>
              <Text style={{ color: Colors.neutral00 }}>
                {slot.startTime}
                {' '}
                -
                {' '}
                {slot.endTime}
              </Text>
            </View>
          ))}
          {(!data.slots || data.slots.length === 0) && (
          <Text style={{ color: Colors.neutral500 }}>Aucun créneau défini</Text>
          )}
        </View>

      </ScrollView>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
        <Button
          onPress={onPrev}
          style={{ flex: 1 }}
          title="Retour"
          variant="Secondary"
        />
        <Button
          isLoading={isLoading}
          onPress={onSubmit}
          style={{ backgroundColor: Colors.gold500, flex: 1 }}
          title="Enregistrer"
          variant="Primary"
        />
      </View>
    </View>
  );
}

export default SquadSummaryStep;
