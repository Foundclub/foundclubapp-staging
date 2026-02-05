import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import useTheme from '@/theme/themeContext';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import Button from '@/components/atoms/button/Button';
import useAuth from '@/domains/auth/useAuth';
import { createMatchmakingRequest, cancelMatchmakingRequest, getActiveMatchmakingRequest } from './MatchmakingService';

export default function FindMatchScreen({ navigation }) {
    const { Colors, Fonts, Spaces } = useTheme();
    const { userData } = useAuth();
    
    // We assume userData has league_team loaded. If not, we might need to fetch it.
    // For MVP, let's assume we pass teamId or it's in context. 
    // If complex, we might need a dedicated hook.
    // Let's assume userData.league_team is populated by the auth provider/backend populate.
    const teamId = userData?.league_team?.id; 

    const [loading, setLoading] = useState(false);
    const [activeRequest, setActiveRequest] = useState(null);
    const [radius, setRadius] = useState(15);

    useEffect(() => {
        if (teamId) {
            checkStatus();
        }
    }, [teamId]);

    const checkStatus = async () => {
        try {
            const req = await getActiveMatchmakingRequest(teamId);
            setActiveRequest(req); // req is { id, attributes: {...} } or { id, ... } depending on API
        } catch (e) {
            console.error(e);
        }
    };

    const handleSearch = async () => {
        if (!teamId) return alert("No Team ID");
        setLoading(true);
        try {
            const res = await createMatchmakingRequest({
                teamId,
                radius,
                min_elo: 1000, // Placeholder
                max_elo: 1400, // Placeholder
                location: userData?.league_team?.home_base || { lat: 48.85, lng: 2.35 }
            });
            // Strapi response might be { data: { id, attributes } }
            setActiveRequest(res.data); 
        } catch (e) {
            console.error(e);
            alert("Error starting search");
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = async () => {
        if (!activeRequest) return;
        setLoading(true);
        try {
            await cancelMatchmakingRequest(activeRequest.id);
            setActiveRequest(null);
        } catch (e) {
            console.error(e);
            alert("Error cancelling");
        } finally {
            setLoading(false);
        }
    };

    if (activeRequest) {
        return (
            <WizardStepLayout
                title="Searching..."
                subtitle="Finding valuable opponents."
                onBack={() => navigation.goBack()}
                showSkip={false}
                onNext={() => {}} // Dummy to satisfy Wizard
                onSkip={() => {}} // Dummy
            >
                <View style={[styles.centerContainer, { gap: 20 }]}>
                    <ActivityIndicator size="large" color={Colors.gold500} />
                    <Text style={[Fonts.h3, { color: Colors.neutral00, textAlign: 'center' }]}>
                        Looking for a match within {activeRequest.attributes?.radius || radius} km
                    </Text>
                    <Button 
                        title="Cancel Search" 
                        onPress={handleCancel} 
                        variant="Secondary"
                        isLoading={loading}
                    />
                </View>
            </WizardStepLayout>
    );
    } 

    return (
        <WizardStepLayout
            title="Find an Opponent"
            subtitle="Configure your search criteria."
            onNext={handleSearch}
            nextLabel="Start Search"
            isNextLoading={loading}
            onBack={() => navigation.goBack()}
            onSkip={() => {}} // Dummy
        >
            <View style={{ gap: 20 }}>
                <Text style={[Fonts.h4, { color: Colors.neutral00 }]}>Search Radius: {radius} km</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                    {[5, 15, 30, 50].map(r => (
                        <Button
                            key={r}
                            title={`${r} km`}
                            onPress={() => setRadius(r)}
                            variant={radius === r ? 'Primary' : 'Secondary'}
                            style={{ flex: 1 }}
                        />
                    ))}
                </View>

                {/* Placeholder for Time Selection - MVP assumes 'Now' */}
                <Text style={[Fonts.h4, { color: Colors.neutral00, marginTop: 20 }]}>Time: Now</Text>
                <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>
                    We will look for teams available immediately.
                </Text>
            </View>
        </WizardStepLayout>
    );
}

const styles = StyleSheet.create({
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 300 },
});
