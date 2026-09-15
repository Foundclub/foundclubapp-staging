import i18next from 'i18next';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Checkable from '@/components/atoms/checkable/Checkable';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';

import {
  buildLeagueLegalAcceptancePayload,
  LEAGUE_ADULT_REQUIRED_SCOPES,
  LEAGUE_LEGAL_SCOPES,
} from '@/constants/leagueLegalAcceptance';

/**
 * Les textes de la fenêtre, par portée : une fonction, pour que la langue soit lue à l'affichage.
 * @returns {Record<string, { action: string, description: string, title: string }>}
 */
const scopeContent = () => ({
  [LEAGUE_LEGAL_SCOPES.MATCH_CAPTAIN_ACCEPTANCE]: {
    action: i18next.t(
      'leagueLegalAcceptanceModal.scopes.matchCaptainAcceptance.action',
      'Confirmer le match',
    ),
    description: i18next.t(
      'leagueLegalAcceptanceModal.scopes.matchCaptainAcceptance.description',
      'Avant de confirmer ce match League, confirme le cadre de responsabilité de ton équipe et du lieu choisi.', // eslint-disable-line max-len
    ),
    title: i18next.t(
      'leagueLegalAcceptanceModal.scopes.matchCaptainAcceptance.title',
      'Confirmation League',
    ),
  },
  [LEAGUE_LEGAL_SCOPES.MATCH_CAPTAIN_PROPOSAL]: {
    action: i18next.t(
      'leagueLegalAcceptanceModal.scopes.matchCaptainProposal.action',
      'Envoyer la proposition',
    ),
    description: i18next.t(
      'leagueLegalAcceptanceModal.scopes.matchCaptainProposal.description',
      'Tu proposes une rencontre au nom de ton équipe. FoundClub facilite la mise en relation mais n organise pas le match.', // eslint-disable-line max-len
    ),
    title: i18next.t(
      'leagueLegalAcceptanceModal.scopes.matchCaptainProposal.title',
      'Proposition League',
    ),
  },
  [LEAGUE_LEGAL_SCOPES.MATCH_PLAYER_PARTICIPATION]: {
    action: i18next.t(
      'leagueLegalAcceptanceModal.scopes.matchPlayerParticipation.action',
      'Confirmer ma présence',
    ),
    description: i18next.t(
      'leagueLegalAcceptanceModal.scopes.matchPlayerParticipation.description',
      'Avant de participer à ce match League, confirme que tu acceptes les risques liés à la pratique sportive.', // eslint-disable-line max-len
    ),
    title: i18next.t(
      'leagueLegalAcceptanceModal.scopes.matchPlayerParticipation.title',
      'Participation League',
    ),
  },
  [LEAGUE_LEGAL_SCOPES.MATCH_VENUE_BOOKING]: {
    action: i18next.t(
      'leagueLegalAcceptanceModal.scopes.matchVenueBooking.action',
      'Marquer le terrain réservé',
    ),
    description: i18next.t(
      'leagueLegalAcceptanceModal.scopes.matchVenueBooking.description',
      'Avant de marquer le terrain comme réservé, confirme que la réservation et les conditions du lieu ont bien été gérées hors FoundClub.', // eslint-disable-line max-len
    ),
    title: i18next.t('leagueLegalAcceptanceModal.scopes.matchVenueBooking.title', 'Terrain League'),
  },
  [LEAGUE_LEGAL_SCOPES.TEAM_CREATE]: {
    action: i18next.t(
      'leagueLegalAcceptanceModal.scopes.teamCreate.action',
      'Créer mon équipe League',
    ),
    description: i18next.t(
      'leagueLegalAcceptanceModal.scopes.teamCreate.description',
      'Avant de créer une équipe FoundClub League, confirme que FoundClub est une plateforme de mise en relation et ne devient pas organisateur des rencontres.', // eslint-disable-line max-len
    ),
    title: i18next.t(
      'leagueLegalAcceptanceModal.scopes.teamCreate.title',
      'Cadre FoundClub League',
    ),
  },
  [LEAGUE_LEGAL_SCOPES.TEAM_INVITATION_ACCEPT]: {
    action: i18next.t(
      'leagueLegalAcceptanceModal.scopes.teamInvitationAccept.action',
      'Accepter l invitation',
    ),
    description: i18next.t(
      'leagueLegalAcceptanceModal.scopes.teamInvitationAccept.description',
      'Avant d accepter cette invitation League, confirme le cadre de pratique et de responsabilité applicable aux rencontres.', // eslint-disable-line max-len
    ),
    title: i18next.t(
      'leagueLegalAcceptanceModal.scopes.teamInvitationAccept.title',
      'Invitation FoundClub League',
    ),
  },
  [LEAGUE_LEGAL_SCOPES.TEAM_JOIN_REQUEST]: {
    action: i18next.t(
      'leagueLegalAcceptanceModal.scopes.teamJoinRequest.action',
      'Demander à rejoindre',
    ),
    description: i18next.t(
      'leagueLegalAcceptanceModal.scopes.teamJoinRequest.description',
      'Avant de rejoindre une équipe FoundClub League, confirme le cadre de pratique et de responsabilité applicable aux rencontres.', // eslint-disable-line max-len
    ),
    title: i18next.t(
      'leagueLegalAcceptanceModal.scopes.teamJoinRequest.title',
      'Rejoindre une équipe League',
    ),
  },
});

