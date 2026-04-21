import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Checkable from '@/components/atoms/checkable/Checkable';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';

import {
  buildLeagueLegalAcceptancePayload,
  LEAGUE_LEGAL_SCOPES,
} from '@/constants/leagueLegalAcceptance';

const SCOPE_CONTENT = {
  [LEAGUE_LEGAL_SCOPES.MATCH_CAPTAIN_ACCEPTANCE]: {
    action: 'Confirmer le match',
    description: 'Avant de confirmer ce match League, confirmez le cadre de responsabilite de votre equipe et du lieu choisi.',
    title: 'Confirmation League',
  },
  [LEAGUE_LEGAL_SCOPES.MATCH_CAPTAIN_PROPOSAL]: {
    action: 'Envoyer la proposition',
    description: 'En tant que capitaine, vous proposez une rencontre entre equipes. FoundClub facilite la mise en relation mais n organise pas le match.',
    title: 'Proposition League',
  },
  [LEAGUE_LEGAL_SCOPES.MATCH_PLAYER_PARTICIPATION]: {
    action: 'Confirmer ma presence',
    description: 'Avant de participer a ce match League, confirmez que vous acceptez les risques lies a la pratique sportive.',
    title: 'Participation League',
  },
  [LEAGUE_LEGAL_SCOPES.MATCH_VENUE_BOOKING]: {
    action: 'Marquer le terrain reserve',
    description: 'Avant de marquer le terrain comme reserve, confirmez que la reservation et les conditions du lieu ont bien ete gerees hors FoundClub.',
    title: 'Terrain League',
  },
  [LEAGUE_LEGAL_SCOPES.TEAM_CREATE]: {
    action: 'Creer mon equipe League',
    description: 'Avant de creer une equipe FoundClub League, confirmez que FoundClub est une plateforme de mise en relation et ne devient pas organisateur des rencontres.',
    title: 'Cadre FoundClub League',
  },
  [LEAGUE_LEGAL_SCOPES.TEAM_INVITATION_ACCEPT]: {
    action: 'Accepter l invitation',
    description: 'Avant d accepter cette invitation League, confirmez le cadre de pratique et de responsabilite applicable aux rencontres.',
    title: 'Invitation FoundClub League',
  },
  [LEAGUE_LEGAL_SCOPES.TEAM_JOIN_REQUEST]: {
    action: 'Demander a rejoindre',
    description: 'Avant de rejoindre une equipe FoundClub League, confirmez le cadre de pratique et de responsabilite applicable aux rencontres.',
    title: 'Rejoindre une equipe League',
  },
};

const getScopeContent = (scope) => SCOPE_CONTENT[scope] || {
  action: 'Continuer',
  description: 'Confirmez le cadre FoundClub League avant de continuer.',
  title: 'FoundClub League',
};

function LeagueLegalAcceptanceModal({
  isSubmitting = false,
  isVisible,
  metadata,
  onAccept,
  onClose,
  scope,
  sourceScreen,
  targetDocumentId,
  targetLabel,
  targetType,
}) {
  const [acceptedContext, setAcceptedContext] = useState(false);
  const [acceptedRisk, setAcceptedRisk] = useState(false);
  const [acceptedRules, setAcceptedRules] = useState(false);
  const [acceptedExtra, setAcceptedExtra] = useState(false);
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();

  const content = useMemo(() => getScopeContent(scope), [scope]);
  const needsCaptainResponsibility = [
    LEAGUE_LEGAL_SCOPES.MATCH_CAPTAIN_ACCEPTANCE,
    LEAGUE_LEGAL_SCOPES.MATCH_CAPTAIN_PROPOSAL,
  ].includes(scope);
  const needsVenueResponsibility = scope === LEAGUE_LEGAL_SCOPES.MATCH_VENUE_BOOKING;
  const hasExtra = needsCaptainResponsibility || needsVenueResponsibility;
  const canConfirm = acceptedContext && acceptedRisk && acceptedRules && (!hasExtra || acceptedExtra);

  useEffect(() => {
    if (!isVisible) {
      setAcceptedContext(false);
      setAcceptedRisk(false);
      setAcceptedRules(false);
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
            title="Annuler"
            variant="Secondary"
          />
        </View>
      )}
      headerComponent={(
        <View style={[Spaces.gap[6]]}>
          <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[6]]}>
            <Text style={[Fonts.p3Bold, { color: Colors.primary200, letterSpacing: 1.1 }]}>FOUNDCLUB</Text>
            <Text style={[Fonts.p3Bold, { color: '#FFD400', letterSpacing: 1.1 }]}>LEAGUE</Text>
          </View>
          <Text style={[Fonts.p1Black, Fonts.neutral00]}>{content.title}</Text>
        </View>
      )}
      isVisible={isVisible}
      snapPoints={['82%']}
    >
      <View style={[Spaces.gap[20]]}>
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
            <Text style={[Fonts.p3Bold, { color: Colors.primary200 }]}>Concerne</Text>
            <Text style={[Fonts.p2Bold, Fonts.neutral00, Spaces.marginTop[6]]}>{targetLabel}</Text>
          </View>
        ) : null}

        <View style={[
          ApplicationStyle.borderRadius16,
          ApplicationStyle.borderWidth1,
          Spaces.padding[16],
          { backgroundColor: 'rgba(0, 24, 33, 0.42)', borderColor: 'rgba(255, 212, 0, 0.26)' },
        ]}
        >
          <Text style={[Fonts.p2Bold, Fonts.neutral00, Spaces.marginBottom[12]]}>A confirmer</Text>
          <View style={[Spaces.gap[14]]}>
            <Checkable
              fontStyle={[Fonts.p2, Fonts.neutral00]}
              isChecked={acceptedContext}
              setIsChecked={() => setAcceptedContext((previous) => !previous)}
              text="Je comprends que FoundClub ne fait que mettre en relation les equipes et participants, sans organiser ni superviser la rencontre."
              type="square"
              wrapperStyle={checkableWrapperStyle}
            />
            <Checkable
              fontStyle={[Fonts.p2, Fonts.neutral00]}
              isChecked={acceptedRisk}
              setIsChecked={() => setAcceptedRisk((previous) => !previous)}
              text="J accepte les risques normaux lies a la pratique sportive et je verifie que mon etat de sante me permet de participer."
              type="square"
              wrapperStyle={checkableWrapperStyle}
            />
            <Checkable
              fontStyle={[Fonts.p2, Fonts.neutral00]}
              isChecked={acceptedRules}
              setIsChecked={() => setAcceptedRules((previous) => !previous)}
              text="Je respecte les regles du lieu, les consignes de securite et je verifie la couverture d assurance applicable."
              type="square"
              wrapperStyle={checkableWrapperStyle}
            />
            {hasExtra ? (
              <Checkable
                fontStyle={[Fonts.p2, Fonts.neutral00]}
                isChecked={acceptedExtra}
                setIsChecked={() => setAcceptedExtra((previous) => !previous)}
                text={needsVenueResponsibility
                  ? 'Je confirme que le terrain, les horaires et les conditions du lieu ont ete verifies par les participants concernes.'
                  : 'Je confirme agir comme capitaine/referent de mon equipe pour cette proposition ou confirmation de match.'}
                type="square"
                wrapperStyle={checkableWrapperStyle}
              />
            ) : null}
          </View>
        </View>

        <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>Cette confirmation est enregistree avec la version legale active pour garder une preuve d acceptation.</Text>
      </View>
    </BottomModal>
  );
}

export default LeagueLegalAcceptanceModal;
