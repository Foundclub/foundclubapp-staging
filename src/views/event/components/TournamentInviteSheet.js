import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Platform, Text, TouchableOpacity, View,
} from 'react-native';

import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import BottomModalTextInput from '@/components/atoms/bottomModalTextInput/BottomModalTextInput';
import Button from '@/components/atoms/button/Button';
import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';

import { createTournamentDesignSystem } from '../tournamentDesignSystem';

// IMPL-2-EQUIPE (18/11/2026, planches 3b, 3c, 3d, 3f du pack T-DESIGN-TOURNOI) — « + Inviter » :
// une fenêtre en bas de l'écran (au centre sur un grand écran, `webPresentation="dialog"`) avec
// deux choix : partager le lien de l'équipe (WhatsApp, SMS, copier) ou chercher un joueur
// FoundClub.
// La recherche, l'invitation et le lien restent ceux de la page d'équipe (TournamentTeamDetails) :
// cette fenêtre ne fait aucun appel réseau, elle reçoit tout par ses propriétés.
// Témoins : __tests__/T-PAGES-2.pageEquipe.test.js (T-SUITES repris) et T-PAGES-2.caracterisation.

// IMPL-2C (19/11, recette 48 écart 7, Android) : le champ de recherche (`BottomModalTextInput`,
// gorhom sur Android) se déclare lui-même au clavier. Comme les autres feuilles qui le portent
// (AutocompleteSelect en recherche, PollCreationModal, EventTasksEditor) : `extend` et un cran
// fixe, le même dans les deux modes. Sans quoi le cran changeait (choix → recherche) au moment où
// le clavier s'ouvre, et la feuille se fermait (CLAVPOP-ANDROID, BottomModal.js). Le site garde sa
// hauteur automatique : il n'a ni ce champ ni ce clavier.
const CRANS_NATIFS = ['86%'];

/**
 * @typedef {{ documentId: string, firstname?: string, lastname?: string, username?: string,
 *   avatar?: { url?: string }, club?: { name?: string } }} Candidat
 */

/**
 * La fenêtre « Inviter un joueur ».
 * @param {object} props - Les propriétés.
 * @param {boolean} props.isVisible - Ouverte.
 * @param {() => void} props.onClose - Fermer.
 * @param {'choice' | 'search'} [props.initialMode] - Le premier écran.
 * @param {string} [props.teamName] - Le nom de l'équipe.
 * @param {number | null} [props.slotIndex] - La place libre touchée (« Place 4 de … »), ou rien.
 * @param {boolean} [props.isWide] - Grand écran : la fenêtre au centre.
 * @param {string} props.query - Le texte cherché.
 * @param {(texte: string) => void} props.onChangeQuery - Change le texte cherché.
 * @param {string} [props.placeholder] - L'indication du champ.
 * @param {boolean} [props.isSearching] - Recherche en cours.
 * @param {Candidat[]} props.candidates - Les joueurs trouvés (ou proposés).
 * @param {Set<string>} [props.invitedIds] - Les joueurs déjà invités (« Invité »).
 * @param {boolean} [props.isInviting] - Une invitation part.
 * @param {(userId: string) => void} props.onInvite - Inviter un joueur trouvé.
 * @param {(canal: 'whatsapp' | 'sms' | 'copy' | 'share') => void} props.onShare - Partager le lien.
 * @param {string} [props.shareHint] - L'état du lien (copié, échec), ou rien.
 * @param {boolean} [props.isSharing] - Le lien se prépare.
 * @returns {import('react').ReactElement} La fenêtre.
 */
