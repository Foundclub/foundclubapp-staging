import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import {
  CANAL_DIRIGEANTS,
  CANAL_VILLE,
  CONVERSATION_CLUB,
  estFilDeLaVille,
  estRefusDuFilDeLaVille,
  peutEcrireDansLeFil,
  placeholderDuFil,
  routeDeLaLigne,
  signatureDuMessage,
  sousTitreDuFil,
  texteDeLaLigne,
  titreDuFil,
  voixDuFil,
} from '@/domains/collectivite/collectiviteCanaux';
import { formatCollectiviteOfferedBy } from '@/domains/subscription/subscriptionDecision';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';
import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';
import { EcussonVille } from '@/views/collectivite/components/BlocDeLaVille';

import { RouteNames } from '@/navigation/routeNames';

import { useMembresDuFil } from '@/services/collectivite/collectiviteCanauxQueries';

/**
 * 🏛️ COLL-C4A2 (02/10/2026) — LES FILS DE LA VILLE DANS UNE CONVERSATION : le canal des
 * dirigeants (D72) et la conversation privée Ville ↔ club (D73). Design HY521H1 page 3,
 * P3c-canal-tel (écrans 1, 4, 6, 8) et P3c-canal-ordi.
 *
 * Ce fichier porte ce que la conversation (Conversation.js ET Conversation.web.js) ajoute pour
 * ces deux fils, et seulement pour eux : l'icône du canal, l'écran « Tu ne fais plus partie de
 * ce canal », la première phrase d'un fil vide, le bouton « Qui est dans ce canal », et le crochet
 * qui dit le titre, la ligne sous le titre, le texte du champ et la voix demandée au serveur.
 */

/**
 * L'icône du canal des dirigeants : une tuile, des personnes (« hcard-tuile i-personnes »).
 * @param {{ taille?: number }} props
 * @returns {import('react').ReactElement} La tuile.
 */
export function IconeDuCanal({ taille = 40 }) {
  const { Colors } = useTheme();
  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: withAlpha(Colors.primary500, 0.16),
        borderRadius: Math.round(taille * 0.3),
        height: taille,
        justifyContent: 'center',
        width: taille,
      }}
    >
      <SvgIcon
        color={Colors.primary200}
        height={Math.round(taille * 0.5)}
        name="users"
        width={Math.round(taille * 0.5)}
      />
    </View>
  );
}

/**
 * COLL-C4A3 (planche 47) — l'écusson d'un fil de la Ville, dans l'en-tête de la conversation
 * (P3c-canal-tel, écrans 1 et 8) : la tuile du canal des dirigeants ; pour la conversation
 * privée, l'écusson d'EN FACE, comme dans la liste de la messagerie (le club côté Ville, la Ville
 * côté club). Rien hors de ces fils.
 * @param {{ chat: any, espaceVille?: boolean, routeChatType?: string | null,
 *   taille?: number }} props - Le fil ; `routeChatType` montre la tuile du canal avant que le fil
 *   soit lu.
 * @returns {import('react').ReactElement | null} L'écusson, ou rien.
 */
export function EcussonDuFil({
  chat, espaceVille = false, routeChatType = null, taille = 40,
}) {
  const type = chat?.type || routeChatType;
  if (type === CANAL_DIRIGEANTS) return <IconeDuCanal taille={taille} />;
  // R17-CANAUX — « Toute la ville » : l'écusson de la Ville, des deux côtés.
  if (type === CANAL_VILLE && chat) {
    return <EcussonVille nom={String(chat.collectivite?.name || '')} taille={taille} />;
  }
  if (type !== CONVERSATION_CLUB || !chat) return null;
  return espaceVille
    ? <ClubLogoMark club={chat.collectiviteClub} isNeutral size={taille} />
    : <EcussonVille nom={String(chat.collectivite?.name || '')} taille={taille} />;
}

/**
 * Le bouton de l'en-tête « Qui est dans ce canal » (icône seule, libellé pour le lecteur
 * d'écran). Il remplace le menu « ⋮ » : la liste ne se tient pas à la main.
 * @param {{ estCanal?: boolean, onPress: () => void }} props
 * @returns {import('react').ReactElement} Le bouton.
 */
export function BoutonMembresDuFil({ estCanal = true, onPress }) {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  return (
    <TouchableOpacity
      accessibilityLabel={estCanal
        ? t('collectiviteCanaux.membres.ouvrirCanal', 'Qui est dans ce canal')
        : t('collectiviteCanaux.membres.ouvrirPrivee', 'Qui est dans cette conversation')}
      accessibilityRole="button"
      onPress={onPress}
      style={{
        alignItems: 'center',
        backgroundColor: withAlpha(Colors.neutral00, 0.1),
        borderRadius: 20,
        height: 40,
        justifyContent: 'center',
        width: 40,
      }}
      testID="fil-de-la-ville-membres"
    >
      <SvgIcon color={Colors.neutral00} height={20} name="users" width={20} />
    </TouchableOpacity>
  );
}

