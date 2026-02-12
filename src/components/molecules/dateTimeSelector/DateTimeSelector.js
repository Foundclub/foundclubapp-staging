import React, { useState, useRef, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import useTheme from '@/theme/themeContext';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import Button from '@/components/atoms/button/Button';

// Move constants inside component or calculate dynamically
const ITEM_HEIGHT = 50;

/**
 * Internal Wheel Picker Component
 */
export const WheelPicker = ({ data, selectedValue, onValueChange, formatItem, width = 80, isOpen, visibleItems = 5 }) => {
  const PICKER_HEIGHT = ITEM_HEIGHT * visibleItems;
  const centerOffset = (visibleItems - 1) * ITEM_HEIGHT / 2;
  const { Colors, Fonts } = useTheme();
  const scrollRef = useRef(null);
  const selectedIndex = data.findIndex(item => 
    typeof item === 'object' ? item.value === selectedValue : item === selectedValue
  );

  // Initial scroll
  useEffect(() => {
    if (scrollRef.current && selectedIndex >= 0 && isOpen) {
        // For inline usage, we might not need isOpen check, but let's keep it safe
        // Use timeout to ensure layout is ready
      const timer = setTimeout(() => {
        scrollRef.current?.scrollTo({ 
          y: selectedIndex * ITEM_HEIGHT, 
          animated: false 
        });
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen]); // If used inline, isOpen might always be true or undefined. If undefined, we might need another trigger.

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
    <View style={[styles.wheelContainer, { width, height: PICKER_HEIGHT }]}>
      {/* Selection Indicator */}
      <View style={[styles.selectionIndicator, { 
        top: centerOffset,
        backgroundColor: 'rgba(1, 179, 244, 0.14)',
        borderColor: Colors.primary500
      }]} pointerEvents="none" />
      
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        bounces={false}
        onMomentumScrollEnd={handleScrollComplete}
        contentContainerStyle={{ paddingVertical: centerOffset }}
        nestedScrollEnabled={true} // Important for nesting in Android
      >
        {data.map((item, index) => {
            const itemValue = typeof item === 'object' ? item.value : item;
            const itemLabel = typeof item === 'object' ? item.label : formatItem ? formatItem(item) : String(item).padStart(2, '0');
            const isSelected = itemValue === selectedValue;
            return (
                <TouchableOpacity 
                    key={index}
                    style={[styles.wheelItem, { height: ITEM_HEIGHT }]}
                    onPress={() => {
                        onValueChange(itemValue);
                        scrollRef.current?.scrollTo({
                            y: index * ITEM_HEIGHT,
                            animated: true
                        });
                    }}
                    activeOpacity={0.7}
                >
                    <Text style={[
                        Fonts.p1,
                        { color: isSelected ? Colors.primary500 : Colors.neutral300 },
                        isSelected && styles.selectedItemText
                    ]}>
                        {itemLabel}
                    </Text>
                </TouchableOpacity>
            );
        })}
      </ScrollView>
    </View>
  );
};

const DateTimeSelector = ({
  buttonStyle,
  buttonTextStyle,
  display = 'modal',
  label,
  labelStyle,
  mode = 'date',
  onChange,
  value,
}) => {
  const { Colors, Fonts, Spaces } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [tempDate, setTempDate] = useState(value || new Date());

  const getFormattedValue = () => {
    if (!value) return 'Sélectionner';
    if (mode === 'date') {
      return value.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    }
    return value.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const handleOpen = () => {
    setTempDate(value ? new Date(value) : new Date());
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleConfirm = () => {
    onChange(tempDate);
    handleClose();
  };

  // Generate data
  const generateDaysWithWeekday = (month, year) => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const weekdays = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    return Array.from({ length: daysInMonth }, (_, i) => {
      const date = new Date(year, month, i + 1);
      return {
        value: i + 1,
        label: `${weekdays[date.getDay()]} ${i + 1}`
      };
    });
  };
  
  const days = useMemo(() => generateDaysWithWeekday(tempDate.getMonth(), tempDate.getFullYear()), [tempDate.getMonth(), tempDate.getFullYear()]);
  const months = useMemo(() => [
    { label: 'Jan', value: 0 }, { label: 'Fév', value: 1 }, { label: 'Mar', value: 2 },
    { label: 'Avr', value: 3 }, { label: 'Mai', value: 4 }, { label: 'Juin', value: 5 },
    { label: 'Juil', value: 6 }, { label: 'Août', value: 7 }, { label: 'Sep', value: 8 },
    { label: 'Oct', value: 9 }, { label: 'Nov', value: 10 }, { label: 'Déc', value: 11 }
  ], []);
  
  const currentYear = new Date().getFullYear();
  const years = useMemo(() => Array.from({ length: 5 }, (_, i) => currentYear + i), [currentYear]);
  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const minutes = useMemo(() => Array.from({ length: 12 }, (_, i) => i * 5), []);
  const isInlineTimeMode = display === 'inline' && mode === 'time';
  const timeWheelWidth = isInlineTimeMode ? 56 : 80;
  const timeSeparatorMargin = isInlineTimeMode ? 4 : 8;
  const inlinePickerPanelStyle = useMemo(() => ({
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(1, 179, 244, 0.30)',
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 8,
    padding: isInlineTimeMode ? 10 : 16,
    shadowColor: Colors.primary500,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 2,
    overflow: 'hidden',
  }), [Colors.primary500, isInlineTimeMode]);

  return (
    <View style={[Spaces.marginBottom[16]]}>
      {label && (
        <Text style={[Fonts.p1Bold, Fonts.neutral00, Spaces.marginBottom[8], labelStyle]}>
          {label}
        </Text>
      )}

      {/* Button to open Modal/Toggle Inline */}
      <TouchableOpacity
        onPress={handleOpen}
        style={[
          styles.inputButton,
          { borderColor: Colors.neutral700, backgroundColor: Colors.neutral800 },
          buttonStyle,
        ]}
        activeOpacity={0.8}
      >
        <Text style={[Fonts.p1, Fonts.neutral00, buttonTextStyle]}>{getFormattedValue()}</Text>
      </TouchableOpacity>

      {/* Inline Content */}
      {display === 'inline' && isOpen && (
          <View style={inlinePickerPanelStyle}>
             <View style={[styles.pickersRow, isInlineTimeMode && styles.inlineTimePickersRow]}>
                {mode === 'date' ? (
                <>
                    <WheelPicker
                    data={days}
                    selectedValue={tempDate.getDate()}
                    onValueChange={(d) => {
                        const newDate = new Date(tempDate);
                        newDate.setDate(d);
                        setTempDate(newDate);
                        if(display === 'inline') onChange(newDate); // Immediate update for inline
                    }}
                    width={70}
                    isOpen={isOpen}
                    />
                    <WheelPicker
                    data={months}
                    selectedValue={tempDate.getMonth()}
                    onValueChange={(m) => {
                        const newDate = new Date(tempDate);
                        newDate.setMonth(m);
                        setTempDate(newDate);
                        if(display === 'inline') onChange(newDate); // Immediate update for inline
                    }}
                    width={90}
                    isOpen={isOpen}
                    />
                    <WheelPicker
                    data={years}
                    selectedValue={tempDate.getFullYear()}
                    onValueChange={(y) => {
                        const newDate = new Date(tempDate);
                        newDate.setFullYear(y);
                        setTempDate(newDate);
                        if(display === 'inline') onChange(newDate); // Immediate update for inline
                    }}
                    width={90}
                    isOpen={isOpen}
                    />
                </>
                ) : (
                <>
                    <WheelPicker
                    data={hours}
                    selectedValue={tempDate.getHours()}
                    onValueChange={(h) => {
                        const newDate = new Date(tempDate);
                        newDate.setHours(h);
                        setTempDate(newDate);
                        if(display === 'inline') onChange(newDate); // Immediate update for inline
                    }}
                    width={timeWheelWidth}
                    isOpen={isOpen}
                    />
                    <Text style={[Fonts.h2, Fonts.neutral00, { alignSelf: 'center', marginHorizontal: timeSeparatorMargin }]}>:</Text>
                    <WheelPicker
                    data={minutes}
                    selectedValue={tempDate.getMinutes()}
                    onValueChange={(m) => {
                        const newDate = new Date(tempDate);
                        newDate.setMinutes(m);
                        setTempDate(newDate);
                        if(display === 'inline') onChange(newDate); // Immediate update for inline
                    }}
                    width={timeWheelWidth}
                    isOpen={isOpen}
                    />
                </>
                )}
            </View>
            <Button 
                variant="Secondary" 
                title="Valider" 
                onPress={handleClose} 
                style={{
                  marginTop: 16,
                  backgroundColor: 'rgba(1, 179, 244, 0.10)',
                  borderColor: Colors.primary500,
                  borderWidth: 1,
                }}
                textStyle={{ color: Colors.primary500 }}
            />
          </View>
      )}

      {/* Modal Content */}
      {display !== 'inline' && (
        <BottomModal
            isVisible={isOpen}
            close={handleClose}
            scrollable={false}
            hideCloseButton={true}
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
                    selectedValue={tempDate.getDate()}
                    onValueChange={(d) => {
                        const newDate = new Date(tempDate);
                        newDate.setDate(d);
                        setTempDate(newDate);
                    }}
                    width={70}
                    isOpen={isOpen}
                    />
                    <WheelPicker
                    data={months}
                    selectedValue={tempDate.getMonth()}
                    onValueChange={(m) => {
                        const newDate = new Date(tempDate);
                        newDate.setMonth(m);
                        setTempDate(newDate);
                    }}
                    width={90}
                    isOpen={isOpen}
                    />
                    <WheelPicker
                    data={years}
                    selectedValue={tempDate.getFullYear()}
                    onValueChange={(y) => {
                        const newDate = new Date(tempDate);
                        newDate.setFullYear(y);
                        setTempDate(newDate);
                    }}
                    width={90}
                    isOpen={isOpen}
                    />
                </>
                ) : (
                <>
                    <WheelPicker
                    data={hours}
                    selectedValue={tempDate.getHours()}
                    onValueChange={(h) => {
                        const newDate = new Date(tempDate);
                        newDate.setHours(h);
                        setTempDate(newDate);
                    }}
                    width={80}
                    isOpen={isOpen}
                    />
                    <Text style={[Fonts.h2, Fonts.neutral00, { alignSelf: 'center', marginHorizontal: 8 }]}>:</Text>
                    <WheelPicker
                    data={minutes}
                    selectedValue={tempDate.getMinutes()}
                    onValueChange={(m) => {
                        const newDate = new Date(tempDate);
                        newDate.setMinutes(m);
                        setTempDate(newDate);
                    }}
                    width={80}
                    isOpen={isOpen}
                    />
                </>
                )}
            </View>
            
            <View style={[Spaces.marginTop[16], Spaces.marginBottom[24]]}>
                <Button 
                    variant="Primary" 
                    title="Confirmer" 
                    onPress={handleConfirm} 
                />
            </View>
        </BottomModal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  inputButton: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickersRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
  },
  inlineTimePickersRow: {
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  wheelContainer: {
    overflow: 'hidden',
    marginHorizontal: 2,
  },
  wheelItem: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionIndicator: {
    position: 'absolute',
    left: 2,
    right: 2,
    height: ITEM_HEIGHT,
    borderRadius: 8,
    borderWidth: 1.5,
    zIndex: -1,
  },
  selectedItemText: {
    fontWeight: '700',
    fontSize: 20,
  },
});

export default DateTimeSelector;
