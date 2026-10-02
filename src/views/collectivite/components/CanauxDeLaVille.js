import { useTranslation } from 'react-i18next';
import {
  Image,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { publicationDateLabel } from '@/domains/collectivite/collectiviteActualites';
import { findManagedCollectivite } from '@/domains/collectivite/collectiviteDisplay';
import { formatCollectiviteOfferedBy } from '@/domains/subscription/subscriptionDecision';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import { EcussonVille } from '@/views/collectivite/components/BlocDeLaVille';

import { RouteNames } from '@/navigation/routeNames';

import { useMesActualitesDeLaVille } from '@/services/collectivite/collectiviteActualiteQueries';
import {
  useCollectiviteClubs,
  useMyCollectivites,
} from '@/services/collectivite/collectiviteQueries';

/**
 * Une ligne de canal (planche P3v2-messages-tel : « .canal ») : un écusson, un titre, une ligne
 * de précision, une flèche. Toute la ligne est un lien.
 * @param {{ nomVille: string, onPress: () => void, precision: string, testID: string,
 *   titre: string }} props
 * @returns {import('react').ReactElement} La ligne.
 */
function LigneDeCanal({
  nomVille, onPress, precision, testID, titre,
}) {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images,
  } = useTheme();
  return (
    <TouchableOpacity
      accessibilityRole="link"
      onPress={onPress}
      style={[
        Alignments.row,
        Alignments.alignCenter,
        {
          backgroundColor: withAlpha(Colors.primary700, 0.45),
          borderColor: withAlpha(Colors.primary500, 0.35),
          borderRadius: 16,
          borderWidth: 1,
          gap: 12,
          minHeight: 64,
          padding: 16,
        },
      ]}
      testID={testID}
    >
      <EcussonVille nom={nomVille} taille={40} />
      <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
        <Text numberOfLines={1} style={[Fonts.p2Bold, Fonts.neutral00]}>{titre}</Text>
        <Text numberOfLines={1} style={[Fonts.p3, Fonts.neutral200]}>{precision}</Text>
      </View>
      <Image
        source={Images.arrowRight}
        style={[ApplicationStyle.icon16, ApplicationStyle.tintColor.neutral300]}
      />
    </TouchableOpacity>
  );
}

/**
 * Le canal des actualités, côté MAIRIE (planche P3v2-messages-tel, écran 1) : « Actualités de
 * la Ville de … », lu par les membres de ses clubs, et « Publier une actualité ».
 * @param {{ collectiviteId: string, navigation: any }} props
 * @returns {import('react').ReactElement | null} La section.
 */
function CanauxDeLaMairie({ collectiviteId, navigation }) {
  const { t } = useTranslation();
  const { Fonts } = useTheme();
  const mine = useMyCollectivites();
  const clubs = useCollectiviteClubs(collectiviteId);
  const collectivite = findManagedCollectivite(mine.data, collectiviteId);
  if (!collectivite) return null;
  const nombre = Array.isArray(clubs.data) ? clubs.data.length : 0;
  return (
    <View style={{ gap: 12 }} testID="canaux-de-la-ville-mairie">
      <LigneDeCanal
        nomVille={String(collectivite.name || '')}
        onPress={() => navigation.navigate(RouteNames.CollectiviteActualites, { collectiviteId })}
        precision={nombre === 1
          ? t(
            'collectiviteActualites.canaux.mairieLuUn',
            'Lu par les membres d’1 club · eux ne répondent pas',
          )
          : t(
            'collectiviteActualites.canaux.mairieLu',
            'Lu par les membres de {{nombre}} clubs · eux ne répondent pas',
            { nombre },
          )}
        testID="canal-actualites-mairie"
        titre={t('collectiviteActualites.canaux.mairieTitre', 'Actualités de {{ville}}', {
          ville: formatCollectiviteOfferedBy(String(collectivite.name || '')),
          ...SANS_ECHAPPEMENT,
        })}
      />
      <Button
        icon="send"
        onPress={() => navigation.navigate(
          RouteNames.CollectiviteActualiteForm,
          { collectiviteId },
        )}
        testID="canaux-publier"
        title={t('collectiviteActualites.publier', 'Publier une actualité')}
        variant="Primary"
      />
      <Text accessibilityRole="header" style={[Fonts.p3Bold, Fonts.neutral300, { marginTop: 8 }]}>
        {t('collectiviteActualites.canaux.conversations', 'Conversations')}
      </Text>
    </View>
  );
}

