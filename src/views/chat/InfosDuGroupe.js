import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  peutDansLeGroupe,
  resumeDesAutorisations,
} from '@/domains/messaging/autorisationsDuGroupe';
import { libelleDuRole } from '@/domains/messaging/roleDuMembre';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';
import {
  GRAS_FAMILLE,
  LIGNE_DE_MENU,
  REGULIER_FAMILLE,
} from '@/components/molecules/bulleDuFil/typographieDuFil';
import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import AdminsDuGroupe from '@/views/chat/AdminsDuGroupe';
import AutorisationsDuGroupe from '@/views/chat/AutorisationsDuGroupe';
import FeuillePhotoDuGroupe from '@/views/chat/FeuillePhotoDuGroupe';

/**
 * L'identifiant d'un membre.
 * @param {any} membre
 * @returns {string}
 */
const idDe = (membre) => String(membre?.documentId || membre?.id || '').trim();

/**
 * Le nom affiche d'un membre (meme repli que l'ancienne feuille « Gestion du groupe »).
 * @param {any} membre
 * @returns {string}
 */
const nomDe = (membre) => `${membre?.firstname || ''} ${membre?.lastname || ''}`.trim()
  || membre?.username
  || membre?.phoneNumber
  || idDe(membre);

/**
 * MSG1A (§3.16) — « INFOS DU GROUPE », la page du pack qui remplace la feuille « Gestion
 * du groupe ». Elle ne fait QUE ce que le serveur sait deja faire :
 * - renommer (« Enregistrer » / « Annuler », admin seulement — `updateGroupMeta`) ;
 * - « Ajouter des membres » en tete de liste (admin) ;
 * - pastille « Admin » ; la fiche d'un membre : « Envoyer un message » (discussion
 *   privee), « Nommer admin du groupe » / « Retirer le role d'admin » (`addAdminIds` /
 *   `removeAdminIds`, admin seulement), « Retirer du groupe » avec confirmation — plus
 *   de bouton « Retirer » sur chaque ligne ;
 * - « Signaler le groupe ».
 * - « Quitter le groupe » (decision d'Adel `quitter maintenant`), pour TOUT membre, avec
 *   confirmation — l'appel vit dans une fonction de service isolee (`leaveGroupChat`).
 * MSG1BA (§3.16) — ce que le serveur MESSAGERIE-1B ajoute (contrat §4, §5) :
 * - la PHOTO (92, pastille appareil photo de 34 quand elle est modifiable) : « Prendre une
 *   photo », « Choisir dans la galerie », « Supprimer la photo » ;
 * - « AUTORISATIONS DU GROUPE » (admins) : « Les membres peuvent… », « Modifier les admins »
 *   + « Valider » ;
 * - ce qu'un MEMBRE peut faire selon ces autorisations : renommer, ajouter, changer la photo.
 * `autorisations` nul = serveur d'avant 1B : ni photo modifiable, ni autorisations, et seuls
 * les admins renomment et ajoutent (comme avant).
 * @param {object} props
 * @param {string[]} props.adminIds
 * @param {Record<string, boolean> | null} [props.autorisations] - `groupPermissions` resolues.
 * @param {any} props.chat
 * @param {boolean} props.estAdmin - Le lecteur est admin du groupe.
 * @param {string} props.meId
 * @param {boolean} [props.occupe] - Une ecriture est en cours.
 * @param {() => void} props.onAjouter
 * @param {(membre: any, devientAdmin: boolean) => void} props.onBasculerAdmin
 * @param {(cle: string, valeur: boolean) => void} [props.onChangerAutorisation]
 * @param {(source: 'camera' | 'galerie') => void} [props.onChoisirPhoto]
 * @param {() => void} props.onClose
 * @param {(membre: any) => void} props.onEnvoyerUnMessage
 * @param {() => void} [props.onQuitter] - Appele APRES la confirmation ; absent = pas de ligne.
 * @param {(nom: string) => Promise<any>} props.onRenommer
 * @param {(membre: any) => void} props.onRetirer - Appele APRES la confirmation.
 * @param {() => void} props.onSignaler
 * @param {() => void} [props.onSupprimerPhoto]
 * @param {(admins: string[]) => void} [props.onValiderAdmins] - La liste complete choisie.
 * @param {(personne: any) => string} [props.resolveAvatar]
 * @param {Record<string, string>} [props.roles] - MSG1BA (§3.1) : documentId -> nom du role
 *   (`role.name`) ; absent = « Membre ».
 * @param {boolean} props.visible
 * @returns {import('react').ReactElement}
 */
