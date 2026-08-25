import {
  Image, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';

import { isNoShow, resolveRowState } from './attendanceCallModel';

const AVATAR_SIZE = 44;
// 🎯 La pastille d etat du pack : 10 px, ancree en bas a droite de l avatar,
// cerclee de la couleur DE LA CARTE pour se detacher de la photo.
const DOT_SIZE = 10;
const DOT_BORDER = 2;
const TARGET_SIZE = 44;
const ICON_SIZE = 18;

const styles = StyleSheet.create({
  // 🖐️ 44 x 44, radius 12 — la cible tactile du projet, et la forme du pack.
  action: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    height: TARGET_SIZE,
    justifyContent: 'center',
    width: TARGET_SIZE,
  },
  avatarWrap: { flex: 0, position: 'relative' },
  dot: {
    borderRadius: 100,
    borderWidth: DOT_BORDER,
    bottom: -1,
    height: DOT_SIZE + (DOT_BORDER * 2),
    position: 'absolute',
    right: -1,
    width: DOT_SIZE + (DOT_BORDER * 2),
  },
  icon: { height: ICON_SIZE, width: ICON_SIZE },
  identity: { flex: 1, minWidth: 0 },
  row: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 60,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 8,
  },
});

/**
 * APPEL (26/08) — UNE LIGNE DE L APPEL MINIMALISTE.
 *
 * 🎯 CE QUE LE PACK A CHANGE, ET POURQUOI CE N EST PAS DE LA PEINTURE :
 * l ancienne ligne avait DEUX visages — « Là » + horloge tant qu on n avait
 * rien pointe, puis un unique bouton « Corriger » une fois pointe. Corriger
 * une erreur coutait donc TROIS appuis (Corriger -> feuille -> action), et le
 * geste le plus frequent au bord d un terrain est justement la correction.
 * Les boutons restent maintenant en place APRES le pointage : un appui suffit.
 *
 * 🔁 RE-TAPER LE BOUTON ALLUME DEPOINTE (decision D2 du 26/08). C est le geste
 * le plus sur qui existe : il ne detruit rien, il n ecrit aucun jugement, et
 * il rend exactement l etat de depart. Le serveur l accepte par la route
 * `reset`, qui est VOLONTAIREMENT hors fenetre horaire — une correction ne
 * s enferme pas.
 *
 * ⛔ LA LIGNE ELLE-MEME N EST TOUJOURS PAS CLIQUABLE. Ce n est pas un oubli :
 * au bord d un terrain, un appui parasite ne doit pas ouvrir une fiche de
 * profil au milieu d un appel. Des cibles nommees, et rien d autre.
 *
 * 🔒 Quand `identitiesHidden` est vrai, aucun nom ne sort — ni a l ecran, ni
 * dans l etiquette d accessibilite (un lecteur d ecran lit a voix haute).
 * @param {object} props - Les proprietes de la ligne.
 * @param {boolean} [props.identitiesHidden] - Le serveur masque les identites.
 * @param {any} props.item - La ligne rendue par `list`.
 * @param {(item: any) => void} [props.onAbsent] - Poser une absence (D7bis).
 * @param {(item: any) => void} [props.onLate] - Ouvrir la feuille de retard.
 * @param {(item: any) => void} [props.onOnTime] - Pointer « a l heure ».
 * @param {(item: any) => void} [props.onUnmark] - Depointer (re-tap, D2).
 * @param {number} props.position - Rang, pour nommer une personne masquee.
 * @param {(key: string, fallback: string) => string} props.t - Le traducteur.
 * @returns {import('react').ReactElement} - La ligne.
 */