/**
 * « Tu ne fais plus partie de ce canal » (écran 6) : le club n'est plus rattaché à la Ville.
 * L'ancien dirigeant ne voit plus le canal ; s'il l'ouvre par une vieille notification, il lit
 * pourquoi. Ses anciens messages restent pour les autres.
 * @param {{ estCanal?: boolean, onRetour: () => void }} props
 * @returns {import('react').ReactElement} L'écran.
 */
export function FilDeLaVilleQuitte({ estCanal = true, onRetour }) {
  const { t } = useTranslation();
  const { Fonts } = useTheme();
  return (
    <View
      style={{
        alignItems: 'center', flex: 1, gap: 12, justifyContent: 'center', padding: 24,
      }}
      testID="fil-de-la-ville-quitte"
    >
      <IconeDuCanal taille={56} />
      <Text
        accessibilityRole="header"
        style={[Fonts.h4Bold, Fonts.neutral00, { textAlign: 'center' }]}
      >
        {estCanal
          ? t('collectiviteCanaux.quitte.titreCanal', 'Tu ne fais plus partie de ce canal')
          : t(
            'collectiviteCanaux.quitte.titrePrivee',
            'Tu ne fais plus partie de cette conversation',
          )}
      </Text>
      <Text style={[Fonts.p2, Fonts.neutral200, { textAlign: 'center' }]}>
        {estCanal
          ? t(
            'collectiviteCanaux.quitte.texteCanal',
            // eslint-disable-next-line max-len
            'Ton club n’est plus rattaché à cette Ville, donc tu n’es plus dans le canal de ses dirigeants. Tes anciens messages y restent.',
          )
          : t(
            'collectiviteCanaux.quitte.textePrivee',
            // eslint-disable-next-line max-len
            'Ton club n’est plus rattaché à cette Ville : cette conversation privée est close pour toi. Tes anciens messages y restent.',
          )}
      </Text>
      <Button
        onPress={onRetour}
        testID="fil-de-la-ville-retour"
        title={t('collectiviteCanaux.quitte.retour', 'Retour à la messagerie')}
        variant="Primary"
      />
    </View>
  );
}

/**
 * La première phrase d'un fil de la Ville encore vide (écrans 4 et 8) : à quoi il sert, et qui
 * le lit. « Vous » pour la mairie, « tu » pour le dirigeant.
 * @param {{ chat: any, clubsCount?: number, espaceVille?: boolean }} props
 * @returns {import('react').ReactElement | null} Le bloc, ou rien hors d'un fil de la Ville.
 */
export function VideDuFilDeLaVille({ chat, clubsCount = 0, espaceVille = false }) {
  const { t } = useTranslation();
  const { Fonts } = useTheme();
  if (!estFilDeLaVille(chat)) return null;
  const ville = formatCollectiviteOfferedBy(String(chat?.collectivite?.name || ''));
  let titre = '';
  let texte = '';
  if (chat.type === CANAL_VILLE) {
    // R17-CANAUX — à quoi sert « Toute la ville », et qui le lit (un nombre, jamais des noms).
    titre = titreDuFil(t, { chat, espaceVille });
    texte = espaceVille
      ? t(
        'collectiviteCanaux.ville.videMairie',
        // eslint-disable-next-line max-len
        'Vos actualités pour tous les membres y arrivent toutes seules, et vous pouvez y écrire. Les membres de vos {{nombre}} clubs le lisent ; personne ne voit qui le lit.',
        { nombre: clubsCount },
      )
      : t(
        'collectiviteCanaux.ville.videMembre',
        // eslint-disable-next-line max-len
        'Les actualités de {{ville}} arrivent ici. Seule la Ville écrit ; personne ne voit qui le lit.',
        { ville, ...SANS_ECHAPPEMENT },
      );
  } else if (chat.type === CANAL_DIRIGEANTS && espaceVille) {
    titre = t(
      'collectiviteCanaux.vide.mairieTitre',
      'Les dirigeants des {{nombre}} clubs et vous',
      { nombre: clubsCount },
    );
    texte = t(
      'collectiviteCanaux.vide.mairieTexte',
      // eslint-disable-next-line max-len
      'Pour les échanges de créneaux, les questions sur une installation, un forum à préparer. Les joueurs n’y sont pas.',
    );
  } else if (chat.type === CANAL_DIRIGEANTS) {
    titre = t('collectiviteCanaux.vide.dirigeantTitre', 'Le canal des dirigeants');
    texte = t(
      'collectiviteCanaux.vide.dirigeantTexte',
      // eslint-disable-next-line max-len
      'Ici, tu échanges avec {{ville}} et les dirigeants des autres clubs rattachés : un créneau à céder, un tournoi à caler. Les joueurs et les parents n’y sont pas.',
      { ville, ...SANS_ECHAPPEMENT },
    );
  } else if (espaceVille) {
    titre = String(chat?.collectiviteClub?.name || '');
    texte = t(
      'collectiviteCanaux.vide.priveeMairie',
      'Conversation privée : seuls les dirigeants de {{club}} la lisent.',
      { club: String(chat?.collectiviteClub?.name || ''), ...SANS_ECHAPPEMENT },
    );
  } else {
    titre = String(chat?.collectivite?.name || '');
    texte = t(
      'collectiviteCanaux.vide.priveeClub',
      'Conversation privée : seuls la Ville et les dirigeants de ton club la lisent.',
    );
  }
  return (
    <View style={{ alignItems: 'center', gap: 12, padding: 24 }} testID="fil-de-la-ville-vide">
      <IconeDuCanal taille={56} />
      <Text style={[Fonts.h4Bold, Fonts.neutral00, { textAlign: 'center' }]}>{titre}</Text>
      <Text style={[Fonts.p2, Fonts.neutral200, { textAlign: 'center' }]}>{texte}</Text>
    </View>
  );
}

