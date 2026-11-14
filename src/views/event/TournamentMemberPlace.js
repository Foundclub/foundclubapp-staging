import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Text, View } from 'react-native';

import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

import LinksPlatform from '@/platform/links';
import SharePlatform from '@/platform/share';

// T-PAIE (15/11) — la place d'un membre sur la fiche d'une équipe de tournoi payant. Le bloc
// `team.payment` vient du serveur (admin, contrôleur tournament-team) : `paymentUrl` n'y est que
// pour qui gère l'équipe (toutes les places) ou pour le joueur lui-même (la sienne).

/**
 * @typedef {{ entryFeeCents?: number, paidCount?: number, paidMembersToValidate?: number }} Places
 * @typedef {{ isSelf?: boolean, paymentUrl?: string | null, status?: string }} MemberPlace
 */

/**
 * Le résumé des places : « Places payées : 1/5 pour valider l'équipe ».
 * @param {object} props - Les propriétés.
 * @param {Places | undefined} props.payment - Le bloc `payment` de l'équipe.
 * @returns {import('react').ReactElement | null} Le résumé, ou rien.
 */
export function TournamentPlacesSummary({ payment }) {
  const { t } = useTranslation();
  const { Fonts } = useTheme();
  if (!payment) return null;
  const amount = `${(Number(payment.entryFeeCents || 0) / 100).toLocaleString('fr-FR')} €`;
  return (
    <Text style={[Fonts.p3, Fonts.neutral100]}>
      {t(
        'tournamentTeamDetails.places.summary',
        'Places payées : {{paid}}/{{needed}} pour valider l’équipe ({{amount}} par joueur).',
        {
          amount,
          needed: payment.paidMembersToValidate || 5,
          paid: payment.paidCount || 0,
          ...SANS_ECHAPPEMENT,
        },
      )}
    </Text>
  );
}

/**
 * « Place payée » / « Place à payer », puis « Copier le lien de paiement » (qui gère l'équipe) ou
 * « Payer ma place » (le joueur lui-même).
 * @param {object} props - Les propriétés.
 * @param {MemberPlace | undefined} props.place - La place du membre (`team.payment.members`).
 * @returns {import('react').ReactElement | null} La ligne, ou rien.
 */
export function TournamentMemberPlace({ place }) {
  const { t } = useTranslation();
  const { Colors, Fonts, Spaces } = useTheme();
  const paymentUrl = place?.paymentUrl || '';

  const copyLink = useCallback(async () => {
    const ok = await SharePlatform.copier(paymentUrl);
    Alert.alert(
      ok
        ? t('tournamentTeamDetails.places.copied', 'Lien copié')
        : t('tournamentTeamDetails.places.copyFailed', 'Copie impossible'),
      ok
        ? t('tournamentTeamDetails.places.copiedHint', 'Envoie-le au joueur ou à son parent.')
        : paymentUrl,
    );
  }, [paymentUrl, t]);
  const payMine = useCallback(() => LinksPlatform.openUrl(paymentUrl), [paymentUrl]);

  if (!place) return null;
  const isPaid = place.status === 'paid';
  return (
    <View style={Spaces.gap[8]}>
      <Text style={[Fonts.p4Bold, { color: isPaid ? Colors.success500 : Colors.warning500 }]}>
        {isPaid
          ? t('tournamentTeamDetails.places.paid', 'Place payée')
          : t('tournamentTeamDetails.places.due', 'Place à payer')}
      </Text>
      {!isPaid && paymentUrl && place.isSelf ? (
        <Button
          onPress={payMine}
          size="sm"
          style={{ alignSelf: 'flex-start' }}
          title={t('tournamentTeamDetails.places.payMine', 'Payer ma place')}
          variant="Primary"
        />
      ) : null}
      {!isPaid && paymentUrl && !place.isSelf ? (
        <Button
          onPress={copyLink}
          size="sm"
          style={{ alignSelf: 'flex-start' }}
          title={t('tournamentTeamDetails.places.copyLink', 'Copier le lien de paiement')}
          variant="Secondary"
        />
      ) : null}
    </View>
  );
}