function TournamentInviteSheet({
  candidates, initialMode = 'choice', invitedIds = new Set(), isInviting = false,
  isSearching = false, isSharing = false, isVisible, isWide = false, onChangeQuery, onClose,
  onInvite, onShare, placeholder = '', query, shareHint = '', slotIndex = null, teamName = '',
}) {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const ds = createTournamentDesignSystem({
    ApplicationStyle, Colors, Fonts, Spaces,
  });
  const [mode, setMode] = useState(initialMode);
  // Chaque ouverture repart du premier écran demandé (« + Inviter » ou « Chercher un joueur »).
  useEffect(() => { if (isVisible) setMode(initialMode); }, [initialMode, isVisible]);

  const terme = String(query || '').trim();
  const sousTitre = slotIndex
    ? t('implEquipe.invite.slot', { index: slotIndex, team: teamName, ...SANS_ECHAPPEMENT })
    : t('implEquipe.invite.team', { team: teamName, ...SANS_ECHAPPEMENT });
  const carte = [...ds.styles.insetPanelCard, Spaces.gap[8]];

  const partage = (
    <View style={carte} testID="tournament-invite-share">
      <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
        <GlyphIcon color={Colors.primary500} name="send" size={20} />
        <Text style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1 }]}>
          {t('implEquipe.invite.shareTitle')}
        </Text>
      </View>
      <Text style={[Fonts.p3, Fonts.neutral200]}>{t('implEquipe.invite.shareText')}</Text>
      <View style={[Alignments.row, Spaces.gap[8], { flexWrap: 'wrap' }]}>
        {/* Sur un ordinateur, pas de SMS : le lien se copie (comme « Partager le lien » avant). */}
        <Button
          disabled={isSharing}
          onPress={() => onShare('whatsapp')}
          size="sm"
          style={{ flexGrow: 1 }}
          title={t('implEquipe.invite.whatsapp')}
          variant="SecondaryLight"
        />
        {Platform.OS !== 'web' ? (
          <Button
            disabled={isSharing}
            onPress={() => onShare('sms')}
            size="sm"
            style={{ flexGrow: 1 }}
            title={t('implEquipe.invite.sms')}
            variant="SecondaryLight"
          />
        ) : null}
        <Button
          disabled={isSharing}
          onPress={() => onShare('copy')}
          size="sm"
          style={{ flexGrow: 1 }}
          title={t('implEquipe.invite.copy')}
          variant="SecondaryLight"
        />
      </View>
      {/* Au téléphone, la feuille de partage du système reste (toutes les applications), comme
          « Partager le lien » d'avant : la planche ne la dessine pas, elle ne la retire pas. */}
      {Platform.OS !== 'web' ? (
        <Button
          disabled={isSharing}
          onPress={() => onShare('share')}
          size="sm"
          style={{ alignSelf: 'stretch' }}
          title={t('tournamentTeamDetails.inviteLink.button', 'Partager le lien')}
          variant="Secondary"
        />
      ) : null}
      {shareHint ? <Text style={[Fonts.p3, Fonts.neutral100]}>{shareHint}</Text> : null}
    </View>
  );

  const choix = (
    <View style={Spaces.gap[12]}>
      {partage}
      <TouchableOpacity
        accessibilityLabel={t('implEquipe.invite.searchTitle')}
        accessibilityRole="button"
        onPress={() => setMode('search')}
        style={[...carte, Alignments.row, Alignments.alignCenter, { minHeight: 56 }]}
        testID="tournament-invite-open-search"
      >
        <GlyphIcon color={Colors.primary500} name="search" size={20} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{t('implEquipe.invite.searchTitle')}</Text>
          <Text style={[Fonts.p3, Fonts.neutral200]}>{t('implEquipe.invite.searchHint')}</Text>
        </View>
        <GlyphIcon color={Colors.neutral200} name="chevronRight" size={18} />
      </TouchableOpacity>
    </View>
  );

  const nomDe = (/** @type {Candidat} */ user) => [user?.firstname, user?.lastname]
    .filter(Boolean).join(' ') || user?.username || '';
  let resultat = null;
  if (terme.length > 0 && terme.length < 2) {
    resultat = (
      <Text style={[Fonts.p3, Fonts.neutral200]}>{t('implEquipe.invite.minLetters')}</Text>
    );
  } else if (isSearching) {
    resultat = <Text style={[Fonts.p3, Fonts.neutral200]}>{t('implEquipe.invite.searching')}</Text>;
  } else if (terme.length >= 2 && candidates.length === 0) {
    // 3d : pas d'impasse, le lien de l'équipe est proposé à la place.
    resultat = (
      <View
        style={[...carte, { alignItems: 'center', borderStyle: 'dashed' }]}
        testID="tournament-invite-empty"
      >
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{t('implEquipe.invite.noResultTitle')}</Text>
        <Text style={[Fonts.p3, Fonts.neutral200, { textAlign: 'center' }]}>
          {t('implEquipe.invite.noResultText')}
        </Text>
        {/* PAGE-EQUIPE (3d) : l'icône de partage remise. */}
        <Button
          icon="share"
          iconPosition="before"
          isLoading={isSharing}
          onPress={() => onShare('share')}
          size="sm"
          style={{ alignSelf: 'stretch' }}
          title={t('implEquipe.invite.shareTitle')}
          variant="Primary"
        />
      </View>
    );
  } else {
    resultat = candidates.map((user) => (
      <View
        key={user.documentId}
        style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12], { minHeight: 52 }]}
        testID={`tournament-invite-candidate-${user.documentId}`}
      >
        <ProfileAvatar imageUrl={user?.avatar?.url} name={nomDe(user)} size={38} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{nomDe(user)}</Text>
          {user?.club?.name ? (
            <Text style={[Fonts.p3, Fonts.neutral200]}>{user.club.name}</Text>
          ) : null}
        </View>
        {invitedIds.has(user.documentId) ? (
          // PAGE-EQUIPE (3c) : « ✓ Invité », pastille bleue.
          <View
            style={[
              Alignments.row, Alignments.alignCenter, Spaces.gap[4],
              {
                backgroundColor: `${Colors.primary500}24`,
                borderRadius: 999,
                paddingHorizontal: 10,
                paddingVertical: 4,
              },
            ]}
            testID={`tournament-invite-invited-${user.documentId}`}
          >
            <GlyphIcon color={Colors.primary500} name="check" size={14} />
            <Text style={[Fonts.p3Bold, Fonts.primary500]}>{t('implEquipe.invite.invited')}</Text>
          </View>
        ) : (
          <Button
            disabled={isInviting}
            onPress={() => onInvite(user.documentId)}
            size="sm"
            title={t('implEquipe.invite.invite')}
            variant="Secondary"
          />
        )}
      </View>
    ));
  }

  const recherche = (
    <View style={Spaces.gap[12]}>
      {/* Android : le champ que la feuille suit au clavier (CLAVREGLE) ; ailleurs, TextInput. */}
      {/* PAGE-EQUIPE (3c, 3d) : la loupe dans le champ, et la croix qui l'efface dès qu'il y a du
          texte. */}
      <View style={{ justifyContent: 'center' }}>
        <BottomModalTextInput
          accessibilityLabel={t('implEquipe.invite.searchTitle')}
          autoCorrect={false}
          // Chef « A » (18/11, T-SUITES) : le champ prend le focus dès que la recherche s'ouvre.
          autoFocus
          onChangeText={onChangeQuery}
          placeholder={placeholder || t('implEquipe.invite.placeholder')}
          placeholderTextColor={Colors.neutral500}
          style={[ds.styles.input, { paddingLeft: 44, paddingRight: 44 }]}
          testID="tournament-invite-search-input"
          value={query}
        />
        <View pointerEvents="none" style={{ left: 14, position: 'absolute' }}>
          <GlyphIcon color={Colors.neutral200} name="search" size={18} />
        </View>
        {String(query || '').length > 0 ? (
          <TouchableOpacity
            accessibilityLabel={t('implEquipe.invite.clearSearch')}
            accessibilityRole="button"
            onPress={() => onChangeQuery('')}
            style={{
              alignItems: 'center',
              height: 44,
              justifyContent: 'center',
              position: 'absolute',
              right: 0,
              width: 44,
            }}
            testID="tournament-invite-search-clear"
          >
            <GlyphIcon color={Colors.neutral200} name="xmark" size={18} />
          </TouchableOpacity>
        ) : null}
      </View>
      {resultat}
    </View>
  );

  return (
    <BottomModal
      androidKeyboardBehavior="extend"
      close={onClose}
      // IMPL-2C (19/11, recette 48 écart 6) : la croix « Fermer » (`common.close`),
      // cachée par défaut.
      hideCloseButton={false}
      isVisible={isVisible}
      snapPoints={Platform.OS === 'web' ? undefined : CRANS_NATIFS}
      webPresentation={isWide ? 'dialog' : undefined}
    >
      <View testID="tournament-invite-sheet">
        {/* L'en-tête dans le contenu : visible dans la feuille comme dans la fenêtre du site. */}
        <View style={[Spaces.gap[4], Spaces.paddingBottom[12]]}>
          {/* La place de la croix, en haut à droite : le titre ne passe pas dessous. */}
          <View
            style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8], { paddingRight: 40 }]}
          >
            {mode === 'search' && initialMode === 'choice' ? (
              <TouchableOpacity
                accessibilityLabel={t('implEquipe.invite.back')}
                accessibilityRole="button"
                onPress={() => setMode('choice')}
                style={{
                  alignItems: 'center', height: 44, justifyContent: 'center', width: 44,
                }}
              >
                <GlyphIcon color={Colors.neutral00} name="chevronLeft" size={20} />
              </TouchableOpacity>
            ) : null}
            <Text style={[Fonts.h4Bold, Fonts.neutral00, { flex: 1 }]}>
              {mode === 'search'
                ? t('implEquipe.invite.searchTitle') : t('implEquipe.invite.title')}
            </Text>
          </View>
          <Text style={[Fonts.p3, Fonts.neutral200]}>{sousTitre}</Text>
        </View>
        {mode === 'search' ? recherche : choix}
      </View>
    </BottomModal>
  );
}

export default TournamentInviteSheet;