function InfosDuGroupe({
  adminIds,
  autorisations = null,
  chat,
  estAdmin,
  meId,
  occupe = false,
  onAjouter,
  onBasculerAdmin,
  onChangerAutorisation = () => {},
  onChoisirPhoto = () => {},
  onClose,
  onEnvoyerUnMessage,
  onQuitter = undefined,
  onRenommer,
  onRetirer,
  onSignaler,
  onSupprimerPhoto = () => {},
  onValiderAdmins = () => {},
  resolveAvatar = () => '',
  roles = {},
  visible,
}) {
  const { Colors } = useTheme();
  const { t } = useTranslation();
  const { bottom, top } = useSafeAreaInsets();
  const nomDuGroupe = String(chat?.groupName || '').trim();
  const [enEdition, setEnEdition] = useState(false);
  const [brouillon, setBrouillon] = useState(nomDuGroupe);
  const [membreOuvert, setMembreOuvert] = useState(/** @type {any} */ (null));
  const [aRetirer, setARetirer] = useState(/** @type {any} */ (null));
  const [departAConfirmer, setDepartAConfirmer] = useState(false);
  // MSG1BA (§3.16) — la feuille photo, puis les pages « Autorisations » et « Modifier les admins »,
  // posees PAR-DESSUS la page (dans sa fenetre).
  const [feuillePhoto, setFeuillePhoto] = useState(false);
  const [pageAutorisations, setPageAutorisations] = useState(false);
  const [pageAdmins, setPageAdmins] = useState(false);

  useEffect(() => {
    if (!visible) {
      setEnEdition(false);
      setMembreOuvert(null);
      setARetirer(null);
      setDepartAConfirmer(false);
      setFeuillePhoto(false);
      setPageAutorisations(false);
      setPageAdmins(false);
    }
    setBrouillon(nomDuGroupe);
  }, [nomDuGroupe, visible]);

  const participants = Array.isArray(chat?.participants) ? chat.participants : [];
  const moi = participants.find((/** @type {any} */ membre) => idDe(membre) === meId);
  const autres = participants.filter(
    (/** @type {any} */ membre) => idDe(membre) && idDe(membre) !== meId,
  );
  const ordonnes = moi ? [moi, ...autres] : autres;
  const filet = withAlpha(Colors.neutral00, 0.07);
  const sourdine = withAlpha(Colors.neutral00, 0.58);

  const enregistrer = async () => {
    const nom = brouillon.trim();
    if (!nom || nom === nomDuGroupe) {
      setBrouillon(nomDuGroupe);
      setEnEdition(false);
      return;
    }
    await onRenommer(nom);
    setEnEdition(false);
  };

  const membreEstAdmin = (/** @type {any} */ membre) => adminIds.includes(idDe(membre));
  // 🛡️ MSG1BA (§3.16) — admin : tout ; membre : ce que les autorisations ouvrent. La photo
  // demande le serveur 1B (`autorisations` presentes) : sans lui, la route n'existe pas.
  const lecteur = { autorisations, estAdmin };
  const peutRenommer = peutDansLeGroupe(lecteur, 'membersCanEditName');
  const peutAjouter = peutDansLeGroupe(lecteur, 'membersCanAddMembers');
  const peutChangerLaPhoto = Boolean(autorisations)
    && peutDansLeGroupe(lecteur, 'membersCanEditPhoto');
  const photoDuGroupe = String(chat?.groupPhoto?.url || '').trim();
  const membresAffiches = ordonnes.map((/** @type {any} */ membre) => ({
    avatar: resolveAvatar(membre) || undefined,
    id: idDe(membre),
    nom: idDe(membre) === meId ? t('conversation.header.you', 'Vous') : nomDe(membre),
    role: libelleDuRole(roles[idDe(membre)] || membre?.role?.name, t),
  }));
  // 🏷️ MSG1BA (§3.1) — « Entraîneur », « Joueur »... sous le nom ; sans role connu, « Membre ».
  const roleDe = (/** @type {any} */ membre) => libelleDuRole(
    roles[idDe(membre)] || membre?.role?.name,
    t,
  );

  const ligneDeFiche = (
    /** @type {any} */ icone,
    /** @type {string} */ libelle,
    /** @type {() => void} */ onPress,
    /** @type {string} */ testID,
    danger = false,
  ) => (
    <TouchableOpacity
      accessibilityRole="button"
      disabled={occupe}
      onPress={onPress}
      style={[styles.ligneDeFiche, { borderTopColor: filet }]}
      testID={testID}
    >
      <GlyphIcon color={danger ? Colors.chatDanger : Colors.neutral00} name={icone} size={20} />
      <Text style={[LIGNE_DE_MENU, { color: danger ? Colors.chatDanger : Colors.neutral00 }]}>
        {libelle}
      </Text>
    </TouchableOpacity>
  );

  return (
    <Modal animationType="slide" onRequestClose={onClose} statusBarTranslucent visible={visible}>
      <View
        style={[styles.page, { backgroundColor: Colors.chatBackground }]}
        testID="infos-du-groupe"
      >
        <View style={[styles.enTete, { backgroundColor: Colors.chatBar, paddingTop: top }]}>
          <TouchableOpacity
            accessibilityLabel={t('common.back', 'Retour')}
            accessibilityRole="button"
            onPress={onClose}
            style={[styles.retour, { borderColor: Colors.primary500 }]}
            testID="infos-du-groupe-retour"
          >
            <GlyphIcon color={Colors.neutral00} name="chevronLeft" size={20} />
          </TouchableOpacity>
          <Text
            accessibilityRole="header"
            style={[styles.titreEnTete, { color: Colors.neutral00 }]}
          >
            {t('conversation.groupInfo.title', 'Infos du groupe')}
          </Text>
        </View>

        <ScrollView contentContainerStyle={[styles.contenu, { paddingBottom: 40 + bottom }]}>
          <View style={styles.identite}>
            {/* 🖼️ MSG1BA (§3.16) — la photo du groupe, sinon l'ecusson ; la pastille appareil
                photo quand le lecteur peut la changer. */}
            <TouchableOpacity
              accessibilityLabel={peutChangerLaPhoto
                ? t('conversation.groupInfo.editPhoto', 'Modifier la photo du groupe')
                : undefined}
              accessibilityRole={peutChangerLaPhoto ? 'button' : 'image'}
              disabled={!peutChangerLaPhoto || occupe}
              onPress={() => setFeuillePhoto(true)}
              testID={peutChangerLaPhoto ? 'infos-du-groupe-photo' : 'infos-du-groupe-avatar'}
            >
              {photoDuGroupe ? (
                <ProfileAvatar
                  enablePreview={false}
                  imageStyle={{ borderRadius: 46 }}
                  imageUrl={photoDuGroupe}
                  name={nomDuGroupe}
                  size={92}
                />
              ) : (
                <ClubLogoMark name={nomDuGroupe || 'Groupe'} size={92} />
              )}
              {peutChangerLaPhoto ? (
                <View
                  style={[
                    styles.pastillePhoto,
                    { backgroundColor: Colors.primary500, borderColor: Colors.chatBackground },
                  ]}
                >
                  <GlyphIcon color={Colors.primary900} name="camera" size={17} />
                </View>
              ) : null}
            </TouchableOpacity>
            {enEdition ? (
              <View style={styles.edition}>
                <TextInput
                  accessibilityLabel={t('conversation.group.nameLabel', 'Nom du groupe')}
                  autoFocus
                  maxLength={40}
                  onChangeText={setBrouillon}
                  onSubmitEditing={enregistrer}
                  style={[
                    styles.champ,
                    {
                      backgroundColor: Colors.primary800,
                      borderColor: Colors.primary500,
                      color: Colors.neutral00,
                    },
                  ]}
                  testID="infos-du-groupe-champ-nom"
                  value={brouillon}
                />
                <View style={styles.boutons}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    onPress={() => {
                      setBrouillon(nomDuGroupe);
                      setEnEdition(false);
                    }}
                    style={[
                      styles.bouton,
                      { borderColor: withAlpha(Colors.neutral00, 0.3), borderWidth: 1.5 },
                    ]}
                  >
                    <Text style={[styles.boutonTexte, { color: Colors.neutral00 }]}>
                      {t('common.cancel', 'Annuler')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityRole="button"
                    disabled={occupe}
                    onPress={enregistrer}
                    style={[styles.bouton, { backgroundColor: Colors.primary500 }]}
                    testID="infos-du-groupe-enregistrer"
                  >
                    <Text style={[styles.boutonTexte, { color: Colors.primary900 }]}>
                      {t('conversation.groupInfo.save', 'Enregistrer')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                accessibilityHint={
                  peutRenommer
                    ? t('conversation.groupInfo.renameHint', 'Renommer le groupe')
                    : undefined
                }
                accessibilityRole={peutRenommer ? 'button' : 'text'}
                disabled={!peutRenommer}
                onPress={() => setEnEdition(true)}
                style={styles.nomLigne}
                testID="infos-du-groupe-nom"
              >
                <Text numberOfLines={1} style={[styles.nom, { color: Colors.neutral00 }]}>
                  {nomDuGroupe || t('conversation.groupInfo.untitled', 'Groupe')}
                </Text>
                {peutRenommer ? (
                  <GlyphIcon color={Colors.primary500} name="pencil" size={18} />
                ) : null}
              </TouchableOpacity>
            )}
            <Text style={[styles.resume, { color: withAlpha(Colors.neutral00, 0.6) }]}>
              {t('conversation.groupInfo.summary', {
                count: participants.length,
                defaultValue: 'Groupe · {{count}} membres',
              })}
            </Text>
          </View>

          {/* 🛡️ MSG1BA (§3.16) — « Autorisations du groupe », pour les admins (serveur 1B). */}
          {estAdmin && autorisations ? (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => setPageAutorisations(true)}
              style={[
                styles.carte,
                styles.ligneAutorisations,
                { backgroundColor: Colors.primary800 },
              ]}
              testID="infos-du-groupe-autorisations"
            >
              <GlyphIcon color={Colors.primary500} name="shieldCheck" size={22} />
              <View style={styles.membreTextes}>
                <Text style={[styles.nomMembre, { color: Colors.neutral00 }]}>
                  {t('conversation.groupPermissions.title', 'Autorisations du groupe')}
                </Text>
                <Text numberOfLines={1} style={[styles.roleMembre, { color: sourdine }]}>
                  {resumeDesAutorisations(autorisations, t)}
                </Text>
              </View>
              <GlyphIcon color={withAlpha(Colors.neutral00, 0.5)} name="chevronRight" size={20} />
            </TouchableOpacity>
          ) : null}

          <Text style={[styles.majuscules, { color: withAlpha(Colors.neutral00, 0.6) }]}>
            {t('conversation.groupInfo.membersCaps', {
              count: participants.length,
              defaultValue: '{{count}} MEMBRES',
            })}
          </Text>
          <View style={[styles.carte, { backgroundColor: Colors.primary800 }]}>
            {peutAjouter ? (
              <TouchableOpacity
                accessibilityRole="button"
                onPress={onAjouter}
                style={styles.ligneMembre}
                testID="infos-du-groupe-ajouter"
              >
                <View style={[styles.rondAjouter, { backgroundColor: Colors.primary500 }]}>
                  <GlyphIcon color={Colors.primary900} name="userPlus" size={20} />
                </View>
                <Text style={[styles.nomMembre, { color: Colors.primary500 }]}>
                  {t('conversation.group.addMembers', 'Ajouter des membres')}
                </Text>
              </TouchableOpacity>
            ) : null}
            {ordonnes.map((/** @type {any} */ membre, /** @type {number} */ index) => {
              const id = idDe(membre);
              const cEstMoi = id === meId;
              return (
                <TouchableOpacity
                  accessibilityRole={cEstMoi ? 'text' : 'button'}
                  disabled={cEstMoi}
                  key={`membre:${id}`}
                  onPress={() => setMembreOuvert(membre)}
                  style={[
                    styles.ligneMembre,
                    peutAjouter || index ? { borderTopColor: filet, borderTopWidth: 1 } : null,
                  ]}
                  testID={`infos-du-groupe-membre-${id}`}
                >
                  <ProfileAvatar
                    enablePreview={false}
                    imageUrl={resolveAvatar(membre) || undefined}
                    name={nomDe(membre)}
                    size={42}
                  />
                  <View style={styles.membreTextes}>
                    <Text numberOfLines={1} style={[styles.nomMembre, { color: Colors.neutral00 }]}>
                      {cEstMoi ? t('conversation.header.you', 'Vous') : nomDe(membre)}
                    </Text>
                    <Text numberOfLines={1} style={[styles.roleMembre, { color: sourdine }]}>
                      {roleDe(membre)}
                    </Text>
                  </View>
                  {membreEstAdmin(membre) ? (
                    <View
                      style={[
                        styles.pastilleAdmin,
                        { borderColor: withAlpha(Colors.primary500, 0.5) },
                      ]}
                    >
                      <Text style={[styles.pastilleAdminTexte, { color: Colors.primary500 }]}>
                        {t('conversation.group.admin', 'Admin')}
                      </Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>

          <View
            style={[styles.carte, styles.carteSignaler, { backgroundColor: Colors.primary800 }]}
          >
            <TouchableOpacity
              accessibilityRole="button"
              onPress={onSignaler}
              style={styles.ligneSignaler}
              testID="infos-du-groupe-signaler"
            >
              <GlyphIcon color={Colors.chatDanger} name="flag" size={20} />
              <Text style={[LIGNE_DE_MENU, { color: Colors.chatDanger }]}>
                {t('conversation.groupInfo.report', 'Signaler le groupe')}
              </Text>
            </TouchableOpacity>
            {onQuitter ? (
              <TouchableOpacity
                accessibilityRole="button"
                disabled={occupe}
                onPress={() => setDepartAConfirmer(true)}
                style={[styles.ligneSignaler, { borderTopColor: filet, borderTopWidth: 1 }]}
                testID="infos-du-groupe-quitter"
              >
                <GlyphIcon color={Colors.chatDanger} name="userMinus" size={20} />
                <Text style={[LIGNE_DE_MENU, { color: Colors.chatDanger }]}>
                  {t('conversation.groupInfo.leave', 'Quitter le groupe')}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </ScrollView>

        {/* La fiche d'un membre. */}
        {membreOuvert ? (
          <Pressable
            onPress={() => setMembreOuvert(null)}
            style={[styles.voile, { backgroundColor: withAlpha(Colors.neutral900, 0.45) }]}
            testID="infos-du-groupe-fiche-voile"
          >
            <Pressable
              onPress={() => {}}
              style={[
                styles.feuille,
                { backgroundColor: Colors.chatSheet, paddingBottom: 34 + bottom },
              ]}
              testID="infos-du-groupe-fiche"
            >
              <View
                style={[styles.poignee, { backgroundColor: withAlpha(Colors.neutral00, 0.25) }]}
              />
              <View style={styles.ficheEnTete}>
                <ProfileAvatar
                  enablePreview={false}
                  imageUrl={resolveAvatar(membreOuvert) || undefined}
                  name={nomDe(membreOuvert)}
                  size={48}
                />
                <View style={styles.membreTextes}>
                  <Text numberOfLines={1} style={[styles.ficheNom, { color: Colors.neutral00 }]}>
                    {nomDe(membreOuvert)}
                  </Text>
                  <Text style={[styles.roleMembre, { color: withAlpha(Colors.neutral00, 0.6) }]}>
                    {membreEstAdmin(membreOuvert)
                      ? `${t('conversation.group.admin', 'Admin')} · ${roleDe(membreOuvert)}`
                      : roleDe(membreOuvert)}
                  </Text>
                </View>
              </View>
              {ligneDeFiche(
                'envelope',
                t('conversation.groupInfo.sendMessage', 'Envoyer un message'),
                () => {
                  const membre = membreOuvert;
                  setMembreOuvert(null);
                  onEnvoyerUnMessage(membre);
                },
                'infos-du-groupe-message',
              )}
              {estAdmin
                ? ligneDeFiche(
                  'shieldCheck',
                  membreEstAdmin(membreOuvert)
                    ? t('conversation.groupInfo.removeAdmin', 'Retirer le rôle d’admin')
                    : t('conversation.groupInfo.makeAdmin', 'Nommer admin du groupe'),
                  () => {
                    const membre = membreOuvert;
                    setMembreOuvert(null);
                    onBasculerAdmin(membre, !membreEstAdmin(membre));
                  },
                  'infos-du-groupe-admin',
                )
                : null}
              {estAdmin
                ? ligneDeFiche(
                  'userMinus',
                  t('conversation.groupInfo.removeFromGroup', 'Retirer du groupe'),
                  () => {
                    setARetirer(membreOuvert);
                    setMembreOuvert(null);
                  },
                  'infos-du-groupe-retirer',
                  true,
                )
                : null}
            </Pressable>
          </Pressable>
        ) : null}

        {departAConfirmer ? (
          <View
            style={[styles.voileCentre, { backgroundColor: withAlpha(Colors.neutral900, 0.55) }]}
          >
            <View
              style={[
                styles.boite,
                {
                  backgroundColor: Colors.chatSheet,
                  borderColor: withAlpha(Colors.neutral00, 0.08),
                },
              ]}
              testID="infos-du-groupe-confirmation-depart"
            >
              <Text style={[styles.boiteTitre, { color: Colors.neutral00 }]}>
                {t('conversation.groupInfo.leaveConfirm', {
                  defaultValue:
                    'Quitter le groupe « {{name}} » ? Tu ne recevras plus ses messages.',
                  name: nomDuGroupe || t('conversation.groupInfo.untitled', 'Groupe'),
                  ...SANS_ECHAPPEMENT,
                })}
              </Text>
              <View style={styles.boutons}>
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => setDepartAConfirmer(false)}
                  style={[
                    styles.bouton,
                    styles.boutonBoite,
                    { borderColor: withAlpha(Colors.neutral00, 0.3), borderWidth: 1.5 },
                  ]}
                >
                  <Text style={[styles.boutonTexte, { color: Colors.neutral00 }]}>
                    {t('common.cancel', 'Annuler')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => {
                    setDepartAConfirmer(false);
                    onQuitter?.();
                  }}
                  style={[
                    styles.bouton,
                    styles.boutonBoite,
                    {
                      backgroundColor: withAlpha(Colors.chatDanger, 0.16),
                      borderColor: Colors.chatDanger,
                      borderWidth: 1.5,
                    },
                  ]}
                  testID="infos-du-groupe-confirmer-depart"
                >
                  <Text style={[styles.boutonTexte, { color: Colors.chatDanger }]}>
                    {t('conversation.groupInfo.leaveConfirmAction', 'Quitter')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : null}

        {/* 🖼️🛡️ MSG1BA (§3.16) — par-dessus la page, dans sa fenetre (meme raison que les
            confirmations ci-dessous). */}
        <FeuillePhotoDuGroupe
          aPhoto={Boolean(photoDuGroupe)}
          onChoisir={onChoisirPhoto}
          onClose={() => setFeuillePhoto(false)}
          onSupprimer={onSupprimerPhoto}
          visible={feuillePhoto}
        />
        <AutorisationsDuGroupe
          admins={membresAffiches.filter((membre) => adminIds.includes(membre.id))}
          occupe={occupe}
          onChanger={onChangerAutorisation}
          onClose={() => setPageAutorisations(false)}
          onModifierLesAdmins={() => setPageAdmins(true)}
          valeurs={autorisations || {}}
          visible={pageAutorisations && !pageAdmins}
        />
        <AdminsDuGroupe
          adminsInitiaux={[
            ...adminIds.filter((id) => id === meId),
            ...adminIds.filter((id) => id !== meId),
          ]}
          meId={meId}
          membres={membresAffiches}
          note={t(
            'conversation.groupAdmins.cannotRemoveSelf',
            'Tu ne peux pas te retirer toi-même le rôle d’admin.',
          )}
          occupe={occupe}
          onClose={() => setPageAdmins(false)}
          onValider={(admins) => {
            setPageAdmins(false);
            onValiderAdmins(admins);
          }}
          visible={pageAdmins}
        />

        {/* La confirmation, DANS la page : une seconde fenetre par-dessus une page deja
            ouverte ne s'affiche pas toujours sur iPhone. */}
        {aRetirer ? (
          <View
            style={[styles.voileCentre, { backgroundColor: withAlpha(Colors.neutral900, 0.55) }]}
          >
            <View
              style={[
                styles.boite,
                {
                  backgroundColor: Colors.chatSheet,
                  borderColor: withAlpha(Colors.neutral00, 0.08),
                },
              ]}
              testID="infos-du-groupe-confirmation"
            >
              <Text style={[styles.boiteTitre, { color: Colors.neutral00 }]}>
                {t('conversation.group.removeConfirm', {
                  defaultValue: 'Retirer {{member}} du groupe ?',
                  member: nomDe(aRetirer),
                  ...SANS_ECHAPPEMENT,
                })}
              </Text>
              <View style={styles.boutons}>
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => setARetirer(null)}
                  style={[
                    styles.bouton,
                    styles.boutonBoite,
                    { borderColor: withAlpha(Colors.neutral00, 0.3), borderWidth: 1.5 },
                  ]}
                >
                  <Text style={[styles.boutonTexte, { color: Colors.neutral00 }]}>
                    {t('common.cancel', 'Annuler')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => {
                    const membre = aRetirer;
                    setARetirer(null);
                    onRetirer(membre);
                  }}
                  style={[
                    styles.bouton,
                    styles.boutonBoite,
                    {
                      backgroundColor: withAlpha(Colors.chatDanger, 0.16),
                      borderColor: Colors.chatDanger,
                      borderWidth: 1.5,
                    },
                  ]}
                  testID="infos-du-groupe-confirmer-retrait"
                >
                  <Text style={[styles.boutonTexte, { color: Colors.chatDanger }]}>
                    {t('conversation.group.remove', 'Retirer')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  boite: {
    borderRadius: 20,
    borderWidth: 1,
    paddingBottom: 16,
    paddingHorizontal: 18,
    paddingTop: 22,
    width: 300,
  },
  boiteTitre: {
    fontFamily: GRAS_FAMILLE,
    fontSize: 17,
    lineHeight: 23,
    textAlign: 'center',
  },
  bouton: {
    alignItems: 'center',
    borderRadius: 999,
    flex: 1,
    height: 44,
    justifyContent: 'center',
  },
  boutonBoite: {
    height: 46,
  },
  boutons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 18,
  },
  boutonTexte: {
    fontFamily: GRAS_FAMILLE,
    fontSize: 15,
    lineHeight: 20,
  },
  carte: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  carteSignaler: {
    marginTop: 16,
  },
  champ: {
    borderRadius: 14,
    borderWidth: 1,
    fontFamily: GRAS_FAMILLE,
    fontSize: 17,
    height: 48,
    paddingHorizontal: 14,
    textAlign: 'center',
  },
  contenu: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  edition: {
    alignSelf: 'stretch',
    gap: 10,
  },
  enTete: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 10,
    paddingHorizontal: 12,
  },
  feuille: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  ficheEnTete: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 14,
  },
  ficheNom: {
    fontFamily: GRAS_FAMILLE,
    fontSize: 16,
    lineHeight: 21,
  },
  identite: {
    alignItems: 'center',
    gap: 10,
  },
  ligneAutorisations: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    height: 62,
    marginTop: 24,
    paddingHorizontal: 16,
  },
  ligneDeFiche: {
    alignItems: 'center',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 14,
    height: 54,
  },
  ligneMembre: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    height: 62,
    paddingHorizontal: 14,
  },
  ligneSignaler: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    height: 54,
    paddingHorizontal: 16,
  },
  majuscules: {
    fontFamily: GRAS_FAMILLE,
    fontSize: 12,
    letterSpacing: 1,
    lineHeight: 16,
    marginBottom: 8,
    marginHorizontal: 4,
    marginTop: 28,
  },
  membreTextes: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  nom: {
    fontFamily: GRAS_FAMILLE,
    fontSize: 22,
    lineHeight: 28,
  },
  nomLigne: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    maxWidth: '100%',
  },
  nomMembre: {
    fontFamily: GRAS_FAMILLE,
    fontSize: 15.5,
    lineHeight: 20,
  },
  page: {
    flex: 1,
  },
  pastilleAdmin: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  pastilleAdminTexte: {
    fontFamily: GRAS_FAMILLE,
    fontSize: 11.5,
    lineHeight: 15,
  },
  pastillePhoto: {
    alignItems: 'center',
    borderRadius: 17,
    borderWidth: 3,
    bottom: 0,
    height: 34,
    justifyContent: 'center',
    position: 'absolute',
    right: -2,
    width: 34,
  },
  poignee: {
    alignSelf: 'center',
    borderRadius: 3,
    height: 5,
    marginBottom: 14,
    width: 40,
  },
  resume: {
    fontFamily: REGULIER_FAMILLE,
    fontSize: 14,
    lineHeight: 19,
  },
  retour: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1.5,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  roleMembre: {
    fontFamily: REGULIER_FAMILLE,
    fontSize: 13,
    lineHeight: 17,
  },
  rondAjouter: {
    alignItems: 'center',
    borderRadius: 21,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  titreEnTete: {
    fontFamily: GRAS_FAMILLE,
    fontSize: 16,
    lineHeight: 20,
  },
  voile: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  voileCentre: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default InfosDuGroupe;
