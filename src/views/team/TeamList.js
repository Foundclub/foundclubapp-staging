import { useFocusEffect } from '@react-navigation/native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  TouchableOpacity,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import { useClubScope } from '@/context/ClubScopeContext';
import { TutorialIds } from '@/domains/tutorial/tutorialIds';
import useTheme from '@/theme/themeContext';

import WebFloatingOverlay from '@/components/atoms/webFloatingOverlay/WebFloatingOverlay';
import LeagueHeaderSwitch from '@/components/molecules/header/LeagueHeaderSwitch';
import NotificationBadge from '@/components/molecules/notificationBadge/NotificationBadge';
import OnboardingWrapper from '@/components/molecules/onboardingWrapper/OnboardingWrapper';
import ProfileButton from '@/components/molecules/profileButton/ProfileButton';
import TutorialFlowBoundary from '@/components/molecules/tutorial/TutorialFlowBoundary';
import GlobalPromptModal from '@/components/organisms/popup/GlobalPromptModal';
import TeamListContent from '@/components/organisms/teamListContent/TeamListContent';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { getFloatingActionContainerStyle } from '@/navigation/commonOptions';
import { RouteNames } from '@/navigation/routeNames';
import useBottomDockLayout from '@/navigation/useBottomDockLayout';

import {
  POPUP_DISMISS_SCOPES,
  POPUP_IDS,
} from '@/constants/popupRegistry';
import { useBlockingOverlayPrompt } from '@/context/BlockingOverlayContext';
import { usePopupEligibility } from '@/context/PopupManagerContext';

/**
 * Team list screen component
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} Team list screen component
 */
