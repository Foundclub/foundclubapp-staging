import React, {
  useEffect, useMemo, useRef, useState,
} from 'react';
import {
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';

const ITEM_HEIGHT = 50;

/**
 * @typedef {{label?: string, value: number}} WheelObjectItem
 */

/**
 * @typedef {number | WheelObjectItem} WheelItem
 */

/**
 * @typedef {object} WheelPickerProps
 * @property {WheelItem[]} data
 * @property {number} selectedValue
 * @property {(value: number) => void} onValueChange
 * @property {(item: number) => string} [formatItem]
 * @property {number} [width]
 * @property {boolean} isOpen
 * @property {number} [visibleItems]
 */

/**
 * Internal Wheel Picker Component.
 * @param {WheelPickerProps} props
 * @returns {import('react').ReactElement}
 */
export function WheelPicker({
  data,
  formatItem,
  isOpen,
  onValueChange,
  selectedValue,
  visibleItems = 5,
  width = 80,
}) {
  const PICKER_HEIGHT = ITEM_HEIGHT * visibleItems;
  const centerOffset = ((visibleItems - 1) * ITEM_HEIGHT) / 2;
  const { Colors, Fonts } = useTheme();
  const scrollRef = useRef(/** @type {ScrollView | null} */ (null));

  const selectedIndex = data.findIndex((item) => {
    if (typeof item === 'object') return item.value === selectedValue;
    return item === selectedValue;
  });

  useEffect(() => {
    if (!scrollRef.current || selectedIndex < 0 || !isOpen) return undefined;
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({
        animated: false,
        y: selectedIndex * ITEM_HEIGHT,
      });
    }, 200);
    return () => clearTimeout(timer);
  }, [isOpen, selectedIndex]);

  /**
   * @param {import('react-native').NativeSyntheticEvent<import('react-native').NativeScrollEvent>} event
   */
  const handleScrollComplete = (event) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const index = Math.round(offsetY / ITEM_HEIGHT);
    const clampedIndex = Math.max(0, Math.min(index, data.length - 1));
    const item = data[clampedIndex];
    if (item === undefined) return;
    const newValue = typeof item === 'object' ? item.value : item;

    if (newValue !== selectedValue) {
      onValueChange(newValue);
    }
  };

  return (
    <View style={[styles.wheelContainer, { height: PICKER_HEIGHT, width }]}>
      <View
        pointerEvents="none"
        style={[
          styles.selectionIndicator,
          {
            backgroundColor: 'rgba(1, 179, 244, 0.14)',
            borderColor: Colors.primary500,
            top: centerOffset,
          },
        ]}
      />

      <ScrollView
        bounces={false}
        contentContainerStyle={{ paddingVertical: centerOffset }}
        decelerationRate="fast"
        nestedScrollEnabled
        onMomentumScrollEnd={handleScrollComplete}
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToAlignment="start"
        snapToInterval={ITEM_HEIGHT}
      >
        {data.map((item, index) => {
          const itemValue = typeof item === 'object' ? item.value : item;
          const itemLabel = typeof item === 'object'
            ? item.label
            : (formatItem ? formatItem(item) : String(item).padStart(2, '0'));
          const isSelected = itemValue === selectedValue;

          return (
            <TouchableOpacity
              activeOpacity={0.7}
              key={`${itemValue}-${index}`}
              onPress={() => {
                onValueChange(itemValue);
                scrollRef.current?.scrollTo({
                  animated: true,
                  y: index * ITEM_HEIGHT,
                });
              }}
              style={[styles.wheelItem, { height: ITEM_HEIGHT }]}
            >
              <Text
                style={[
                  Fonts.p1,
                  {
                    color: isSelected ? Colors.primary500 : Colors.neutral300,
                    textAlign: 'center',
                    width: '100%',
                  },
                  isSelected && styles.selectedItemText,
                ]}
              >
                {itemLabel}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

/**
 * @typedef {'date' | 'time'} DateTimeMode
 */

/**
 * @typedef {'inline' | 'modal'} DateTimeDisplay
 */

/**
 * @typedef {object} DateTimeSelectorProps
 * @property {import('react-native').ViewStyle | import('react-native').ViewStyle[]} [buttonStyle]
 * @property {import('react-native').TextStyle | import('react-native').TextStyle[]} [buttonTextStyle]
 * @property {DateTimeDisplay} [display]
 * @property {string} [label]
 * @property {import('react-native').TextStyle | import('react-native').TextStyle[]} [labelStyle]
 * @property {DateTimeMode} [mode]
 * @property {(date: Date) => void} onChange
 * @property {(payload: {display: DateTimeDisplay, mode: DateTimeMode, value: Date}) => void} [onOpen]
 * @property {Date} value
 */

/**
 * @param {DateTimeSelectorProps} props
 * @returns {import('react').ReactElement}
 */
function DateTimeSelector({
  buttonStyle,
  buttonTextStyle,
  display = 'modal',
  label,
  labelStyle,
  mode = 'date',
  onChange,
  onOpen,
  value,
}) {
  const { Colors, Fonts, Spaces } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [tempDate, setTempDate] = useState(value || new Date());

  const month = tempDate.getMonth();
  const year = tempDate.getFullYear();

  const getFormattedValue = () => {
    if (!value) return 'Selectionner';
    if (mode === 'date') {
      return value.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        weekday: 'short',
        year: 'numeric',
      });
    }
    return value.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const handleOpen = () => {
    const nextDate = value ? new Date(value) : new Date();
    setTempDate(nextDate);
    onOpen?.({
      display,
      mode,
      value: nextDate,
    });
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleConfirm = () => {
    onChange(tempDate);
    handleClose();
  };

  /**
   * @param {number} currentMonth
   * @param {number} currentYear
   * @returns {WheelObjectItem[]}
   */
  const generateDaysWithWeekday = (currentMonth, currentYear) => {
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const weekdays = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    return Array.from({ length: daysInMonth }, (_, index) => {
      const date = new Date(currentYear, currentMonth, index + 1);
      return {
        label: `${weekdays[date.getDay()]} ${index + 1}`,
        value: index + 1,
      };
    });
  };

  const days = useMemo(() => generateDaysWithWeekday(month, year), [month, year]);
  const months = useMemo(() => ([
    { label: 'Jan', value: 0 },
    { label: 'Fev', value: 1 },
    { label: 'Mar', value: 2 },
    { label: 'Avr', value: 3 },
    { label: 'Mai', value: 4 },
    { label: 'Juin', value: 5 },
    { label: 'Juil', value: 6 },
    { label: 'Aout', value: 7 },
    { label: 'Sep', value: 8 },
    { label: 'Oct', value: 9 },
    { label: 'Nov', value: 10 },
    { label: 'Dec', value: 11 },
  ]), []);

  const currentYear = new Date().getFullYear();
  const years = useMemo(() => Array.from({ length: 5 }, (_, index) => currentYear + index), [currentYear]);
  const hours = useMemo(() => Array.from({ length: 24 }, (_, index) => index), []);
  const minutes = useMemo(() => Array.from({ length: 12 }, (_, index) => index * 5), []);
  const isInlineTimeMode = display === 'inline' && mode === 'time';
  const dayWheelWidth = 86;
  const timeWheelWidth = isInlineTimeMode ? 56 : 80;
  const timeSeparatorMargin = isInlineTimeMode ? 4 : 8;

  const inlinePickerPanelStyle = useMemo(
    () => (
      /** @type {import('react-native').ViewStyle} */
      ({
        backgroundColor: 'rgba(1, 179, 244, 0.08)',
        borderColor: 'rgba(1, 179, 244, 0.30)',
        borderRadius: 14,
        borderWidth: 1,
        elevation: 2,
        marginTop: 8,
        overflow: 'hidden',
        padding: isInlineTimeMode ? 10 : 16,
        shadowColor: Colors.primary500,
        shadowOffset: { height: 4, width: 0 },
        shadowOpacity: 0.16,
        shadowRadius: 10,
      })
    ),
    [Colors.primary500, isInlineTimeMode],
  );

  return (
    <View style={[Spaces.marginBottom[16]]}>
      {label && (
        <Text style={[Fonts.p1Bold, Fonts.neutral00, Spaces.marginBottom[8], labelStyle]}>
          {label}
        </Text>
      )}

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={handleOpen}
        style={[
          styles.inputButton,
          {
            backgroundColor: 'rgba(1, 179, 244, 0.08)',
            borderColor: 'rgba(1, 179, 244, 0.26)',
          },
          buttonStyle,
        ]}
      >
        <Text style={[Fonts.p1, Fonts.neutral00, buttonTextStyle]}>{getFormattedValue()}</Text>
      </TouchableOpacity>

      {display === 'inline' && isOpen && (
        <View style={inlinePickerPanelStyle}>
          <View style={[styles.pickersRow, isInlineTimeMode && styles.inlineTimePickersRow]}>
            {mode === 'date' ? (
              <>
                <WheelPicker
                  data={days}
                  isOpen={isOpen}
                  onValueChange={(dayValue) => {
                    const nextDate = new Date(tempDate);
                    nextDate.setDate(dayValue);
                    setTempDate(nextDate);
                    onChange(nextDate);
                  }}
                  selectedValue={tempDate.getDate()}
                  width={dayWheelWidth}
                />
                <WheelPicker
                  data={months}
                  isOpen={isOpen}
                  onValueChange={(monthValue) => {
                    const nextDate = new Date(tempDate);
                    nextDate.setMonth(monthValue);
                    setTempDate(nextDate);
                    onChange(nextDate);
                  }}
                  selectedValue={tempDate.getMonth()}
                  width={90}
                />
                <WheelPicker
                  data={years}
                  isOpen={isOpen}
                  onValueChange={(yearValue) => {
                    const nextDate = new Date(tempDate);
                    nextDate.setFullYear(yearValue);
                    setTempDate(nextDate);
                    onChange(nextDate);
                  }}
                  selectedValue={tempDate.getFullYear()}
                  width={90}
                />
              </>
            ) : (
              <>
                <WheelPicker
                  data={hours}
                  isOpen={isOpen}
                  onValueChange={(hourValue) => {
                    const nextDate = new Date(tempDate);
                    nextDate.setHours(hourValue);
                    setTempDate(nextDate);
                    onChange(nextDate);
                  }}
                  selectedValue={tempDate.getHours()}
                  width={timeWheelWidth}
                />
                <Text style={[Fonts.h2, Fonts.neutral00, { alignSelf: 'center', marginHorizontal: timeSeparatorMargin }]}>:</Text>
                <WheelPicker
                  data={minutes}
                  isOpen={isOpen}
                  onValueChange={(minuteValue) => {
                    const nextDate = new Date(tempDate);
                    nextDate.setMinutes(minuteValue);
                    setTempDate(nextDate);
                    onChange(nextDate);
                  }}
                  selectedValue={tempDate.getMinutes()}
                  width={timeWheelWidth}
                />
              </>
            )}
          </View>
          <Button
            onPress={handleClose}
            style={{
              backgroundColor: 'rgba(1, 179, 244, 0.10)',
              borderColor: Colors.primary500,
              borderWidth: 1,
              marginTop: 16,
            }}
            textStyle={{ color: Colors.primary500 }}
            title="Valider"
            variant="Secondary"
          />
        </View>
      )}

      {display !== 'inline' && (
        <BottomModal
          close={handleClose}
          hideCloseButton
          isVisible={isOpen}
          scrollable={false}
          style={{
            backgroundColor: 'rgba(5, 24, 38, 0.98)',
            borderColor: 'rgba(1, 179, 244, 0.24)',
            borderWidth: 1,
          }}
        >
          <View style={styles.pickersRow}>
            {mode === 'date' ? (
              <>
                <WheelPicker
                  data={days}
                  isOpen={isOpen}
                  onValueChange={(dayValue) => {
                    const nextDate = new Date(tempDate);
                    nextDate.setDate(dayValue);
                    setTempDate(nextDate);
                  }}
                  selectedValue={tempDate.getDate()}
                  width={dayWheelWidth}
                />
                <WheelPicker
                  data={months}
                  isOpen={isOpen}
                  onValueChange={(monthValue) => {
                    const nextDate = new Date(tempDate);
                    nextDate.setMonth(monthValue);
                    setTempDate(nextDate);
                  }}
                  selectedValue={tempDate.getMonth()}
                  width={90}
                />
                <WheelPicker
                  data={years}
                  isOpen={isOpen}
                  onValueChange={(yearValue) => {
                    const nextDate = new Date(tempDate);
                    nextDate.setFullYear(yearValue);
                    setTempDate(nextDate);
                  }}
                  selectedValue={tempDate.getFullYear()}
                  width={90}
                />
              </>
            ) : (
              <>
                <WheelPicker
                  data={hours}
                  isOpen={isOpen}
                  onValueChange={(hourValue) => {
                    const nextDate = new Date(tempDate);
                    nextDate.setHours(hourValue);
                    setTempDate(nextDate);
                  }}
                  selectedValue={tempDate.getHours()}
                  width={80}
                />
                <Text style={[Fonts.h2, Fonts.neutral00, { alignSelf: 'center', marginHorizontal: 8 }]}>:</Text>
                <WheelPicker
                  data={minutes}
                  isOpen={isOpen}
                  onValueChange={(minuteValue) => {
                    const nextDate = new Date(tempDate);
                    nextDate.setMinutes(minuteValue);
                    setTempDate(nextDate);
                  }}
                  selectedValue={tempDate.getMinutes()}
                  width={80}
                />
              </>
            )}
          </View>

          <View style={[Spaces.marginTop[16], Spaces.marginBottom[24]]}>
            <Button
              onPress={handleConfirm}
              title="Confirmer"
              variant="Primary"
            />
          </View>
        </BottomModal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  inlineTimePickersRow: {
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  inputButton: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  pickersRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  selectedItemText: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
  },
  selectionIndicator: {
    borderRadius: 8,
    borderWidth: 1.5,
    height: ITEM_HEIGHT,
    left: 2,
    position: 'absolute',
    right: 2,
    zIndex: -1,
  },
  wheelContainer: {
    marginHorizontal: 2,
    overflow: 'hidden',
  },
  wheelItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default DateTimeSelector;
