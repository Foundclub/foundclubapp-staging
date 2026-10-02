import { useTranslation } from 'react-i18next';
import {
  Image,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { publicationDateLabel } from '@/domains/collectivite/collectiviteActualites';
import { CANAL_DIRIGEANTS, signatureDuMessage } from '@/domains/collectivite/collectiviteCanaux';
import { findManagedCollectivite } from '@/domains/collectivite/collectiviteDisplay';
import { formatCollectiviteOfferedBy } from '@/domains/subscription/subscriptionDecision';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import { EcussonVille } from '@/views/collectivite/components/BlocDeLaVille';
import { IconeDuCanal } from '@/views/collectivite/components/FilDeLaVille';

import { RouteNames } from '@/navigation/routeNames';

import { useMesActualitesDeLaVille } from '@/services/collectivite/collectiviteActualiteQueries';
import { useMesCanauxDeLaVille } from '@/services/collectivite/collectiviteCanauxQueries';
import {
  useCollectiviteClubs,
  useMyCollectivites,
} from '@/services/collectivite/collectiviteQueries';

/**
 * Une ligne de canal (planche P3v2-messages-tel : « .canal ») : un écusson, un titre, une ligne
 * de précision, une flèche. Toute la ligne est un lien.
 * COLL-C4A2 : `ecusson` remplace l'écusson de la Ville (le canal des dirigeants porte sa tuile),
 * `compteur` dit les messages non lus.
 * @param {{ compteur?: number, ecusson?: import('react').ReactNode, nomVille: string,
 *   onPress: () => void, precision: string, testID: string, titre: string }} props
 * @returns {import('react').ReactElement} La ligne.
 */
function LigneDeCanal({
  compteur = 0, ecusson = null, nomVille, onPress, precision, testID, titre,
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
        <Text numberOfLines={1} style={[Fonts.p2Bold, Fonts.neutral00]}>{titre}</Text>
        <Text numberOfLines={1} style={[Fonts.p3, Fonts.neutral200]}>{precision}</Text>
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
  const canaux = useMesCanauxDeLaVille();
  const collectivite = findManagedCollectivite(mine.data, collectiviteId);
  if (!collectivite) return null;
  const nombre = Array.isArray(clubs.data) ? clubs.data.length : 0;
  // COLL-C4A2 — le canal des dirigeants de CETTE Ville (créé par le serveur à la première demande).
  const canal = (Array.isArray(canaux.data) ? canaux.data : [])
    .find((/** @type {any} */ ligne) => ligne?.collectivite?.documentId === collectiviteId)?.canal;
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
      {canal?.documentId ? (
        <LigneDeCanal
          ecusson={<IconeDuCanal taille={40} />}
          nomVille={String(collectivite.name || '')}
          onPress={() => navigation.navigate(RouteNames.Conversation, {
            chatId: canal.documentId,
            chatType: CANAL_DIRIGEANTS,
            espace: 'ville',
            title: t('collectiviteCanaux.titre', 'Dirigeants des clubs'),
          })}
          precision={nombre === 1
            ? t(
              'collectiviteCanaux.mairieLigneUn',
              'Vous et les dirigeants d’1 club · échanges de créneaux',
            )
            : t(
              'collectiviteCanaux.mairieLigne',
              'Vous et les dirigeants des {{nombre}} clubs · échanges de créneaux',
              { nombre },
            )}
          testID="canal-dirigeants-mairie"
          titre={t('collectiviteCanaux.titre', 'Dirigeants des clubs')}
        />
      ) : null}
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
 * COLL-C4A2 : s'y ajoute le canal des dirigeants (D72) — pour la mairie, sous ses actualités ;
 * pour un dirigeant, au-dessus des actualités de sa Ville. `chats` (la liste de la messagerie)
 * donne au dirigeant le dernier message du canal et ses non-lus.
 * @param {{ chats?: any[], collectiviteId?: string | null, espaceVille?: boolean,
 *   navigation: any }} props
 * @returns {import('react').ReactElement | null} La section, ou rien.
 */
function CanauxDeLaVille({
  chats = [], collectiviteId = null, espaceVille = false, navigation,
}) {
  if (espaceVille && collectiviteId) {
    return <CanauxDeLaMairie collectiviteId={collectiviteId} navigation={navigation} />;
  }
  if (espaceVille) return null;
  return <CanauxDuMembre chats={chats} navigation={navigation} />;
}

export default CanauxDeLaVille;
