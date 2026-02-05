
import React, { useState } from 'react';
import useTheme from '@/theme/themeContext';
import { checkTeamNameUnique } from '@/services/leagueTeam/leagueTeamService';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import Input from '@/components/molecules/input/Input';

/**
 * @param {object} props
 * @param {any} props.navigation
 * @param {any} props.route
 */
export default function SquadNameScreen({ navigation, route }) {
    const { t } = useTheme(); // Assuming t is available or we use hardcoded strings for now. Correct: useTranslation hook needed if t used.
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleNext = async () => {
        if (name.length < 3) {
            setError('Name must be at least 3 characters');
            return;
        }
        setLoading(true);
        const isUnique = await checkTeamNameUnique(name);
        setLoading(false);

        if (!isUnique) {
            setError('Team name already taken');
            return;
        }

        navigation.navigate('SquadHomeBase', { ...route.params, squadName: name });
    };

    return (
        <WizardStepLayout
            title="Choose your Squad Name"
            subtitle="This will be your identity in the league."
            onNext={handleNext}
            isNextLoading={loading}
            isNextDisabled={name.length < 3}
        >
            <Input
                label="Squad Name"
                placeholder="Ex: FC Pépites"
                value={name}
                onChangeText={(t) => { setName(t); setError(''); }}
                error={error}
                autoCapitalize="words"
            />
        </WizardStepLayout>
    );
}
