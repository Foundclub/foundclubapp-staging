import {
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import BottomModal from '@/components/molecules/bottomModal/BottomModal';

import {
  buildArrivedAtIso,
  countPresence,
  formatTimeInZone,
  listNeverSeen,
} from './attendanceCallModel';

/**
 * Les six paliers du pack, dans l ordre de la grille 3 x 2.
 *
 * ⛔ PAS DE SAISIE LIBRE EN V1 (decision D4). L ancienne feuille offrait
 * « Autre heure » : un clavier au bord d un terrain, pour un cas que ces six
 * valeurs couvrent deja. A rouvrir si la recette le demande.
 */
const LATE_STEPS = [5, 10, 15, 20, 30, 45];

const styles = StyleSheet.create({
  body: { gap: 12, paddingHorizontal: 16, paddingVertical: 8 },
  cancel: {
    alignItems: 'center',
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 44,
  },
  // 🖐️ 48 de HAUT : c est une hauteur, pas un jeton `Spaces` — la rampe ne
  // genere que des marges et des espacements, elle n a rien a dire ici.
  chip: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flexBasis: '31%',
    flexGrow: 1,
    height: 48,
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12,
  },
  footerButton: {
    alignItems: 'center',
    borderRadius: 100,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 16,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  header: { gap: 4, paddingHorizontal: 16, paddingTop: 16 },
  nameRow: { justifyContent: 'center', minHeight: 44 },
  namesBox: { borderRadius: 12, gap: 4, padding: 12 },
});

/**
 * 2D — CLOTURER L APPEL.
 *
 * ⛔ CE BOUTON N ECRIT RIEN, ET LA FEUILLE LE DIT. Aucune route de cloture
 * n existe cote serveur : c est le cron `eventAbsenceFinalizationGovernance`
 * qui passe les non-pointes en « Non pointé », a la fin du match. Ecrire
 * « 4 personnes vont passer en Non pointé » sur un bouton qui ne fait que
 * quitter le mode en ferait un MENTEUR — il rendrait la main sans avoir rien
 * ecrit, et le coach croirait la feuille close.
 *
 * ✅ Ce qu elle annonce, en revanche, est vrai et verifiable : QUI le fera
 * (le serveur), QUAND (le premier passage du cron apres la fin), et jusqu a
 * quand on peut encore corriger (la fermeture de la fenetre).
 * @param {object} props - Les proprietes de la feuille.
 * @param {boolean} props.isVisible - La feuille est-elle ouverte.
 * @param {any[]} props.items - Les lignes de la feuille de presence.
 * @param {() => void} props.onClose - Fermer sans quitter le mode.
 * @param {() => void} props.onConfirm - Quitter le mode d appel.
 * @param {any} props.payloadData - La reponse de `list`.
 * @param {number | null} props.sweepAtMs - Le premier passage du cron.
 * @param {number | null} props.closesAtMs - La fermeture de la fenetre.
 * @param {(key: string, fallback: string) => string} props.t - Le traducteur.
 * @returns {import('react').ReactElement} - La feuille.
 */
export function AttendanceCloseSheet({
  closesAtMs,
  isVisible,
  items,
  onClose,
  onConfirm,
  payloadData,
  sweepAtMs,
  t,
}) {
  const { Colors, Fonts } = useTheme();
  const timezone = payloadData?.timezone;
  const presence = countPresence(items);
  const neverSeen = listNeverSeen(items);
  const identitiesHidden = Boolean(payloadData?.participantIdentitiesHidden);
  const markedCount = items.length - presence.waiting;

  // 🗣️ Toutes les chaines de la feuille, au meme endroit.
  const mots = {
    anonymous: t('eventDetails.attendanceCall.row.anonymous', 'Participant·e'),
    arrived: t('eventDetails.attendanceCall.presence.arrived', 'Arrivé·e·s'),
    arrivedLate: t('eventDetails.attendanceCall.close.arrivedLate', 'Arrivé·e·s en retard'),
    confirm: t('eventDetails.attendanceCall.close.confirm', 'Clôturer'),
    confirmLabel: t(
      'eventDetails.attendanceCall.close.confirmLabel',
      "Clôturer l'appel maintenant",
    ),
    keepGoing: t('eventDetails.attendanceCall.close.keepGoing', "Continuer l'appel"),
    marked: t('eventDetails.attendanceCall.close.marked', 'pointés'),
    neverSeen: t('eventDetails.attendanceCall.close.neverSeen', 'jamais vus'),
    title: t('eventDetails.attendanceCall.close.title', "CLÔTURER L'APPEL"),
  };

  const heureBalayage = formatTimeInZone(sweepAtMs, timezone);
  const heureFermeture = formatTimeInZone(closesAtMs, timezone);

  return (
    <BottomModal
      close={onClose}
      footerComponent={(
        <View style={styles.footer}>
          <TouchableOpacity
            accessibilityLabel={mots.keepGoing}
            accessibilityRole="button"
            onPress={onClose}
            style={[styles.footerButton, { borderColor: Colors.neutral500 }]}
          >
            <Text style={[Fonts.p3Bold, { color: Colors.neutral200 }]}>
              {mots.keepGoing}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityLabel={mots.confirmLabel}
            accessibilityRole="button"
            onPress={onConfirm}
            style={[styles.footerButton, {
              backgroundColor: Colors.primary500, borderColor: Colors.primary500,
            }]}
          >
            <Text style={[Fonts.p3Bold, { color: Colors.primary900 }]}>
              {mots.confirm}
            </Text>
          </TouchableOpacity>
        </View>
      )}
      headerComponent={(
        <View style={styles.header}>
          <Text style={[Fonts.p4Bold, { color: Colors.neutral400 }]}>
            {mots.title}
          </Text>
          <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>
            {`${markedCount} ${mots.marked} · ${neverSeen.length} ${mots.neverSeen}`}
          </Text>
        </View>
      )}
      isVisible={isVisible}
      snapPoints={['68%']}
    >
      <View style={styles.body}>
        <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>
          {`${presence.arrived} ${mots.arrived}`}
        </Text>
        <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>
          {`${presence.late} ${mots.arrivedLate}`}
        </Text>

        {/* 🗣️ LA VERITE, PAS UNE PROMESSE : qui le fait, quand, et jusqu a
            quand on peut revenir dessus. */}
        <Text style={[Fonts.p4, { color: Colors.neutral300 }]}>
          {`${t(
            'eventDetails.attendanceCall.close.serverWill',
            'Le serveur les passera en « Non pointé » après la fin du match, vers',
          )} ${heureBalayage}.`}
        </Text>
        <Text style={[Fonts.p4, { color: Colors.neutral300 }]}>
          {`${t(
            'eventDetails.attendanceCall.close.stillCorrect',
            'Tu pourras encore corriger jusqu\'à',
          )} ${heureFermeture}.`}
        </Text>

        <ScrollView contentContainerStyle={[styles.namesBox, {
          backgroundColor: withAlpha(Colors.primary900, 0.6),
        }]}
        >
          {neverSeen.map((item, index) => (
            <View key={item?.user?.documentId || index} style={styles.nameRow}>
              <Text style={[Fonts.p3, { color: Colors.neutral00 }]}>
                {identitiesHidden
                  ? `${mots.anonymous} ${index + 1}`
                  : `${item?.user?.firstname || ''} ${item?.user?.lastname || ''}`.trim()}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </BottomModal>
  );
}

/**
 * 2E — RETARD CONSTATE (pack minimaliste du 26/08, decision D4).
 *
 * 🎯 UN SEUL APPUI, ET C EST TOUT LE SUJET. L ancienne feuille demandait
 * DEUX gestes — choisir un palier, puis appuyer sur « Enregistrer » — plus une
 * saisie libre « Autre heure » et une note du staff. Au bord d un terrain, le
 * coach a un joueur devant lui et une equipe a placer : choisir la duree DOIT
 * pointer et refermer.
 *
 * ⌨️ « Jamais un clavier par défaut » est desormais tenu par CONSTRUCTION :
 * il n y a plus aucune saisie dans cette feuille.
 *
 * 🧭 POURQUOI PAS `ChoiceChipGroup` (qui existe deja) : ce composant porte un
 * ETAT selectionne et attend un geste de validation separe. Ici, choisir EST
 * valider — il n y a jamais de selection a afficher. L employer aurait
 * demande de neutraliser sa moitie utile ; la grille 3 x 2 du pack tient en
 * douze lignes.
 *
 * 🧨 L ENVOI PORTE `arrivedAt`, ET C EST OBLIGATOIRE : sans lui le serveur
 * pose SON instant courant, meme quand `lateMinutes` vaut 10. L ecran
 * afficherait « Arrivé +10 min à 18:42 » pour un match de 18:00.
 * @param {object} props - Les proprietes de la feuille.
 * @param {number | null} props.eventStartMs - Le debut, pour calculer l heure.
 * @param {boolean} props.isCorrection - Corriger (patchLate) plutot que pointer.
 * @param {boolean} props.isVisible - La feuille est-elle ouverte.
 * @param {any} props.item - La ligne visee.
 * @param {boolean} [props.identitiesHidden] - Le serveur masque les identites.
 * @param {number} [props.position] - Rang, pour nommer une personne masquee.
 * @param {() => void} props.onClose - Fermer.
 * @param {(payload: any) => void} props.onSubmit - Envoyer.
 * @param {(key: string, fallback: string) => string} props.t - Le traducteur.
 * @returns {import('react').ReactElement} - La feuille.
 */
export function AttendanceLateSheet({
  eventStartMs,
  identitiesHidden = false,
  isCorrection = false,
  isVisible,
  item,
  onClose,
  onSubmit,
  position = 1,
  t,
}) {
  const { Colors, Fonts } = useTheme();

  // 🔒 Le nom suit la meme regle que la ligne : masque, il ne sort ni a
  // l ecran ni dans l etiquette d accessibilite.
  const nom = identitiesHidden
    ? `${t('eventDetails.attendanceCall.row.anonymous', 'Participant·e')} ${position}`
    : `${item?.user?.firstname || ''} ${item?.user?.lastname || ''}`.trim();

  const motMin = t('eventDetails.attendanceCall.late.minutes', 'min');

  return (
    <BottomModal close={onClose} isVisible={isVisible} snapPoints={['44%']}>
      <View style={styles.body}>
        <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>{nom}</Text>
        <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
          {t('eventDetails.attendanceCall.late.question', 'Arrivé avec combien de retard ?')}
        </Text>

        {/* 📐 La grille 3 x 2 du pack. `flexBasis: '31%'` + `flexWrap` rend
            trois colonnes sans table ni calcul de largeur d ecran. */}
        <View style={styles.grid}>
          {LATE_STEPS.map((minutes) => (
            <TouchableOpacity
              accessibilityLabel={`+${minutes} ${motMin}`}
              accessibilityRole="button"
              key={minutes}
              onPress={() => onSubmit({
                arrivedAt: buildArrivedAtIso({ eventStartMs, lateMinutes: minutes }),
                isCorrection,
                lateMinutes: minutes,
                userId: item?.user?.documentId,
              })}
              style={[styles.chip, {
                backgroundColor: Colors.primary800,
                borderColor: withAlpha(Colors.neutral00, 0.14),
              }]}
            >
              <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>
                {`+${minutes} ${motMin}`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          accessibilityLabel={t('eventDetails.attendanceCall.late.cancel', 'Annuler')}
          accessibilityRole="button"
          onPress={onClose}
          style={styles.cancel}
        >
          <Text style={[Fonts.p2Bold, { color: Colors.neutral300 }]}>
            {t('eventDetails.attendanceCall.late.cancel', 'Annuler')}
          </Text>
        </TouchableOpacity>
      </View>
    </BottomModal>
  );
}
