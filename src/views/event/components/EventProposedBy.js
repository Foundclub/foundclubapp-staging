import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';

import { libelleOrganisateur } from '@/domains/event/organisateurEvenement';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

/**
 * ORGANISATEUR-VISIBLE (19/11, D258 « 2- A ») — « Proposé par Prénom N. » sous le bandeau de la fiche
 * (téléphone). Rien quand le serveur ne rend pas de prénom, ni sur un tournoi (voir `libelleOrganisateur`).
 * @param {{ event: any }} props - l'événement de la fiche.
 * @returns {JSX.Element|null} La ligne, ou rien.
 */
function EventProposedBy({ event }) {
  const { t } = useTranslation();
  const { Fonts } = useTheme();
  const name = libelleOrganisateur(event);
  if (!name) return null;
  return (
    <Text style={[Fonts.p3, Fonts.neutral300]} testID="event-details-proposed-by">
      {t('eventCardNew.proposedBy', 'Proposé par {{name}}', { name, ...SANS_ECHAPPEMENT })}
    </Text>
  );
}

export default EventProposedBy;
