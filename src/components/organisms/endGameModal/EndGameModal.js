import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import Button from '@/components/atoms/button/Button';
import useTheme from '@/theme/themeContext';

const EndGameModal = ({ isVisible, onClose, onSubmit, teamNameA, teamNameB }) => {
    const { Colors, Fonts, Spaces } = useTheme();
    const [scoreA, setScoreA] = useState('');
    const [scoreB, setScoreB] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (scoreA === '' || scoreB === '') {
            Alert.alert('Erreur', 'Veuillez renseigner les scores des deux équipes.');
            return;
        }

        // Validate integers
        const sA = parseInt(scoreA, 10);
        const sB = parseInt(scoreB, 10);

        if (isNaN(sA) || isNaN(sB)) {
             Alert.alert('Erreur', 'Les scores doivent être des nombres valides.');
             return;
        }

        setIsSubmitting(true);
        try {
            await onSubmit(sA, sB);
            onClose();
        } catch (error) {
            console.error(error);
            Alert.alert('Erreur', 'Impossible d\'envoyer le score.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <BottomModal
            isVisible={isVisible}
            close={onClose}
            snapPoints={['50%']}
            headerComponent={
                <Text style={[Fonts.h3, { color: Colors.gold500, textAlign: 'center', marginBottom: 16 }]}>
                    🏁 Fin du Match
                </Text>
            }
        >
            <View style={{ paddingBottom: 32, paddingHorizontal: 16 }}>
                <Text style={[Fonts.p2, { color: Colors.neutral300, textAlign: 'center', marginBottom: 24 }]}>
                    Veuillez saisir le score final du match pour validation.
                </Text>

                <View style={[styles.scoreRow, { borderColor: Colors.neutral700 }]}>
                    {/* Team A */}
                    <View style={styles.teamColumn}>
                        <Text style={[Fonts.p1Bold, { color: Colors.neutral00, marginBottom: 12, textAlign: 'center' }]} numberOfLines={1}>
                            {teamNameA || 'Équipe A'}
                        </Text>
                        <TextInput
                            style={[
                                styles.scoreInput, 
                                { 
                                    backgroundColor: Colors.neutral800, 
                                    color: Colors.neutral00,
                                    borderColor: Colors.neutral600
                                }
                            ]}
                            keyboardType="number-pad"
                            maxLength={2}
                            value={scoreA}
                            onChangeText={setScoreA}
                            textAlign="center"
                            placeholder="0"
                            placeholderTextColor={Colors.neutral500}
                        />
                    </View>

                    <Text style={[Fonts.h1, { color: Colors.neutral500 }]}>-</Text>

                    {/* Team B */}
                    <View style={styles.teamColumn}>
                        <Text style={[Fonts.p1Bold, { color: Colors.neutral00, marginBottom: 12, textAlign: 'center' }]} numberOfLines={1}>
                            {teamNameB || 'Équipe B'}
                        </Text>
                        <TextInput
                            style={[
                                styles.scoreInput, 
                                { 
                                    backgroundColor: Colors.neutral800, 
                                    color: Colors.neutral00,
                                    borderColor: Colors.neutral600
                                }
                            ]}
                            keyboardType="number-pad"
                            maxLength={2}
                            value={scoreB}
                            onChangeText={setScoreB}
                            textAlign="center"
                            placeholder="0"
                            placeholderTextColor={Colors.neutral500}
                        />
                    </View>
                </View>

                <Button
                    title={isSubmitting ? "Envoi..." : "VALIDER LE SCORE"}
                    onPress={handleSubmit}
                    variant="Primary"
                    disabled={isSubmitting}
                    style={{ marginTop: 32, backgroundColor: Colors.gold500 }}
                    textStyle={{ color: Colors.neutral900, fontWeight: 'bold' }}
                />
            </View>
        </BottomModal>
    );
};

const styles = StyleSheet.create({
    scoreRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingVertical: 20,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
    },
    teamColumn: {
        alignItems: 'center',
        width: '40%',
    },
    scoreInput: {
        width: 60,
        height: 60,
        fontSize: 32,
        fontWeight: 'bold',
        borderRadius: 12,
        borderWidth: 1,
    }
});

export default EndGameModal;
