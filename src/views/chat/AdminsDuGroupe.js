import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';
import { GRAS_FAMILLE, REGULIER_FAMILLE } from '@/components/molecules/bulleDuFil/typographieDuFil';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';

/**
 * @typedef {object} MembreAffiche
 * @property {string} id
 * @property {string} nom - « Vous » pour le lecteur.
 * @property {string} role - « Entraîneur », « Membre »...
 * @property {string} [avatar]
 */

/**
 * Deux listes d'identifiants ont-elles le meme contenu ?
 * @param {string[]} a
 * @param {string[]} b
 * @returns {boolean}
 */
const memesIds = (a, b) => a.length === b.length && a.every((id) => b.includes(id));

/**
 * MSG1BA (§3.15, §3.16) — « MODIFIER LES ADMINS » (pack, `AdminsPage`) : une case par
 * membre, « Vous » toujours coche (un admin ne se retire pas lui-meme, contrat 1B §5.5), et
 * « Valider » — RIEN n'est applique avant. `onValider` recoit la liste complete des admins
 * choisis ; c'est l'ecran qui en tire `addAdminIds` / `removeAdminIds` (une seule requete).
 * @param {object} props
 * @param {string[]} props.adminsInitiaux
 * @param {boolean} [props.enFenetre] - Meme regle que `FeuillePhotoDuGroupe`.
 * @param {string} props.meId
 * @param {MembreAffiche[]} props.membres - Le lecteur compris.
 * @param {string} props.note - La ligne sous la liste (creation ou groupe existant).
 * @param {boolean} [props.occupe]
 * @param {() => void} props.onClose
 * @param {(admins: string[]) => void} props.onValider
 * @param {boolean} props.visible
 * @returns {import('react').ReactElement | null}
 */
