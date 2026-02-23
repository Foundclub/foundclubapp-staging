import React from 'react';
import {
  FlatList, Modal, Text, TouchableOpacity, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

/**
 * Simple SelectPicker component
 * @param {object} props
 * @param {{label: string, value: string}[]} props.items
 * @param {string} props.value
 * @param {(value: string) => void} props.onValueChange
 * @param {string} [props.placeholder]
 * @returns {import('react').ReactElement}
 */
function SelectPicker({
  items, onValueChange, placeholder, value,
}) {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const [visible, setVisible] = React.useState(false);

  const selectedItem = items.find((item) => item.value === value);

  return (
    <View>
      <TouchableOpacity
        onPress={() => setVisible(true)}
        style={[
          ApplicationStyle.backgroundColor.neutral800,
          Spaces.padding[12],
          ApplicationStyle.borderRadius8,
          Alignments.row,
          Alignments.justifySpaceBetween,
          Alignments.alignCenter,
        ]}
      >
        <Text style={[Fonts.p2, Fonts.neutral00]}>
          {selectedItem ? selectedItem.label : placeholder || 'Sélectionner'}
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral300]}>▼</Text>
      </TouchableOpacity>

      <Modal
        animationType="fade"
        onRequestClose={() => setVisible(false)}
        transparent
        visible={visible}
      >
        <TouchableOpacity
          onPress={() => setVisible(false)}
          style={[
            Alignments.fill,
            { backgroundColor: 'rgba(0,0,0,0.5)' },
            Alignments.justifyCenter,
            Alignments.alignCenter,
          ]}
        >
          <View style={[
            ApplicationStyle.backgroundColor.neutral900,
            { maxHeight: '50%', width: '80%' },
            ApplicationStyle.borderRadius16,
            Spaces.padding[16],
          ]}
          >
            <FlatList
              data={items}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                        onValueChange(item.value);
                        setVisible(false);
                      }}
                  style={[Spaces.paddingVertical[12], { borderBottomColor: Colors.neutral800, borderBottomWidth: 1 }]}
                >
                  <Text style={[Fonts.p1, Fonts.neutral00, item.value === value && { color: Colors.primary500 }]}>
                        {item.label}
                      </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

export default SelectPicker;
