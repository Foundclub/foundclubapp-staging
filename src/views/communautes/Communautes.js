import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useAuth from '@/domains/auth/useAuth';
import { auteurDeLApercu, estMineurConnu } from '@/domains/collectivite/collectiviteCanaux';
import { prenomDansLeFil } from '@/domains/messaging/anonymatDeLigue';
import {
  bandeauDuComplexe,
  creationEnAttente,
  dOfficeSansApercu,
  groupesVisibles,
  peutCreerDans,
  peutQuitterLeGroupe,
  raisonDuGroupe,
} from '@/domains/messaging/communautes';
import {
  formatChatTimestamp,
  getChatLastMessage,
  getChatMessagePreview,
} from '@/domains/messaging/messagingUseCases';
import useMessaging from '@/domains/messaging/useMessaging';
import { formatThreadUnreadBadge } from '@/domains/messaging/useUnreadMessages';
import { computeAge } from '@/domains/playerCard/cardModel';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';
import { GRAS_FAMILLE, REGULIER_FAMILLE } from '@/components/molecules/bulleDuFil/typographieDuFil';
import MenuDuFil from '@/views/chat/MenuDuFil';
import EnTeteCommunaute from '@/views/communautes/EnTeteCommunaute';

import { RouteNames } from '@/navigation/routeNames';

import { useGetChats } from '@/services/chat/chatQueriesCompat';
import {
  getMesCommunautes,
  quitterLaCommunauteDuComplexe,
  quitterLeGroupe,
} from '@/services/chat/communauteService';

import { confirmerDansLApp } from '@/utils/fenetreDeLApp';

/**
 * Le sous-titre d'une communauté selon son genre. Récolte T11 : les replis vivent DANS `t()`
 * (porte i18n:no-regression) ; même clé, même repli qu'avant.
 * @param {import('i18next').TFunction} t - la traduction.
 * @param {string} genre
 * @returns {string} Le sous-titre.
 */
const sousTitreDuGenre = (t, genre) => {
  if (genre === 'club') return t('communautes.genre.club', 'Communauté du club');
  if (genre === 'complexe') return t('communautes.genre.complexe', 'Communauté du complexe');
  if (genre === 'omnisport') return t('communautes.genre.omnisport', 'Communauté de l’omnisport');
  if (genre === 'ville') return t('communautes.genre.ville', 'Communauté de la Ville');
  return t(`communautes.genre.${genre}`, 'Communauté');
};

/**
 * COMMUNAUTES-L2 (13/11/2026, D76) puis L4 (14/11, maquette v3 écrans 2, 5, 8 et variante A) —
 * « Communautés ». Ouvert depuis la ligne de la communauté (écran 1) avec `genre` + `id` : cette
 * communauté seule ; sans paramètre (bouton de repli) : toutes, à la suite.
 *   · Annonces épinglé en haut (le canal d'aujourd'hui, renommé à l'écran, écran 5), puis « Tes
 *     groupes », chacun avec ses non-lus, l'heure et l'aperçu du dernier message (lus dans la liste
 *     des messages déjà chargée : aucun appel neuf), ou la raison « D'office · parent de Lina ».
 *   · Appui long sur un groupe : marquer comme lu, infos du groupe, quitter (un groupe à thème
 *     seulement ; qui quitte n'y est pas remis d'office).
 *   · Un mineur ne voit jamais un groupe d'adultes (271 A), et « Pourquoi je ne vois pas tous les
 *     groupes ? » le lui dit (écran 8).
 *   · Le complexe mis en favori : le bandeau « pourquoi tu es là » et « Quitter la communauté »
 *     (variante A).
 * « Couper les notifications » n'existe pas encore (aucune coupure par fil) : non montré.
 * @param {object} props
 * @param {any} props.navigation
 * @param {any} [props.route]
 * @returns {import('react').ReactElement} L'écran.
 */
