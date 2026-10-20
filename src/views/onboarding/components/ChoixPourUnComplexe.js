import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';

import useTheme from '@/theme/themeContext';

import OnboardingRadioRow from '@/views/onboarding/components/OnboardingRadioRow';

/**
 * RESA-INSCRIPTION (19/10/2026) — « POUR UN COMPLEXE » AU CHOIX DU STATUT d'un nouveau compte
 * (plan validé E-G01 état 0, `docs/PLAN_ECRANS_RESERVATION_2026-10-13.md:302-306` ; planche
 * EG01-inscription, état 0) : un intertitre sous « Pour une mairie » et le choix « Je gère un
 * complexe », sur le modèle de « Je représente une collectivité ». Ce n'est PAS un rôle Strapi
 * (AT-01 : un seul compte ; le gérant l'est par la relation `gestionnaires` du complexe).
 * Un bloc à part, monté par `UserRole.js` seulement si `COMPLEXES_GERANT` est allumé.
 * @param {object} props - Les propriétés.
 * @param {boolean} props.checked - Le choix est coché.
 * @param {() => void} props.onPress - Cocher ou décocher.
 * @returns {import('react').ReactElement} L'intertitre et sa rangée.
 */
function ChoixPourUnComplexe({ checked, onPress }) {
  const { Fonts, Spaces } = useTheme();
  const { t } = useTranslation();

  return (
    <>
      <Text style={[Fonts.p3Bold, Fonts.neutral300, Spaces.marginTop[12]]}>
        {t('complexeGerant.statut.intertitre', 'Pour un complexe').toUpperCase()}
      </Text>
      <OnboardingRadioRow
        checked={checked}
        label={t('complexeGerant.statut.libelle', 'Je gère un complexe')}
        onPress={onPress}
        subtitle={t('complexeGerant.statut.precision', 'Foot à 5, padel, tennis…')}
        testID="statut-complexe"
      />
    </>
  );
}

export default ChoixPourUnComplexe;
