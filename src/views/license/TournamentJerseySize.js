import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import { LicenseCard, licenseSpacing } from './licenseDesignSystem';
import { ChoixUnique } from './TournamentParentalConsent';

const GAP = { gap: licenseSpacing.actionGap };

/** Les tailles du serveur (admin `tournament-payment.js`, JERSEY_SIZES), adultes. */
export const JERSEY_SIZES = Object.freeze(['XS', 'S', 'M', 'L', 'XL', 'XXL']);

/**
 * T-TAILLE (16/11/2026) — LE BLOC « Taille du maillot » de la page de paiement d'une place de
 * tournoi qui fournit les maillots (le serveur le dit : `tournament.jerseySizeRequired`). Le payeur
 * choisit la taille DU JOUEUR (il peut payer pour un autre). Le serveur refuse le paiement sans
 * taille valable : ce bloc n'est que l'interface. La taille ne se change plus après paiement.
 * @param {object} props - Les propriétés.
 * @param {(valeur: string) => void} props.onChange - La taille choisie.
 * @param {string} props.valeur - La taille en cours (`''` : aucune).
 * @returns {import('react').ReactElement} Le bloc.
 */
function TournamentJerseySize({ onChange, valeur }) {
  const { t } = useTranslation();
  const { Colors, Fonts } = useTheme();
  const p = 'publicLicensePayment.jerseySize';
  const titre = t(`${p}.title`, 'Taille du maillot');

  return (
    <LicenseCard style={null} tone={null} variant="muted">
      <View style={GAP} testID="jersey-size">
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {t(
            `${p}.intro`,
            'Le maillot est compris dans la place. Choisis la taille du joueur inscrit,'
              + ' même si tu paies pour quelqu’un d’autre.',
          )}
        </Text>
        <ChoixUnique
          onChoisir={onChange}
          options={JERSEY_SIZES.map((taille) => ({ label: taille, valeur: taille }))}
          prefixe="jersey-size"
          titre={titre}
          valeur={valeur}
        />
        {JERSEY_SIZES.includes(valeur) ? null : (
          <Text
            accessibilityLiveRegion="polite"
            style={[Fonts.p3, { color: Colors.error300 }]}
            testID="jersey-size-missing"
          >
            {t(`${p}.missing`, 'Choisis une taille pour pouvoir payer.')}
          </Text>
        )}
      </View>
    </LicenseCard>
  );
}

export default TournamentJerseySize;
