import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import { RouteNames } from '@/navigation/routeNames';

import { useAdminManagerRequests } from '@/services/collectivite/collectiviteQueries';

/**
 * 🏛️ LES PORTES DE LA FILE « DEMANDES DE GESTIONNAIRE » — COLL-ACCUEIL (01/10/2026).
 *   - sans `collectiviteId` (la liste des collectivités de la console) : l'entrée de la file,
 *     avec le nombre en attente ;
 *   - avec `collectiviteId` (la fiche d'une collectivité) : SEULEMENT le lien « Ouvrir dans la
 *     file », quand une demande attend pour CETTE collectivité (planche P2-fiche, note « La
 *     demande d'un agent apparaît aussi sur la fiche de sa Ville »). Le reste de la console
 *     est restylé par le lot C-CONSOLE.
 * @param {{ collectiviteId?: string | null }} props - La collectivité de la fiche, ou rien.
 * @returns {import('react').ReactElement | null} La porte, ou rien.
 */
function ManagerRequestsLink({ collectiviteId = null }) {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const enAttente = useAdminManagerRequests('pending');
  const demandes = Array.isArray(enAttente.data) ? enAttente.data : [];
  const concernees = collectiviteId
    ? demandes.filter((demande) => demande?.collectivite?.documentId === collectiviteId)
    : demandes;

  if (collectiviteId && concernees.length === 0) return null;

  const ouvrir = () => navigation.navigate(
    RouteNames.AdminManagerRequests,
    collectiviteId ? { collectiviteId } : undefined,
  );

  let libelle = t('collectiviteAccueil.console.titre', 'Demandes de gestionnaire');
  if (collectiviteId) {
    libelle = concernees.length === 1
      ? t(
        'collectiviteAccueil.console.ficheUne',
        '1 demande de gestionnaire pour cette collectivité',
      )
      : t(
        'collectiviteAccueil.console.ficheDes',
        '{{nombre}} demandes de gestionnaire pour cette collectivité',
        { nombre: concernees.length },
      );
  }

  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={ouvrir}
      style={[
        ApplicationStyle.borderRadius16,
        Alignments.row,
        Alignments.alignCenter,
        Spaces.padding[12],
        {
          backgroundColor: withAlpha(Colors.primary700, 0.35),
          borderColor: withAlpha(Colors.primary500, 0.28),
          borderWidth: 1,
          gap: 12,
        },
      ]}
      testID={collectiviteId ? 'gestionnaire-ouvrir-file' : 'gestionnaire-entree-file'}
    >
      <Text style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1 }]}>{libelle}</Text>
      {!collectiviteId && demandes.length > 0 ? (
        <View
          style={[
            Alignments.alignCenter,
            Alignments.justifyCenter,
            {
              backgroundColor: Colors.error700,
              borderRadius: 999,
              minWidth: 24,
              paddingHorizontal: 6,
            },
          ]}
        >
          <Text style={[Fonts.p3Bold, Fonts.neutral00]}>{String(demandes.length)}</Text>
        </View>
      ) : null}
      {collectiviteId ? (
        <Text style={[Fonts.p2Bold, Fonts.primary500]}>
          {t('collectiviteAccueil.console.ouvrirFile', 'Ouvrir dans la file')}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

export default ManagerRequestsLink;
