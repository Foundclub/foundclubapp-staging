import { useTranslation } from 'react-i18next';
import {
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

// T-ORGA-REGLAGES (18/11) — le prix, l'âge minimum, le seuil de joueurs payés et le maillot d'un
// tournoi (`tournamentConfig.entryFeeCents`, `minAge`, `paidMembersToValidate`,
// `jerseySizeRequired`).
// Les mêmes champs dans l'assistant (EventWizardTournamentSettings) et dans « Modifier les
// paramètres » (TournamentSettingsEdit). Le serveur juge les mêmes règles (admin
// tournament-closure.js `regleDuTournoiIllisible`).
// Témoins : __tests__/TournamentSettingsEdit.TORGAREGLAGES.test.js,
// wizard/__tests__/EventWizardTournoi.TORGAREGLAGES.test.js
// et wizard/__tests__/EventWizardRecap.TORGAREGLAGES.test.js.

export const SEUIL_DE_PAYES_PAR_DEFAUT = 5;

/**
 * « 20 » ou « 19,50 » en centimes ; vide = 0 (gratuit) ; illisible ou négatif = NaN.
 * @param {unknown} texte La saisie.
 * @returns {number} Des centimes entiers, ou NaN.
 */
export const lireEurosEnCentimes = (texte) => {
  const propre = String(texte ?? '').trim();
  if (!propre) return 0;
  if (!/^\d{1,4}([.,]\d{1,2})?$/.test(propre)) return Number.NaN;
  return Math.round(Number.parseFloat(propre.replace(',', '.')) * 100);
};

/**
 * 2000 => « 20 », 1950 => « 19,50 », 0 ou absent => « ».
 * @param {unknown} centimes Le prix enregistré.
 * @returns {string} Le texte du champ.
 */
export const centimesEnTexteEuros = (centimes) => {
  const valeur = Math.round(Number(centimes));
  if (!Number.isFinite(valeur) || valeur <= 0) return '';
  return valeur % 100 === 0 ? String(valeur / 100) : (valeur / 100).toFixed(2).replace('.', ',');
};

/**
 * Un entier saisi.
 * @param {unknown} texte La saisie.
 * @returns {number | null} null si vide, NaN si illisible.
 */
const lireEntier = (texte) => {
  const propre = String(texte ?? '').trim();
  if (!propre) return null;
  return /^\d+$/.test(propre) ? Number.parseInt(propre, 10) : Number.NaN;
};

/**
 * @typedef {object} SaisiesPayantes
 * @property {string} [feeText] Le prix en euros.
 * @property {string} [minAgeText] L'âge minimum.
 * @property {string} [paidText] Le seuil de joueurs payés.
 * @property {boolean} [jerseyRequired] Le maillot obligatoire.
 */

/**
 * @typedef {object} LectureDesReglesPayantes
 * @property {{ entryFeeCents: number, minAge: number | null, paidMembersToValidate: number | null,
 *   jerseySizeRequired: boolean }} config Ce qui part au serveur.
 * @property {{ fee: boolean, minAge: boolean, paid: boolean }} errors Les erreurs.
 * @property {boolean} hasError Une erreur au moins.
 */

/**
 * Les champs saisis, lus pour le serveur, et leurs erreurs.
 * @param {SaisiesPayantes} champs Les saisies.
 * @returns {LectureDesReglesPayantes} La lecture.
 */
export const lireReglesPayantes = ({
  feeText, jerseyRequired, minAgeText, paidText,
}) => {
  const entryFeeCents = lireEurosEnCentimes(feeText);
  const minAge = lireEntier(minAgeText);
  const paid = lireEntier(paidText);
  const errors = {
    fee: Number.isNaN(entryFeeCents),
    minAge: minAge !== null && (Number.isNaN(minAge) || minAge < 1 || minAge > 99),
    // T-SANS-PLAFOND (18/11, Adel D239) : plus de nombre maximum, donc plus de « seuil >
    // effectif max ».
    paid: paid !== null && (Number.isNaN(paid) || paid < 1),
  };
  return {
    config: {
      entryFeeCents: errors.fee ? 0 : entryFeeCents,
      jerseySizeRequired: jerseyRequired === true,
      minAge: errors.minAge ? null : minAge,
      paidMembersToValidate: errors.paid ? null : paid,
    },
    errors,
    hasError: Object.values(errors).some(Boolean),
  };
};

/**
 * Les textes de départ, depuis une configuration enregistrée (ou rien).
 * @param {any} config La configuration du tournoi.
 * @returns {{ feeText: string, jerseyRequired: boolean, minAgeText: string,
 *   paidText: string }} Les saisies.
 */
export const textesDesReglesPayantes = (config) => ({
  feeText: centimesEnTexteEuros(config?.entryFeeCents),
  jerseyRequired: config?.jerseySizeRequired === true,
  minAgeText: Number(config?.minAge) > 0 ? String(Math.round(Number(config.minAge))) : '',
  paidText: String(Number(config?.paidMembersToValidate) > 0
    ? Math.round(Number(config.paidMembersToValidate))
    : SEUIL_DE_PAYES_PAR_DEFAUT),
});

/**
 * La carte des règles payantes d'un tournoi.
 * @param {object} props Proprietes.
 * @param {{ feeText: string, minAgeText: string, paidText: string,
 *   jerseyRequired: boolean }} props.values Les saisies.
 * @param {(patch: object) => void} props.onChange Une saisie change.
 * @param {boolean} [props.showClubWarning] Aucun club porteur connu.
 * @param {any} props.cardStyle Le style de la carte.
 * @param {any} props.inputStyle Le style des champs.
 * @returns {import('react').ReactElement} La carte des règles payantes.
 */
function TournamentPaidRulesFields({
  cardStyle, inputStyle, onChange, showClubWarning = false, values,
}) {
  const { t } = useTranslation();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const { config, errors } = lireReglesPayantes(values);

  /**
   * Un champ numérique, son titre et son aide (ou son erreur).
   * @param {{ error: string | null, help: string, label: string,
   *   onChangeText: (texte: string) => void, placeholder: string, testID: string,
   *   value: string, keyboardType?: any }} champ Le champ.
   * @returns {import('react').ReactElement} Le champ rendu.
   */
  const renderChamp = ({
    error, help, keyboardType = 'number-pad', label, onChangeText, placeholder, testID, value,
  }) => (
    <View style={Spaces.gap[8]}>
      <Text style={[Fonts.p3Bold, Fonts.primary500]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.neutral500}
        style={inputStyle}
        testID={testID}
        value={value}
      />
      {error ? (
        <Text style={[Fonts.p3, Fonts.error500]}>{error}</Text>
      ) : (
        <Text style={[Fonts.p3, Fonts.neutral200]}>{help}</Text>
      )}
    </View>
  );

  const paidError = errors.paid
    ? t('tournamentPaidRules.paidInvalid', 'Saisis au moins 1 joueur.')
    : null;

  return (
    <View style={cardStyle}>
      <View style={Spaces.gap[8]}>
        <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
          {t('tournamentPaidRules.title', 'Inscription et paiement')}
        </Text>
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {t(
            'tournamentPaidRules.subtitle',
            'Le prix, l’âge minimum et le maillot s’appliquent à chaque joueur inscrit.',
          )}
        </Text>
      </View>

      {renderChamp({
        error: errors.fee
          ? t(
            'tournamentPaidRules.priceInvalid',
            'Saisis un prix en euros, par exemple 20 ou 19,50.',
          )
          : null,
        help: t('tournamentPaidRules.priceHelp', 'Laisse vide pour un tournoi gratuit.'),
        keyboardType: 'decimal-pad',
        label: t('tournamentPaidRules.priceLabel', 'Prix par joueur (€)'),
        onChangeText: (feeText) => onChange({ feeText }),
        placeholder: 'Ex. 20',
        testID: 'tournoi-regles-prix',
        value: values.feeText,
      })}

      {showClubWarning && config.entryFeeCents > 0 ? (
        <Text style={[Fonts.p3Bold, Fonts.error500]} testID="tournoi-regles-club-porteur">
          {t(
            'tournamentPaidRules.needsClub',
            // eslint-disable-next-line max-len -- le message du serveur, entier.
            'Un tournoi payant doit être porté par un club. Organise-le au nom de ton club, ou laisse-le gratuit.',
          )}
        </Text>
      ) : null}

      {renderChamp({
        error: errors.minAge
          ? t('tournamentPaidRules.minAgeInvalid', 'Saisis un âge entre 1 et 99 ans.')
          : null,
        help: t('tournamentPaidRules.minAgeHelp', 'Laisse vide pour accepter tous les âges.'),
        label: t('tournamentPaidRules.minAgeLabel', 'Âge minimum'),
        onChangeText: (minAgeText) => onChange({ minAgeText }),
        placeholder: 'Ex. 16',
        testID: 'tournoi-regles-age',
        value: values.minAgeText,
      })}

      {renderChamp({
        error: paidError,
        help: t(
          'tournamentPaidRules.paidHelp',
          'L’équipe est validée dès que ce nombre de joueurs a payé.',
        ),
        label: t('tournamentPaidRules.paidLabel', 'Joueurs payés pour valider l’équipe'),
        onChangeText: (paidText) => onChange({ paidText }),
        placeholder: 'Ex. 5',
        testID: 'tournoi-regles-seuil',
        value: values.paidText,
      })}

      <View
        style={[
          Alignments.row,
          Alignments.alignCenter,
          Alignments.justifySpaceBetween,
          Spaces.gap[12],
          { minHeight: 44 },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
            {t('tournamentPaidRules.jerseyLabel', 'Taille de maillot obligatoire')}
          </Text>
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {t(
              'tournamentPaidRules.jerseyHelp',
              'Chaque joueur indique sa taille en s’inscrivant.',
            )}
          </Text>
        </View>
        <Switch
          accessibilityLabel={t('tournamentPaidRules.jerseyLabel', 'Taille de maillot obligatoire')}
          onValueChange={(jerseyRequired) => onChange({ jerseyRequired })}
          testID="tournoi-regles-maillot"
          thumbColor={Colors.neutral00}
          trackColor={{ false: Colors.neutral500, true: Colors.primary500 }}
          value={values.jerseyRequired === true}
        />
      </View>
    </View>
  );
}

export default TournamentPaidRulesFields;
