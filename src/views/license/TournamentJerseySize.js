import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Input from '@/components/molecules/input/Input';

import { LicenseCard, licenseSpacing } from './licenseDesignSystem';
import { ChoixUnique } from './TournamentParentalConsent';

const GAP = { gap: licenseSpacing.actionGap };

/** Les tailles du serveur (admin `tournament-payment.js`, JERSEY_SIZES), adultes. */
export const JERSEY_SIZES = Object.freeze(['XS', 'S', 'M', 'L', 'XL', 'XXL']);
const NOM_MAX = 12;
// ponytail: lettres latines accentuées seulement (le serveur accepte toute lettre Unicode, \p{L}) :
// Hermes et le site lisent cette classe partout ; un nom refusé ici reste facultatif.
const NOM = /^[A-Za-zÀ-ÖØ-öø-ÿ]+(?:[ -][A-Za-zÀ-ÖØ-öø-ÿ]+)*$/;

/**
 * @typedef {object} Maillot
 * @property {string} size - La taille (`''` : aucune).
 * @property {string} name - Le nom à imprimer (facultatif).
 * @property {string} number - Le numéro, tel que tapé (facultatif).
 */

/** @type {Readonly<Maillot>} Le maillot vide. */
export const MAILLOT_VIDE = Object.freeze({ name: '', number: '', size: '' });

/**
 * Le maillot gardé par le serveur (`tournament.jersey`), mis en forme pour le bloc.
 * @param {any} jersey - `{ size, name?, number? }` ou null.
 * @returns {Maillot} Le maillot, vide si rien n'est gardé.
 */
export const maillotGarde = (jersey) => (JERSEY_SIZES.includes(jersey?.size)
  ? {
    name: typeof jersey.name === 'string' ? jersey.name : '',
    number: Number.isInteger(jersey.number) ? String(jersey.number) : '',
    size: jersey.size,
  }
  : MAILLOT_VIDE);

const nomValable = (/** @type {string} */ nom) => {
  const propre = nom.trim().replace(/\s+/g, ' ');
  return !propre || ([...propre].length <= NOM_MAX && NOM.test(propre));
};
const numeroValable = (/** @type {string} */ numero) => {
  const propre = numero.trim();
  return !propre || (/^\d{1,2}$/.test(propre) && Number(propre) >= 1);
};

/**
 * Le maillot peut-il partir (taille choisie, nom et numéro vides ou valables) ?
 * @param {Maillot} valeur - Le maillot rempli.
 * @returns {boolean} Vrai si le paiement peut partir.
 */
export const maillotComplet = (valeur) => JERSEY_SIZES.includes(valeur.size)
  && nomValable(valeur.name) && numeroValable(valeur.number);

/**
 * Ce qui part avec le paiement (`jersey`) : la taille, et le nom et le numéro s'ils sont remplis.
 * @param {Maillot} valeur - Le maillot rempli.
 * @returns {{ size: string, name?: string, number?: number }} Le corps.
 */
export const maillotAEnvoyer = (valeur) => {
  const name = valeur.name.trim().replace(/\s+/g, ' ');
  const number = valeur.number.trim();
  return {
    ...(name ? { name } : {}),
    ...(number ? { number: Number(number) } : {}),
    size: valeur.size,
  };
};

/**
 * T-TAILLE (16/11/2026) — LE BLOC « Maillot » de la page de paiement d'une place de tournoi qui
 * demande les maillots (le serveur le dit : `tournament.jerseySizeRequired`). Le payeur choisit la
 * taille DU JOUEUR (il peut payer pour un autre) ; nom et numéro sont facultatifs. Le maillot est
 * un bonus non promis (conditions du tournoi, § 2). Après paiement, on ne change plus rien ici :
 * on écrit à l'assistance (conversation « Assistance FoundClub », MSG-SUPPORT). Le serveur refuse le
 * paiement sans taille valable : ce bloc n'est que l'interface.
 * @param {object} props - Les propriétés.
 * @param {(valeur: Maillot) => void} props.onChange - Le maillot modifié.
 * @param {Maillot} props.valeur - Le maillot en cours.
 * @returns {import('react').ReactElement} Le bloc.
 */
function TournamentJerseySize({ onChange, valeur }) {
  const { t } = useTranslation();
  const { Colors, Fonts } = useTheme();
  const p = 'publicLicensePayment.jerseySize';
  const poser = (/** @type {Partial<Maillot>} */ morceau) => onChange({ ...valeur, ...morceau });
  const erreur = [Fonts.p3, { color: Colors.error300 }];

  return (
    <LicenseCard style={null} tone={null} variant="muted">
      <View style={GAP} testID="jersey-size">
        <Text accessibilityRole="header" style={[Fonts.h3, Fonts.neutral00]}>
          {t(`${p}.heading`, 'Maillot du joueur')}
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {t(
            `${p}.noPromise`,
            'On le demande au cas où : le maillot est un bonus offert, dans la limite des tailles'
              + ' et des stocks. Il n’est pas promis et ne fait pas partie du prix.',
          )}
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {t(
            `${p}.intro`,
            'Choisis la taille du joueur inscrit, même si tu paies pour quelqu’un d’autre.',
          )}
        </Text>
        <ChoixUnique
          onChoisir={(size) => poser({ size })}
          options={JERSEY_SIZES.map((taille) => ({ label: taille, valeur: taille }))}
          prefixe="jersey-size"
          titre={t(`${p}.title`, 'Taille du maillot')}
          valeur={valeur.size}
        />
        {JERSEY_SIZES.includes(valeur.size) ? null : (
          <Text accessibilityLiveRegion="polite" style={erreur} testID="jersey-size-missing">
            {t(`${p}.missing`, 'Choisis une taille pour pouvoir payer.')}
          </Text>
        )}
        <Input
          autoCapitalize="characters"
          label={t(`${p}.name`, 'Nom à imprimer (facultatif, 12 lettres au plus)')}
          maxLength={NOM_MAX}
          onChangeText={(texte) => poser({ name: texte })}
          testID="jersey-name"
          value={valeur.name}
        />
        {nomValable(valeur.name) ? null : (
          <Text accessibilityLiveRegion="polite" style={erreur} testID="jersey-name-invalid">
            {t(`${p}.nameInvalid`, 'Nom : 12 lettres au plus, espaces et traits d’union permis.')}
          </Text>
        )}
        <Input
          keyboardType="number-pad"
          label={t(`${p}.number`, 'Numéro (facultatif, de 1 à 99)')}
          maxLength={2}
          onChangeText={(texte) => poser({ number: texte })}
          testID="jersey-number"
          value={valeur.number}
        />
        {numeroValable(valeur.number) ? null : (
          <Text accessibilityLiveRegion="polite" style={erreur} testID="jersey-number-invalid">
            {t(`${p}.numberInvalid`, 'Numéro : un nombre de 1 à 99.')}
          </Text>
        )}
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {t(
            `${p}.change`,
            'Après le paiement, la taille, le nom et le numéro ne se changent plus ici : écris à'
              + ' « Assistance FoundClub », en tête de tes Messages dans l’app FoundClub.',
          )}
        </Text>
      </View>
    </LicenseCard>
  );
}

export default TournamentJerseySize;
