import i18next from 'i18next';
import { useTranslation } from 'react-i18next';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import localeDesFormats from '@/theme/strings/localeDesFormats';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

import { useGetEvent } from '@/services/event/eventQueries';

import { getEventLocationText } from '@/utils/eventLocationText';

// IMPL-4-ACCUEIL, page 5 (planche T-DESIGN-TOURNOI 5b et 5d, variante B « billet » retenue par
// Adel le 18/11) — LA POP-UP D'ANNONCE EN BILLET. Un gabarit À CÔTÉ de GlobalPromptModal (qui
// sert d'autres fenêtres : il ne change pas). Rien du tournoi n'est écrit ici : chaque zone vient
// de la campagne ou de l'événement qu'elle ouvre.
//   · photo        : l'image de la campagne (champ `image`) ; sans image, un bandeau bleu ;
//   · « FOUNDCLUB » sur la photo et dans le billet : le mot recomposé (FOUND bleu, CLUB blanc sur
//     la photo, noir sur le billet, Adel 18/11), quand le titre commence par « FoundClub » ;
//   · petite ligne du billet : `eyebrow` de la campagne ; grand titre : `title`, sinon le nom de
//     l'événement ;
//   · DATE, HEURE, LIEU, PRIX : l'événement (`date`, `startTime`, le lieu par la règle commune,
//     `tournamentConfig.entryFeeCents` ou `pricePerPerson`) ; une case sans donnée n'est pas
//     dessinée ;
//   · phrase sous le billet : `body` ; bouton : l'action principale ; « Plus tard » : l'action
//     secondaire, sinon la fermeture.
// Repli : tant que l'événement se lit, rien ; s'il ne se lit pas ou n'a pas de date, la fenêtre
// d'avant (`repli`, la GlobalPromptModal que l'hôte aurait montrée).
// ponytail: le logo du complexe partenaire (planche : « FOUNDCLUB x [logo] ») n'est pas dessiné :
// aucun champ ne le porte, et la photo attend l'accord du gérant. Sortie : un champ d'image de
// partenaire sur la campagne, ou le logo du complexe de l'événement côté serveur.
// Témoins : __tests__/BilletTournoiModal.test.js,
// __tests__/RemotePopupCampaignHost.IMPL4-billet.test.js.

const MARQUE = /^\s*found\s?club\b\s*(.*)$/i;

/**
 * « 20 € », même règle que `getTournamentEntryFeeLabel` (tournamentUtils.js), sans « par joueur ».
 * @param {any} event - L'événement.
 * @returns {string | null} Le montant, ou rien (gratuit).
 */
const montant = (event) => {
  const cents = Number(event?.tournamentConfig?.entryFeeCents);
  const fee = Math.round(cents > 0 ? cents : Number(event?.pricePerPerson) * 100);
  if (!Number.isFinite(fee) || fee <= 0) return null;
  return `${(fee / 100).toLocaleString('fr-FR')} €`;
};

/**
 * « 19 h », « 19 h 30 » (français), « 19:00 » sinon, depuis « 19:00:00.000 ».
 * @param {unknown} valeur - L'heure de début de l'événement.
 * @returns {string | null} L'heure, ou rien.
 */
const heure = (valeur) => {
  const trouve = /^(\d{1,2}):(\d{2})/.exec(String(valeur || ''));
  if (!trouve) return null;
  if (!String(i18next.language || 'fr').startsWith('fr')) {
    return `${trouve[1].padStart(2, '0')}:${trouve[2]}`;
  }
  return trouve[2] === '00' ? `${Number(trouve[1])} h` : `${Number(trouve[1])} h ${trouve[2]}`;
};

/**
 * « AR Soccer, Montpellier » : le nom du lieu et sa ville (le dernier morceau de l'adresse).
 * @param {any} event - L'événement.
 * @returns {string | null} Le lieu court, ou rien.
 */
const lieuCourt = (event) => {
  const morceaux = String(getEventLocationText(event) || '').split(',')
    .map((m) => m.trim())
    .filter(Boolean);
  if (!morceaux.length) return null;
  // Le nom du lieu quand l'événement le porte à part (`location.name`), sinon le premier morceau.
  const nom = typeof event?.location?.name === 'string' && event.location.name.trim()
    ? event.location.name.trim()
    : morceaux[0];
  const ville = morceaux.length > 1 ? morceaux[morceaux.length - 1] : null;
  return ville && ville !== nom ? `${nom}, ${ville}` : nom;
};

/**
 * Ce que le billet affiche, lu de la campagne et de l'événement ; `null` sans date (repli).
 * @param {any} event - L'événement ouvert par l'action principale.
 * @param {{ eyebrow?: string, title?: string }} campagne - Les textes de la campagne.
 * @returns {null | { date: string, heure: string | null, lieu: string | null, marque: boolean,
 *   prix: string | null, sousTitre: string, titre: string }} Les zones du billet.
 */
