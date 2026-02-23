import React, { useState } from 'react';
import {
  Image, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

/**
 * @param {{
 *  visible: boolean,
 *  onClose: () => void,
 *  onSubmit: (payload: { scoreA: number, scoreB: number, photo: import('react-native-image-picker').Asset | null }) => void,
 *  isLoading?: boolean,
 * }} props
 */
function ReportResultModal({
  isLoading, onClose, onSubmit, visible,
}) {
  const { Colors, Fonts, Spaces } = useTheme();
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  const [photo, setPhoto] = useState(/** @type {import('react-native-image-picker').Asset | null} */ (null));

  const handlePhoto = async () => {
    const options = /** @type {import('react-native-image-picker').ImageLibraryOptions} */ ({
      includeBase64: false,
      mediaType: 'photo',
      quality: 0.8,
    });
    // For simplicity using library, but could be camera
    const result = await launchImageLibrary(options);
    if (result.assets && result.assets.length > 0) {
      setPhoto(result.assets[0]);
    }
  };

  const handleSubmit = () => {
    if (!scoreA || !scoreB) return alert('Please enter scores');
    onSubmit({
      photo,
      scoreA: parseInt(scoreA, 10),
      scoreB: parseInt(scoreB, 10),
    });
  };

  return (
    <Modal animationType="slide" transparent visible={visible}>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: Colors.neutral800 }]}>
          <Text style={[Fonts.h3, { color: Colors.neutral00, marginBottom: 20 }]}>
            Report Result
          </Text>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={[Fonts.p2, { color: Colors.neutral200, marginBottom: 5 }]}>My Team</Text>
              <TextInput
                keyboardType="numeric"
                onChangeText={setScoreA}
                placeholder="0"
                placeholderTextColor={Colors.neutral400}
                style={{
                  backgroundColor: Colors.neutral700,
                  borderRadius: 8,
                  color: Colors.neutral00,
                  padding: 10,
                  textAlign: 'center',
                  ...Fonts.h1,
                }}
                value={scoreA}
              />
            </View>
            <Text style={[Fonts.h2, { alignSelf: 'center', color: Colors.neutral00 }]}>-</Text>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[Fonts.p2, { color: Colors.neutral200, marginBottom: 5 }]}>Opponent</Text>
              <TextInput
                keyboardType="numeric"
                onChangeText={setScoreB}
                placeholder="0"
                placeholderTextColor={Colors.neutral400}
                style={{
                  backgroundColor: Colors.neutral700,
                  borderRadius: 8,
                  color: Colors.neutral00,
                  padding: 10,
                  textAlign: 'center',
                  ...Fonts.h1,
                }}
                value={scoreB}
              />
            </View>
          </View>

          <TouchableOpacity onPress={handlePhoto} style={styles.photoBox}>
            {photo ? (
              <Image source={{ uri: photo.uri || '' }} style={{ borderRadius: 8, height: '100%', width: '100%' }} />
            ) : (
              <Text style={[Fonts.p2, { color: Colors.primary500 }]}>+ Add Match Sheet (Photo)</Text>
            )}
          </TouchableOpacity>

          <View style={{ gap: 10, marginTop: 20 }}>
            <Button isLoading={isLoading} onPress={handleSubmit} title="Submit Result" />
            <Button onPress={onClose} title="Cancel" variant="Secondary" />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 20,
  },
  overlay: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  photoBox: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    borderStyle: 'dashed',
    borderWidth: 1,
    height: 150,
    justifyContent: 'center',
  },
});

export default ReportResultModal;