/**
 * Le canal des actualités, côté MEMBRE (planche P3c-canal-tel, écrans 3 et 7) : épinglé en tête
 * de sa messagerie, pour chaque Ville de ses clubs, « Actualités de la Ville » et la dernière.
 * Un entraîneur, un joueur, un parent le voient aussi (la Ville leur écrit à tous).
 * @param {{ navigation: any }} props
 * @returns {import('react').ReactElement | null} La section, ou rien sans Ville.
 */
function CanauxDuMembre({ navigation }) {
  const { t } = useTranslation();
  const { Fonts } = useTheme();
  const lecture = useMesActualitesDeLaVille();
  const collectivites = Array.isArray(lecture.data?.collectivites)
    ? lecture.data.collectivites
    : [];
  if (!collectivites.length) return null;
  const actualites = Array.isArray(lecture.data?.actualites) ? lecture.data.actualites : [];
  return (
    <View style={{ gap: 12 }} testID="canaux-de-la-ville-membre">
      {collectivites.map((/** @type {any} */ collectivite) => {
        const derniere = actualites.find((/** @type {any} */ actualite) => (
          actualite?.collectivite?.documentId === collectivite.documentId
        ));
        const precision = derniere
          ? t('collectiviteActualites.canaux.derniere', '{{date}} · {{titre}}', {
            date: publicationDateLabel(t, derniere.publishedAt),
            titre: derniere.title,
            ...SANS_ECHAPPEMENT,
          })
          : t('collectiviteActualites.canaux.aucune', 'Aucune actualité pour l’instant');
        return (
          <View key={collectivite.documentId} style={{ gap: 8 }}>
            <Text accessibilityRole="header" style={[Fonts.p3Bold, Fonts.neutral300]}>
              {collectivite.name}
            </Text>
            <LigneDeCanal
              nomVille={String(collectivite.name || '')}
              onPress={() => navigation.navigate(RouteNames.CollectiviteActualitesCanal, {
                collectiviteId: collectivite.documentId,
              })}
              precision={precision}
              testID={`canal-actualites-${collectivite.documentId}`}
              titre={t('collectiviteActualites.canaux.membreTitre', 'Actualités de la Ville')}
            />
          </View>
        );
      })}
    </View>
  );
}

/**
 * 📰 LES CANAUX DE LA VILLE EN TÊTE DE LA MESSAGERIE — COLL-C4A (02/10/2026), planches
 * P3v2-messages-tel (écran 1, la mairie) et P3c-canal-tel (écrans 3 et 7, le club).
 *
 * Dans l'espace de la Ville (onglet « Messages », \`espaceVille\`), la mairie lit son canal des
 * actualités et publie. Dans la messagerie du club, chaque membre d'un club rattaché trouve,
 * épinglé en tête, le canal des actualités de sa Ville (lecture seule). Un compte mixte voit
 * l'un ou l'autre selon l'espace d'où il vient : il parle au nom de la Ville depuis l'espace de
 * la Ville, au nom de son club depuis la messagerie du club.
 * @param {{ collectiviteId?: string | null, espaceVille?: boolean, navigation: any }} props
 * @returns {import('react').ReactElement | null} La section, ou rien.
 */
function CanauxDeLaVille({ collectiviteId = null, espaceVille = false, navigation }) {
  if (espaceVille && collectiviteId) {
    return <CanauxDeLaMairie collectiviteId={collectiviteId} navigation={navigation} />;
  }
  if (espaceVille) return null;
  return <CanauxDuMembre navigation={navigation} />;
}

export default CanauxDeLaVille;
