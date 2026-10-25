import { useNavigation } from '@react-navigation/native';
import { format } from 'date-fns';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import SelectPicker from '@/components/atoms/selectPicker/SelectPicker';
import EventListContent from '@/components/organisms/eventListContent/EventListContent';
import ScreenContainer from '@/components/templates/ScreenContainer';

/**
 * Admin Events screen component
 * @returns {import('react').ReactElement} Admin Events screen component
 */
function AdminEvents() {
  const {
    Alignments,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();

  // Default to today
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Generate date options (e.g., last 7 days + next 7 days)
  const dateOptions = [];
  for (let i = -7; i <= 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    // BH14 P9-10 : le jour LOCAL (toISOString donnait la veille juste après minuit).
    const dateStr = format(d, 'yyyy-MM-dd');
    const label = i === 0 ? t('adminEvents.today', "Aujourd'hui") : d.toLocaleDateString();
    dateOptions.push({ label, value: dateStr });
  }

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.paddingVertical[24],
        Alignments.fill,
      ]}
    >
      <View style={[Spaces.paddingHorizontal[24], Spaces.marginBottom[16]]}>
        <Text style={[Fonts.h1, Fonts.neutral00, Spaces.marginBottom[16]]}>
          {t('adminEvents.title', 'Modération Événements')}
        </Text>
        <SelectPicker
          items={dateOptions}
          onValueChange={setSelectedDate}
          placeholder="Date"
          value={selectedDate}
        />
      </View>

      <View style={[Alignments.fill]}>
        <EventListContent
          additionalFilters={{
            startDateAfter: new Date(`${selectedDate}T00:00:00`),
            startDateBefore: new Date(`${selectedDate}T23:59:59.999`),
          }}
          hideFilters
        />
      </View>
    </ScreenContainer>
  );
}

export default AdminEvents;
