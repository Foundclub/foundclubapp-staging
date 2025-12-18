import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, StyleSheet, Dimensions } from 'react-native';
import useTheme from '@/theme/themeContext';

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

/**
 * A Pure JavaScript Date/Time Selector with iOS-style wheel picker.
 * NO NATIVE MODULES REQUIRED.
 */
const DateTimeSelector = ({ value, onChange, mode = 'date', label }) => {
  const { Colors, Fonts, Spaces } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const [tempDate, setTempDate] = useState(value || new Date());

  const getFormattedValue = () => {
    if (!value) return 'Sélectionner';
    if (mode === 'date') {
      return value.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    }
    return value.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const handleConfirm = () => {
    onChange(tempDate);
    setModalVisible(false);
  };

  const handleCancel = () => {
    setTempDate(value || new Date());
    setModalVisible(false);
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
  
  const days = generateDaysWithWeekday(tempDate.getMonth(), tempDate.getFullYear());
  const months = [
    { label: 'Jan', value: 0 }, { label: 'Fév', value: 1 }, { label: 'Mar', value: 2 },
    { label: 'Avr', value: 3 }, { label: 'Mai', value: 4 }, { label: 'Juin', value: 5 },
    { label: 'Juil', value: 6 }, { label: 'Août', value: 7 }, { label: 'Sep', value: 8 },
    { label: 'Oct', value: 9 }, { label: 'Nov', value: 10 }, { label: 'Déc', value: 11 }
  ];
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear + i);
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 12 }, (_, i) => i * 5);

  // Wheel Picker Component
  const WheelPicker = ({ data, selectedValue, onValueChange, formatItem, width = 80 }) => {
    const flatListRef = useRef(null);
    const isScrolling = useRef(false);
    const selectedIndex = data.findIndex(item => 
      typeof item === 'object' ? item.value === selectedValue : item === selectedValue
    );

    useEffect(() => {
      if (flatListRef.current && selectedIndex >= 0 && modalVisible) {
        // Use timeout to ensure FlatList is mounted
        const timer = setTimeout(() => {
          flatListRef.current?.scrollToOffset({ 
            offset: selectedIndex * ITEM_HEIGHT, 
            animated: false 
          });
        }, 150);
        return () => clearTimeout(timer);
      }
    }, [modalVisible, selectedIndex]);

    const handleScroll = (event) => {
      isScrolling.current = true;
    };

    const handleScrollComplete = (event) => {
      isScrolling.current = false;
      const offsetY = event.nativeEvent.contentOffset.y;
      const index = Math.round(offsetY / ITEM_HEIGHT);
      const clampedIndex = Math.max(0, Math.min(index, data.length - 1));
      const item = data[clampedIndex];
      const newValue = typeof item === 'object' ? item.value : item;
      
      // Only update if value changed
      if (newValue !== selectedValue) {
        onValueChange(newValue);
      }
      
      // Snap to exact position
      flatListRef.current?.scrollToOffset({
        offset: clampedIndex * ITEM_HEIGHT,
        animated: true
      });
    };

    const renderItem = ({ item, index }) => {
      const itemValue = typeof item === 'object' ? item.value : item;
      const itemLabel = typeof item === 'object' ? item.label : formatItem ? formatItem(item) : String(item).padStart(2, '0');
      const isSelected = itemValue === selectedValue;

      return (
        <TouchableOpacity 
          style={[styles.wheelItem, { height: ITEM_HEIGHT }]}
          onPress={() => {
            onValueChange(itemValue);
            flatListRef.current?.scrollToOffset({
              offset: index * ITEM_HEIGHT,
              animated: true
            });
          }}
          activeOpacity={0.7}
        >
          <Text style={[
            Fonts.p1,
            { color: isSelected ? Colors.primary500 : Colors.neutral500 },
            isSelected && styles.selectedItemText
          ]}>
            {itemLabel}
          </Text>
        </TouchableOpacity>
      );
    };

    return (
      <View style={[styles.wheelContainer, { width, height: PICKER_HEIGHT }]}>
        {/* Selection Indicator */}
        <View style={[styles.selectionIndicator, { 
          top: ITEM_HEIGHT * 2,
          backgroundColor: Colors.neutral800,
          borderColor: Colors.primary500
        }]} pointerEvents="none" />
        
        <FlatList
          ref={flatListRef}
          data={data}
          keyExtractor={(item, index) => index.toString()}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_HEIGHT}
          snapToAlignment="start"
          decelerationRate="fast"
          bounces={false}
          overScrollMode="never"
          onScroll={handleScroll}
          onMomentumScrollEnd={handleScrollComplete}
          onScrollEndDrag={(e) => {
            // On iOS, if user releases without momentum, this fires instead
            // Check if momentum will happen, if not handle here
            const velocity = e.nativeEvent.velocity?.y || 0;
            if (Math.abs(velocity) < 0.5) {
              handleScrollComplete(e);
            }
          }}
          getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
          contentContainerStyle={{ paddingVertical: ITEM_HEIGHT * 2 }}
          onScrollToIndexFailed={() => {}}
          nestedScrollEnabled={true}
          scrollEventThrottle={16}
        />
      </View>
    );
  };

  return (
    <View style={[Spaces.marginBottom[16]]}>
      {label && (
        <Text style={[Fonts.p1Bold, Fonts.neutral00, Spaces.marginBottom[8]]}>
          {label}
        </Text>
      )}

      <TouchableOpacity
        onPress={() => {
          setTempDate(value || new Date());
          setModalVisible(true);
        }}
        style={[styles.inputButton, { borderColor: Colors.neutral700, backgroundColor: Colors.neutral800 }]}
      >
        <Text style={[Fonts.p1, Fonts.neutral00]}>{getFormattedValue()}</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={handleCancel}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: Colors.neutral900 }]}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalHandle, { backgroundColor: Colors.neutral500 }]} />
              <Text style={[Fonts.h3, Fonts.neutral00, { marginTop: 16, textAlign: 'center' }]}>
                {mode === 'date' ? 'Choisir la date' : 'Choisir l\'heure'}
              </Text>
            </View>

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
                  />
                </>
              )}
            </View>

            <View style={styles.buttonsRow}>
              <TouchableOpacity onPress={handleCancel} style={[styles.button, { backgroundColor: Colors.neutral700 }]}>
                <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleConfirm} style={[styles.button, { backgroundColor: Colors.primary500 }]}>
                <Text style={[Fonts.p1Bold, { color: Colors.neutral900 }]}>Confirmer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  modalHeader: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 16,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  pickersRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
  },
  wheelContainer: {
    overflow: 'hidden',
    marginHorizontal: 4,
  },
  wheelItem: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionIndicator: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    borderRadius: 8,
    borderWidth: 1.5,
    zIndex: -1,
  },
  selectedItemText: {
    fontWeight: '700',
    fontSize: 20,
  },
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    marginTop: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
});

export default DateTimeSelector;