function AdminsDuGroupe({
  adminsInitiaux,
  enFenetre = false,
  meId,
  membres,
  note,
  occupe = false,
  onClose,
  onValider,
  visible,
}) {
  const { Colors } = useTheme();
  const { t } = useTranslation();
  const { bottom, top } = useSafeAreaInsets();
  const [choisis, setChoisis] = useState(adminsInitiaux);
  const cleInitiale = adminsInitiaux.join(',');

  useEffect(() => {
    if (visible) setChoisis(cleInitiale ? cleInitiale.split(',') : []);
  }, [cleInitiale, visible]);

  if (!visible) return null;

  const change = !memesIds(choisis, adminsInitiaux);
  const filet = withAlpha(Colors.neutral00, 0.07);
  const ordonnes = [
    ...membres.filter((membre) => membre.id === meId),
    ...membres.filter((membre) => membre.id !== meId),
  ];

  const page = (
    <View
      style={[styles.page, { backgroundColor: Colors.chatBackground }]}
      testID="admins-du-groupe"
    >
      <View style={[styles.enTete, { backgroundColor: Colors.chatBar, paddingTop: top }]}>
        <TouchableOpacity
          accessibilityLabel={t('common.back', 'Retour')}
          accessibilityRole="button"
          onPress={onClose}
          style={[styles.retour, { borderColor: Colors.primary500 }]}
          testID="admins-du-groupe-retour"
        >
          <GlyphIcon color={Colors.neutral00} name="chevronLeft" size={20} />
        </TouchableOpacity>
        <View style={styles.textes}>
          <Text
            accessibilityRole="header"
            style={[styles.titreEnTete, { color: Colors.neutral00 }]}
          >
            {t('conversation.groupPermissions.editAdmins', 'Modifier les admins')}
          </Text>
          <Text style={[styles.sousTitre, { color: withAlpha(Colors.neutral00, 0.6) }]}>
            {t('conversation.groupAdmins.count', {
              count: choisis.length,
              defaultValue: '{{count}} admins',
            })}
          </Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.contenu}>
        <View style={[styles.carte, { backgroundColor: Colors.primary700 }]}>
          {ordonnes.map((membre, rang) => {
            const cEstMoi = membre.id === meId;
            const coche = choisis.includes(membre.id);
            return (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: coche, disabled: cEstMoi }}
                disabled={cEstMoi}
                key={membre.id}
                onPress={() => setChoisis((avant) => (avant.includes(membre.id)
                  ? avant.filter((id) => id !== membre.id)
                  : [...avant, membre.id]))}
                style={[styles.ligne, rang ? { borderTopColor: filet, borderTopWidth: 1 } : null]}
                testID={`admins-du-groupe-${membre.id}`}
              >
                <ProfileAvatar
                  enablePreview={false}
                  imageUrl={membre.avatar || undefined}
                  name={membre.nom}
                  size={42}
                />
                <View style={styles.textes}>
                  <Text numberOfLines={1} style={[styles.nom, { color: Colors.neutral00 }]}>
                    {membre.nom}
                  </Text>
                  <Text style={[styles.role, { color: withAlpha(Colors.neutral00, 0.58) }]}>
                    {coche
                      ? `${t('conversation.group.admin', 'Admin')} · ${membre.role}`
                      : membre.role}
                  </Text>
                </View>
                <View
                  style={[
                    styles.case,
                    coche
                      ? { backgroundColor: Colors.primary500, opacity: cEstMoi ? 0.5 : 1 }
                      : { borderColor: withAlpha(Colors.neutral00, 0.4), borderWidth: 2 },
                  ]}
                >
                  {coche ? <GlyphIcon color={Colors.primary900} name="check" size={15} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.note, { color: withAlpha(Colors.neutral00, 0.6) }]}>{note}</Text>
      </ScrollView>
      <View
        style={[
          styles.barre,
          {
            backgroundColor: Colors.chatBar,
            borderTopColor: withAlpha(Colors.neutral00, 0.06),
            paddingBottom: 34 + bottom,
          },
        ]}
      >
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ disabled: !change || occupe }}
          disabled={!change || occupe}
          onPress={() => onValider(choisis)}
          style={[
            styles.valider,
            { backgroundColor: Colors.primary500, opacity: change && !occupe ? 1 : 0.4 },
          ]}
          testID="admins-du-groupe-valider"
        >
          <Text style={[styles.validerTexte, { color: Colors.primary900 }]}>
            {t('conversation.groupAdmins.validate', 'Valider')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (!enFenetre) return <View style={StyleSheet.absoluteFill}>{page}</View>;
  return (
    <Modal animationType="slide" onRequestClose={onClose} statusBarTranslucent visible>
      {page}
    </Modal>
  );
}

const styles = StyleSheet.create({
  barre: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  carte: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  case: {
    alignItems: 'center',
    borderRadius: 12,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  contenu: {
    paddingBottom: 40,
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  enTete: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 10,
    paddingHorizontal: 12,
  },
  ligne: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    height: 62,
    paddingHorizontal: 16,
  },
  nom: {
    fontFamily: GRAS_FAMILLE,
    fontSize: 15.5,
    lineHeight: 20,
  },
  note: {
    fontFamily: REGULIER_FAMILLE,
    fontSize: 13,
    lineHeight: 19,
    marginHorizontal: 4,
    marginTop: 10,
  },
  page: {
    flex: 1,
  },
  retour: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1.5,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  role: {
    fontFamily: REGULIER_FAMILLE,
    fontSize: 13,
    lineHeight: 17,
  },
  sousTitre: {
    fontFamily: REGULIER_FAMILLE,
    fontSize: 12.5,
    lineHeight: 16,
  },
  textes: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  titreEnTete: {
    fontFamily: GRAS_FAMILLE,
    fontSize: 16,
    lineHeight: 20,
  },
  valider: {
    alignItems: 'center',
    borderRadius: 999,
    height: 52,
    justifyContent: 'center',
  },
  validerTexte: {
    fontFamily: GRAS_FAMILLE,
    fontSize: 16,
    lineHeight: 20,
  },
});

export default AdminsDuGroupe;
