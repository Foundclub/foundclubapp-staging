import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Text, View } from 'react-native';

import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Tag from '@/components/atoms/tag/Tag';

import LinksPlatform from '@/platform/links';
import SharePlatform from '@/platform/share';

/**
 * Le fond et le bord d'une étiquette teintée (même règle que `getToneTagStyle`).
 * @param {string} tone - La couleur.
 * @returns {{ backgroundColor: string, borderColor: string }} Le style.
 */
const tagStyle = (tone) => ({ backgroundColor: `${tone}18`, borderColor: `${tone}33` });

// T-PAIE (15/11) — la place d'un membre sur la fiche d'une équipe de tournoi payant. Le bloc
// `team.payment` vient du serveur (admin, contrôleur tournament-team) : `paymentUrl` n'y est que
// pour qui gère l'équipe (toutes les places) ou pour le joueur lui-même (la sienne).

/**
 * @typedef {{ entryFeeCents?: number, paidCount?: number, paidMembersToValidate?: number }} Places
 * @typedef {{ isSelf?: boolean, jerseySize?: string | null, paymentUrl?: string | null,
 *   status?: string }} MemberPlace
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
 * « Place payée » / « Place à payer », la taille de maillot (T-PAGES-5), puis « Copier le lien de
 * paiement » (qui gère l'équipe) ou « Payer ma place » (le joueur lui-même).
 * T-PAGES-2 (17/11) : « Payer ma place » ouvre la page de paiement dans le MÊME onglet sur le site
 * (R8, `openUrlInPlace`) ; sur une ligne de l'effectif, la page met son seul « Payer ma place » en
 * tête (`showSelfPay` faux ici) ; le lien copié prend toute la largeur de la ligne, il ne dépasse
 * plus de la carte à 375 px (R11, fait F5).
 * @param {object} props - Les propriétés.
 * @param {MemberPlace | undefined} props.place - La place du membre (`team.payment.members`).
 * @param {boolean} [props.showSelfPay] - Montre « Payer ma place » sur la place du lecteur.
 * @returns {import('react').ReactElement | null} La ligne, ou rien.
 */
export function TournamentMemberPlace({ place, showSelfPay = true }) {
  const { t } = useTranslation();
  const { Colors, Spaces } = useTheme();
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
  const payMine = useCallback(() => LinksPlatform.openUrlInPlace(paymentUrl), [paymentUrl]);

  if (!place) return null;
  const isPaid = place.status === 'paid';
  const statusTone = isPaid ? Colors.success500 : Colors.warning500;
  const hasSize = Object.prototype.hasOwnProperty.call(place, 'jerseySize');
  let sizeLabel = null;
  if (hasSize && place.jerseySize) {
    sizeLabel = t('tournamentTeamProgress.sizeChosen', {
      size: place.jerseySize, ...SANS_ECHAPPEMENT,
    });
  } else if (hasSize && !isPaid) {
    sizeLabel = t('tournamentTeamDetails.places.sizeAtPayment', 'Taille : au paiement');
  }
  return (
    <View style={Spaces.gap[8]}>
      <View style={[Spaces.gap[8], { flexDirection: 'row', flexWrap: 'wrap' }]}>
        <Tag
          style={tagStyle(statusTone)}
          text={isPaid
            ? t('tournamentTeamDetails.places.paid', 'Place payée')
            : t('tournamentTeamDetails.places.due', 'Place à payer')}
          textColor="neutral00"
          textStyle={{ color: statusTone }}
        />
        {sizeLabel ? (
          <Tag
            style={tagStyle(Colors.neutral300)}
            text={sizeLabel}
            textColor="neutral00"
            textStyle={{ color: Colors.neutral200 }}
          />
        ) : null}
      </View>
      {!isPaid && paymentUrl && place.isSelf && showSelfPay ? (
        <Button
          onPress={payMine}
          size="sm"
          style={{ alignSelf: 'flex-start', maxWidth: '100%' }}
          title={t('tournamentTeamDetails.places.payMine', 'Payer ma place')}
          variant="Primary"
        />
      ) : null}
      {!isPaid && paymentUrl && !place.isSelf ? (
        <Button
          onPress={copyLink}
          size="sm"
          style={{ alignSelf: 'stretch', maxWidth: '100%' }}
          title={t('tournamentTeamDetails.places.copyLink', 'Copier le lien de paiement')}
          variant="Secondary"
        />
      ) : null}
    </View>
  );
}
