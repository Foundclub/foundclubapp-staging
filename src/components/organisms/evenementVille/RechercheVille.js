import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import { lieuLabel, quandLabel } from '@/domains/collectivite/evenementDeLaVille';
import { useAppContext } from '@/store/appContext';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import { RouteNames } from '@/navigation/routeNames';

import {
  useEvenementsPublicsDeLaVille,
} from '@/services/collectivite/collectiviteEvenementQueries';

/**
 * 🏛️ R17-EVT-1 (20/10/2026, REC17-005), point 3 — LA RECHERCHE D'ÉVÉNEMENTS (niveau 3 « Tout
 * le monde », planche P11-evenement-ou-ca-vit, porte 6) : une bande « Événements de la Ville »
 * au-dessus des résultats, une carte par événement public à venir : la Ville, le nom, quand et
 * où, « Voir la fiche ». Rien du tout s'il n'y en a pas, ou si le serveur ne répond pas (un
 * visiteur sans compte : la lecture sans compte attend le GO d'Adel).
 * R17-EVT-1-BIS (g) (20/10) : elle suit le mot tapé dans la recherche (`eventFilters.q`, le champ
 * le retient déjà 300 ms) ; le serveur filtre sur le nom, le lieu et la Ville.
 * @returns {import('react').ReactElement | null} La bande, ou rien.
 */
function EvenementsVilleRecherche() {
  const { t } = useTranslation();
  const { Alignments, Colors, Fonts } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const [{ eventFilters }] = useAppContext();
  const lecture = useEvenementsPublicsDeLaVille(String(eventFilters?.q || '').trim());
  const evenements = Array.isArray(lecture.data) ? lecture.data.slice(0, 10) : [];
  if (!evenements.length) return null;
  return (
    <View style={{ gap: 8, marginBottom: 12 }} testID="recherche-evenements-ville">
      <Text accessibilityRole="header" style={[Fonts.p2Bold, Fonts.neutral00]}>
        {t('collectiviteEvenement.recherche.titre', 'Événements de la Ville')}
      </Text>
      <ScrollView
        contentContainerStyle={{ gap: 12 }}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {evenements.map((evenement) => (
          <TouchableOpacity
            accessibilityRole="link"
            key={evenement.documentId}
            onPress={() => navigation.navigate(RouteNames.EvenementDeLaVille, {
              evenementId: evenement.documentId,
            })}
            style={{
              backgroundColor: withAlpha(Colors.primary800, 0.85),
              borderColor: withAlpha(Colors.primary100, 0.55),
              borderRadius: 20,
              borderWidth: 1,
              gap: 4,
              minHeight: 44,
              padding: 14,
              width: 260,
            }}
            testID={`recherche-evenement-ville-${evenement.documentId}`}
          >
            <Text
              numberOfLines={1}
              style={[
                Fonts.p4Bold,
                Fonts.primary200,
                { letterSpacing: 0.6, textTransform: 'uppercase' },
              ]}
            >
              {evenement.collectivite?.name || ''}
            </Text>
            <Text numberOfLines={2} style={[Fonts.p2Bold, Fonts.neutral00]}>
              {evenement.name}
            </Text>
            <Text numberOfLines={2} style={[Fonts.p3, Fonts.neutral200]}>
              {[
                quandLabel(t, evenement),
                lieuLabel(t, {
                  address: evenement.address,
                  facilityName: evenement.facility?.name || null,
                  takesPlace: evenement.takesPlace,
                }),
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
            <View style={[Alignments.row, Alignments.alignCenter]}>
              <Text style={[Fonts.p3Bold, Fonts.primary200]}>
                {t('collectiviteEvenement.recherche.voir', 'Voir la fiche ›')}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

export default EvenementsVilleRecherche;
