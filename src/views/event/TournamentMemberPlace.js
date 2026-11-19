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
 * PAGE-EQUIPE (19/11) — l'étiquette « Payé » / « À payer » (courte) ou « Place payée » /
 * « Place à payer », seule à droite d'une ligne de joueur (maquette 3a), ou dans
 * `TournamentMemberPlace`.
 * IMPL-2 (Adel 18/11, « plus aucun vert ») : « payée » en bleu primaire.
 * @param {object} props - Les propriétés.
 * @param {MemberPlace | undefined} props.place - La place du membre.
 * @param {boolean} [props.compact] - La pastille courte.
 * @returns {import('react').ReactElement | null} L'étiquette, ou rien.
 */
export function PlaceStatusTag({ compact = false, place }) {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  if (!place) return null;
  const isPaid = place.status === 'paid';
  const statusTone = isPaid ? Colors.primary500 : Colors.warning500;
  let texte = isPaid
    ? t('tournamentTeamDetails.places.paid', 'Place payée')
    : t('tournamentTeamDetails.places.due', 'Place à payer');
  if (compact) texte = isPaid ? t('implEquipe.roster.paid') : t('implEquipe.roster.due');
  return (
    <Tag
      style={tagStyle(statusTone)}
      text={texte}
      textColor="neutral00"
      textStyle={{ color: statusTone }}
    />
  );
}

/**
 * PAGE-EQUIPE (19/11) — la taille de maillot d'une place, en mots (T-PAGES-5), ou ''.
 * @param {MemberPlace | undefined} place - La place du membre.
 * @param {(key: string, options?: any) => string} t - La traduction.
 * @returns {string} « Taille choisie : M », « Taille : au paiement », ou ''.
 */
export const getPlaceSizeLabel = (place, t) => {
  if (!place) return '';
  const hasSize = Object.prototype.hasOwnProperty.call(place, 'jerseySize');
  if (hasSize && place.jerseySize) {
    return t('tournamentTeamProgress.sizeChosen', { size: place.jerseySize, ...SANS_ECHAPPEMENT });
  }
  if (hasSize && place.status !== 'paid') {
    return t('tournamentTeamDetails.places.sizeAtPayment', 'Taille : au paiement');
  }
  return '';
};

/**
 * PAGE-EQUIPE (19/11) — « Copier le lien de paiement » de la place d'un autre joueur (qui gère
 * l'équipe), rangé dans le menu de la ligne ou sous elle.
 * @param {object} props - Les propriétés.
 * @param {string} props.paymentUrl - Le lien de paiement de la place.
 * @returns {import('react').ReactElement} Le bouton.
 */
export function CopyPaymentLinkButton({ paymentUrl }) {
  const { t } = useTranslation();
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
  return (
    <Button
      onPress={copyLink}
      size="sm"
      style={{ alignSelf: 'stretch', maxWidth: '100%' }}
      title={t('tournamentTeamDetails.places.copyLink', 'Copier le lien de paiement')}
      variant="Secondary"
    />
  );
}

/**
 * « Place payée » / « Place à payer », la taille de maillot (T-PAGES-5), puis « Copier le lien de
 * paiement » (qui gère l'équipe) ou « Payer ma place » (le joueur lui-même).
 * T-PAGES-2 (17/11) : « Payer ma place » ouvre la page de paiement dans le MÊME onglet sur le site
 * (R8, `openUrlHere`) ; sur une ligne de l'effectif, la page met son seul « Payer ma place » en
 * tête (`showSelfPay` faux ici) ; le lien copié prend toute la largeur de la ligne, il ne dépasse
 * plus de la carte à 375 px (R11, fait F5).
 * @param {object} props - Les propriétés.
 * @param {MemberPlace | undefined} props.place - La place du membre (`team.payment.members`).
 * @param {boolean} [props.showSelfPay] - Montre « Payer ma place » sur la place du lecteur.
 * @param {boolean} [props.compact] - IMPL-2 (planches 3a, 4a) : la pastille courte « Payé » /
 *   « À payer »
 *   d'une ligne de l'effectif.
 * @param {string} [props.payLabel] - IMPL-2 (9a) : le libellé du bouton, avec le prix.
 * @param {boolean} [props.payFullWidth] - PAGE-EQUIPE (9a) : « Payer ma place » sur toute la
 *   largeur, à la taille ordinaire.
 * @returns {import('react').ReactElement | null} La ligne, ou rien.
 */
export function TournamentMemberPlace({
  compact = false, payFullWidth = false, payLabel = '', place, showSelfPay = true,
}) {
  const { t } = useTranslation();
  const { Colors, Spaces } = useTheme();
  const paymentUrl = place?.paymentUrl || '';
  const payMine = useCallback(() => LinksPlatform.openUrlHere(paymentUrl), [paymentUrl]);

  if (!place) return null;
  const isPaid = place.status === 'paid';
  const sizeLabel = getPlaceSizeLabel(place, t);
  return (
    <View style={Spaces.gap[8]}>
      <View style={[Spaces.gap[8], { flexDirection: 'row', flexWrap: 'wrap' }]}>
        <PlaceStatusTag compact={compact} place={place} />
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
          size={payFullWidth ? undefined : 'sm'}
          style={payFullWidth
            ? { alignSelf: 'stretch', maxWidth: '100%' }
            : { alignSelf: 'flex-start', maxWidth: '100%' }}
          title={payLabel || t('tournamentTeamDetails.places.payMine', 'Payer ma place')}
          variant="Primary"
        />
      ) : null}
      {!isPaid && paymentUrl && !place.isSelf ? (
        <CopyPaymentLinkButton paymentUrl={paymentUrl} />
      ) : null}
    </View>
  );
}
