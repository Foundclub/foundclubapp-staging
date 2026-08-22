import {
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';

import { formatTimeInZone, isMarked, isNoShow } from './attendanceCallModel';

// 🪤 `SvgIcon` declare ses proprietes en `@param` separes au lieu d un objet
// `props` : TypeScript le lit donc comme une fonction a arguments positionnels,
// et TOUT appel en JSX leve une erreur. Le defaut est dans le composant (il
// porte deja 5 erreurs a lui seul, mesurees le 2026-08-23) ; le corriger est un
// autre lot — celui-ci se contente de ne pas en ajouter une sixieme.
const Icone = /** @type {any} */ (SvgIcon);

const styles = StyleSheet.create({
  identity: { flex: 1 },
  row: {
    alignItems: 'center',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  // 🖐️ 44 x 44 — la cible tactile du projet. Les actions actuelles
  // « Pointer l arrivée » et « Corriger » etaient rendues a 39 px.
  target: {
    alignItems: 'center',
    borderRadius: 100,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 12,
  },
  targetIcon: {
    alignItems: 'center',
    borderRadius: 100,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 44,
  },
});

/**
 * L5-A — UNE LIGNE DE LA FEUILLE DE PRESENCE.
 *
 * ⛔ LA LIGNE ELLE-MEME N EST PAS CLIQUABLE. Ce n est pas un oubli : au bord
 * d un terrain, un appui parasite ne doit pas ouvrir une fiche de profil au
 * milieu d un appel. Deux cibles nommees, et rien d autre.
 *
 * 🔒 Quand `identitiesHidden` est vrai, aucun nom ne sort — ni a l ecran, ni
 * dans l etiquette d accessibilite (un lecteur d ecran lit a voix haute).
 * @param {object} props - Les proprietes de la ligne.
 * @param {boolean} [props.identitiesHidden] - Le serveur masque les identites.
 * @param {any} props.item - La ligne rendue par `list`.
 * @param {(item: any) => void} [props.onCorrect] - Ouvre « Corriger » (2F).
 * @param {(item: any) => void} [props.onLate] - Ouvre « Retard constate » (2E).
 * @param {(item: any) => void} [props.onMark] - Pointe la personne.
 * @param {boolean} [props.stayInPlace] - Onglet « Sans réponse » : une ligne
 *   pointee NE SAUTE PAS ailleurs, elle se remplit sur place.
 * @param {number} props.position - Rang, pour nommer une personne masquee.
 * @param {(key: string, fallback: string) => string} props.t - Le traducteur.
 * @param {string} [props.timezone] - Le fuseau du club.
 * @returns {import('react').ReactElement} - La ligne.
 */
function AttendanceRow({
  identitiesHidden = false,
  item,
  onCorrect,
  onLate,
  onMark,
  position,
  stayInPlace = false,
  t,
  timezone,
}) {
  const { Colors, Fonts } = useTheme();

  const nom = identitiesHidden
    ? `${t('eventDetails.attendanceCall.row.anonymous', 'Participant·e')} ${position}`
    : `${item?.user?.firstname || ''} ${item?.user?.lastname || ''}`.trim();

  const etiquetteRetard = t('eventDetails.attendanceCall.row.lateFor', 'Retard pour');
  const pointe = isMarked(item);
  const minutesRetard = Number(item?.attendance?.lateMinutes || 0);
  const heureArrivee = formatTimeInZone(item?.attendance?.arrivedAt, timezone);
  const minutesAnnoncees = Number(item?.attendance?.declaredLateMinutes || 0);

  // 🖐️ POURQUOI UNE LIGNE POINTEE PEUT RESTER LA. Dans l onglet « Sans
  // réponse », faire disparaitre la ligne au moment ou le doigt la touche
  // decale toute la liste sous le pouce : l appui suivant tombe sur quelqu un
  // d autre. Elle se remplit sur place, et le coach continue de haut en bas.
  const resteEnPlace = stayInPlace && pointe;
  const pointeParLeStaff = String(item?.attendance?.source || '').startsWith('coach');

  let sousLigne;
  if (resteEnPlace && pointeParLeStaff) {
    // ⚠️ « par toi » suppose que le coach qui regarde est celui qui a pointe —
    // vrai sauf si deux encadrants font l appel a deux. `attendance.updatedBy`
    // est deja dans la reponse : une comparaison suffira le jour ou l ecran
    // connaitra l utilisateur courant.
    const motPointe = t('eventDetails.attendanceCall.row.markedByYou', 'Pointé par toi à');
    sousLigne = `${motPointe} ${heureArrivee}`;
  } else if (pointe && minutesRetard > 0) {
    const mot = t('eventDetails.attendanceCall.row.arrivedLate', 'Arrivé');
    sousLigne = `${mot} +${minutesRetard} min · ${heureArrivee}`;
  } else if (pointe) {
    sousLigne = `${t('eventDetails.attendanceCall.row.arrived', 'Arrivé')} · ${heureArrivee}`;
  } else if (isNoShow(item)) {
    // 🕐 Le cron de fin de match l a passe « Non pointé » a fin + 0, alors que
    // la fenetre reste ouverte 2 h. Il est donc etiquete — et POINTABLE.
    sousLigne = t('eventDetails.attendanceCall.row.noShow', 'Non pointé');
  } else if (minutesAnnoncees > 0) {
    const mot = t('eventDetails.attendanceCall.row.declaredLate', 'Retard annoncé');
    sousLigne = `${mot} +${minutesAnnoncees} min`;
  } else if (item?.rsvpStatus === 'participating') {
    sousLigne = t('eventDetails.attendanceCall.row.saidYes', 'a dit présent');
  } else if (item?.rsvpStatus === 'missing') {
    sousLigne = t('eventDetails.attendanceCall.row.saidNo', 'a dit absent');
  } else {
    sousLigne = t('eventDetails.attendanceCall.row.noAnswer', 'Sans réponse');
  }

  return (
    <View
      style={[styles.row, { backgroundColor: withAlpha(Colors.primary900, 0.6) }]}
      testID={`attendance-row-${item?.user?.documentId || position}`}
    >
      <ProfileAvatar
        imageUrl={identitiesHidden ? undefined : item?.user?.avatar?.url}
        name={nom}
        size={40}
      />
      <View style={styles.identity}>
        <Text numberOfLines={1} style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>{nom}</Text>
        <Text numberOfLines={1} style={[Fonts.p4, { color: Colors.neutral300 }]}>{sousLigne}</Text>
      </View>

      {pointe && !resteEnPlace ? (
        <TouchableOpacity
          accessibilityLabel={`${t('eventDetails.attendanceCall.row.correct', 'Corriger')} ${nom}`}
          accessibilityRole="button"
          accessibilityState={{ disabled: false }}
          onPress={() => onCorrect?.(item)}
          style={[styles.target, { borderColor: Colors.neutral500 }]}
        >
          <Text style={[Fonts.p4Bold, { color: Colors.neutral200 }]}>
            {t('eventDetails.attendanceCall.row.correct', 'Corriger')}
          </Text>
        </TouchableOpacity>
      ) : (
        <>
          <TouchableOpacity
            accessibilityLabel={`${t('eventDetails.attendanceCall.row.markHere', 'Là')} ${nom}`}
            accessibilityRole="button"
            accessibilityState={{ disabled: false, selected: resteEnPlace }}
            onPress={() => (resteEnPlace ? onCorrect?.(item) : onMark?.(item))}
            style={[styles.target, {
              backgroundColor: resteEnPlace ? Colors.success500 : undefined,
              borderColor: Colors.success500,
            }]}
          >
            <Text style={[Fonts.p3Bold, {
              color: resteEnPlace ? Colors.primary900 : Colors.success500,
            }]}
            >
              {t('eventDetails.attendanceCall.row.markHere', 'Là')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityLabel={`${etiquetteRetard} ${nom}`}
            accessibilityRole="button"
            accessibilityState={{ disabled: false }}
            onPress={() => onLate?.(item)}
            style={styles.targetIcon}
          >
            <Icone color={Colors.warning500} height={20} name="clock-two-thirty" width={20} />
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

export default AttendanceRow;
