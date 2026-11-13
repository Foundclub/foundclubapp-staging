import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { creationEnAttente, peutCreerDans } from '@/domains/messaging/communautes';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';
import { GRAS_FAMILLE, REGULIER_FAMILLE } from '@/components/molecules/bulleDuFil/typographieDuFil';
import EnTeteCommunaute from '@/views/communautes/EnTeteCommunaute';

import { RouteNames } from '@/navigation/routeNames';

import { getMesCommunautes } from '@/services/chat/communauteService';

/** @type {Record<string, string>} */
const SOUS_TITRES_DES_GENRES = {
  club: 'Communauté du club',
  complexe: 'Communauté du complexe',
  omnisport: 'Communauté de l’omnisport',
  ville: 'Communauté de la Ville',
};

/**
 * COMMUNAUTES-L2 (13/11/2026, D76 ; maquette v3, écran 2 en lecture simple) — « Communautés » :
 * chacune de mes
 * communautés (club, omnisport, Ville, complexe) avec son Annonces (le fil d'aujourd'hui) et mes
 * groupes. Chaque
 * ligne ouvre le fil tel qu'il est aujourd'hui. « Nouveau groupe » seulement si le serveur dit
 * `peutCreer`.
 * Non-lus, appui long et ligne de la communauté dans Messages : lot L4.
 * @param {object} props
 * @param {any} props.navigation
 * @returns {import('react').ReactElement} L'écran.
 */
function Communautes({ navigation }) {
  const { Colors } = useTheme();
  const { t } = useTranslation();
  const { bottom } = useSafeAreaInsets();
  const [communautes, setCommunautes] = useState(/** @type {any[] | null} */ (null));
  const [erreur, setErreur] = useState(false);

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

  const sourdine = withAlpha(Colors.neutral00, 0.6);
  // Un fond bleu TRANSLUCIDE (18 %) sous une icone claire : lisible, ce n'est pas le bouton plein.
  const fondDeLaPastille = withAlpha(Colors.primary500, 0.18);
  const nomDuGroupe = (/** @type {any} */ g) => g?.nom
    || (g?.origine === 'ville'
      ? t('communautes.filDeLaVille', 'Fil de la Ville')
      : t('communautes.groupe', 'Groupe'));
  const ouvrirFil = (/** @type {string} */ chatId, /** @type {string} */ title) => (
    navigation.navigate(RouteNames.Conversation, { chatId, title })
  );

  const ligne = (/** @type {any} */ {
    cle, icone, onPress, sousTitre, titre,
  }) => (
    <TouchableOpacity
      accessibilityRole="button"
      key={cle}
      onPress={onPress}
      style={[styles.ligne, { borderTopColor: withAlpha(Colors.neutral00, 0.07) }]}
      testID={`communaute-ligne-${cle}`}
    >
      <View style={[styles.pastille, { backgroundColor: fondDeLaPastille }]}>
        <GlyphIcon color={Colors.neutral00} name={icone} size={18} />
      </View>
      <View style={styles.textes}>
        <Text numberOfLines={1} style={[styles.libelle, { color: Colors.neutral00 }]}>
          {titre}
        </Text>
        {sousTitre ? (
          <Text numberOfLines={1} style={[styles.aide, { color: sourdine }]}>
            {sousTitre}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );

  let contenu;
  if (erreur) {
    contenu = (
      <Text style={[styles.note, { color: sourdine }]} testID="communautes-erreur">
        {t('communautes.erreur', 'Impossible de charger tes communautés pour l’instant.')}
      </Text>
    );
  } else if (communautes === null) {
    contenu = <ActivityIndicator color={Colors.primary500} style={styles.attente} />;
  } else if (communautes.length === 0) {
    contenu = (
      <Text style={[styles.note, { color: sourdine }]} testID="communautes-vide">
        {t('communautes.vide', 'Tu ne fais partie d’aucune communauté pour l’instant.')}
      </Text>
    );
  } else {
    contenu = communautes.map((c) => (
      <View key={`${c.genre}-${c.documentId}`} testID={`communaute-${c.genre}-${c.documentId}`}>
        <Text style={[styles.titreCommunaute, { color: Colors.neutral00 }]}>{c.nom}</Text>
        <Text style={[styles.aide, { color: sourdine }]}>
          {t(`communautes.genre.${c.genre}`, SOUS_TITRES_DES_GENRES[c.genre] || 'Communauté')}
        </Text>
        <View style={[styles.carte, { backgroundColor: Colors.primary700 }]}>
          {c.annonces
            ? ligne({
              cle: `annonces-${c.documentId}`,
              icone: 'thumbtack',
              onPress: () => ouvrirFil(c.annonces, t('communautes.annonces', 'Annonces')),
              sousTitre: t('communautes.annoncesAide', 'Seuls les admins écrivent'),
              titre: t('communautes.annonces', 'Annonces'),
            })
            : null}
          {(c.groupes || []).map((/** @type {any} */ g) => ligne({
            cle: g.chat,
            icone: g.icone || 'users',
            onPress: () => ouvrirFil(g.chat, nomDuGroupe(g)),
            sousTitre: t(`communautes.theme.${g.theme}`, g.theme),
            titre: nomDuGroupe(g),
          }))}
          {!c.annonces && !(c.groupes || []).length ? (
            <Text style={[styles.note, { color: sourdine }]}>
              {t('communautes.aucunGroupe', 'Aucun groupe pour l’instant.')}
            </Text>
          ) : null}
        </View>
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
    ));
  }

  return (
    <View style={[styles.page, { backgroundColor: Colors.chatBackground }]} testID="communautes">
      <EnTeteCommunaute
        onRetour={() => navigation.goBack()}
        titre={t('communautes.titre', 'Communautés')}
      />
      <ScrollView contentContainerStyle={[styles.contenu, { paddingBottom: 40 + bottom }]}>
        {contenu}
      </ScrollView>
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
  bouton: {
    alignItems: 'center',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    marginTop: 12,
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
  libelle: {
    fontFamily: GRAS_FAMILLE,
    fontSize: 15,
  },
  ligne: {
    alignItems: 'center',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 60,
    paddingHorizontal: 14,
    paddingVertical: 10,
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
  texteBouton: {
    fontFamily: GRAS_FAMILLE,
    fontSize: 15,
  },
  textes: {
    flex: 1,
  },
  titreCommunaute: {
    fontFamily: GRAS_FAMILLE,
    fontSize: 20,
  },
});

export default Communautes;
