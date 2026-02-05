
import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import useTheme from '@/theme/themeContext';
import { createLeagueTeam } from '@/services/leagueTeam/leagueTeamService';
import useAuth from '@/domains/auth/useAuth';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import FutCard from '@/components/organisms/league/FutCard';

/**
 * @param {object} props
 * @param {any} props.navigation
 * @param {any} props.route
 * @returns {React.JSX.Element}
 */
export default function SquadSummaryScreen({ navigation, route }) {
    const { Colors, Fonts } = useTheme();
    const { userData } = useAuth();
    const { squadName, homeBase } = route.params;
    const [loading, setLoading] = useState(false);

    const handleCreate = async () => {
        if (!userData?.id) return;
        setLoading(true);
        try {
            await createLeagueTeam({
                name: squadName,
                captain: userData.id.toString(),
                home_base: homeBase,
                elo: 1200
            });
            // Success - Go back to root or dashboard
            navigation.getParent()?.reset({
                index: 0,
                routes: [{ name: 'LeagueHome' }],
            });
        } catch (error) {
            alert('Error creating squad');
        } finally {
            setLoading(false);
        }
    };



// ... (existing imports)

    return (
        <WizardStepLayout
            title="Ready to launch?"
            subtitle="Review your squad details."
            onNext={handleCreate}
            nextLabel="Create Squad"
            isNextLoading={loading}
            onBack={() => navigation.goBack()}
            onSkip={() => {}} // Satisfy strict linting
        >
            <View style={{ alignItems: 'center', paddingHorizontal: 20 }}>
                 <FutCard 
                    team={{
                        name: squadName,
                        home_base: homeBase,
                        elo: 1200, // Preview default
                        division: 10 // Preview default
                    }} 
                />
            </View>
        </WizardStepLayout>
    );
}

const styles = StyleSheet.create({
    card: { padding: 20, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, marginTop: 20, alignItems: 'center' },
});
