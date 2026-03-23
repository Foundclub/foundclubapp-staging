import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  InteractionManager,
  Modal,
  ScrollView,
  Text,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

import { navigate } from '@/navigation/navigationService';
import { RouteNames } from '@/navigation/routeNames';

/**
 * Normalise une valeur en chaine exploitable.
 *
 * @param {unknown} value
 * @returns {string}
 */
const getNormalizedString = (value) => String(value || '').trim();

/**
 * Filtre les equipes qui doivent encore configurer une source externe.
 *
 * @param {any} userData
 * @returns {Array<any>}
 */
const getTeamsNeedingExternalSource = (userData) => {
  const uniqueTeams = new Map();
  const allTeams = [
    ...(Array.isArray(userData?.myTeams) ? userData.myTeams : []),
    ...(Array.isArray(userData?.trainedTeams) ? userData.trainedTeams : []),
  ];

  allTeams.forEach((team) => {
    const documentId = getNormalizedString(team?.documentId || team?.id);
    if (!documentId || uniqueTeams.has(documentId)) {
      return;
    }

    const hasSource = getNormalizedString(team?.externalStandingUrl).length > 0;
    if (!team?.externalCompetitionEligible || hasSource) {
      return;
    }

    uniqueTeams.set(documentId, team);
  });

  return Array.from(uniqueTeams.values());
};

/**
 * Affiche un rappel global unique par session pour les equipes eligibles
 * sans lien de classement configure.
 *
 * @param {{ userData?: any, enabled?: boolean, openDelayMs?: number }} props
 * @returns {import('react').ReactElement | null}
 */
function ExternalCompetitionPromptGate({
  enabled = true,
  openDelayMs = 450,
  userData,
}) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const [dismissedSessionKey, setDismissedSessionKey] = useState('');
  const [visible, setVisible] = useState(false);

  const sessionKey = getNormalizedString(userData?.documentId);
  const teamsNeedingExternalSource = useMemo(
    () => getTeamsNeedingExternalSource(userData),
    [userData],
  );

  useEffect(() => {
    setDismissedSessionKey('');
    setVisible(false);
  }, [sessionKey]);

  useEffect(() => {
    if (
      !enabled
      || !sessionKey
      || !teamsNeedingExternalSource.length
      || dismissedSessionKey === sessionKey
    ) {
      setVisible(false);
      return undefined;
    }

    let isCancelled = false;
    let timeoutId = null;
    const interactionHandle = InteractionManager.runAfterInteractions(() => {
      timeoutId = setTimeout(() => {
        if (!isCancelled) {
          setVisible(true);
        }
      }, openDelayMs);
    });

    return () => {
      isCancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      interactionHandle?.cancel?.();
    };
  }, [
    dismissedSessionKey,
    enabled,
    openDelayMs,
    sessionKey,
    teamsNeedingExternalSource.length,
  ]);

  const handleDismiss = () => {
    if (sessionKey) {
      setDismissedSessionKey(sessionKey);
    }
    setVisible(false);
  };

  const handleOpenTeamSetup = (team) => {
    if (sessionKey) {
      setDismissedSessionKey(sessionKey);
    }
    setVisible(false);
    navigate(RouteNames.TeamStack, {
      params: {
        openExternalSourceSetup: true,
        source: 'externalCompetitionPrompt',
        teamId: team?.documentId || team?.id,
      },
      screen: RouteNames.TeamDetails,
    });
  };

  if (!teamsNeedingExternalSource.length) {
    return null;
  }

  return (
    <Modal
      animationType="fade"
      onRequestClose={handleDismiss}
      transparent
      visible={visible}
    >
      <View
        style={[
          Alignments.fill,
          Alignments.justifyCenter,
          Spaces.padding[24],
          {
            backgroundColor: 'rgba(0,0,0,0.72)',
          },
        ]}
      >
        <View
          style={[
            ApplicationStyle.backgroundColor.primary700,
            ApplicationStyle.borderRadius24,
            {
              borderColor: `${Colors.primary500}33`,
              borderWidth: 1,
              maxHeight: '78%',
              maxWidth: 420,
              overflow: 'hidden',
              width: '100%',
            },
          ]}
        >
          <View
            style={[
              Spaces.paddingHorizontal[24],
              {
                paddingBottom: 18,
                paddingTop: 24,
              },
            ]}
          >
            <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
              {t(
                'teamDetails.external.prompt.title',
                'Ajoutez le classement de votre ligue',
              )}
            </Text>
            <Text
              style={[
                Fonts.p2,
                Fonts.primary100,
                {
                  lineHeight: 24,
                  marginTop: 10,
                  paddingRight: 4,
                },
              ]}
            >
              {t(
                'teamDetails.external.prompt.description',
                'Vous pouvez ajouter le lien du classement de votre ligue pour '
                  + "retrouver directement dans l'application votre classement, "
                  + 'votre calendrier et vos statistiques.',
              )}
            </Text>
          </View>

          <ScrollView
            contentContainerStyle={[
              Spaces.gap[14],
              Spaces.paddingHorizontal[24],
              {
                paddingBottom: 20,
              },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {teamsNeedingExternalSource.map((team) => {
              const activityLabel = getNormalizedString(team?.activities?.[0]?.name);
              const clubLabel = getNormalizedString(team?.club?.name);

              return (
                <View
                  key={team?.documentId || team?.id}
                  style={[
                    ApplicationStyle.borderRadius16,
                    {
                      paddingHorizontal: 18,
                      paddingVertical: 18,
                    },
                    {
                      backgroundColor: `${Colors.primary500}14`,
                      borderColor: `${Colors.primary500}33`,
                      borderWidth: 1,
                      gap: 14,
                    },
                  ]}
                >
                  <View style={{ gap: 6 }}>
                    <Text style={[Fonts.p1Bold, Fonts.neutral00, { lineHeight: 22 }]}>
                      {team?.name || t('common.team', 'Equipe')}
                    </Text>
                    {activityLabel ? (
                      <Text style={[Fonts.p3, Fonts.primary500, { lineHeight: 18 }]}>
                        {activityLabel}
                      </Text>
                    ) : null}
                    {clubLabel ? (
                      <Text style={[Fonts.p3, Fonts.primary100, { lineHeight: 18 }]}>
                        {clubLabel}
                      </Text>
                    ) : null}
                  </View>

                  <Button
                    onPress={() => handleOpenTeamSetup(team)}
                    style={{ marginTop: 2 }}
                    title={t(
                      'teamDetails.external.prompt.cta',
                      'Ajouter le classement',
                    )}
                    variant="Primary"
                  />
                </View>
              );
            })}
          </ScrollView>

          <View
            style={[
              Spaces.paddingHorizontal[24],
              {
                borderTopColor: `${Colors.primary500}1F`,
                borderTopWidth: 1,
                paddingBottom: 24,
                paddingTop: 16,
              },
            ]}
          >
            <Button
              onPress={handleDismiss}
              style={{ width: '100%' }}
              textStyle={{ letterSpacing: 0.2 }}
              title={t('common.later', 'Plus tard')}
              variant="Secondary"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default ExternalCompetitionPromptGate;
