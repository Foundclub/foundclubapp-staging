import { useTranslation } from 'react-i18next';
import {
  Image,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { publicationDateLabel } from '@/domains/collectivite/collectiviteActualites';
import {
  CANAL_DIRIGEANTS,
  CANAL_VILLE,
  filsDeLaMessagerie,
  signatureDuMessage,
  titreDuFil,
} from '@/domains/collectivite/collectiviteCanaux';
import { findManagedCollectivite } from '@/domains/collectivite/collectiviteDisplay';
import { formatChatTimestamp } from '@/domains/messaging/messagingUseCases';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';
import { EcussonVille } from '@/views/collectivite/components/BlocDeLaVille';
import { IconeDuCanal } from '@/views/collectivite/components/FilDeLaVille';

import { RouteNames } from '@/navigation/routeNames';

import { useMesActualitesDeLaVille } from '@/services/collectivite/collectiviteActualiteQueries';
import { useMesCanauxDeLaVille } from '@/services/collectivite/collectiviteCanauxQueries';
import { useMyCollectivites } from '@/services/collectivite/collectiviteQueries';

/**
 * Une ligne de canal (planche P3v2-messages-tel : « .canal ») : un écusson, un titre, une ligne
 * de précision, une flèche. Toute la ligne est un lien.
 * COLL-C4A2 : `ecusson` remplace l'écusson de la Ville (le canal des dirigeants porte sa tuile),
 * `compteur` dit les messages non lus.
 * COLL-C4A3 (planche 47) : `heure`, l'heure du dernier message, à droite du titre (P3c-canal-tel,
 * écran 3) ; accentuée tant qu'il reste des non-lus.
 * @param {{ compteur?: number, ecusson?: import('react').ReactNode, heure?: string,
 *   nomVille: string, onPress: () => void, precision: string, testID: string,
 *   titre: string }} props
 * @returns {import('react').ReactElement} La ligne.
 */
function LigneDeCanal({
  compteur = 0, ecusson = null, heure = '', nomVille, onPress, precision, testID, titre,
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
      {ecusson || <EcussonVille nom={nomVille} taille={40} />}
      <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
        <View style={[Alignments.row, Alignments.alignCenter, { gap: 8 }]}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1 }]}>
            {titre}
          </Text>
          {heure ? (
            <Text
              style={[Fonts.p3, compteur > 0 ? Fonts.primary200 : Fonts.neutral300]}
              testID={`${testID}-heure`}
            >
              {heure}
            </Text>
          ) : null}
        </View>
        <Text style={[Fonts.p3, Fonts.neutral200]}>{precision}</Text>
      </View>
      {compteur > 0 ? (
        <View
          style={{
            alignItems: 'center',
            backgroundColor: Colors.primary500,
            borderRadius: 10,
            minWidth: 20,
            paddingHorizontal: 6,
          }}
          testID={`${testID}-non-lus`}
        >
          <Text style={[Fonts.p4Bold, { color: Colors.primary900 }]}>{String(compteur)}</Text>
        </View>
      ) : null}
      <Image
        source={Images.arrowRight}
        style={[ApplicationStyle.icon16, ApplicationStyle.tintColor.neutral300]}
      />
    </TouchableOpacity>
  );
}

/**
 * 🏛️ R17-CANAUX (19/10/2026, REC17-004) — CÔTÉ MAIRIE, RIEN AU-DESSUS DES CONVERSATIONS. Adel :
 * « la messagerie ne doit être que sous forme de message ; le canal des dirigeants doit être comme
 * les autres ; pour publier une actualité on a déjà d'autres endroits ». Les deux cartes
 * (« Actualités de la Ville de … », « Dirigeants des clubs ») et « Publier une actualité » sont
 * parties : les canaux de la Ville sont des LIGNES de la liste (`filsDeLaMessagerie`), et la
 * publication reste à ses quatre autres places (R17CANAUX.publierAilleurs.test.js).
 * Ce qui reste, et c'est tout : la demande « mes canaux », qui CRÉE les canaux de la Ville au
 * serveur à la première ouverture (collectivite-channels.ts, `mine`).
 * @returns {null} Rien à l'écran.
 */
function CanauxDeLaMairie() {
  useMesCanauxDeLaVille();
  return null;
}

/**
 * COLL-C4A2 — la ligne « Dirigeants des clubs » d'un dirigeant (planche P3c-canal-tel, écran 3) :
 * le dernier message, signé (« Ville de Montrivage : Merci… »), et ses non-lus. Rien sans canal
 * (un entraîneur, un joueur, un parent n'en ont pas).
 * @param {{ chats: any[], collectivite: any, ligne?: any, navigation: any }} props
 * @returns {import('react').ReactElement | null} La ligne, ou rien.
 */
