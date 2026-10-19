import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import {
  CANAL_DIRIGEANTS,
  CANAL_VILLE,
  filsDeLaMessagerie,
  signatureDuMessage,
  titreDuFil,
} from '@/domains/collectivite/collectiviteCanaux';
import { findManagedCollectivite } from '@/domains/collectivite/collectiviteDisplay';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';
import { EcussonVille } from '@/views/collectivite/components/BlocDeLaVille';
import { IconeDuCanal } from '@/views/collectivite/components/FilDeLaVille';

import { RouteNames } from '@/navigation/routeNames';

import { useMesCanauxDeLaVille } from '@/services/collectivite/collectiviteCanauxQueries';
import { useMyCollectivites } from '@/services/collectivite/collectiviteQueries';

/**
 * 🏛️ R17-CANAUX (19/10/2026, REC17-004) — RIEN AU-DESSUS DES CONVERSATIONS. Adel :
 * « la messagerie ne doit être que sous forme de message ; le canal des dirigeants doit être comme
 * les autres ; pour publier une actualité on a déjà d'autres endroits ». Les deux cartes
 * (« Actualités de la Ville de … », « Dirigeants des clubs ») et « Publier une actualité » sont
 * parties : les canaux de la Ville sont des LIGNES de la liste (`filsDeLaMessagerie`), et la
 * publication reste à ses quatre autres places (R17CANAUX.publierAilleurs.test.js).
 * Correction 2 du chef (19/10, §1 ter) : côté club aussi — le bloc épinglé (« Dirigeants des
 * clubs », « Actualités de la Ville », « Ton club ») doublait la ligne « Toute la ville » ; il est
 * parti, et le canal des dirigeants est une ligne. L'écran des actualités garde ses autres
 * entrées : le lien de chaque actualité dans « Toute la ville », la fiche du club (« De la
 * Ville »), le bandeau de l'accueil et la notification.
 * Ce qui reste, et c'est tout : la demande « mes canaux », qui CRÉE les canaux de la Ville au
 * serveur à la première ouverture (collectivite-channels.ts, `mine`).
 * @returns {null} Rien à l'écran.
 */
function OuvrirLesCanauxDeLaVille() {
  useMesCanauxDeLaVille();
  return null;
}

/**
 * Une ligne de la colonne de gauche du site (P3c-canal-ordi : « .ligne-conv ») : un écusson, un
 * titre, l'aperçu ; le fil ouvert est marqué (`actif`). Toute la ligne est un lien.
 * @param {{ actif?: boolean, ecusson: import('react').ReactNode, onPress: () => void,
 *   precision: string, testID: string, titre: string }} props
 * @returns {import('react').ReactElement} La ligne.
 */