function Communautes({ navigation, route = undefined }) {
  const { Colors } = useTheme();
  const { t } = useTranslation();
  const { bottom } = useSafeAreaInsets();
  const { allMyTeams, userData } = useAuth();
  const { sendReadReceipt, updateLastReadMessage } = useMessaging();
  const meId = String(userData?.documentId || '');
  const mineur = estMineurConnu(userData);
  const ageConnu = computeAge(userData?.birthdate);
  const moinsDe13 = ageConnu !== null && ageConnu < 13;
  const [communautes, setCommunautes] = useState(/** @type {any[] | null} */ (null));
  const [erreur, setErreur] = useState(false);
  const [menu, setMenu] = useState(/** @type {{ groupe: any, titre: string } | null} */ (null));
  const [pourquoiOuvert, setPourquoiOuvert] = useState(false);

  // La requête de « Messages » (même clé, donc même cache) : l'aperçu et l'heure de chaque groupe.
  const mesEquipes = useMemo(() => (Array.isArray(allMyTeams)
    ? Array.from(new Set(allMyTeams
      .map((/** @type {any} */ equipe) => String(equipe?.documentId || '').trim())
      .filter(Boolean)))
    : []), [allMyTeams]);
  const { data: listeDesFils } = useGetChats({
    currentUserClubId: userData?.club?.documentId,
    currentUserId: userData?.documentId,
    currentUserTeamIds: mesEquipes,
  });
  const filsParId = useMemo(() => {
    const pages = /** @type {any} */ (listeDesFils)?.pages;
    const fils = Array.isArray(pages) ? pages.flatMap((/** @type {any} */ p) => p?.data || []) : [];
    return new Map(fils.map((/** @type {any} */ f) => [String(f?.documentId || ''), f]));
  }, [listeDesFils]);

  const charger = useCallback(async () => {
    try {
      setCommunautes(await getMesCommunautes());
      setErreur(false);
    } catch {
      setErreur(true);
    }
  }, []);

  useEffect(() => {
    charger();
    const desabonner = navigation?.addListener?.('focus', charger);
    return typeof desabonner === 'function' ? desabonner : undefined;
  }, [charger, navigation]);

  const genreDemande = route?.params?.genre;
  const idDemande = route?.params?.id;
  const choisies = genreDemande && idDemande && Array.isArray(communautes)
    ? communautes.filter((c) => c?.genre === genreDemande
      && String(c?.documentId) === String(idDemande))
    : [];
  // Une communauté quittée entre-temps : toutes, plutôt qu'un écran vide.
  const affichees = choisies.length ? choisies : communautes;
  const seule = choisies.length === 1 ? choisies[0] : null;

  const sourdine = withAlpha(Colors.neutral00, 0.6);
  // Un fond bleu TRANSLUCIDE (18 %) sous une icone claire : lisible, ce n'est pas le bouton plein.
  const fondDeLaPastille = withAlpha(Colors.primary500, 0.18);
  // Variante A : même raison, un voile bleu à 12 % sous un texte clair (pas un bouton plein).
  const fondDuBandeau = withAlpha(Colors.primary500, 0.12);
  const nomDuGroupe = (/** @type {any} */ g) => g?.nom
    || (g?.origine === 'ville'
      ? t('communautes.filDeLaVille', 'Fil de la Ville')
      : t('communautes.groupe', 'Groupe'));
  const ouvrirFil = (/** @type {string} */ chatId, /** @type {string} */ title, sousTitre = '') => (
    navigation.navigate(RouteNames.Conversation, {
      chatId,
      title,
      ...(sousTitre ? { subTitle: sousTitre } : {}),
    })
  );
  /**
   * L'aperçu du dernier message, comme la liste des messages (« Sophie : … »).
   * @param {string} chatId - Le fil.
   * @returns {{ heure: string, texte: string }} L'heure et le texte, vides sans message.
   */
  const apercuDe = (/** @type {string} */ chatId) => {
    const fil = filsParId.get(String(chatId || ''));
    const dernier = fil ? getChatLastMessage(fil) : null;
    if (!dernier) return { heure: '', texte: '' };
    const deMoi = dernier?.sender?.documentId === meId;
    const auteur = deMoi ? '' : auteurDeLApercu(
      dernier,
      prenomDansLeFil({ chat: fil, moiId: meId, personne: dernier?.sender }),
    );
    const texte = getChatMessagePreview(dernier, t);
    return {
      heure: formatChatTimestamp(dernier.createdAt),
      texte: auteur ? `${auteur} : ${texte}` : texte,
    };
  };

  const ligne = (/** @type {any} */ {
    cle, heure = '', icone, nonLus = 0, onLongPress = undefined, onPress, sousTitre, titre,
  }) => {
    const pastille = formatThreadUnreadBadge(nonLus);
    return (
      <TouchableOpacity
        accessibilityRole="button"
        delayLongPress={450}
        key={cle}
        onLongPress={onLongPress}
        onPress={onPress}
        style={[styles.ligne, { borderTopColor: withAlpha(Colors.neutral00, 0.07) }]}
        testID={`communaute-ligne-${cle}`}
      >
        <View style={[styles.pastille, { backgroundColor: fondDeLaPastille }]}>
          <GlyphIcon color={Colors.neutral00} name={icone} size={18} />
        </View>
        <View style={styles.textes}>
          <View style={styles.rangee}>
            <Text numberOfLines={1} style={[styles.libelle, { color: Colors.neutral00 }]}>
              {titre}
            </Text>
            {heure ? (
              <Text
                style={[
                  styles.heure,
                  pastille
                    ? { color: Colors.primary500, fontFamily: GRAS_FAMILLE }
                    : { color: sourdine },
                ]}
              >
                {heure}
              </Text>
            ) : null}
          </View>
          <View style={styles.rangee}>
            {sousTitre ? (
              <Text numberOfLines={1} style={[styles.aide, styles.extensible, { color: sourdine }]}>
                {sousTitre}
              </Text>
            ) : <View style={styles.extensible} />}
            {pastille ? (
              <View
                style={[styles.nonLus, { backgroundColor: Colors.primary500 }]}
                testID={`communaute-non-lus-${cle}`}
              >
                <Text style={[styles.texteNonLus, { color: Colors.primary900 }]}>{pastille}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const quitterLaCommunaute = async (/** @type {any} */ c) => {
    const ok = await confirmerDansLApp(t('communautes.quitterLaCommunauteConfirmer', {
      defaultValue: 'Quitter la communauté du {{nom}} ? Tu sors de tous ses groupes et tu gardes '
        + 'ton favori.',
      interpolation: { escapeValue: false },
      nom: c.nom,
    }));
    if (!ok) return;
    try {
      await quitterLaCommunauteDuComplexe({
        groupes: (c.groupes || [])
          .filter(peutQuitterLeGroupe)
          .map((/** @type {any} */ g) => g.chat),
        slug: c.slug,
      });
      navigation.goBack();
    } catch {
      setErreur(true);
    }
  };

  /**
   * Le menu de l'appui long sur un groupe.
   * @returns {import('@/views/chat/MenuDuFil').EntreeDuMenu[]} Ses entrées.
   */
  const entreesDuMenu = () => {
    if (!menu) return [];
    const { groupe, titre } = menu;
    const fermerPuis = (/** @type {() => any} */ geste) => () => {
      setMenu(null);
      geste();
    };
    /** @type {import('@/views/chat/MenuDuFil').EntreeDuMenu[]} */
    const entrees = [];
    if (Number(groupe?.nonLus) > 0) {
      entrees.push({
        cle: 'marquer-lu',
        icone: 'checkDouble',
        libelle: t('messaging.preview.markRead', 'Marquer comme lu'),
        onPress: fermerPuis(() => {
          updateLastReadMessage?.(groupe.chat);
          sendReadReceipt?.(groupe.chat);
          setCommunautes((avant) => (avant || []).map((c) => ({
            ...c,
            groupes: (c.groupes || []).map((/** @type {any} */ g) => (
              g.chat === groupe.chat ? { ...g, nonLus: 0 } : g
            )),
          })));
        }),
      });
    }
    entrees.push({
      cle: 'infos',
      icone: 'information',
      libelle: t('communautes.infosDuGroupe', 'Infos du groupe'),
      onPress: fermerPuis(() => navigation.navigate(RouteNames.Conversation, {
        chatId: groupe.chat,
        ouvrirInfos: true,
        title: titre,
      })),
    });
    if (peutQuitterLeGroupe(groupe)) {
      entrees.push({
        cle: 'quitter',
        danger: true,
        icone: 'xmark',
        libelle: t('communautes.quitterLeGroupe', 'Quitter le groupe'),
        onPress: fermerPuis(async () => {
          const ok = await confirmerDansLApp(t('communautes.quitterLeGroupeConfirmer', {
            defaultValue: 'Quitter « {{nom}} » ? Tu n’y seras pas remis d’office.',
            interpolation: { escapeValue: false },
            nom: titre,
          }));
          if (!ok) return;
          try {
            await quitterLeGroupe(groupe.chat);
            charger();
          } catch {
            setErreur(true);
          }
        }),
      });
    }
    return entrees;
  };

  let contenu;
  if (erreur) {
    contenu = (
      <Text style={[styles.note, { color: sourdine }]} testID="communautes-erreur">
        {t('communautes.erreur', 'Impossible de charger tes communautés pour l’instant.')}
      </Text>
    );
  } else if (affichees === null) {
    contenu = <ActivityIndicator color={Colors.primary500} style={styles.attente} />;
  } else if (affichees.length === 0) {
    contenu = (
      <Text style={[styles.note, { color: sourdine }]} testID="communautes-vide">
        {t('communautes.vide', 'Tu ne fais partie d’aucune communauté pour l’instant.')}
      </Text>
    );
  } else {
    contenu = affichees.map((c) => {
      const groupes = groupesVisibles(c, { mineur });
      const annonces = c.annonces ? apercuDe(c.annonces) : null;
      return (
        <View key={`${c.genre}-${c.documentId}`} testID={`communaute-${c.genre}-${c.documentId}`}>
          {seule ? null : (
            <>
              <Text style={[styles.titreCommunaute, { color: Colors.neutral00 }]}>{c.nom}</Text>
              <Text style={[styles.aide, { color: sourdine }]}>
                {sousTitreDuGenre(t, c.genre)}
              </Text>
            </>
          )}
          {bandeauDuComplexe(c) ? (
            <View
              style={[styles.bandeau, { backgroundColor: fondDuBandeau }]}
              testID={`communaute-bandeau-${c.documentId}`}
            >
              <Text style={[styles.aide, { color: Colors.neutral00 }]}>
                {t('communautes.bandeauFavori', {
                  defaultValue: 'Tu es dans la communauté du {{nom}} parce que tu l’as mis en '
                    + 'favori.',
                  interpolation: { escapeValue: false },
                  nom: c.nom,
                })}
              </Text>
              {c.slug ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => quitterLaCommunaute(c)}
                  style={[styles.boutonDiscret, { borderColor: withAlpha(Colors.neutral00, 0.3) }]}
                  testID={`communaute-quitter-${c.documentId}`}
                >
                  <Text style={[styles.texteBouton, { color: Colors.neutral00 }]}>
                    {t('communautes.quitterLaCommunaute', 'Quitter la communauté')}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
          <View style={[styles.carte, { backgroundColor: Colors.primary700 }]}>
            {c.annonces
              ? ligne({
                cle: `annonces-${c.documentId}`,
                heure: annonces?.heure,
                icone: 'thumbtack',
                nonLus: c.annoncesNonLus,
                onPress: () => ouvrirFil(c.annonces, t('communautes.annonces', 'Annonces'), c.nom),
                sousTitre: annonces?.texte
                  || t('communautes.annoncesAide', 'Seuls les admins écrivent'),
                titre: t('communautes.annonces', 'Annonces'),
              })
              : null}
          </View>
          {groupes.length ? (
            <>
              <Text style={[styles.section, { color: sourdine }]}>
                {t('communautes.tesGroupes', 'Tes groupes')}
              </Text>
              <View style={[styles.carte, { backgroundColor: Colors.primary700 }]}>
                {groupes.map((/** @type {any} */ g) => {
                  const apercu = apercuDe(g.chat);
                  const titre = nomDuGroupe(g);
                  return ligne({
                    cle: g.chat,
                    heure: apercu.heure,
                    icone: g.icone || 'users',
                    nonLus: g.nonLus,
                    onLongPress: () => setMenu({ groupe: g, titre }),
                    onPress: () => ouvrirFil(g.chat, titre),
                    sousTitre: raisonDuGroupe(t, g) || apercu.texte || dOfficeSansApercu(t, g)
                      || t(`communautes.theme.${g.theme}`, g.theme),
                    titre,
                  });
                })}
              </View>
            </>
          ) : null}
          {!c.annonces && !groupes.length ? (
            <Text style={[styles.note, { color: sourdine }]}>
              {t('communautes.aucunGroupe', 'Aucun groupe pour l’instant.')}
            </Text>
          ) : null}
          {mineur && c.genre !== 'complexe' ? (
            <View style={styles.mineur} testID={`communaute-mineur-${c.documentId}`}>
              {moinsDe13 ? (
                <Text style={[styles.aide, { color: sourdine }]}>
                  {t('communautes.mineurParents', 'Tes parents sont dans les groupes où tu es.')}
                </Text>
              ) : null}
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => setPourquoiOuvert(true)}
                testID="communaute-mineur-pourquoi"
              >
                <Text style={[styles.lien, { color: Colors.primary500 }]}>
                  {t('communautes.mineurPourquoi', 'Pourquoi je ne vois pas tous les groupes ?')}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
          {peutCreerDans(c) ? (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => navigation.navigate(RouteNames.NouveauGroupeCommunaute, {
                genre: c.genre,
                id: c.documentId,
                nomCommunaute: c.nom,
              })}
              style={[styles.bouton, { backgroundColor: Colors.primary500 }]}
              testID={`communaute-nouveau-groupe-${c.documentId}`}
            >
              <Text style={[styles.texteBouton, { color: Colors.primary900 }]}>
                {t('communautes.nouveauGroupe', 'Nouveau groupe')}
              </Text>
            </TouchableOpacity>
          ) : null}
          {creationEnAttente(c) ? (
            <Text
              style={[styles.note, { color: sourdine }]}
              testID={`communaute-ville-attente-${c.documentId}`}
            >
              {t(
                'communautes.villeInvitations',
                'Les groupes de la Ville arrivent avec les invitations.',
              )}
            </Text>
          ) : null}
        </View>
      );
    });
  }

  return (
    <View style={[styles.page, { backgroundColor: Colors.chatBackground }]} testID="communautes">
      <EnTeteCommunaute
        onRetour={() => navigation.goBack()}
        sousTitre={seule
          ? sousTitreDuGenre(t, seule.genre)
          : ''}
        titre={seule?.nom || t('communautes.titre', 'Communautés')}
      />
      <ScrollView contentContainerStyle={[styles.contenu, { paddingBottom: 40 + bottom }]}>
        {contenu}
      </ScrollView>
      <MenuDuFil entrees={entreesDuMenu()} onClose={() => setMenu(null)} visible={Boolean(menu)} />
      <Modal
        animationType="fade"
        onRequestClose={() => setPourquoiOuvert(false)}
        testID="communaute-mineur-modal"
        transparent
        visible={pourquoiOuvert}
      >
        <Pressable
          onPress={() => setPourquoiOuvert(false)}
          style={[styles.voile, { backgroundColor: withAlpha(Colors.neutral900, 0.6) }]}
        >
          <View
            style={[
              styles.feuille,
              { backgroundColor: Colors.primary700, paddingBottom: 24 + bottom },
            ]}
            testID="communaute-mineur-feuille"
          >
            <Text style={[styles.libelle, { color: Colors.neutral00 }]}>
              {t('communautes.mineurPourquoi', 'Pourquoi je ne vois pas tous les groupes ?')}
            </Text>
            <Text style={[styles.aide, { color: sourdine }]}>
              {t(
                'communautes.mineurPourquoiTexte',
                'Certains groupes du club sont réservés aux adultes : parents, covoiturage, '
                  + 'encadrement. Tu vois les groupes de ton équipe et les annonces du club.',
              )}
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => setPourquoiOuvert(false)}
              style={[styles.bouton, { backgroundColor: Colors.primary500 }]}
              testID="communaute-mineur-compris"
            >
              <Text style={[styles.texteBouton, { color: Colors.primary900 }]}>
                {t('communautes.jaiCompris', 'J’ai compris')}
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  aide: {
    fontFamily: REGULIER_FAMILLE,
    fontSize: 13,
    marginTop: 2,
  },
  attente: {
    marginTop: 40,
  },
  bandeau: {
    borderRadius: 14,
    gap: 10,
    marginTop: 12,
    padding: 14,
  },
  bouton: {
    alignItems: 'center',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    marginTop: 12,
  },
  boutonDiscret: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  carte: {
    borderRadius: 16,
    marginTop: 12,
    overflow: 'hidden',
  },
  contenu: {
    alignSelf: 'center',
    gap: 28,
    maxWidth: 640,
    padding: 16,
    width: '100%',
  },
  extensible: {
    flex: 1,
  },
  feuille: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    gap: 10,
    padding: 20,
  },
  heure: {
    fontFamily: REGULIER_FAMILLE,
    fontSize: 12,
  },
  libelle: {
    flex: 1,
    fontFamily: GRAS_FAMILLE,
    fontSize: 15,
  },
  lien: {
    fontFamily: GRAS_FAMILLE,
    fontSize: 14,
    paddingVertical: 8,
  },
  ligne: {
    alignItems: 'center',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  mineur: {
    marginTop: 14,
  },
  nonLus: {
    alignItems: 'center',
    borderRadius: 10,
    height: 20,
    justifyContent: 'center',
    minWidth: 20,
    paddingHorizontal: 6,
  },
  note: {
    fontFamily: REGULIER_FAMILLE,
    fontSize: 14,
    marginTop: 12,
    padding: 4,
  },
  page: {
    flex: 1,
  },
  pastille: {
    alignItems: 'center',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  rangee: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  section: {
    fontFamily: GRAS_FAMILLE,
    fontSize: 13,
    marginTop: 18,
    textTransform: 'uppercase',
  },
  texteBouton: {
    fontFamily: GRAS_FAMILLE,
    fontSize: 15,
  },
  texteNonLus: {
    fontFamily: GRAS_FAMILLE,
    fontSize: 11.5,
  },
  textes: {
    flex: 1,
  },
  titreCommunaute: {
    fontFamily: GRAS_FAMILLE,
    fontSize: 20,
  },
  voile: {
    flex: 1,
    justifyContent: 'flex-end',
  },
});

export default Communautes;
