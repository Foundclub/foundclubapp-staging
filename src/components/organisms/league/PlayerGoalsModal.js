import React, { useState, useEffect } from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, TextInput, FlatList, Alert } from 'react-native';
import useTheme from '@/theme/themeContext';
import Button from '@/components/atoms/button/Button';

/**
 * PlayerGoalsModal
 * Modal to enter individual player goals after a match
 */
const PlayerGoalsModal = ({ 
    visible, 
    onClose, 
    onSubmit, 
    players = [], 
    totalGoals = 0,
    teamName = '' 
}) => {
    const { Colors, Fonts } = useTheme();
    const [goals, setGoals] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Reset goals when modal opens
    useEffect(() => {
        if (visible) {
            setGoals({});
        }
    }, [visible]);

    const getCurrentTotal = () => {
        return Object.values(goals).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
    };

    const handleGoalChange = (playerId, value) => {
        const numValue = parseInt(value) || 0;
        setGoals(prev => ({ ...prev, [playerId]: numValue }));
    };

    const handleSubmit = async () => {
        const currentTotal = getCurrentTotal();
        
        if (currentTotal !== totalGoals) {
            Alert.alert(
                "Erreur",
                `Le total des buts (${currentTotal}) ne correspond pas au score (${totalGoals}). Veuillez corriger.`
            );
            return;
        }

        setIsSubmitting(true);
        try {
            await onSubmit(goals);
            onClose();
        } catch (error) {
            Alert.alert("Erreur", "Impossible de sauvegarder les buteurs");
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderPlayer = ({ item }) => (
        <View style={styles.playerRow}>
            <Text style={[styles.playerName, { color: Colors.neutral100 }]}>
                {item.firstname || item.username} {item.lastname || ''}
            </Text>
            <View style={styles.goalInputWrapper}>
                <TouchableOpacity 
                    style={styles.counterButton}
                    onPress={() => handleGoalChange(item.documentId, Math.max(0, (goals[item.documentId] || 0) - 1))}
                >
                    <Text style={styles.counterText}>-</Text>
                </TouchableOpacity>
                <TextInput
                    style={[styles.goalInput, { color: Colors.primary500, borderColor: Colors.neutral700 }]}
                    value={String(goals[item.documentId] || 0)}
                    onChangeText={(val) => handleGoalChange(item.documentId, val)}
                    keyboardType="numeric"
                    maxLength={2}
                />
                <TouchableOpacity 
                    style={styles.counterButton}
                    onPress={() => handleGoalChange(item.documentId, (goals[item.documentId] || 0) + 1)}
                >
                    <Text style={styles.counterText}>+</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const currentTotal = getCurrentTotal();
    const isValid = currentTotal === totalGoals;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={[styles.container, { backgroundColor: Colors.neutral900 }]}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={[Fonts.h3, { color: Colors.neutral100 }]}>
                            ⚽ Buteurs - {teamName}
                        </Text>
                        <TouchableOpacity onPress={onClose}>
                            <Text style={{ color: Colors.neutral400, fontSize: 24 }}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Score Summary */}
                    <View style={[styles.scoreSummary, { 
                        backgroundColor: isValid ? 'rgba(76, 175, 80, 0.1)' : 'rgba(255, 193, 7, 0.1)',
                        borderColor: isValid ? '#4CAF50' : '#FFC107'
                    }]}>
                        <Text style={{ color: isValid ? '#4CAF50' : '#FFC107', fontWeight: 'bold' }}>
                            {currentTotal} / {totalGoals} buts attribués
                        </Text>
                    </View>

                    {/* Players List */}
                    <FlatList
                        data={players}
                        keyExtractor={(item) => item.documentId || item.id?.toString()}
                        renderItem={renderPlayer}
                        style={styles.list}
                        ListEmptyComponent={
                            <Text style={{ color: Colors.neutral500, textAlign: 'center', padding: 20 }}>
                                Aucun joueur disponible
                            </Text>
                        }
                    />

                    {/* Submit Button */}
                    <Button
                        label={isSubmitting ? "Enregistrement..." : "Valider les buteurs"}
                        onPress={handleSubmit}
                        disabled={!isValid || isSubmitting}
                        style={{ 
                            backgroundColor: isValid ? Colors.primary500 : Colors.neutral700,
                            marginTop: 16 
                        }}
                    />
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'flex-end',
    },
    container: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
        maxHeight: '80%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    scoreSummary: {
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
        marginBottom: 16,
    },
    list: {
        maxHeight: 400,
    },
    playerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    playerName: {
        fontSize: 14,
        fontWeight: '500',
        flex: 1,
    },
    goalInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    counterButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    counterText: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: 'bold',
    },
    goalInput: {
        width: 50,
        height: 40,
        borderWidth: 1,
        borderRadius: 8,
        textAlign: 'center',
        fontSize: 18,
        fontWeight: 'bold',
    },
});

export default PlayerGoalsModal;