function LigneCanalDuDirigeant({
  chats, collectivite, ligne, navigation,
}) {
  const { t } = useTranslation();
  if (!ligne?.canal?.documentId) return null;
  const fil = (Array.isArray(chats) ? chats : [])
    .find((/** @type {any} */ chat) => chat?.documentId === ligne.canal.documentId);
  const dernier = Array.isArray(fil?.messages) ? fil.messages[0] : null;
  const qui = dernier ? signatureDuMessage(t, dernier) : null;
  let precision = t('collectiviteCanaux.dirigeantLigne', '{{ville}} et {{nombre}} clubs', {
    nombre: Number(ligne.clubsCount) || 0,
    ville: String(collectivite?.name || ''),
    ...SANS_ECHAPPEMENT,
  });
  if (dernier?.message) {
    precision = qui
      ? t('collectiviteCanaux.dernierMessage', '{{qui}} : {{texte}}', {
        qui: qui.split(' · ')[0],
        texte: dernier.message,
        ...SANS_ECHAPPEMENT,
      })
      : String(dernier.message);
  }
  return (
    <LigneDeCanal
      compteur={Number(fil?.unreadCount) || 0}
      ecusson={<IconeDuCanal taille={40} />}
      heure={dernier?.createdAt ? formatChatTimestamp(dernier.createdAt) : ''}
      nomVille={String(collectivite?.name || '')}
      onPress={() => navigation.navigate(RouteNames.Conversation, {
        chatId: ligne.canal.documentId,
        chatType: CANAL_DIRIGEANTS,
        title: t('collectiviteCanaux.titre', 'Dirigeants des clubs'),
      })}
      precision={precision}
      testID={`canal-dirigeants-${collectivite?.documentId}`}
      titre={t('collectiviteCanaux.titre', 'Dirigeants des clubs')}
    />
  );
}

/**
 * Le canal des actualités, côté MEMBRE (planche P3c-canal-tel, écrans 3 et 7) : épinglé en tête
 * de sa messagerie, pour chaque Ville de ses clubs, « Actualités de la Ville » et la dernière.
 * Un entraîneur, un joueur, un parent le voient aussi (la Ville leur écrit à tous).
 * COLL-C4A2 : le DIRIGEANT y trouve aussi, au-dessus, le canal des dirigeants de la Ville, avec le
 * dernier message (« qui · pour quel club ») et ses non-lus (écran 3). Pas un entraîneur.
 * COLL-C4A3 (planche 47) : sous les canaux de la Ville, « Ton club » titre les conversations du
 * club et des équipes (écrans 3 et 7), pour tous les rôles.
 * @param {{ chats?: any[], navigation: any }} props
 * @returns {import('react').ReactElement | null} La section, ou rien sans Ville.
 */
function CanauxDuMembre({ chats = [], navigation }) {
  const { t } = useTranslation();
  const { Fonts } = useTheme();
  const lecture = useMesActualitesDeLaVille();
  const canaux = useMesCanauxDeLaVille();
  const mesCanaux = Array.isArray(canaux.data) ? canaux.data : [];
  const collectivites = Array.isArray(lecture.data?.collectivites)
    ? [...lecture.data.collectivites]
    : [];
  // Une Ville dont le dirigeant a le canal mais pas encore d'actualité lue garde sa place.
  mesCanaux.forEach((/** @type {any} */ ligne) => {
    const id = ligne?.collectivite?.documentId;
    if (id && !collectivites.some((/** @type {any} */ c) => c?.documentId === id)) {
      collectivites.push(ligne.collectivite);
    }
  });
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
            <LigneCanalDuDirigeant
              chats={chats}
              collectivite={collectivite}
              ligne={mesCanaux.find((/** @type {any} */ l) => (
                l?.collectivite?.documentId === collectivite.documentId
              ))}
              navigation={navigation}
            />
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
      <Text
        accessibilityRole="header"
        style={[Fonts.p3Bold, Fonts.neutral300, { marginTop: 8 }]}
        testID="canaux-ton-club"
      >
        {t('collectiviteCanaux.tonClub', 'Ton club')}
      </Text>
    </View>
  );
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
 * 📰 LES CANAUX DE LA VILLE EN TÊTE DE LA MESSAGERIE — COLL-C4A (02/10/2026), planches
 * P3v2-messages-tel (écran 1, la mairie) et P3c-canal-tel (écrans 3 et 7, le club).
 *
 * Dans l'espace de la Ville (onglet « Messages », \`espaceVille\`), la mairie lisait son canal des
 * actualités et publiait (jusqu'à R17-CANAUX). Dans la messagerie du club, chaque membre d'un club
 * rattaché trouve,
 * épinglé en tête, le canal des actualités de sa Ville (lecture seule). Un compte mixte voit
 * l'un ou l'autre selon l'espace d'où il vient : il parle au nom de la Ville depuis l'espace de
 * la Ville, au nom de son club depuis la messagerie du club.
 * COLL-C4A2 : s'y ajoute le canal des dirigeants (D72) — pour un dirigeant, au-dessus des
 * actualités de sa Ville. `chats` (la liste de la messagerie) donne au dirigeant le dernier
 * message du canal et ses non-lus.
 * R17-CANAUX (19/10) : côté mairie, plus rien ici (voir `CanauxDeLaMairie`) — ses canaux sont des
 * lignes de la liste.
 * @param {{ chats?: any[], collectiviteId?: string | null, espaceVille?: boolean,
 *   navigation: any }} props
 * @returns {import('react').ReactElement | null} La section, ou rien.
 */
function CanauxDeLaVille({
  chats = [], collectiviteId = null, espaceVille = false, navigation,
}) {
  if (espaceVille && collectiviteId) return <CanauxDeLaMairie />;
  if (espaceVille) return null;
  return <CanauxDuMembre chats={chats} navigation={navigation} />;
}

export default CanauxDeLaVille;
