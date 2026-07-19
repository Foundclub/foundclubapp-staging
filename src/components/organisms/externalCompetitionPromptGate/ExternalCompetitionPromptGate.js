import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  InteractionManager,
  Modal,
  Platform,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

import { navigate } from '@/navigation/navigationService';
import { RouteNames } from '@/navigation/routeNames';

import {
  POPUP_DISMISS_SCOPES,
  POPUP_IDS,
} from '@/constants/popupRegistry';
import {
  useBlockingOverlayLifecycle,
  useBlockingOverlayPrompt,
} from '@/context/BlockingOverlayContext';
import { usePopupEligibility } from '@/context/PopupManagerContext';

/**
 * Normalise une valeur en chaine exploitable.
 * @param {unknown} value
 * @returns {string}
 */
const getNormalizedString = (value) => String(value || '').trim();

/**
 * Filtre les equipes qui doivent encore configurer une source externe.
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
  const { height: viewportHeight, width: viewportWidth } = useWindowDimensions();
  const [isPromptReady, setIsPromptReady] = useState(false);

  const sessionKey = getNormalizedString(userData?.documentId);
  const isLandscape = viewportWidth > viewportHeight;
  const overlayHorizontalPadding = isLandscape ? 16 : 24;
  const overlayVerticalPadding = isLandscape ? 10 : 24;
  const dialogMaxHeight = isLandscape
    ? Math.max(320, viewportHeight - (overlayVerticalPadding * 2))
    : viewportHeight * 0.78;
  const dialogMaxWidth = isLandscape
    ? Math.min(Math.max(560, viewportWidth - (overlayHorizontalPadding * 2)), 760)
    : 420;
  const teamsNeedingExternalSource = useMemo(
    () => getTeamsNeedingExternalSource(userData),
    [userData],
  );
  const externalCompetitionPopup = usePopupEligibility(
    POPUP_IDS.EXTERNAL_COMPETITION_PROMPT,
    Boolean(enabled && isPromptReady && teamsNeedingExternalSource.length),
    {
      cooldownKey: [sessionKey, ...teamsNeedingExternalSource.map((team) => team?.documentId || team?.id)].filter(Boolean).join(':') || 'default',
      dismissScope: POPUP_DISMISS_SCOPES.DAY,
    },
  );

  useEffect(() => {
    setIsPromptReady(false);
  }, [sessionKey]);

  useEffect(() => {
    if (
      !enabled
      || !sessionKey
      || !teamsNeedingExternalSource.length
    ) {
      setIsPromptReady(false);
      return undefined;
    }

    let isCancelled = false;
    let timeoutId = null;
    const interactionHandle = InteractionManager.runAfterInteractions(() => {
      timeoutId = setTimeout(() => {
        if (!isCancelled) {
          setIsPromptReady(true);
        }
      }, openDelayMs);
    });

    return () => {
      isCancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      interactionHandle?.cancel?.();
    };
  }, [
    enabled,
    openDelayMs,
    sessionKey,
    teamsNeedingExternalSource.length,
  ]);

  const canShowPrompt = useBlockingOverlayPrompt(
    externalCompetitionPopup.descriptor.id,
    externalCompetitionPopup.canShow,
    externalCompetitionPopup.descriptor.priority,
  );
  const visible = Boolean(isPromptReady && externalCompetitionPopup.canShow && canShowPrompt);
  useBlockingOverlayLifecycle(externalCompetitionPopup.descriptor.id, visible, {
    releaseDelayMs: 320,
  });

  useEffect(() => {
    if (!visible) return;
    externalCompetitionPopup.markShown({ sessionKey });
  }, [externalCompetitionPopup, sessionKey, visible]);

  const handleDismiss = () => {
    externalCompetitionPopup.dismiss(POPUP_DISMISS_SCOPES.DAY);
    setIsPromptReady(false);
  };

  const handleOpenTeamSetup = (team) => {
    externalCompetitionPopup.trackEvent('accepted', {
      teamId: team?.documentId || team?.id,
    });
    externalCompetitionPopup.dismiss(POPUP_DISMISS_SCOPES.DAY);
    setIsPromptReady(false);
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

  const renderPromptHeader = () => (
    <>
      <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
        {t(
          'teamDetails.external.prompt.title',
          'Ajoute le classement de ta ligue',
        )}
      </Text>
      <Text
        style={[
          Fonts.p2,
          Fonts.primary100,
          {
            lineHeight: isLandscape ? 22 : 24,
            marginTop: 10,
            paddingRight: 4,
          },
        ]}
      >
        {t(
          'teamDetails.external.prompt.description',
          'Tu peux ajouter le lien du classement de ta ligue pour '
            + "retrouver directement dans l'application ton classement, "
            + 'ton calendrier et tes statistiques.',
        )}
      </Text>
    </>
  );

  const renderTeamCard = (team) => {
    const activityLabel = getNormalizedString(team?.activities?.[0]?.name);
    const clubLabel = getNormalizedString(team?.club?.name);

    return (
      <View
        key={team?.documentId || team?.id}
        style={[
          ApplicationStyle.borderRadius16,
          {
            backgroundColor: `${Colors.primary500}14`,
            borderColor: `${Colors.primary500}33`,
            borderWidth: 1,
            gap: isLandscape ? 12 : 14,
            paddingHorizontal: isLandscape ? 16 : 18,
            paddingVertical: isLandscape ? 16 : 18,
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
  };

  const promptContent = (
    <View
      style={[
        Alignments.fill,
        Alignments.justifyCenter,
        {
          paddingHorizontal: overlayHorizontalPadding,
          paddingVertical: overlayVerticalPadding,
        },
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
            maxHeight: dialogMaxHeight,
            maxWidth: dialogMaxWidth,
            overflow: 'hidden',
            width: '100%',
          },
        ]}
      >
        {isLandscape ? (
          <ScrollView
            contentContainerStyle={{
              padding: 20,
            }}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={[
                Alignments.row,
                {
                  alignItems: 'flex-start',
                  gap: 18,
                },
              ]}
            >
              <View
                style={{
                  flex: 0.95,
                  minWidth: 0,
                  paddingRight: 4,
                }}
              >
                {renderPromptHeader()}
              </View>

              <View
                style={{
                  flex: 1.05,
                  gap: 12,
                  minWidth: 0,
                }}
              >
                {teamsNeedingExternalSource.map(renderTeamCard)}

                <View
                  style={{
                    paddingTop: 2,
                  }}
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
          </ScrollView>
        ) : (
          <>
            <View
              style={[
                Spaces.paddingHorizontal[24],
                {
                  paddingBottom: 18,
                  paddingTop: 24,
                },
              ]}
            >
              {renderPromptHeader()}
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
              {teamsNeedingExternalSource.map(renderTeamCard)}
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
          </>
        )}
      </View>
    </View>
  );

  if (!visible) {
    return null;
  }

  if (Platform.OS === 'web') {
    return (
      <View
        style={{
          bottom: 0,
          left: 0,
          position: 'fixed',
          right: 0,
          top: 0,
          zIndex: 1060,
        }}
      >
        {promptContent}
      </View>
    );
  }

  return (
    <Modal
      animationType="fade"
      onRequestClose={handleDismiss}
      transparent
      visible={visible}
    >
      {promptContent}
    </Modal>
  );
}

export default ExternalCompetitionPromptGate;