function AttendanceRow({
  identitiesHidden = false,
  item,
  onAbsent,
  onLate,
  onOnTime,
  onUnmark,
  position,
  t,
}) {
  const { Colors, Fonts, Images } = useTheme();

  const nom = identitiesHidden
    ? `${t('eventDetails.attendanceCall.row.anonymous', 'Participant·e')} ${position}`
    : `${item?.user?.firstname || ''} ${item?.user?.lastname || ''}`.trim();

  const etat = resolveRowState(item);
  const minutesRetard = Number(item?.attendance?.lateMinutes || 0);
  const minutesAnnoncees = Number(item?.attendance?.declaredLateMinutes || 0);

  // 🎨 LES QUATRE COULEURS DU PACK, EN JETONS. Aucun hex : #27d6a3 EST
  // `success500`, #ffa115 EST `warning500`, #ff8fa3 EST `error300`, et le gris
  // « a pointer » EST `neutral700`.
  const teintes = {
    absent: Colors.error300,
    late: Colors.warning500,
    ontime: Colors.success500,
  };
  const couleurEtat = (etat && teintes[etat]) || Colors.neutral700;

  // ⚠️ La sous-ligne NE PREND PAS le gris de la pastille. Le pack met
  // « À pointer » en #5f6366 ; nous y ecrivons ce que le joueur avait repondu
  // (D8), et cette phrase-la doit rester LISIBLE au soleil, au bord d un
  // terrain. `neutral300` est celui que l ecran d aujourd hui emploie deja.
  const couleurSousLigne = etat === null ? Colors.neutral300 : couleurEtat;

  // 🗣️ LA SOUS-LIGNE GARDE CE QUE LE JOUEUR AVAIT DIT (decision D8).
  //
  // Le pack n y met que « À pointer » avant le pointage, et laisse la porte
  // ouverte : « le statut de reponse peut revenir en sous-ligne AVANT pointage
  // si le serveur le fournit ». Il le fournit. Et cette phrase-la est le seul
  // endroit de l ecran ou le coach lit la difference entre « il a prevenu
  // qu il serait absent » et « il n a jamais repondu » — la retirer serait
  // perdre de l information pour ressembler a une maquette.
  let sousLigne;
  if (etat === 'late') {
    const mot = t('eventDetails.attendanceCall.row.lateState', 'En retard');
    sousLigne = `${mot} · +${minutesRetard} min`;
  } else if (etat === 'ontime') {
    sousLigne = t('eventDetails.attendanceCall.row.onTimeState', "À l'heure");
  } else if (etat === 'absent') {
    sousLigne = t('eventDetails.attendanceCall.row.absentState', 'Absent');
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

  /**
   * UN DES TROIS BOUTONS D ETAT.
   *
   * 🔁 `onPress` porte la regle D2 en un seul endroit : si l etat vise est
   * DEJA celui de la ligne, on depointe ; sinon on pose. L ecrire dans chaque
   * bouton ferait trois copies d une meme decision.
   * @param {object} bouton - La description du bouton.
   * @param {string} bouton.cible - L etat que ce bouton pose.
   * @param {any} bouton.icone - L image du theme.
   * @param {string} bouton.libelle - L etiquette lue a voix haute.
   * @param {string} bouton.teinte - La couleur semantique de l etat.
   * @param {(item: any) => void} [bouton.poser] - Le geste qui pose l etat.
   * @returns {import('react').ReactElement} - Le bouton.
   */
  const renderAction = ({
    cible, icone, libelle, poser, teinte,
  }) => {
    const actif = etat === cible;
    return (
      <TouchableOpacity
        accessibilityLabel={`${libelle} ${nom}`}
        accessibilityRole="button"
        accessibilityState={{ disabled: false, selected: actif }}
        key={cible}
        onPress={() => (actif ? onUnmark?.(item) : poser?.(item))}
        style={[styles.action, {
          backgroundColor: actif ? withAlpha(teinte, 0.16) : Colors.primary800,
          borderColor: actif ? teinte : withAlpha(Colors.neutral00, 0.12),
        }]}
      >
        <Image
          resizeMode="contain"
          source={icone}
          style={[styles.icon, { tintColor: actif ? teinte : Colors.neutral300 }]}
        />
      </TouchableOpacity>
    );
  };

  return (
    <View
      style={[styles.row, {
        backgroundColor: Colors.primary700,
        borderColor: withAlpha(Colors.neutral00, 0.07),
      }]}
      testID={`attendance-row-${item?.user?.documentId || position}`}
    >
      <View style={styles.avatarWrap}>
        <ProfileAvatar
          imageUrl={identitiesHidden ? undefined : item?.user?.avatar?.url}
          name={nom}
          size={AVATAR_SIZE}
        />
        {/* 🎯 La pastille redit l etat SANS COULEUR SEULE : la sous-ligne
            juste a cote porte le meme mot en toutes lettres. */}
        <View
          style={[styles.dot, {
            backgroundColor: couleurEtat,
            borderColor: Colors.primary700,
          }]}
          testID={`attendance-dot-${etat || 'none'}`}
        />
      </View>

      <View style={styles.identity}>
        <Text numberOfLines={1} style={[Fonts.h5Bold, { color: Colors.neutral00 }]}>{nom}</Text>
        <Text numberOfLines={1} style={[Fonts.p3Bold, { color: couleurSousLigne }]}>
          {sousLigne}
        </Text>
      </View>

      {renderAction({
        cible: 'ontime',
        icone: Images.check,
        libelle: t('eventDetails.attendanceCall.row.onTimeState', "À l'heure"),
        poser: onOnTime,
        teinte: Colors.success500,
      })}
      {renderAction({
        cible: 'late',
        icone: Images.clock,
        libelle: t('eventDetails.attendanceCall.row.lateFor', 'Retard pour'),
        poser: onLate,
        teinte: Colors.warning500,
      })}
      {/* ⛔ LA TROISIEME CIBLE N EXISTE QUE SI L ECRAN SAIT QUOI EN FAIRE.
          Poser une absence exige une route serveur (D7bis) ; tant que
          l ecran ne passe pas `onAbsent`, ce bouton ne s affiche PAS.
          Un bouton visible sans route derriere est un menteur — et c est
          aussi ce qui permet d annuler D7bis d un seul commit. */}
      {Boolean(onAbsent) && renderAction({
        cible: 'absent',
        icone: Images.close,
        libelle: t('eventDetails.attendanceCall.row.absentState', 'Absent'),
        poser: onAbsent,
        teinte: Colors.error300,
      })}
    </View>
  );
}

export default AttendanceRow;
