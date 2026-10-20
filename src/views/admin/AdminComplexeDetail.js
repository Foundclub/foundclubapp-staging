import { useRoute } from '@react-navigation/native';
import { ScrollView } from 'react-native';

import useTheme from '@/theme/themeContext';

import ScreenContainer from '@/components/templates/ScreenContainer';
import FicheComplexeConsole from '@/views/admin/components/FicheComplexeConsole';

/**
 * E-S01 — LA FICHE D'UN COMPLEXE DANS LA CONSOLE, SUR TÉLÉPHONE — RESA-L5B-2 (20/10/2026),
 * planche ES01 (« téléphone : liste puis fiche »). La fiche elle-même (identité, gérant,
 * signalements, journal, gestes) est `FicheComplexeConsole`, partagée avec le volet de droite de
 * la liste sur ordinateur. Paramètre de route : `complexeId`. Caché par `COMPLEXES_GERANT`.
 * @returns {import('react').ReactElement} L'écran.
 */
function AdminComplexeDetail() {
  const { Alignments, Spaces } = useTheme();
  const route = useRoute();
  const params = /** @type {{ complexeId?: string } | undefined} */ (route?.params);
  return (
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="screen"
      contentContainerStyle={[Spaces.paddingTop[0], Alignments.fill]}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: 24, paddingTop: 12 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
      >
        <FicheComplexeConsole complexeId={String(params?.complexeId || '')} />
      </ScrollView>
    </ScreenContainer>
  );
}

export default AdminComplexeDetail;