export const zonesDuBillet = (event, campagne = {}) => {
  const jour = event?.date ? new Date(event.date) : null;
  if (!jour || Number.isNaN(jour.getTime())) return null;
  const brut = new Intl.DateTimeFormat(localeDesFormats(), {
    day: 'numeric', month: 'short', timeZone: 'Europe/Paris', weekday: 'short',
  }).format(jour);
  const titreComplet = String(campagne.title || event?.name || '').trim();
  const trouve = MARQUE.exec(titreComplet);
  return {
    date: brut.charAt(0).toUpperCase() + brut.slice(1),
    heure: heure(event?.startTime),
    lieu: lieuCourt(event),
    marque: Boolean(trouve),
    prix: montant(event),
    sousTitre: String(campagne.eyebrow || '').trim(),
    titre: trouve ? trouve[1] : titreComplet,
  };
};

/**
 * Le mot « FOUNDCLUB » : FOUND en bleu, CLUB de la couleur demandée, même ligne de base.
 * @param {{ couleurClub: string, taille: number }} props - Couleur de « CLUB » et taille.
 * @returns {import('react').ReactElement} Le mot.
 */
function MotFoundClub({ couleurClub, taille }) {
  const { Colors } = useTheme();
  return (
    <Text
      accessibilityLabel="FoundClub"
      style={{ fontSize: taille, lineHeight: Math.round(taille * 1.2) }}
    >
      <Text style={{ color: Colors.primary500, fontFamily: 'Montserrat-Bold' }}>FOUND</Text>
      <Text style={{ color: couleurClub, fontFamily: 'Montserrat-Regular' }}>CLUB</Text>
    </Text>
  );
}

/**
 * Une case du billet : son nom en petites capitales, puis sa valeur.
 * @param {{ nom: string, valeur: string }} props - La case.
 * @returns {import('react').ReactElement} La case.
 */
function CaseDuBillet({ nom, valeur }) {
  const { Colors, Fonts } = useTheme();
  return (
    <View style={styles.caseDuBillet}>
      <Text style={[Fonts.p4Bold, styles.petitesCapitales, { color: Colors.neutral600 }]}>
        {nom}
      </Text>
      <Text style={[Fonts.p2Bold, { color: Colors.neutral900 }]}>{valeur}</Text>
    </View>
  );
}

/**
 * La pop-up d'annonce en billet (variante B), ou la fenêtre d'avant si l'événement ne se lit pas.
 * @param {{
 *  visible: boolean;
 *  eventId: string;
 *  eyebrow?: string;
 *  title?: string;
 *  body?: string;
 *  imageUrl?: string | null;
 *  primaryAction: { label: string; onPress: () => void };
 *  secondaryAction?: { label: string; onPress: () => void } | null;
 *  onRequestClose: () => void;
 *  repli: import('react').ReactNode;
 *  inlineOnAndroid?: boolean;
 * }} props
 * @returns {import('react').ReactNode} La pop-up billet, la fenêtre d'avant, ou rien.
 */