/**
 * @param {unknown} scope
 */
const getScopeContent = (scope) => scopeContent()[String(scope || '')] || {
  action: i18next.t('leagueLegalAcceptanceModal.scopes.default.action', 'Continuer'),
  description: i18next.t(
    'leagueLegalAcceptanceModal.scopes.default.description',
    'Confirme le cadre FoundClub League avant de continuer.',
  ),
  title: 'FoundClub League',
};

/**
 * @typedef {object} LeagueLegalAcceptanceModalProps
 * @property {boolean} [isSubmitting]
 * @property {boolean} isVisible
 * @property {Record<string, unknown>} [metadata]
 * @property {(payload: ReturnType<typeof buildLeagueLegalAcceptancePayload>) => void} [onAccept]
 * @property {() => void} [onClose]
 * @property {any} scope
 * @property {string} [sourceScreen]
 * @property {string} [targetDocumentId]
 * @property {string} [targetLabel]
 * @property {string} [targetType]
 */

/**
 * @param {LeagueLegalAcceptanceModalProps} props
 * @returns {import('react').ReactElement}
 */
function LeagueLegalAcceptanceModal({
  isSubmitting = false,
  isVisible,
  metadata,
  onAccept,
  onClose = () => {},
  scope,
  sourceScreen,
  targetDocumentId,
  targetLabel,
  targetType,
}) {
  const [acceptedContext, setAcceptedContext] = useState(false);
  const [acceptedRisk, setAcceptedRisk] = useState(false);
  const [acceptedRules, setAcceptedRules] = useState(false);
  const [acceptedAdult, setAcceptedAdult] = useState(false);
  const [acceptedExtra, setAcceptedExtra] = useState(false);
  const { t } = useTranslation();
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();

  const content = useMemo(() => getScopeContent(scope), [scope]);
  const needsTeamResponsibility = [
    LEAGUE_LEGAL_SCOPES.MATCH_CAPTAIN_ACCEPTANCE,
    LEAGUE_LEGAL_SCOPES.MATCH_CAPTAIN_PROPOSAL,
  ].includes(scope);
  const needsAdultConfirmation = LEAGUE_ADULT_REQUIRED_SCOPES.includes(scope);
  const needsVenueResponsibility = scope === LEAGUE_LEGAL_SCOPES.MATCH_VENUE_BOOKING;
  const hasExtra = needsTeamResponsibility || needsVenueResponsibility;
  const canConfirm = acceptedContext
    && acceptedRisk
    && acceptedRules
    && (!needsAdultConfirmation || acceptedAdult)
    && (!hasExtra || acceptedExtra);

  useEffect(() => {
    if (!isVisible) {
      setAcceptedContext(false);
      setAcceptedRisk(false);
      setAcceptedRules(false);
      setAcceptedAdult(false);
      setAcceptedExtra(false);
    }
  }, [isVisible]);

  const checkableWrapperStyle = [
    ApplicationStyle.borderWidth0,
    ApplicationStyle.backgroundColor.transparent,
    Spaces.padding[0],
    Alignments.rowReverse,
    { flex: 0, width: '100%' },
  ];

  const handleAccept = useCallback(() => {
    if (!canConfirm) return;
    onAccept?.(buildLeagueLegalAcceptancePayload({
      metadata,
      scope,
      sourceScreen,
      targetDocumentId,
      targetType,
    }));
  }, [canConfirm, metadata, onAccept, scope, sourceScreen, targetDocumentId, targetType]);

  return (
    <BottomModal
      close={onClose}
      contentBottomPaddingOverride={12}
      footerComponent={(
        <View style={[Spaces.gap[12]]}>
          <Button
            disabled={!canConfirm}
            isLoading={isSubmitting}
            onPress={handleAccept}
            title={content.action}
            variant="Primary"
          />
          <Button
            onPress={onClose}
            title={t('leagueLegalAcceptanceModal.cancel', 'Annuler')}
            variant="Secondary"
          />
        </View>
      )}
      headerComponent={(
        <View style={{ gap: 6 }}>
          <View style={[Alignments.row, Alignments.alignCenter, { gap: 6 }]}>
            <Text style={[Fonts.p3Bold, { color: Colors.primary200, letterSpacing: 1.1 }]}>FOUNDCLUB</Text>
            <Text style={[Fonts.p3Bold, { color: Colors.gold500, letterSpacing: 1.1 }]}>LEAGUE</Text>
          </View>
          <Text style={[Fonts.p1Black, Fonts.neutral00]}>{content.title}</Text>
        </View>
      )}
      isVisible={isVisible}
      snapPoints={['82%']}
    >
      <View style={{ gap: 20 }}>
        <Text style={[Fonts.p2, Fonts.neutral00]}>
          {content.description}
        </Text>

        {targetLabel ? (
          <View style={[
            ApplicationStyle.borderRadius16,
            ApplicationStyle.borderWidth1,
            Spaces.padding[16],
            { backgroundColor: 'rgba(0, 24, 33, 0.42)', borderColor: 'rgba(1, 179, 244, 0.28)' },
          ]}
          >
            <Text style={[Fonts.p3Bold, { color: Colors.primary200 }]}>
              {t('leagueLegalAcceptanceModal.regarding', 'Concerne')}
            </Text>
            <Text style={[Fonts.p2Bold, Fonts.neutral00, { marginTop: 6 }]}>{targetLabel}</Text>
          </View>
        ) : null}

        <View style={[
          ApplicationStyle.borderRadius16,
          ApplicationStyle.borderWidth1,
          Spaces.padding[16],
          { backgroundColor: 'rgba(0, 24, 33, 0.42)', borderColor: 'rgba(255, 212, 0, 0.26)' },
        ]}
        >
          <Text style={[Fonts.p2Bold, Fonts.neutral00, Spaces.marginBottom[12]]}>
            {t('leagueLegalAcceptanceModal.toConfirm', 'A confirmer')}
          </Text>
          <View style={{ gap: 14 }}>
            <Checkable
              fontStyle={[Fonts.p2, Fonts.neutral00]}
              isChecked={acceptedContext}
              setIsChecked={() => setAcceptedContext((previous) => !previous)}
              text={t(
                'leagueLegalAcceptanceModal.checks.context',
                'Je comprends que FoundClub ne fait que mettre en relation les équipes et participants, sans organiser ni superviser la rencontre.', // eslint-disable-line max-len
              )}
              type="square"
              wrapperStyle={checkableWrapperStyle}
            />
            <Checkable
              fontStyle={[Fonts.p2, Fonts.neutral00]}
              isChecked={acceptedRisk}
              setIsChecked={() => setAcceptedRisk((previous) => !previous)}
              text={t(
                'leagueLegalAcceptanceModal.checks.risk',
                'J accepte les risques normaux liés à la pratique sportive et je vérifie que mon état de santé me permet de participer.', // eslint-disable-line max-len
              )}
              type="square"
              wrapperStyle={checkableWrapperStyle}
            />
            <Checkable
              fontStyle={[Fonts.p2, Fonts.neutral00]}
              isChecked={acceptedRules}
              setIsChecked={() => setAcceptedRules((previous) => !previous)}
              text={t(
                'leagueLegalAcceptanceModal.checks.rules',
                'Je respecte les règles du lieu, les consignes de sécurité et je vérifie la couverture d assurance applicable.', // eslint-disable-line max-len
              )}
              type="square"
              wrapperStyle={checkableWrapperStyle}
            />
            {needsAdultConfirmation ? (
              <Checkable
                fontStyle={[Fonts.p2, Fonts.neutral00]}
                isChecked={acceptedAdult}
                setIsChecked={() => setAcceptedAdult((previous) => !previous)}
                text={t(
                  'leagueLegalAcceptanceModal.checks.adult',
                  'Je certifie avoir 18 ans ou plus pour créer ou rejoindre une squad FoundClub League.', // eslint-disable-line max-len
                )}
                type="square"
                wrapperStyle={checkableWrapperStyle}
              />
            ) : null}
            {hasExtra ? (
              <Checkable
                fontStyle={[Fonts.p2, Fonts.neutral00]}
                isChecked={acceptedExtra}
                setIsChecked={() => setAcceptedExtra((previous) => !previous)}
                text={needsVenueResponsibility
                  ? t(
                    'leagueLegalAcceptanceModal.checks.venue',
                    'Je confirme que le terrain, les horaires et les conditions du lieu ont été verifies par les participants concernés.', // eslint-disable-line max-len
                  )
                  : t(
                    'leagueLegalAcceptanceModal.checks.teamLead',
                    'Je confirme agir comme membre référent de mon équipe pour cette proposition ou confirmation de match.', // eslint-disable-line max-len
                  )}
                type="square"
                wrapperStyle={checkableWrapperStyle}
              />
            ) : null}
          </View>
        </View>

        <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
          {t(
            'leagueLegalAcceptanceModal.footer',
            'Cette confirmation est enregistrée avec la version legale active pour garder une preuve d acceptation.', // eslint-disable-line max-len
          )}
        </Text>
      </View>
    </BottomModal>
  );
}

export default LeagueLegalAcceptanceModal;
