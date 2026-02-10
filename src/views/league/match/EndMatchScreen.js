import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Switch, Image, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { launchImageLibrary } from 'react-native-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';

import useTheme from '@/theme/themeContext';
import Button from '@/components/atoms/button/Button';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import { getImageUrl } from '@/utils/imageUrl';
import { fetchMatch, submitMatchScore } from '@/services/league/leagueMatchService';

const EndMatchScreen = () => {
    const { Colors, Fonts, Spaces } = useTheme();
    const navigation = useNavigation();
    const route = useRoute();
    const queryClient = useQueryClient();
    const matchId = route.params?.matchId;

    const [scoreA, setScoreA] = useState('');
    const [scoreB, setScoreB] = useState('');
    const [dispute, setDispute] = useState(false);
    const [proof, setProof] = useState(null);

    const { data: match, isLoading } = useQuery({
        queryKey: ['league-match', matchId],
        queryFn: () => fetchMatch(matchId),
        enabled: !!matchId
    });

    const submitMutation = useMutation({
        mutationFn: (data) => submitMatchScore(matchId, data.scoreA, data.scoreB, data.dispute, data.proof),
        onSuccess: () => {
            Alert.alert("Succès", "Le score a été envoyé avec succès !");
            queryClient.invalidateQueries({ queryKey: ['league-matches'] });
            queryClient.invalidateQueries({ queryKey: ['league-match', matchId] });
            navigation.goBack();
        },
        onError: (error) => {
            console.error(error);
            Alert.alert("Erreur", "Impossible d'envoyer le score.");
        }
    });

    const handlePickProof = async () => {
        const options = {
            mediaType: 'photo',
            quality: 0.7,
            selectionLimit: 1,
        };

        launchImageLibrary(options, (response) => {
            if (response.didCancel) {
                console.log('User cancelled image picker');
            } else if (response.errorCode) {
                console.log('ImagePicker Error: ', response.errorMessage);
                Alert.alert('Erreur', 'Impossible de sélectionner une image');
            } else if (response.assets && response.assets.length > 0) {
                const asset = response.assets[0];
                setProof({
                    uri: asset.uri,
                    name: asset.fileName || 'proof.jpg',
                    type: asset.type || 'image/jpeg'
                });
            }
        });
    };

    const handleSubmit = () => {
        if (!scoreA || !scoreB) {
            Alert.alert("Erreur", "Veuillez saisir les scores.");
            return;
        }
        submitMutation.mutate({
            scoreA: parseInt(scoreA),
            scoreB: parseInt(scoreB),
            dispute,
            proof
        });
    };

    if (isLoading || !match) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={Colors.primary500} />
            </SafeAreaView>
        );
    }

    const teamA = match.team_a;
    const teamB = match.team_b;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: Colors.background }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.neutral800 }}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8, marginRight: 16 }}>
                    <Text style={{ color: Colors.primary500, fontSize: 24, fontWeight: 'bold' }}>{"<"}</Text>
                </TouchableOpacity>
                <Text style={[Fonts.h3, { color: Colors.neutral100 }]}>SAISIR LE SCORE</Text>
            </View>
            
            <ScrollView contentContainerStyle={{ padding: 16 }}>
                <Text style={[Fonts.p2, { color: Colors.neutral300, textAlign: 'center', marginBottom: 24 }]}>
                    Veuillez saisir le score final du match.
                </Text>

                {/* Score Input Area */}
                <View style={styles.scoreContainer}>
                    {/* Team A */}
                    <View style={styles.teamColumn}>
                        <TeamShield initials={teamA?.name?.substring(0,2)} size={60} />
                        <Text style={[Fonts.h4, { color: Colors.neutral100, marginVertical: 8 }]} numberOfLines={1}>
                            {teamA?.name}
                        </Text>
                        <TextInput 
                            style={[styles.scoreInput, { borderColor: Colors.neutral600, color: Colors.neutral100, backgroundColor: Colors.neutral800 }]}
                            keyboardType="number-pad"
                            value={scoreA}
                            onChangeText={setScoreA}
                            placeholder="0"
                            placeholderTextColor={Colors.neutral500}
                        />
                    </View>

                    <Text style={[Fonts.h2, { color: Colors.neutral400, paddingTop: 60 }]}>-</Text>

                    {/* Team B */}
                    <View style={styles.teamColumn}>
                        <TeamShield initials={teamB?.name?.substring(0,2)} size={60} />
                        <Text style={[Fonts.h4, { color: Colors.neutral100, marginVertical: 8 }]} numberOfLines={1}>
                            {teamB?.name}
                        </Text>
                        <TextInput 
                            style={[styles.scoreInput, { borderColor: Colors.neutral600, color: Colors.neutral100, backgroundColor: Colors.neutral800 }]}
                            keyboardType="number-pad"
                            value={scoreB}
                            onChangeText={setScoreB}
                            placeholder="0"
                            placeholderTextColor={Colors.neutral500}
                        />
                    </View>
                </View>

                {/* Dispute Toggle */}
                <View style={[styles.card, { backgroundColor: Colors.neutral800, borderColor: Colors.neutral700 }]}>
                    <View style={styles.headerRow}>
                        <Text style={[Fonts.h4, { color: Colors.neutral100 }]}>Il y a un litige ?</Text>
                        <Switch 
                            value={dispute}
                            onValueChange={setDispute}
                            trackColor={{ false: Colors.neutral600, true: Colors.error500 }}
                            thumbColor={Colors.neutral100}
                        />
                    </View>
                    <Text style={[Fonts.p3, { color: Colors.neutral400, marginTop: 4 }]}>
                        Activez cette option en cas de désaccord sur le score ou d'incident majeur. Une preuve sera demandée.
                    </Text>
                    
                    {dispute && (
                        <View style={{ marginTop: 16, gap: 12 }}>
                            <Button 
                                title={proof ? "Preuve ajoutée ✅" : "Ajouter une preuve (Photo/Vidéo)"}
                                variant={proof ? "Primary" : "Secondary"}
                                onPress={handlePickProof}
                                style={{ borderColor: Colors.neutral600 }}
                            />
                            {proof && (
                                <Image source={{ uri: proof.uri }} style={{ width: '100%', height: 200, borderRadius: 8, marginTop: 8, resizeMode: 'cover' }} />
                            )}
                        </View>
                    )}
                </View>

                <Button 
                    title={submitMutation.isPending ? "ENVOI EN COURS..." : "VALIDER LE SCORE"}
                    onPress={handleSubmit}
                    variant="Primary"
                    disabled={submitMutation.isPending}
                    style={{ marginTop: 32, backgroundColor: Colors.primary500 }}
                />

            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scoreContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 32,
    },
    teamColumn: {
        alignItems: 'center',
        flex: 1,
    },
    scoreInput: {
        width: 60,
        height: 60,
        borderRadius: 8,
        borderWidth: 1,
        fontSize: 32,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    card: {
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    }
});

export default EndMatchScreen;
