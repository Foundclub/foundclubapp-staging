import React, { useState } from 'react';
import { View, Text, Modal, StyleSheet, Image, TouchableOpacity, TextInput } from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import useTheme from '@/theme/themeContext';
import Button from '@/components/atoms/button/Button';

const ReportResultModal = ({ visible, onClose, onSubmit, isLoading }) => {
    const { Colors, Fonts, Spaces } = useTheme();
    const [scoreA, setScoreA] = useState('');
    const [scoreB, setScoreB] = useState('');
    const [photo, setPhoto] = useState(null);

    const handlePhoto = async () => {
        const options = {
            mediaType: 'photo',
            includeBase64: false,
            quality: 0.8,
        };
        // For simplicity using library, but could be camera
        const result = await launchImageLibrary(options);
        if (result.assets && result.assets.length > 0) {
            setPhoto(result.assets[0]);
        }
    };

    const handleSubmit = () => {
        if (!scoreA || !scoreB) return alert('Please enter scores');
        onSubmit({
            scoreA: parseInt(scoreA, 10),
            scoreB: parseInt(scoreB, 10),
            photo
        });
    };

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={styles.overlay}>
                <View style={[styles.container, { backgroundColor: Colors.neutral800 }]}>
                    <Text style={[Fonts.h3, { color: Colors.neutral00, marginBottom: 20 }]}>
                        Report Result
                    </Text>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
                        <View style={{ flex: 1, marginRight: 10 }}>
                            <Text style={[Fonts.p2, { color: Colors.neutral200, marginBottom: 5 }]}>My Team</Text>
                            <TextInput 
                                placeholder="0" 
                                placeholderTextColor={Colors.neutral400}
                                keyboardType="numeric" 
                                value={scoreA}
                                onChangeText={setScoreA}
                                style={{ 
                                    textAlign: 'center', 
                                    backgroundColor: Colors.neutral700,
                                    color: Colors.neutral00,
                                    borderRadius: 8,
                                    padding: 10,
                                    ...Fonts.h1
                                }}
                            />
                        </View>
                        <Text style={[Fonts.h2, { color: Colors.neutral00, alignSelf: 'center' }]}>-</Text>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={[Fonts.p2, { color: Colors.neutral200, marginBottom: 5 }]}>Opponent</Text>
                            <TextInput 
                                placeholder="0" 
                                placeholderTextColor={Colors.neutral400}
                                keyboardType="numeric" 
                                value={scoreB} 
                                onChangeText={setScoreB}
                                style={{ 
                                    textAlign: 'center', 
                                    backgroundColor: Colors.neutral700,
                                    color: Colors.neutral00,
                                    borderRadius: 8,
                                    padding: 10,
                                    ...Fonts.h1
                                }}
                            />
                        </View>
                    </View>

                    <TouchableOpacity onPress={handlePhoto} style={styles.photoBox}>
                        {photo ? (
                            <Image source={{ uri: photo.uri }} style={{ width: '100%', height: '100%', borderRadius: 8 }} />
                        ) : (
                            <Text style={[Fonts.p2, { color: Colors.primary500 }]}>+ Add Match Sheet (Photo)</Text>
                        )}
                    </TouchableOpacity>

                    <View style={{ gap: 10, marginTop: 20 }}>
                        <Button title="Submit Result" onPress={handleSubmit} isLoading={isLoading} />
                        <Button title="Cancel" variant="Secondary" onPress={onClose} />
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        padding: 20,
    },
    container: {
        padding: 20,
        borderRadius: 16,
    },
    photoBox: {
        height: 150,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        borderStyle: 'dashed'
    }
});

export default ReportResultModal;