function TeamList({ navigation, route }) {
  const { t } = useTranslation();
  const { canManageTeam, refetchUserData, userData } = useAuth();
  const clubScope = useClubScope() || {};
  const clubId = clubScope.activeMode === 'section'
    ? (clubScope.activeSectionClubId || route?.params?.clubId || userData?.club?.documentId)
    : (route?.params?.clubId || userData?.club?.documentId);
  const assignmentTrainerName = route?.params?.assignmentTrainerName;
  const assignmentTrainerId = route?.params?.assignmentTrainerId;
  const openAssignTrainerGuide = route?.params?.openAssignTrainerGuide;
  const { floatingActionBottomOffset } = useBottomDockLayout();
  const trainerGuidePopup = usePopupEligibility(
    POPUP_IDS.TEAM_ASSIGN_TRAINER_GUIDE,
    Boolean(openAssignTrainerGuide),
    {
      cooldownKey: assignmentTrainerId || assignmentTrainerName || clubId || 'default',
      dismissScope: POPUP_DISMISS_SCOPES.SESSION,
    },
  );
  const canShowTrainerGuide = useBlockingOverlayPrompt(
    trainerGuidePopup.descriptor.id,
    trainerGuidePopup.canShow,
    trainerGuidePopup.descriptor.priority,
  );
  const isTrainerGuideVisible = Boolean(
    openAssignTrainerGuide
    && trainerGuidePopup.canShow
    && canShowTrainerGuide,
  );

  useFocusEffect(() => {
    refetchUserData();
  });

  useEffect(() => {
    if (!isTrainerGuideVisible) return;
    trainerGuidePopup.markShown({
      assignmentTrainerId,
      assignmentTrainerName,
    });
  }, [assignmentTrainerId, assignmentTrainerName, isTrainerGuideVisible, trainerGuidePopup]);

  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Images,
    Spaces,
  } = useTheme();

  const floatingButtonBottom = floatingActionBottomOffset;

  const handleAddTeam = () => {
    navigation.navigate(RouteNames.TeamStack, {
      params: { clubId },
      screen: RouteNames.TeamWizardName,
    });
  };

  const dismissTrainerGuide = () => {
    trainerGuidePopup.dismiss(POPUP_DISMISS_SCOPES.SESSION);
    navigation.setParams({
      openAssignTrainerGuide: false,
    });
  };

  return (
    <TutorialFlowBoundary
      onForceStartHandled={() => {
        navigation.setParams({
          startTutorial: undefined,
          tutorialId: undefined,
          tutorialSource: undefined,
          tutorialStartToken: undefined,
        });
      }}
      routeParams={route?.params}
      tutorialId={TutorialIds.MY_TEAMS}
      userId={userData?.documentId}
    >
      <ScreenContainer
        bgImage="bg2"
        contentContainerStyle={[
          Spaces.paddingBottom[24],
          Alignments.justifySpaceBetween,
          Alignments.column,
          Alignments.fill,
        ]}
        responsiveHorizontalPadding
      >
        <View
          style={[
            Spaces.marginTop[16],
            Spaces.marginBottom[24],
            Alignments.row,
            Alignments.alignCenter,
            Alignments.justifySpaceBetween,
          ]}
        >
          <LeagueHeaderSwitch />
          <View style={{ alignItems: 'center', flexDirection: 'row' }}>
            <NotificationBadge />
            <ProfileButton />
          </View>
        </View>

        <OnboardingWrapper
          description="Consultez vos équipes, les demandes et ouvrez chaque fiche équipe."
          id="team-list-main-content"
          order={1}
          spotlight={{
            borderRadius: 16,
            maxHeight: 280,
            overlayOpacity: 0.4,
            paddingX: 2,
            paddingY: 2,
          }}
          style={{ flex: 1 }}
          title="Mes équipes"
        >
          <TeamListContent
            assignmentTrainerId={assignmentTrainerId}
            assignmentTrainerName={assignmentTrainerName}
            clubId={clubId}
          />
        </OnboardingWrapper>

        {canManageTeam ? (
          <WebFloatingOverlay
            style={getFloatingActionContainerStyle(floatingButtonBottom, { zIndex: 1100 })}
          >
            <TouchableOpacity
              accessibilityLabel={t('teamList.actions.add', 'Ajouter une equipe')}
              accessibilityRole="button"
              activeOpacity={0.85}
              onPress={handleAddTeam}
              style={[
                ApplicationStyle.shadow200,
                {
                  alignItems: 'center',
                  backgroundColor: Colors.primary500,
                  borderColor: 'rgba(255,255,255,0.18)',
                  borderRadius: 32,
                  borderWidth: 1,
                  elevation: 8,
                  height: 64,
                  justifyContent: 'center',
                  shadowColor: 'black',
                  shadowOffset: {
                    height: 6,
                    width: 0,
                  },
                  shadowOpacity: 0.32,
                  shadowRadius: 12,
                  width: 64,
                },
              ]}
            >
              <Image
                resizeMode="contain"
                source={Images.strokeShield}
                style={{
                  height: 24,
                  // Icone porteuse d'information sur fond primary500 : blanc = 2,40:1
                  // (sous le seuil 3:1 des elements graphiques), primary900 = 7,96:1.
                  tintColor: Colors.primary900,
                  width: 24,
                }}
              />
              <View
                style={{
                  alignItems: 'center',
                  backgroundColor: Colors.primary200,
                  borderColor: 'rgba(255,255,255,0.36)',
                  borderRadius: 999,
                  borderWidth: 1,
                  height: 20,
                  justifyContent: 'center',
                  position: 'absolute',
                  right: 8,
                  top: 8,
                  width: 20,
                }}
              >
                <Image
                  resizeMode="contain"
                  source={Images.plus}
                  style={{
                    height: 10,
                    tintColor: Colors.primary900,
                    width: 10,
                  }}
                />
              </View>
            </TouchableOpacity>
          </WebFloatingOverlay>
        ) : null}

        <GlobalPromptModal
          body={`${assignmentTrainerName || 'Cet entraîneur'} est maintenant dans votre club.\n\n1. Ouvrez une équipe.\n2. Appuyez sur "Modifier".\n3. Dans la section "Entraîneurs", ajoutez-le puis validez.`}
          inlineOnAndroid
          onRequestClose={dismissTrainerGuide}
          primaryAction={{
            label: t('common.actions.ok', 'OK'),
            onPress: dismissTrainerGuide,
          }}
          title="Assigner un entraîneur"
          visible={isTrainerGuideVisible}
        />
      </ScreenContainer>
    </TutorialFlowBoundary>
  );
}

export default TeamList;
