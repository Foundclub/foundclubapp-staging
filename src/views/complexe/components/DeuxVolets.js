import { View } from 'react-native';

import useTheme from '@/theme/themeContext';

/**
 * LES DEUX VOLETS DU GÉRANT AU COMPTOIR — RESA-L5A2 (14/10/2026), planche OR1 : sur ordinateur
 * (≥ 1024 px), la liste à gauche et la fiche à droite (E-G04 + E-G05, E-G06), comme les demandes
 * de la Ville (`CollectiviteRequests`). Sous 1024 px, la liste seule : un écran à la fois.
 * @param {object} props - Les propriétés.
 * @param {boolean} props.actif - Deux volets (ordinateur) ou la liste seule.
 * @param {import('react').ReactNode} props.children - La liste (le volet gauche).
 * @param {import('react').ReactNode} props.droite - La fiche (le volet droit).
 * @returns {import('react').ReactElement} Les volets.
 */
function DeuxVolets({ actif, children, droite }) {
  const { Alignments } = useTheme();
  // Sur téléphone, la liste telle quelle (aucune vue de plus autour).
  if (!actif) return /** @type {import('react').ReactElement} */ (children);
  return (
    <View style={[Alignments.row, Alignments.fill, { gap: 24 }]}>
      <View style={{ flex: 1, maxWidth: 560 }}>{children}</View>
      <View style={{ flex: 1, paddingTop: 12 }} testID="volet-fiche">{droite}</View>
    </View>
  );
}

export default DeuxVolets;
