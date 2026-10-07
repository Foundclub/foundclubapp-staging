import { useTranslation } from 'react-i18next';
import {
  Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CLES_DES_AUTORISATIONS } from '@/domains/messaging/autorisationsDuGroupe';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';
import { GRAS_FAMILLE, REGULIER_FAMILLE } from '@/components/molecules/bulleDuFil/typographieDuFil';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';

/**
 * @typedef {object} AdminAffiche
 * @property {string} id
 * @property {string} nom - « Vous » pour le lecteur.
 * @property {string} role - « Entraîneur », « Membre »...
 * @property {string} [avatar]
 */

/**
 * MSG1BA (§3.15, §3.16) — « AUTORISATIONS DU GROUPE » (pack, `Permissions`) : « Les membres
 * peuvent » modifier le nom, modifier la photo, envoyer des messages, ajouter des membres
 * (interrupteurs), puis « Admins · N » et « Modifier les admins ».
 *
 * La page ne decide rien : chaque interrupteur appelle `onChanger(cle, valeur)` — a la
 * creation, l'ecran garde le reglage ; dans « Infos du groupe », il l'envoie au serveur
 * (`PATCH …/group-meta { permissions }`, contrat 1B §5.3).
 * `enFenetre` : meme regle que `FeuillePhotoDuGroupe` (une fenetre a soi dans un ecran
 * ordinaire, par-dessus la page dans « Infos du groupe »).
 * @param {object} props
 * @param {AdminAffiche[]} props.admins
 * @param {boolean} [props.enFenetre]
 * @param {boolean} [props.occupe] - Une ecriture est en cours.
 * @param {(cle: string, valeur: boolean) => void} props.onChanger
 * @param {() => void} props.onClose
 * @param {() => void} [props.onModifierLesAdmins] - Absent : pas de ligne « Modifier les admins ».
 * @param {Record<string, boolean>} props.valeurs
 * @param {boolean} props.visible
 * @returns {import('react').ReactElement | null}
 */