/**
 * Ce que la conversation fait de différent pour un fil de la Ville. Hors d'un tel fil, tout est
 * vide ou nul, et la conversation reste exactement ce qu'elle était.
 * @param {{ chatData: any, chatId: string, espaceVille?: boolean, messagesError?: unknown,
 *   navigation: any, routeChatType?: string | null }} params
 * R17-CANAUX (19/10) : pour « Toute la ville », `peutEcrire` (la Ville seule), `texteLectureSeule`
 * (« Seule la Ville écrit ici »), `afficheMembres` faux (personne ne voit qui le lit) et
 * `ligneDActualite` (une actualité posée par la Ville mène à elle).
 * @returns {{ afficheMembres: boolean, clubsCount: number, estCanal: boolean,
 *   estCanalVille: boolean, estFil: boolean,
 *   estLigneSysteme: (message: any) => boolean, estQuitte: boolean,
 *   ligneDActualite: (message: any) => ({ libelle: string, ouvrir: () => void,
 *     texte: string, voir: string } | null), membres: any,
 *   nomDeLExpediteur: (message: any) => string | null, ouvrirMembres: () => void,
 *   peutEcrire: boolean, placeholder: string | null, sousTitre: string,
 *   texteLectureSeule: string | null, titre: string,
 *   voix: { senderSignature?: { voix: 'ville' } } }} Le fil, vu par la conversation.
 */
export const useFilDeLaVille = ({
  chatData, chatId, espaceVille = false, messagesError = null, navigation, routeChatType = null,
}) => {
  const { t } = useTranslation();
  const estQuitte = estRefusDuFilDeLaVille(messagesError);
  const estFil = estFilDeLaVille(chatData);
  const membres = useMembresDuFil(chatId, { enabled: estFil && !estQuitte });
  const clubsCount = Number(membres.data?.clubsCount) || 0;
  return useMemo(() => {
    const contexte = { chat: chatData, clubsCount, espaceVille };
    const estCanalVille = (chatData?.type || routeChatType) === CANAL_VILLE;
    return {
      afficheMembres: estFil && !estCanalVille,
      clubsCount,
      estCanal: (chatData?.type || routeChatType) !== CONVERSATION_CLUB,
      estCanalVille,
      estFil,
      estLigneSysteme: (/** @type {any} */ message) => estFil && !message?.sender,
      estQuitte,
      ligneDActualite: (/** @type {any} */ message) => {
        const route = estFil ? routeDeLaLigne({ espaceVille, message }) : null;
        if (!route) return null;
        const titreDeLActualite = String(message?.systemNotice?.actualite?.title || '');
        return {
          libelle: t('collectiviteCanaux.ville.voirActualite', 'Voir l’actualité « {{titre}} »', {
            ...SANS_ECHAPPEMENT,
            titre: titreDeLActualite,
          }),
          ouvrir: () => navigation.navigate(route.name, route.params),
          texte: texteDeLaLigne(t, message),
          voir: t('collectiviteCanaux.ville.ouvrirActualite', 'Voir l’actualité'),
        };
      },
      membres: membres.data || null,
      nomDeLExpediteur: (/** @type {any} */ message) => (
        estFil ? signatureDuMessage(t, message) : null
      ),
      ouvrirMembres: () => navigation.navigate(RouteNames.CollectiviteCanalMembres, {
        chatId,
        ...(espaceVille ? { espace: 'ville' } : {}),
      }),
      peutEcrire: estFil && peutEcrireDansLeFil({ ...contexte, membres: membres.data }),
      placeholder: placeholderDuFil(t, contexte),
      sousTitre: sousTitreDuFil(t, contexte),
      texteLectureSeule: estCanalVille
        ? t('collectiviteCanaux.ville.seuleLaVille', 'Seule la Ville écrit ici')
        : null,
      titre: titreDuFil(t, contexte),
      voix: voixDuFil(contexte),
    };
  }, [
    chatData, chatId, clubsCount, espaceVille, estFil, estQuitte, membres.data, navigation,
    routeChatType, t,
  ]);
};