function BilletTournoiModal({
  body,
  eventId,
  eyebrow,
  imageUrl,
  inlineOnAndroid = false,
  onRequestClose,
  primaryAction,
  repli,
  secondaryAction = null,
  title,
  visible,
}) {
  const { t } = useTranslation();
  const { Colors, Fonts, Images } = useTheme();
  // Une panne ne dit rien : la fenêtre d'avant prend le relais.
  const lecture = useGetEvent(eventId, { meta: { preventToastError: true }, retry: false });

  if (!visible) return null;
  if (lecture.isLoading) return null;
  const zones = lecture.data ? zonesDuBillet(lecture.data, { eyebrow, title }) : null;
  if (!zones) return repli;

  const plusTard = secondaryAction || {
    label: t('implAccueil.billet.plusTard', 'Plus tard'),
    onPress: onRequestClose,
  };

  const contenu = (
    <View style={[styles.voile, { backgroundColor: withAlpha(Colors.neutral900, 0.6) }]}>
      <Pressable
        accessibilityLabel={t('implAccueil.billet.fermer', 'Fermer')}
        onPress={onRequestClose}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[styles.carte, {
          backgroundColor: Colors.primary800,
          borderColor: withAlpha(Colors.primary500, 0.38),
        }]}
        testID="popup-billet"
      >
        <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
          <View>
            {imageUrl ? (
              <Image
                accessibilityIgnoresInvertColors
                source={{ uri: imageUrl }}
                style={styles.photo}
              />
            ) : (
              <View style={[styles.photo, { backgroundColor: Colors.primary700 }]} />
            )}
            {zones.marque ? (
              <View style={styles.marqueSurPhoto}>
                <MotFoundClub couleurClub={Colors.neutral00} taille={18} />
              </View>
            ) : null}
            <TouchableOpacity
              accessibilityLabel={t('implAccueil.billet.fermer', 'Fermer')}
              accessibilityRole="button"
              onPress={onRequestClose}
              style={[styles.fermer, { backgroundColor: withAlpha(Colors.neutral900, 0.55) }]}
            >
              <Image
                source={Images.close}
                style={[styles.iconeFermer, { tintColor: Colors.neutral00 }]}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.billet} testID="popup-billet-ticket">
            <View style={[styles.talonGauche, { backgroundColor: Colors.neutral50 }]}>
              {zones.sousTitre ? (
                <Text style={[Fonts.p4Bold, styles.petitesCapitales, { color: Colors.neutral600 }]}>
                  {zones.sousTitre.toLocaleUpperCase('fr-FR')}
                </Text>
              ) : null}
              <View>
                {zones.marque ? <MotFoundClub couleurClub={Colors.neutral900} taille={22} /> : null}
                {zones.titre ? (
                  <Text style={[Fonts.h4Black, { color: Colors.neutral900 }]}>
                    {zones.titre.toLocaleUpperCase('fr-FR')}
                  </Text>
                ) : null}
              </View>
              <View style={styles.lignesDuBillet}>
                <CaseDuBillet nom={t('implAccueil.billet.date', 'Date')} valeur={zones.date} />
                {zones.heure ? (
                  <CaseDuBillet
                    nom={t('implAccueil.billet.heure', 'Heure')}
                    valeur={t('implAccueil.billet.des', 'dès {{heure}}', { heure: zones.heure })}
                  />
                ) : null}
              </View>
              {zones.lieu ? (
                <CaseDuBillet nom={t('implAccueil.billet.lieu', 'Lieu')} valeur={zones.lieu} />
              ) : null}
            </View>
            {zones.prix ? (
              <View style={[styles.talonDroit, {
                backgroundColor: Colors.primary500,
                borderLeftColor: Colors.neutral600,
              }]}
              >
                <Text style={[Fonts.h3Black, { color: Colors.neutral900 }]}>{zones.prix}</Text>
                <Text
                  style={[
                    Fonts.p4Bold,
                    styles.petitesCapitales,
                    styles.centre,
                    { color: Colors.neutral900 },
                  ]}
                >
                  {t('implAccueil.billet.parJoueur', 'par joueur').toLocaleUpperCase('fr-FR')}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.basDeCarte}>
            {body ? <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>{body}</Text> : null}
            <Button onPress={primaryAction.onPress} title={primaryAction.label} variant="Primary" />
            <TouchableOpacity
              accessibilityRole="button"
              onPress={plusTard.onPress}
              style={styles.plusTard}
            >
              <Text style={[Fonts.p2Bold, { color: Colors.primary200 }]}>{plusTard.label}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </View>
  );

  if (inlineOnAndroid && Platform.OS === 'android') {
    return <View style={styles.hoteEnLigne}>{contenu}</View>;
  }
  return (
    <Modal
      animationType="fade"
      hardwareAccelerated
      onRequestClose={onRequestClose}
      statusBarTranslucent
      transparent
      visible
    >
      {contenu}
    </Modal>
  );
}

const styles = StyleSheet.create({
  basDeCarte: {
    gap: 12,
    paddingBottom: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  billet: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: -72,
    transform: [{ rotate: '-1.5deg' }],
  },
  carte: {
    borderRadius: 24,
    borderWidth: 1,
    maxHeight: '92%',
    maxWidth: 420,
    overflow: 'hidden',
    width: '100%',
  },
  caseDuBillet: {
    gap: 2,
  },
  centre: {
    textAlign: 'center',
  },
  fermer: {
    alignItems: 'center',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    position: 'absolute',
    right: 8,
    top: 8,
    width: 44,
  },
  hoteEnLigne: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 1200,
  },
  iconeFermer: {
    height: 18,
    width: 18,
  },
  lignesDuBillet: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  marqueSurPhoto: {
    left: 16,
    position: 'absolute',
    top: 18,
  },
  petitesCapitales: {
    letterSpacing: 1.5,
  },
  photo: {
    height: 200,
    width: '100%',
  },
  plusTard: {
    alignItems: 'center',
    alignSelf: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 16,
  },
  talonDroit: {
    alignItems: 'center',
    borderBottomRightRadius: 4,
    borderLeftWidth: 2,
    borderStyle: 'dashed',
    borderTopRightRadius: 4,
    justifyContent: 'center',
    paddingHorizontal: 8,
    width: 92,
  },
  talonGauche: {
    borderBottomLeftRadius: 4,
    borderTopLeftRadius: 4,
    flex: 1,
    gap: 8,
    padding: 12,
  },
  voile: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
});

export default BilletTournoiModal;
