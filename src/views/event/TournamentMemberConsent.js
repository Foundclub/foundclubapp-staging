import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';

import useTheme from '@/theme/themeContext';

/**
 * T-AGE puis T-PARENT (15/11/2026) — sous le nom d'un membre de 16-17 ans, sur la fiche
 * d'équipe : « Autorisation parentale attendue » (marque du serveur), puis « Autorisation
 * parentale reçue » quand le parent a coché la case sur la page de paiement, et « Pas d'image »
 * s'il n'a pas coché la case image. Le serveur ne pose ces champs que pour qui voit les
 * personnes (capitaine, gestionnaires, organisateur). Un adulte n'en a aucun : rien ne s'affiche.
 * @param {object} props - Les propriétés.
 * @param {any} props.member - Le membre (vue d'équipe du serveur).
 * @returns {import('react').ReactElement | null} Les mentions, ou rien.
 */
function TournamentMemberConsent({ member }) {
  const { t } = useTranslation();
  const { Colors, Fonts } = useTheme();
  const id = member?.documentId;
  const attente = [Fonts.p4, { color: Colors.warning500 }];
  return (
    <>
      {member?.parentalConsentPending === true ? (
        <Text style={attente} testID={`tournament-member-parental-consent-${id}`}>
          {t('tournamentTeamDetails.parentalConsentPending', 'Autorisation parentale attendue')}
        </Text>
      ) : null}
      {member?.parentalConsentReceived === true ? (
        <Text
          style={[Fonts.p4, { color: Colors.success500 }]}
          testID={`tournament-member-parental-consent-${id}`}
        >
          {t('tournamentTeamDetails.parentalConsentReceived', 'Autorisation parentale reçue')}
        </Text>
      ) : null}
      {member?.noImage === true ? (
        <Text style={attente} testID={`tournament-member-no-image-${id}`}>
          {t('tournamentTeamDetails.noImage', 'Pas d’image')}
        </Text>
      ) : null}
    </>
  );
}

export default TournamentMemberConsent;