function LigneDeColonne({
  actif = false, ecusson, onPress, precision, testID, titre,
}) {
  const { Alignments, Colors, Fonts } = useTheme();
  return (
    <TouchableOpacity
      accessibilityRole="link"
      accessibilityState={{ selected: actif }}
      onPress={onPress}
      style={[
        Alignments.row,
        Alignments.alignCenter,
        {
          backgroundColor: actif ? withAlpha(Colors.primary500, 0.12) : 'transparent',
          borderRadius: 12,
          gap: 10,
          minHeight: 60,
          paddingHorizontal: 10,
          paddingVertical: 8,
        },
      ]}
      testID={testID}
    >
      {ecusson}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={[Fonts.p3Bold, Fonts.neutral00]}>{titre}</Text>
        {precision ? (
          <Text numberOfLines={1} style={[Fonts.p4, Fonts.neutral200]}>{precision}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

/**
 * 🖥️ COLL-C4A3 (planche 47, P3c-canal-ordi) — LA COLONNE DE GAUCHE de « Messages » de la Ville,
 * SUR LE SITE, quand un fil de la Ville est ouvert : SES fils, chacun une ligne. Le fil ouvert est
 * marqué ; chaque ligne y mène depuis l'espace de la Ville (la voix de la Ville). La liste des fils
 * vient de l'écran (la même requête que la messagerie) : la colonne suit ses mises à jour en temps
 * réel.
 * R17-CANAUX (19/10, REC17-004) : le groupe « Canaux de la Ville » (Actualités de la Ville,
 * Dirigeants des clubs) qui précédait les conversations est parti — « que des conversations »,
 * Adel ; le canal des dirigeants est une ligne de « Conversations », comme sur le téléphone.
 * @param {{ chatId: string, chats?: any[], collectiviteId: string, navigation: any }} props
 * @returns {import('react').ReactElement | null} La colonne, ou rien pour une Ville inconnue.
 */
export function ColonneDesFilsDeLaVille({
  chatId, chats = [], collectiviteId, navigation,
}) {
  const { t } = useTranslation();
  const { Fonts } = useTheme();
  const mine = useMyCollectivites();
  const collectivite = findManagedCollectivite(mine.data, collectiviteId);
  if (!collectivite) return null;
  const liste = Array.isArray(chats) ? chats : [];
  const siens = filsDeLaMessagerie(liste, { collectiviteId, espaceVille: true });
  // R17-CANAUX (point 5) — « Toute la ville » en tête, comme sur le téléphone ; les autres gardent
  // l'ordre de la liste.
  const conversations = [
    ...siens.filter((/** @type {any} */ fil) => fil?.type === CANAL_VILLE),
    ...siens.filter((/** @type {any} */ fil) => fil?.type !== CANAL_VILLE),
  ];
  const ecussonDe = (/** @type {any} */ fil) => {
    if (fil.type === CANAL_DIRIGEANTS) return <IconeDuCanal taille={32} />;
    if (fil.type === CANAL_VILLE) {
      return <EcussonVille nom={String(collectivite.name || '')} taille={32} />;
    }
    return <ClubLogoMark club={fil.collectiviteClub} isNeutral size={32} />;
  };
  // « Vous : … » quand la Ville a écrit, sinon « Prénom Nom : … » (P3c-canal-ordi).
  const apercu = (/** @type {any} */ fil, /** @type {string} */ repli) => {
    const dernier = Array.isArray(fil?.messages) ? fil.messages[0] : null;
    if (!dernier?.message) return repli;
    const qui = dernier?.senderSignature?.voix === 'ville'
      ? t('collectiviteCanaux.colonne.vous', 'Vous')
      : String(signatureDuMessage(t, dernier) || '').split(' · ')[0];
    return qui
      ? t('collectiviteCanaux.dernierMessage', '{{qui}} : {{texte}}', {
        qui,
        texte: dernier.message,
        ...SANS_ECHAPPEMENT,
      })
      : String(dernier.message);
  };
  const ouvrir = (
    /** @type {string} */ id,
    /** @type {string} */ type,
    /** @type {string} */ titre,
  ) => (
    navigation.navigate(RouteNames.Conversation, {
      chatId: id, chatType: type, espace: 'ville', title: titre,
    })
  );
  const groupe = (/** @type {string} */ libelle) => (
    <Text
      accessibilityRole="header"
      style={[Fonts.p4Bold, Fonts.neutral300, {
        letterSpacing: 0.8, marginHorizontal: 10, marginTop: 10, textTransform: 'uppercase',
      }]}
    >
      {libelle}
    </Text>
  );
  return (
    <View
      accessibilityLabel={t('collectiviteCanaux.colonne.titre', 'Canaux et conversations')}
      role="navigation"
      style={{ gap: 2 }}
      testID="colonne-fils-de-la-ville"
    >
      {groupe(t('collectiviteActualites.canaux.conversations', 'Conversations'))}
      {conversations.length === 0 ? (
        <Text style={[Fonts.p4, Fonts.neutral200, { marginHorizontal: 10, marginTop: 4 }]}>
          {t(
            'collectiviteCanaux.conversationsVides',
            'Aucune conversation. Un dirigeant qui vous écrit apparaîtra ici.',
          )}
        </Text>
      ) : conversations.map((/** @type {any} */ fil) => {
        const titre = titreDuFil(t, { chat: fil, espaceVille: true });
        return (
          <LigneDeColonne
            actif={fil.documentId === chatId}
            ecusson={ecussonDe(fil)}
            key={fil.documentId}
            onPress={() => ouvrir(fil.documentId, fil.type, titre)}
            precision={apercu(fil, '')}
            testID={`colonne-${fil.documentId}`}
            titre={titre}
          />
        );
      })}
    </View>
  );
}

/**
 * 📰 LES CANAUX DE LA VILLE DANS LA MESSAGERIE — COLL-C4A (02/10/2026) puis R17-CANAUX (19/10/2026,
 * REC17-004). Jusqu'au 19/10, une section épinglée en tête : les cartes de la mairie (espace de la
 * Ville), le canal des dirigeants et « Actualités de la Ville » (côté club), puis « Ton club ».
 * Adel : « la messagerie ne doit être que sous forme de message » ; le chef (correction 2) : le
 * bloc du membre double « Toute la ville ». Depuis, les canaux de la Ville sont des LIGNES de la
 * liste (`filsDeLaMessagerie`) et ce composant ne dessine plus rien : il garde la demande « mes
 * canaux » (création des canaux au serveur à la première ouverture). Les props des appelants
 * (Messaging.js, Conversation.web.js) ne servent plus.
 * @returns {import('react').ReactElement} La demande, sans rien à l'écran.
 */
function CanauxDeLaVille() {
  return <OuvrirLesCanauxDeLaVille />;
}

export default CanauxDeLaVille;
