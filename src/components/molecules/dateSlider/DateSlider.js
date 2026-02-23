import {
  addDays, addMonths, format, getMonth, getYear, isSameDay, setMonth, setYear, startOfDay, startOfMonth, startOfWeek, subMonths,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import React, {
  useEffect, useMemo, useRef, useState,
} from 'react';
import {
  FlatList, Image, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import BottomModal from '@/components/molecules/bottomModal/BottomModal';

/**
 * DateSlider component
 * Custom implementation using FlatList to ensure day names slide with dates
 * and to provide a dynamic month header with picker.
 * @param {object} props
 * @param {Date} props.selectedDate - The currently selected date
 * @param {Function} props.onDateSelected - Callback when a date is selected
 */
function DateSlider({ onDateSelected, selectedDate }) {
  const {
    Colors, Fonts, Images, Spaces,
  } = useTheme();
  const flatListRef = useRef(null);
  const [currentMonth, setCurrentMonth] = useState(selectedDate || new Date());
  const [baseDate, setBaseDate] = useState(startOfDay(new Date())); // Anchor for the list generation
  const [isMonthPickerVisible, setIsMonthPickerVisible] = useState(false);
  const [pickerDate, setPickerDate] = useState(new Date()); // Date used inside the picker

  // Generate dates: Start from baseDate - 15 days, go +120 days
  const dates = useMemo(() => {
    const start = addDays(baseDate, -15);
    const days = [];
    for (let i = 0; i < 120; i++) {
      days.push(addDays(start, i));
    }
    return days;
  }, [baseDate]);

  // Find initial index to scroll to
  const initialScrollIndex = useMemo(() => {
    // If selectedDate is in the list, scroll to it.
    // Otherwise, scroll to baseDate (which is usually today or the start of selected month)
    const index = dates.findIndex((d) => isSameDay(d, selectedDate));
    if (index !== -1) return index;

    const baseIndex = dates.findIndex((d) => isSameDay(d, baseDate));
    return baseIndex !== -1 ? baseIndex : 0;
  }, [dates, selectedDate, baseDate]);

  // Handle scroll to update month header
  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      const firstItem = viewableItems[0];
      setCurrentMonth(firstItem.item);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  // Scroll to selected date when it changes externally
  useEffect(() => {
    if (flatListRef.current && initialScrollIndex !== -1) {
      // We can't always scroll immediately if the list is re-rendering
      // But initialScrollIndex prop handles the mount case.
      // For updates, we might need a small timeout or check layout.
      flatListRef.current.scrollToIndex({ animated: true, index: initialScrollIndex });
    }
  }, [selectedDate, initialScrollIndex]);

  const handleMonthSelect = (newMonthIndex) => {
    const newDate = setMonth(pickerDate, newMonthIndex);
    setPickerDate(newDate);
  };

  const handleYearChange = (increment) => {
    const newDate = addMonths(pickerDate, increment * 12); // Add/Sub 1 year
    setPickerDate(newDate);
  };

  const confirmMonthSelection = () => {
    const newBase = startOfMonth(pickerDate);
    setBaseDate(newBase); // Regenerate list around this month
    onDateSelected(newBase); // Select the 1st of the month
    setIsMonthPickerVisible(false);
  };

  const openMonthPicker = () => {
    setPickerDate(currentMonth);
    setIsMonthPickerVisible(true);
  };

  const renderItem = ({ item }) => {
    const isSelected = isSameDay(item, selectedDate);
    const isToday = isSameDay(item, new Date());

    return (
      <TouchableOpacity
        onPress={() => onDateSelected(item)}
        style={styles.itemContainer}
      >
        <Text style={[
          Fonts.p2,
          {
            color: Colors.neutral200,
            marginBottom: 8,
            textTransform: 'uppercase',
          },
        ]}
        >
          {format(item, 'EEE', { locale: fr }).replace('.', '')}
        </Text>

        <View style={[
          styles.dateCircle,
          isSelected && { backgroundColor: Colors.primary500 },
          !isSelected && isToday && { borderColor: Colors.primary500, borderWidth: 1 },
        ]}
        >
          <Text style={[
            Fonts.h3,
            {
              color: isSelected ? Colors.neutral900 : Colors.neutral00,
              lineHeight: 24,
            },
          ]}
          >
            {format(item, 'd')}
          </Text>
        </View>

        {/* Event Indicator Dot (if needed later, currently handled in Week View) */}
      </TouchableOpacity>
    );
  };

  const months = Array.from({ length: 12 }, (_, i) => i);

  return (
    <View style={styles.container}>
      {/* Month Header with Dropdown Trigger */}
      <TouchableOpacity
        onPress={openMonthPicker}
        style={[
          { alignItems: 'center', flexDirection: 'row', marginBottom: 16 },
        ]}
      >
        <Text style={[
          Fonts.h3,
          { color: Colors.neutral00, marginRight: 8, textTransform: 'capitalize' },
        ]}
        >
          {format(currentMonth, 'MMMM yyyy', { locale: fr })}
        </Text>
        <Text style={{ color: Colors.primary500, fontSize: 12 }}>▼</Text>
      </TouchableOpacity>

      {/* Date Strip */}
      <FlatList
        contentContainerStyle={{ paddingHorizontal: 10 }}
        data={dates}
        getItemLayout={(data, index) => (
          { index, length: 60, offset: 60 * index }
        )}
        horizontal
        initialScrollIndex={initialScrollIndex}
        keyExtractor={(item) => item.toISOString()}
        onScrollToIndexFailed={(info) => {
          const wait = new Promise((resolve) => setTimeout(resolve, 500));
          wait.then(() => {
            flatListRef.current?.scrollToIndex({ animated: true, index: info.index });
          });
        }}
        onViewableItemsChanged={onViewableItemsChanged}
        ref={flatListRef}
        renderItem={renderItem}
        showsHorizontalScrollIndicator={false}
        viewabilityConfig={viewabilityConfig}
      />

      {/* Month Picker Modal */}
      <BottomModal
        close={() => setIsMonthPickerVisible(false)}
        isVisible={isMonthPickerVisible}
        style={{ backgroundColor: Colors.neutral900 }}
      >
        <View style={{ paddingBottom: 20 }}>
          {/* Year Selector */}
          <View style={{
            alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20,
          }}
          >
            <TouchableOpacity onPress={() => handleYearChange(-1)} style={{ padding: 10 }}>
              <Text style={[Fonts.h2, { color: Colors.primary500 }]}>{'<'}</Text>
            </TouchableOpacity>
            <Text style={[Fonts.h2, { color: Colors.neutral00 }]}>{format(pickerDate, 'yyyy')}</Text>
            <TouchableOpacity onPress={() => handleYearChange(1)} style={{ padding: 10 }}>
              <Text style={[Fonts.h2, { color: Colors.primary500 }]}>{'>'}</Text>
            </TouchableOpacity>
          </View>

          {/* Months Grid */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {months.map((monthIndex) => {
              const isSelectedMonth = getMonth(pickerDate) === monthIndex;
              const monthDate = setMonth(new Date(), monthIndex);
              return (
                <TouchableOpacity
                  key={monthIndex}
                  onPress={() => handleMonthSelect(monthIndex)}
                  style={{
                        alignItems: 'center',
                        backgroundColor: isSelectedMonth ? Colors.primary500 : Colors.neutral800,
                        borderRadius: 8,
                        marginBottom: 10,
                        paddingVertical: 12,
                        width: '30%',
                      }}
                >
                  <Text style={[
                        Fonts.p3Bold,
                        { color: isSelectedMonth ? Colors.neutral900 : Colors.neutral00, textTransform: 'capitalize' },
                      ]}
                      >
                        {format(monthDate, 'MMM', { locale: fr })}
                      </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Confirm Button */}
          <TouchableOpacity
            onPress={confirmMonthSelection}
            style={{
              alignItems: 'center',
              backgroundColor: Colors.primary500,
              borderRadius: 25,
              marginTop: 20,
              paddingVertical: 16,
            }}
          >
            <Text style={[Fonts.h4Bold, { color: Colors.neutral900 }]}>Valider</Text>
          </TouchableOpacity>
        </View>
      </BottomModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // height: 120,
  },
  dateCircle: {
    alignItems: 'center',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  itemContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
  },
});

export default DateSlider;
