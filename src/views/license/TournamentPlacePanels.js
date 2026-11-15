import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

import { LicenseCard, licenseSpacing } from './licenseDesignSystem';

const GAP = { gap: licenseSpacing.actionGap };

// T-PAIE (15/11) — les deux blocs d'une PLACE DE TOURNOI sur la page publique
// `/licenses/pay/:token` (PublicLicensePayment.js). Une licence ne les voit jamais.

/**
 * Le résultat du paiement, au retour de Stripe : « Place payée » (ou « en cours de confirmation »),
 * l'équipe, et le lien vers la fiche du tournoi. Lisible sans compte.
 * @param {object} props - Les propriétés.
 * @param {boolean} props.isPaid - La place est-elle payée (lu sur le serveur, pas dans l'adresse) ?
 * @param {() => void} props.onOpenTournament - Ouvre la fiche du tournoi.
 * @param {string} props.returnStatus - `success`, `cancelled` ou vide (adresse de retour).
 * @param {{ eventDocumentId?: string, teamName?: string }} props.tournament - Équipe, tournoi.
 * @returns {import('react').ReactElement | null} Le bloc, ou rien.
 */
export function TournamentPlaceResult({
  isPaid, onOpenTournament, returnStatus, tournament,
}) {
  const { t } = useTranslation();
  const { Fonts } = useTheme();

  if (returnStatus === 'cancelled' && !isPaid) {
    return (
      <LicenseCard style={null} tone={null} variant="muted">
        <View style={GAP}>
          <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
            {t('publicLicensePayment.tournament.cancelledTitle', 'Paiement annulé')}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            {t(
              'publicLicensePayment.tournament.cancelledDescription',
              'Rien n’a été débité. Tu peux réessayer quand tu veux.',
            )}
          </Text>
        </View>
      </LicenseCard>
    );
  }
  if (returnStatus !== 'success' && !isPaid) return null;

  const teamName = tournament?.teamName
    || t('publicLicensePayment.tournament.teamFallback', 'du joueur');
  return (
    <LicenseCard style={null} tone={null}>
      <View style={GAP}>
        <Text style={[Fonts.h3, Fonts.neutral00]}>
          {isPaid
            ? t('publicLicensePayment.tournament.paidTitle', 'Place payée')
            : t(
              'publicLicensePayment.tournament.confirmingTitle',
              'Paiement en cours de confirmation',
            )}
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {isPaid
            ? t(
              'publicLicensePayment.tournament.paidDescription',
              'Merci ! Cette place est réglée pour l’équipe {{teamName}}.',
              { teamName, ...SANS_ECHAPPEMENT },
            )
            : t(
              'publicLicensePayment.tournament.confirmingDescription',
              'Stripe nous prévient en quelques secondes : cette page se met à jour toute seule.',
            )}
        </Text>
        {tournament?.eventDocumentId ? (
          <Button
            onPress={onOpenTournament}
            title={t('publicLicensePayment.tournament.openTournament', 'Voir la fiche du tournoi')}
            variant="Secondary"
          />
        ) : null}
      </View>
    </LicenseCard>
  );
}

/**
 * La mention due AVANT de payer (C. conso. L221-5 et L221-28 12°), le lien vers les conditions,
 * puis le bouton Stripe.
 * ponytail: texte provisoire (CGV v2, partie I) ; sortie : la clé `noWithdrawal` des traductions.
 * @param {object} props - Les propriétés.
 * @param {boolean} props.canPay - Le bouton Stripe est-il proposé ?
 * @param {string | null} [props.complexeName] - Le complexe du tournoi (phrase du favori), ou null.
 * @param {boolean} [props.disabled] - T-PARENT : bouton inactif (autorisation parentale incomplète).
 * @param {boolean} props.isLoading - Le paiement s'ouvre-t-il ?
 * @param {() => void} props.onOpenTerms - Ouvre les conditions d'inscription.
 * @param {() => void} props.onPay - Ouvre le paiement Stripe.
 * @returns {import('react').ReactElement} Le bloc.
 */
export function TournamentPlacePay({
  canPay, complexeName = null, disabled = false, isLoading, onOpenTerms, onPay,
}) {
  const { t } = useTranslation();
  const { Fonts } = useTheme();

  return (
    <View style={GAP}>
      <LicenseCard style={null} tone={null} variant="muted">
        <View style={GAP}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
            {t(
              'publicLicensePayment.tournament.noWithdrawal',
              'Activité de loisir à date fixe : pas de droit de rétractation'
                + ' (art. L221-28 12° du Code de la consommation).',
            )}
          </Text>
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {t(
              'publicLicensePayment.tournament.payForOthers',
              'Paiement sécurisé par Stripe. Tu peux aussi payer la place d’un autre joueur'
                + ' en ouvrant son lien.',
            )}
          </Text>
          <Button
            onPress={onOpenTerms}
            title={t('publicLicensePayment.tournament.termsLink', "Conditions d'inscription")}
            variant="SecondaryLight"
          />
        </View>
      </LicenseCard>
      {/* T-COMPLEXE, étape 2 (D13 B) : au paiement confirmé, le complexe du tournoi passe dans les
          favoris du joueur (serveur) ; on le dit avant le bouton. Le nom vient du serveur. */}
      {canPay && complexeName ? (
        <Text style={[Fonts.p3, Fonts.neutral200]} testID="tournament-place-favori">
          {t(
            'complexeEvenements.favoriAuPaiement',
            'En t’inscrivant, tu ajoutes {{complexe}} à tes favoris sur FoundClub.'
              + ' Tu peux le retirer à tout moment.',
            { complexe: complexeName, ...SANS_ECHAPPEMENT },
          )}
        </Text>
      ) : null}
      {canPay ? (
        <Button
          disabled={disabled}
          isLoading={isLoading}
          onPress={onPay}
          title={t('publicLicensePayment.tournament.payStripe', 'Payer ma place')}
        />
      ) : null}
    </View>
  );
}
