import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

/**
 * @param {{ data: any; onPrev: () => void; onSubmit: () => void; isLoading?: boolean; submitError?: string }} props
 */
function SquadSummaryStep({
  data, isLoading = false, onPrev, onSubmit, submitError = '',
}) {
  const { Colors, Fonts, Spaces } = useTheme();
  const { t } = useTranslation();

  /** @param {string} dayValue */
  const getDayLabel = (dayValue) => {
    /** @type {Record<string, string>} */
    const DAYS = {
      friday: t('squadSummaryStep.days.friday', 'Vendredi'),
      monday: t('squadSummaryStep.days.monday', 'Lundi'),
      saturday: t('squadSummaryStep.days.saturday', 'Samedi'),
      sunday: t('squadSummaryStep.days.sunday', 'Dimanche'),
      thursday: t('squadSummaryStep.days.thursday', 'Jeudi'),
      tuesday: t('squadSummaryStep.days.tuesday', 'Mardi'),
      wednesday: t('squadSummaryStep.days.wednesday', 'Mercredi'),
    };
    return DAYS[dayValue] || dayValue;
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={[Spaces.gap[24]]}>
        <Text style={[Fonts.p1, { color: Colors.neutral00 }]}>
          {t('squadSummaryStep.intro', 'Voici le récapitulatif de ta Squad. Tout est bon ?')}
        </Text>

        {/* Identity Card */}
        <View style={{ backgroundColor: Colors.neutral800, borderRadius: 12, padding: 16 }}>
          <Text style={[Fonts.h4, { color: Colors.gold500, marginBottom: 8 }]}>
            {t('squadSummaryStep.identity.title', 'Identité')}
          </Text>

          <View style={{ marginBottom: 8 }}>
            <Text style={{ color: Colors.neutral500, fontSize: 12 }}>
              {t('squadSummaryStep.identity.name', "Nom de l'équipe")}
            </Text>
            <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>{data.name}</Text>
          </View>

          <View style={{ marginBottom: 8 }}>
            <Text style={{ color: Colors.neutral500, fontSize: 12 }}>
              {t('squadSummaryStep.identity.sport', 'Sport')}
            </Text>
            <Text style={[Fonts.p1, { color: Colors.neutral00 }]}>{data.sport?.label}</Text>
          </View>

          <View style={{ marginBottom: 8 }}>
            <Text style={{ color: Colors.neutral500, fontSize: 12 }}>
              {t('squadSummaryStep.identity.category', 'Catégorie')}
            </Text>
            <Text style={[Fonts.p1, { color: Colors.neutral00 }]}>
              {data.category?.label || t('squadSummaryStep.identity.notSpecified', 'Non spécifié')}
            </Text>
          </View>

          <View style={{ marginBottom: 8 }}>
            <Text style={{ color: Colors.neutral500, fontSize: 12 }}>
              {t('squadSummaryStep.identity.section', 'Section')}
            </Text>
            <Text style={[Fonts.p1, { color: Colors.neutral00 }]}>
              {data.section?.label || t('squadSummaryStep.identity.notSpecified', 'Non spécifié')}
            </Text>
          </View>

          <View>
            <Text style={{ color: Colors.neutral500, fontSize: 12 }}>
              {t('squadSummaryStep.identity.location', 'Localisation')}
            </Text>
            <Text style={[Fonts.p1, { color: Colors.neutral00 }]}>{data.address?.label}</Text>
            <Text style={[Fonts.p2, { color: Colors.neutral500 }]}>
              {t(
                'squadSummaryStep.identity.radius',
                'Rayon :{{radius}} km',
                { radius: data.radius || 20 },
              )}
            </Text>
          </View>
        </View>

        {/* Slots Card */}
        <View style={{ backgroundColor: Colors.neutral800, borderRadius: 12, padding: 16 }}>
          <Text style={[Fonts.h4, { color: Colors.gold500, marginBottom: 8 }]}>
            {t(
              'squadSummaryStep.slots.title',
              'Créneaux ({{total}})',
              { total: data.slots?.length || 0 },
            )}
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
          <Text style={{ color: Colors.neutral500 }}>
            {t('squadSummaryStep.slots.empty', 'Aucun créneau défini')}
          </Text>
          )}
        </View>

        {submitError ? (
          <View style={{ backgroundColor: 'rgba(255, 40, 79, 0.12)', borderRadius: 12, padding: 16 }}>
            <Text style={[Fonts.p2Bold, { color: Colors.error500, marginBottom: 4 }]}>
              {t('squadSummaryStep.submitError', 'Création impossible')}
            </Text>
            <Text style={[Fonts.p2, { color: Colors.neutral100 }]}>{submitError}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
        <Button
          onPress={onPrev}
          style={{ flex: 1 }}
          title={t('squadSummaryStep.back', 'Retour')}
          variant="Secondary"
        />
        <Button
          isLoading={isLoading}
          onPress={onSubmit}
          style={{ backgroundColor: Colors.gold500, flex: 1 }}
          title={t('squadSummaryStep.save', 'Enregistrer')}
          variant="Primary"
        />
      </View>
    </View>
  );
}

export default SquadSummaryStep;
