// @ts-nocheck
/* eslint-disable jsdoc/require-description, jsdoc/require-param-type, jsdoc/require-returns, max-len */
import { useState } from 'react';
import {
  Alert,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Input from '@/components/molecules/input/Input';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import {
  getClubRelationLabel,
  normalizeText,
} from '@/services/admin/adminClubContentModel';
import { useSearchAdminClubRelations } from '@/services/admin/adminClubContentQueries';

import { getErrorMessage } from '@/utils/errors/displayError';

import {
  ADMIN_CLUB_WIZARD_TOTAL_STEPS,
  useAdminClubWizard,
} from './AdminClubWizardContext';
import { MULTISPORT_TARGET_UID } from './helpers';
import useAdminClubWizardExit from './useAdminClubWizardExit';

/**
 *
 * @param root0
 * @param root0.navigation
 */
function AdminClubWizardMultisport({ navigation }) {
  const {
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { setField, state } = useAdminClubWizard();
  const handleExitWizard = useAdminClubWizardExit(navigation);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const relationSearchMutation = useSearchAdminClubRelations();

  const handleSearch = async () => {
    try {
      const response = await relationSearchMutation.mutateAsync({
        payload: {
          page: 1,
          pageSize: 12,
          q: normalizeText(query) || undefined,
        },
        targetUid: MULTISPORT_TARGET_UID,
      });
      setResults(Array.isArray(response?.data) ? response.data : []);
    } catch (error) {
      Alert.alert('Recherche impossible', getErrorMessage(error, 'generic'));
    }
  };

  return (
    <WizardStepLayout
      nextLabel="Suivant"
      onBack={() => navigation.goBack()}
      onClose={handleExitWizard}
      onNext={() => navigation.navigate(RouteNames.AdminClubWizardSponsors)}
      stepCount={ADMIN_CLUB_WIZARD_TOTAL_STEPS}
      stepIndex={6}
      subtitle="Si le club appartient a une structure multisport, rattache-le ici. Sinon laisse simplement cette étape vide."
      title="Rattachement multisport"
    >
      <View style={[Spaces.gap[18]]}>
        <Input
          label="Rechercher un club multisport"
          onChangeText={setQuery}
          placeholder="Nom du multisport"
          value={query}
        />
        <Button
          isLoading={relationSearchMutation.isPending}
          onPress={handleSearch}
          title="Rechercher"
          variant="Secondary"
        />

        {state.parentMultisport ? (
          <View
            style={[
              ApplicationStyle.card,
              Spaces.padding[16],
              Spaces.gap[10],
              {
                backgroundColor: 'rgba(4, 31, 44, 0.82)',
                borderColor: Colors.primary500,
              },
            ]}
          >
            <Text style={[Fonts.p2Bold, Fonts.primary500]}>Parent sélectionne</Text>
            <Text style={[Fonts.p2, Fonts.neutral00]}>
              {getClubRelationLabel(state.parentMultisport)}
            </Text>
            <Button
              onPress={() => setField('parentMultisport', null)}
              size="sm"
              title="Retirer le rattachement"
              variant="Secondary"
            />
          </View>
        ) : (
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            Aucun parent multisport sélectionne.
          </Text>
        )}

        <View style={[Spaces.gap[10]]}>
          {results.map((item) => (
            <TouchableOpacity
              activeOpacity={0.88}
              key={item.documentId || item.id}
              onPress={() => setField('parentMultisport', item)}
              style={[
                ApplicationStyle.card,
                Spaces.padding[16],
                {
                  backgroundColor: 'rgba(4, 31, 44, 0.82)',
                  borderColor: 'rgba(1, 179, 244, 0.18)',
                },
              ]}
            >
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                {getClubRelationLabel(item)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </WizardStepLayout>
  );
}

export default AdminClubWizardMultisport;
