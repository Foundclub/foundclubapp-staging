import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Alert, Text, View } from 'react-native';

import {
  closedThatDayText, hoursLabel, placeWithPreposition, relocationErrorMessage, shortDay,
} from '@/domains/relocation/relocationDisplay';
import { formatCollectiviteOfferedBy } from '@/domains/subscription/subscriptionDecision';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

import { decideRelocation } from '@/services/event/eventService';

/**
 * COLL-R-DEPLACER A8 (14/10, COL-013, décision d'Adel « D9 = b ») — LA PROPOSITION DE LA VILLE,
 * chez le club (planche P5v4-deplacer-ville-tel écran 5 b ; P5v4-deplacer-ordi état D) : la place
 * proposée, la fermeture qui la motive, et deux gestes — « Accepter » (la séance, elle seule,
 * passe à la place proposée ; ses joueurs sont prévenus) et « Choisir une autre place » (le
 * tunnel « Déplacer la séance »). Le club garde la main (D16). Le serveur ne la rend qu'à qui
 * peut déplacer la séance.
 * @param {{ onChooseOther?: () => void, proposal: any }} props - La proposition
 *   (`relocationProposal` de la fiche) ; `onChooseOther` : ouvrir le tunnel.
 * @returns {import('react').ReactElement | null} La carte, ou rien.
 */
function RelocationProposalCard({ onChooseOther, proposal }) {
  const { t } = useTranslation();
  const { Colors, Fonts } = useTheme();
  const queryClient = useQueryClient();
  const accepter = useMutation({
    meta: { preventToastError: true },
    mutationFn: () => decideRelocation(proposal?.documentId, 'accept'),
    onError: (erreur) => {
      Alert.alert(
        t('deplacerSeance.erreurs.titre', 'La séance n’a pas bougé'),
        relocationErrorMessage(t, erreur),
      );
    },
    onSuccess: async () => {
      await Promise.all(['event', 'events', 'planning']
        .map((cle) => queryClient.invalidateQueries({ queryKey: [cle] })));
      Alert.alert(
        t('deplacerSeance.fait.deplacee', 'Séance déplacée {{lieu}}', {
          ...SANS_ECHAPPEMENT, lieu: placeWithPreposition(t, proposal?.facility?.name),
        }),
        t('deplacerSeance.proposition.joueursPrevenus', 'Tes joueurs sont prévenus.'),
      );
    },
  });
  if (!proposal?.documentId || proposal.status !== 'pending') return null;

  const ville = formatCollectiviteOfferedBy(proposal.collectivite?.name || '');
  return (
    <View
      accessibilityRole="summary"
      style={{
        backgroundColor: withAlpha(Colors.primary800, 0.82),
        borderColor: withAlpha(Colors.primary500, 0.45),
        borderRadius: 16,
        borderWidth: 1,
        gap: 8,
        padding: 16,
      }}
      testID="proposition-de-la-ville"
    >
      <Text style={[Fonts.p3Bold, { color: Colors.primary200 }]}>
        {ville
          ? t('deplacerSeance.proposition.de', 'Proposition de {{ville}}', {
            ...SANS_ECHAPPEMENT, ville,
          })
          : t('deplacerSeance.proposition.deLaVille', 'Proposition de la Ville')}
      </Text>
      <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
        {[
          proposal.facility?.name,
          shortDay(proposal.date),
          hoursLabel(proposal.startTime, proposal.endTime),
        ].filter(Boolean).join(' · ')}
      </Text>
      {proposal.closure ? (
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {closedThatDayText(t, proposal.closure, proposal.fromFacility?.name)}
        </Text>
      ) : null}
      <View style={{ gap: 8 }}>
        <Button
          isLoading={accepter.isPending}
          onPress={() => accepter.mutate()}
          title={t('deplacerSeance.proposition.accepter', 'Accepter')}
          variant="Primary"
        />
        {onChooseOther ? (
          <Button
            disabled={accepter.isPending}
            onPress={onChooseOther}
            title={t('deplacerSeance.proposition.autrePlace', 'Choisir une autre place')}
            variant="Secondary"
          />
        ) : null}
      </View>
      <Text style={[Fonts.p3, Fonts.neutral200]}>
        {t(
          'deplacerSeance.proposition.aide',
          'Accepter déplace la séance et prévient tes joueurs.',
        )}
      </Text>
    </View>
  );
}

export default RelocationProposalCard;