function AutorisationsDuGroupe({
  admins,
  enFenetre = false,
  occupe = false,
  onChanger,
  onClose,
  onModifierLesAdmins = undefined,
  valeurs,
  visible,
}) {
  const { Colors } = useTheme();
  const { t } = useTranslation();
  const { bottom, top } = useSafeAreaInsets();
  if (!visible) return null;

  const filet = withAlpha(Colors.neutral00, 0.07);
  const sourdine = withAlpha(Colors.neutral00, 0.58);
  /** @type {Record<string, { icone: any, libelle: string, aide?: string }>} */
  const lignes = {
    membersCanAddMembers: {
      icone: 'userPlus',
      libelle: t('conversation.groupPermissions.addMembers', 'Ajouter des membres'),
    },
    membersCanEditName: {
      icone: 'pencil',
      libelle: t('conversation.groupPermissions.editName', 'Modifier le nom du groupe'),
    },
    membersCanEditPhoto: {
      icone: 'camera',
      libelle: t('conversation.groupPermissions.editPhoto', 'Modifier la photo du groupe'),
    },
    membersCanSendMessages: {
      aide: t(
        'conversation.groupPermissions.sendMessagesHint',
        'Désactivé : seuls les admins écrivent, les autres lisent.',
      ),
      icone: 'send',
      libelle: t('conversation.groupPermissions.sendMessages', 'Envoyer des messages'),
    },
  };

  const page = (
    <View
      style={[styles.page, { backgroundColor: Colors.chatBackground }]}
      testID="autorisations-du-groupe"
    >
      <View style={[styles.enTete, { backgroundColor: Colors.chatBar, paddingTop: top }]}>
        <TouchableOpacity
          accessibilityLabel={t('common.back', 'Retour')}
          accessibilityRole="button"
          onPress={onClose}
          style={[styles.retour, { borderColor: Colors.primary500 }]}
          testID="autorisations-du-groupe-retour"
        >
          <GlyphIcon color={Colors.neutral00} name="chevronLeft" size={20} />
        </TouchableOpacity>
        <Text accessibilityRole="header" style={[styles.titreEnTete, { color: Colors.neutral00 }]}>
          {t('conversation.groupPermissions.title', 'Autorisations du groupe')}
        </Text>
      </View>
      <ScrollView contentContainerStyle={[styles.contenu, { paddingBottom: 40 + bottom }]}>
        <Text style={[styles.titre, { color: Colors.neutral00 }]}>
          {t('conversation.groupPermissions.membersCan', 'Les membres peuvent')}
        </Text>
        <View style={[styles.carte, { backgroundColor: Colors.primary700 }]}>
          {CLES_DES_AUTORISATIONS.map((cle, rang) => {
            const ligne = lignes[cle];
            return (
              <View
                key={cle}
                style={[styles.ligne, rang ? { borderTopColor: filet, borderTopWidth: 1 } : null]}
              >
                <GlyphIcon color={Colors.neutral00} name={ligne.icone} size={22} />
                <View style={styles.textes}>
                  <Text style={[styles.libelle, { color: Colors.neutral00 }]}>{ligne.libelle}</Text>
                  {ligne.aide ? (
                    <Text style={[styles.aide, { color: sourdine }]}>{ligne.aide}</Text>
                  ) : null}
                </View>
                <Switch
                  accessibilityLabel={ligne.libelle}
                  disabled={occupe}
                  onValueChange={(valeur) => onChanger(cle, valeur)}
                  testID={`autorisation-${cle}`}
                  thumbColor={Colors.neutral00}
                  trackColor={{ false: withAlpha(Colors.neutral00, 0.18), true: Colors.primary500 }}
                  value={Boolean(valeurs?.[cle])}
                />
              </View>
            );
          })}
        </View>
        <Text style={[styles.note, { color: withAlpha(Colors.neutral00, 0.6) }]}>
          {t(
            'conversation.groupPermissions.adminsKeepAll',
            'Ce que tu désactives reste possible pour les admins.',
          )}
        </Text>

        <Text style={[styles.titre, styles.titreAdmins, { color: Colors.neutral00 }]}>
          {t('conversation.groupPermissions.adminsTitle', {
            count: admins.length,
            defaultValue: 'Admins · {{count}}',
          })}
        </Text>
        <View style={[styles.carte, { backgroundColor: Colors.primary700 }]}>
          {admins.map((admin, rang) => (
            <View
              key={admin.id}
              style={[
                styles.ligneAdmin,
                rang ? { borderTopColor: filet, borderTopWidth: 1 } : null,
              ]}
              testID={`autorisations-admin-${admin.id}`}
            >
              <ProfileAvatar
                enablePreview={false}
                imageUrl={admin.avatar || undefined}
                name={admin.nom}
                size={38}
              />
              <Text numberOfLines={1} style={[styles.nomAdmin, { color: Colors.neutral00 }]}>
                {admin.nom}
              </Text>
              <Text style={[styles.aide, { color: sourdine }]}>{admin.role}</Text>
            </View>
          ))}
          {onModifierLesAdmins ? (
            <Pressable
              accessibilityRole="button"
              disabled={occupe}
              onPress={onModifierLesAdmins}
              style={[styles.ligneModifier, { borderTopColor: filet }]}
              testID="autorisations-modifier-les-admins"
            >
              <GlyphIcon color={Colors.primary500} name="shieldCheck" size={20} />
              <Text style={[styles.libelle, { color: Colors.primary500 }]}>
                {t('conversation.groupPermissions.editAdmins', 'Modifier les admins')}
              </Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={[styles.note, { color: withAlpha(Colors.neutral00, 0.6) }]}>
          {t(
            'conversation.groupPermissions.adminsCan',
            'Les admins peuvent renommer le groupe, changer sa photo, ajouter et retirer des '
              + 'membres, et modifier ces autorisations.',
          )}
        </Text>
      </ScrollView>
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
  aide: {
    fontFamily: REGULIER_FAMILLE,
    fontSize: 12.5,
    lineHeight: 17,
  },
  carte: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  contenu: {
    paddingHorizontal: 16,
    paddingTop: 22,
  },
  enTete: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 10,
    paddingHorizontal: 12,
  },
  libelle: {
    fontFamily: GRAS_FAMILLE,
    fontSize: 15.5,
    lineHeight: 20,
  },
  ligne: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    minHeight: 60,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  ligneAdmin: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    height: 58,
    paddingHorizontal: 16,
  },
  ligneModifier: {
    alignItems: 'center',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 12,
    height: 56,
    paddingHorizontal: 16,
  },
  nomAdmin: {
    flex: 1,
    fontFamily: GRAS_FAMILLE,
    fontSize: 15,
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
  textes: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  titre: {
    fontFamily: GRAS_FAMILLE,
    fontSize: 20,
    lineHeight: 26,
    marginBottom: 12,
    marginHorizontal: 4,
  },
  titreAdmins: {
    marginTop: 30,
  },
  titreEnTete: {
    fontFamily: GRAS_FAMILLE,
    fontSize: 16,
    lineHeight: 20,
  },
});

export default AutorisationsDuGroupe;
