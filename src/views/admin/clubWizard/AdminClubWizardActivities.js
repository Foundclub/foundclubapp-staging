// @ts-nocheck
/* eslint-disable jsdoc/require-description, jsdoc/require-param-type, jsdoc/require-returns, max-len */
import { useMemo } from 'react';
import {
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Input from '@/components/molecules/input/Input';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import { useGetActivities } from '@/services/activity/activityQueries';

import { getErrorMessage } from '@/utils/errors/displayError';

import {
  ADMIN_CLUB_WIZARD_TOTAL_STEPS,
  useAdminClubWizard,
} from './AdminClubWizardContext';
import useAdminClubWizardExit from './useAdminClubWizardExit';

/**
 *
 * @param root0
 * @param root0.navigation
 */
function AdminClubWizardActivities({ navigation }) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { setField, state } = useAdminClubWizard();
  const handleExitWizard = useAdminClubWizardExit(navigation);
  const activitiesQuery = useGetActivities();
  const searchValue = state.activitiesSearch || '';

  const filteredActivities = useMemo(() => {
    const source = Array.isArray(activitiesQuery.data) ? activitiesQuery.data : [];
    const normalizedSearch = String(searchValue || '').trim().toLowerCase();
    if (!normalizedSearch) return source;
    return source.filter((activity) => String(activity?.name || '').toLowerCase().includes(normalizedSearch));
  }, [activitiesQuery.data, searchValue]);

  const selectedIds = useMemo(
    () => new Set((Array.isArray(state.activites) ? state.activites : []).map((activity) => activity?.documentId).filter(Boolean)),
    [state.activites],
  );

  const toggleActivity = (activity) => {
    const current = Array.isArray(state.activites) ? state.activites : [];
    const exists = current.some((item) => item?.documentId === activity?.documentId);
    setField(
      'activites',
      exists
        ? current.filter((item) => item?.documentId !== activity?.documentId)
        : [...current, activity],
    );
  };

  return (
    <WizardStepLayout
      nextLabel="Suivant"
      onBack={() => navigation.goBack()}
      onClose={handleExitWizard}
      onNext={() => navigation.navigate(RouteNames.AdminClubWizardBusiness)}
      stepCount={ADMIN_CLUB_WIZARD_TOTAL_STEPS}
      stepIndex={4}
      subtitle="Comme pour le tunnel équipe, on choisit d'abord le profil sportif. Sélectionne une ou plusieurs activités pour rendre le club exploitable tout de suite."
      title="Activités sportives"
    >
      <View style={[Spaces.gap[18]]}>
        <Input
          label="Rechercher une activité"
          onChangeText={(value) => setField('activitiesSearch', value)}
          placeholder="Football, basket, handball..."
          value={searchValue}
        />

        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {selectedIds.size > 0
            ? `${selectedIds.size} activité(s) sélectionnée(s)`
            : 'Aucune activité sélectionnée pour le moment. Tu peux continuer et compléter plus tard.'}
        </Text>

        {activitiesQuery.isLoading ? (
          <Text style={[Fonts.p2, Fonts.neutral200]}>Chargement des activités...</Text>
        ) : null}

        {activitiesQuery.error ? (
          <View
            style={[
              ApplicationStyle.card,
              Spaces.padding[16],
              Spaces.gap[10],
              {
                backgroundColor: 'rgba(4, 31, 44, 0.82)',
                borderColor: Colors.error500,
              },
            ]}
          >
            <Text style={[Fonts.p2Bold, { color: Colors.error500 }]}>
              Impossible de charger les activités.
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              {getErrorMessage(activitiesQuery.error, 'generic')}
            </Text>
            <Button
              onPress={() => activitiesQuery.refetch()}
              size="sm"
              title="Reessayer"
              variant="Secondary"
            />
          </View>
        ) : null}

        <View style={[Spaces.gap[10]]}>
          {filteredActivities.map((activity) => {
            const isSelected = selectedIds.has(activity?.documentId);
            return (
              <TouchableOpacity
                activeOpacity={0.88}
                key={activity.documentId}
                onPress={() => toggleActivity(activity)}
                style={[
                  ApplicationStyle.card,
                  Alignments.row,
                  Alignments.alignCenter,
                  Alignments.justifySpaceBetween,
                  Spaces.padding[16],
                  Spaces.gap[12],
                  {
                    backgroundColor: isSelected ? 'rgba(1, 179, 244, 0.14)' : 'rgba(4, 31, 44, 0.82)',
                    borderColor: isSelected ? Colors.primary500 : 'rgba(1, 179, 244, 0.18)',
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[isSelected ? Fonts.p2Bold : Fonts.p2, Fonts.neutral00]}>
                    {activity.name}
                  </Text>
                </View>
                <View
                  style={[
                    Alignments.alignCenter,
                    Alignments.justifyCenter,
                    {
                      backgroundColor: isSelected ? `${Colors.primary500}22` : 'transparent',
                      borderColor: isSelected ? Colors.primary500 : Colors.neutral500,
                      borderRadius: 11,
                      borderWidth: 2,
                      height: 22,
                      width: 22,
                    },
                  ]}
                >
                  {isSelected ? (
                    <View
                      style={{
                        backgroundColor: Colors.primary500,
                        borderRadius: 4,
                        height: 8,
                        width: 8,
                      }}
                    />
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </WizardStepLayout>
  );
}

export default AdminClubWizardActivities;
