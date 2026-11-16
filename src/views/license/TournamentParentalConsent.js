import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import {
  LIENS_DU_PARENT,
  PHRASES_DE_L_AUTORISATION,
  RETOURS,
  TEXTE_DE_L_IMAGE,
  VERSION_DE_L_AUTORISATION,
} from '@/domains/tournoi/autorisationParentale';
import useTheme from '@/theme/themeContext';

import CaseACocher from '@/components/atoms/caseACocher/CaseACocher';
import Input from '@/components/molecules/input/Input';

import { LicenseCard, licenseSpacing } from './licenseDesignSystem';

const GAP = { gap: licenseSpacing.actionGap };
// Même règle que le serveur (admin `tournament-payment.js`, PHONE_PATTERN), sans les espaces.
const TELEPHONE = /^(\+\d{8,15}|0\d{9})$/;

/**
 * @typedef {object} Autorisation
 * @property {boolean} accepted - La case obligatoire.
 * @property {boolean} imageConsent - La case image (facultative).
 * @property {string} parentName - Nom et prénom du parent.
 * @property {string} parentPhone - Son téléphone.
 * @property {string} relation - `father`, `mother` ou `legal_guardian`.
 * @property {string} returnMode - `alone` ou `picked_up`.
 */

/** @type {Readonly<Autorisation>} L'autorisation vide (la case image est non cochée par défaut). */
export const AUTORISATION_VIDE = Object.freeze({
  accepted: false,
  imageConsent: false,
  parentName: '',
  parentPhone: '',
  relation: '',
  returnMode: '',
});

/**
 * L'autorisation est-elle complète (case cochée, champs du parent valables) ?
 * @param {Autorisation} valeur - Ce que le parent a rempli.
 * @returns {boolean} Vrai si le paiement peut partir.
 */
export const autorisationComplete = (valeur) => valeur.accepted === true
  && valeur.parentName.trim().length >= 2
  && LIENS_DU_PARENT.includes(valeur.relation)
  && TELEPHONE.test(valeur.parentPhone.replace(/[\s.()-]/g, ''))
  && RETOURS.includes(valeur.returnMode);

/**
 * Ce qui part avec le paiement (`parentalConsent`) : la version du texte lu en plus.
 * @param {Autorisation} valeur - Ce que le parent a rempli.
 * @returns {object} Le corps de l'autorisation.
 */
export const autorisationAEnvoyer = (valeur) => ({
  ...valeur,
  legalVersion: VERSION_DE_L_AUTORISATION,
});

/**
 * Un choix parmi quelques-uns (lien, retour ; T-TAILLE : taille du maillot), en pastilles.
 * @param {object} props - Les propriétés.
 * @param {string} props.prefixe - Préfixe des témoins (`testID`).
 * @param {(valeur: string) => void} props.onChoisir - Le geste.
 * @param {Array<{ label: string, valeur: string }>} props.options - Les choix.
 * @param {string} props.titre - Le libellé.
 * @param {string} props.valeur - Le choix actuel.
 * @returns {import('react').ReactElement} Le choix.
 */
export function ChoixUnique({
  onChoisir, options, prefixe, titre, valeur,
}) {
  const { Colors, Fonts } = useTheme();
  return (
    <View accessibilityLabel={titre} accessibilityRole="radiogroup" style={{ gap: 8 }}>
      <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{titre}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map((option) => {
          const actif = option.valeur === valeur;
          return (
            <TouchableOpacity
              accessibilityLabel={option.label}
              accessibilityRole="radio"
              accessibilityState={{ selected: actif }}
              key={option.valeur}
              onPress={() => onChoisir(option.valeur)}
              style={{
                backgroundColor: actif ? Colors.primary500 : 'transparent',
                borderColor: actif ? Colors.primary500 : Colors.primary200,
                borderRadius: 999,
                borderWidth: 1,
                justifyContent: 'center',
                minHeight: 44,
                paddingHorizontal: 16,
              }}
              testID={`${prefixe}-${option.valeur}`}
            >
              <Text style={[Fonts.p2Bold, actif ? { color: Colors.primary900 } : Fonts.neutral00]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

/**
 * T-PARENT (15/11/2026, Adel D20 A) — LE BLOC « Autorisation parentale » de la page de paiement
 * d'une place de tournoi, pour un joueur de 16 ou 17 ans (le serveur le dit :
 * `tournament.parentalConsentRequired`). Le parent donne son nom, son lien avec le joueur, son
 * téléphone, dit comment l'enfant rentre, et coche la case OBLIGATOIRE ; la case image est
 * FACULTATIVE (sans elle : « pas d'image »). Le serveur refuse le paiement sans autorisation
 * valable : ce bloc n'est que l'interface. Texte : `domains/tournoi/autorisationParentale.js`.
 * @param {object} props - Les propriétés.
 * @param {(valeur: Autorisation) => void} props.onChange - L'autorisation modifiée.
 * @param {Autorisation} props.valeur - L'autorisation en cours.
 * @returns {import('react').ReactElement} Le bloc.
 */
function TournamentParentalConsent({ onChange, valeur }) {
  const { t } = useTranslation();
  const { Fonts } = useTheme();
  const poser = (/** @type {Partial<Autorisation>} */ morceau) => (
    onChange({ ...valeur, ...morceau })
  );
  const p = 'publicLicensePayment.parentalConsent';

  return (
    <LicenseCard style={null} tone={null} variant="muted">
      <View style={GAP} testID="parental-consent">
        <Text accessibilityRole="header" style={[Fonts.h3, Fonts.neutral00]}>
          {t(`${p}.title`, 'Autorisation parentale')}
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {t(
            `${p}.intro`,
            'Ce joueur a 16 ou 17 ans : un de ses parents remplit ce bloc avant le paiement,'
              + ' même si la place est payée par quelqu’un d’autre.',
          )}
        </Text>
        <Input
          autoComplete="name"
          label={t(`${p}.parentName`, 'Nom et prénom du parent')}
          onChangeText={(texte) => poser({ parentName: texte })}
          testID="parental-consent-name"
          value={valeur.parentName}
        />
        <ChoixUnique
          onChoisir={(relation) => poser({ relation })}
          options={[
            { label: t(`${p}.relation.mother`, 'Mère'), valeur: 'mother' },
            { label: t(`${p}.relation.father`, 'Père'), valeur: 'father' },
            {
              label: t(`${p}.relation.legal_guardian`, 'Représentant légal'),
              valeur: 'legal_guardian',
            },
          ]}
          prefixe="parental-consent-relation"
          titre={t(`${p}.relation.title`, 'Lien avec le joueur')}
          valeur={valeur.relation}
        />
        <Input
          autoComplete="tel"
          keyboardType="phone-pad"
          label={t(`${p}.parentPhone`, 'Téléphone du parent, joignable le soir du tournoi')}
          onChangeText={(texte) => poser({ parentPhone: texte })}
          testID="parental-consent-phone"
          value={valeur.parentPhone}
        />
        <ChoixUnique
          onChoisir={(returnMode) => poser({ returnMode })}
          options={[
            { label: t(`${p}.return.alone`, 'Il rentre seul'), valeur: 'alone' },
            {
              label: t(`${p}.return.picked_up`, 'Quelqu’un vient le chercher'),
              valeur: 'picked_up',
            },
          ]}
          prefixe="parental-consent-return"
          titre={t(`${p}.return.title`, 'Après le tournoi')}
          valeur={valeur.returnMode}
        />
        {PHRASES_DE_L_AUTORISATION.map((phrase) => (
          <Text key={phrase} style={[Fonts.p3, Fonts.neutral200]}>{phrase}</Text>
        ))}
        <CaseACocher
          actif={valeur.accepted}
          onBasculer={() => poser({ accepted: !valeur.accepted })}
          testID="parental-consent-accept"
          titre={t(`${p}.accept`, 'J’autorise mon enfant à participer au tournoi')}
        />
        <CaseACocher
          actif={valeur.imageConsent}
          dit={TEXTE_DE_L_IMAGE}
          onBasculer={() => poser({ imageConsent: !valeur.imageConsent })}
          testID="parental-consent-image"
          titre={t(`${p}.image`, 'Les deux parents autorisent photos et vidéos (facultatif)')}
        />
        {autorisationComplete(valeur) ? null : (
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {t(`${p}.missing`, 'Remplis les champs et coche l’autorisation pour pouvoir payer.')}
          </Text>
        )}
      </View>
    </LicenseCard>
  );
}

export default TournamentParentalConsent;
