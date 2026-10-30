import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  getPollVoteCount,
  getPollVoters,
} from '@/domains/messaging/pollUseCases';
import usePollVoterProfiles, { nameOfPollVoter } from '@/domains/messaging/usePollVoterProfiles';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';
import { GRAS_FAMILLE, REGULIER_FAMILLE } from '@/components/molecules/bulleDuFil/typographieDuFil';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';

/** Largeur du contenu d'une bulle de sondage (SPECS.md §3). */
const LARGEUR_DU_SONDAGE = 274;

const styles = StyleSheet.create({
  avatarDeVotant: {
    borderRadius: 999,
    borderWidth: 1.5,
  },
  barre: {
    borderRadius: 3,
    height: 6,
    marginTop: 7,
    overflow: 'hidden',
  },
  carteSeule: {
    borderRadius: 18,
    paddingBottom: 7,
    paddingHorizontal: 10,
    paddingTop: 6,
  },
  compte: {
    fontFamily: GRAS_FAMILLE,
    fontSize: 13,
    lineHeight: 18,
    minWidth: 8,
    textAlign: 'right',
  },
  consigne: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    marginTop: 4,
  },
  consigneTexte: {
    flexShrink: 1,
    fontFamily: REGULIER_FAMILLE,
    fontSize: 12,
    lineHeight: 16,
  },
  enTeteDOption: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    minHeight: 22,
  },
  libelle: {
    flexShrink: 1,
    fontFamily: REGULIER_FAMILLE,
    fontSize: 15,
    lineHeight: 20,
  },
  option: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 7,
  },
  options: {
    gap: 2,
    marginTop: 8,
  },
  pied: {
    alignItems: 'center',
    borderTopWidth: 1,
    marginBottom: -7,
    marginHorizontal: -10,
    marginTop: 7,
    paddingBottom: 12,
    paddingTop: 11,
  },
  piedTexte: {
    fontFamily: GRAS_FAMILLE,
    fontSize: 15,
    lineHeight: 20,
  },
  question: {
    fontFamily: GRAS_FAMILLE,
    fontSize: 15,
    lineHeight: 20,
    marginTop: 2,
  },
  rondCoche: {
    alignItems: 'center',
    borderRadius: 11,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  rondVide: {
    borderRadius: 11,
    borderWidth: 2,
    height: 22,
    width: 22,
  },
  votants: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  votantsNoms: {
    fontFamily: REGULIER_FAMILLE,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
});

/**
 * La bulle de sondage d'un fil (et sa carte, dans le detail du sondage).
 *
 * 🎨 MSG1A (§3.4) — LE DESSIN DU PACK (SPECS.md §3 « Sondage ») : question 15/700, consigne
 * avec son icone (un choix / plusieurs, « · anonyme »), une ligne par option avec un ROND
 * (coche cyan = mon vote), le libelle, 2 avatars de votants et le compte, puis une barre
 * de 6 proportionnelle a l'option la plus votee ; pied « Voir les votes ». Le contraste est
 * renforce a la demande de l'equipe (piste a 20 %, textes blancs).
 * Rien ne change dans ce que fait la bulle : un appui vote (ou retire le vote), le pied ouvre
 * le detail, un sondage anonyme ne montre personne, et les noms viennent TOUJOURS de
 * `resolveVoterName` (la resolution des noms n'est pas l'affaire de ce composant).
 * @param {object} props
 * @param {string} [props.currentUserId]
 * @param {boolean} [props.dansLaBulle] - Pose dans le cadre `BulleDuFil` du fil : sans fond.
 * @param {boolean} [props.fullWidth] - Toute la largeur (detail du sondage).
 * @param {boolean} [props.isMe]
 * @param {string} [props.messageId] - SONDAGE-NOMS : le message du sondage. Donné, la bulle
 *   lit ELLE-MÊME les noms des votants au serveur : dans le fil, GiftedChat ne la redessine pas
 *   quand l'écran apprend un nom après coup (piège de FINITIONS15).
 * @param {import('react').ReactNode} [props.meta] - L'heure (et les coches), avant le pied.
 * @param {(voterId: string) => string} [props.nomMasqueDuVotant] - ANONSITE : le nom qui
 *   REMPLACE celui du serveur (« Joueur Adverse » d'un fil de ligue avant le match), sans photo ;
 *   '' quand la personne n'est pas masquée.
 * @param {() => void} [props.onOpenDetails]
 * @param {(optionId: string) => Promise<void> | void} [props.onVote]
 * @param {object | null | undefined} props.poll
 * @param {(voterId: string) => string} [props.resolveVoterAvatar] - L'adresse de l'avatar.
 * @param {(voterId: string) => string} [props.resolveVoterName]
 * @param {boolean} [props.showSelectedBadge] - Garde pour compatibilite : le rond coche le dit.
 * @param {boolean} [props.showVoterChips] - Les noms des votants sous chaque option (detail).
 * @returns {import('react').ReactElement | null}
 */
function PollMessageBubble({
  currentUserId = '',
  dansLaBulle = false,
  fullWidth = false,
  isMe = false,
  messageId = undefined,
  meta = null,
  nomMasqueDuVotant,
  onOpenDetails,
  onVote,
  poll,
  resolveVoterAvatar,
  resolveVoterName,
  // eslint-disable-next-line no-unused-vars -- garde pour les appelants d'avant MSG1A
  showSelectedBadge = true,
  showVoterChips = false,
}) {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const [loadingOptionId, setLoadingOptionId] = useState('');
  const voterProfiles = usePollVoterProfiles(messageId, poll);
  const options = Array.isArray(poll?.options) ? poll.options : [];

  if (!poll || poll.type !== 'poll') return null;
  if (options.length === 0) return null;

  const isAnonymousPoll = !!poll?.isAnonymous;
  const canVote = typeof onVote === 'function';
  const maximum = Math.max(1, ...options.map((option) => getPollVoteCount(option)));
  const fondDeLaBulle = isMe ? Colors.chatBubbleMine : Colors.primary700;
  const sousTexte = withAlpha(Colors.neutral00, 0.7);

  const handleOptionPress = async (/** @type {string} */ optionId) => {
    if (!onVote || !optionId || loadingOptionId) return;
    setLoadingOptionId(optionId);
    try {
      await onVote(optionId);
    } finally {
      setLoadingOptionId('');
    }
  };

  const nomMasque = (/** @type {string} */ voterId) => String(
    nomMasqueDuVotant?.(voterId) || '',
  ).trim();
  const nomDuVotant = (/** @type {string} */ voterId) => {
    if (nomMasque(voterId)) return nomMasque(voterId);
    // SONDAGE-NOMS — le nom lu au serveur d'abord (un fil de club n'a pas de participants, et
    // seul le serveur sait qu'un compte est supprime), la resolution de l'ecran ensuite.
    const nomDuServeur = nameOfPollVoter(voterProfiles.get(voterId));
    if (nomDuServeur) return nomDuServeur;
    if (typeof resolveVoterName !== 'function') return '';
    const nom = resolveVoterName(voterId);
    return typeof nom === 'string' ? nom.trim() : '';
  };

  const consigne = (poll.allowMultipleVotes
    ? t('conversation.poll.bubble.pickMany', 'Sélectionne une ou plusieurs options')
    : t('conversation.poll.bubble.pickOne', 'Sélectionne une option'))
    + (isAnonymousPoll ? ` · ${t('conversation.poll.visibility.anonymous', 'anonyme')}` : '');

  const contenu = (
    <>
      <Text style={[styles.question, { color: Colors.neutral00 }]}>
        {poll.question || t('conversation.poll.bubble.questionFallback', 'Question')}
      </Text>
      <View style={styles.consigne}>
        <GlyphIcon
          color={sousTexte}
          name={poll.allowMultipleVotes ? 'checkDouble' : 'check'}
          size={14}
        />
        <Text style={[styles.consigneTexte, { color: sousTexte }]}>{consigne}</Text>
      </View>

      <View style={styles.options}>
        {options.map((option, index) => {
          const optionId = String(option?.id || `option-${index}`);
          const optionLabel = String(
            option?.label || t('conversation.poll.form.optionPlaceholder', {
              defaultValue: 'Option {{index}}',
              index: index + 1,
            }),
          );
          const voters = getPollVoters(option);
          const voteCount = getPollVoteCount(option);
          const isSelected = !!currentUserId && voters.includes(currentUserId);
          const votantsVisibles = isAnonymousPoll ? [] : voters.slice(0, 2);
          const nomsDesVotants = isAnonymousPoll
            ? []
            : voters.map((voterId) => nomDuVotant(voterId)).filter(Boolean);

          const ligne = (
            <>
              {isSelected ? (
                <View
                  style={[styles.rondCoche, { backgroundColor: Colors.primary500 }]}
                  testID="sondage-rond-coche"
                >
                  <GlyphIcon color={Colors.primary900} name="check" size={14} />
                </View>
              ) : (
                <View
                  style={[styles.rondVide, { borderColor: withAlpha(Colors.neutral00, 0.55) }]}
                  testID="sondage-rond-vide"
                />
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.enTeteDOption}>
                  <Text style={[styles.libelle, { color: Colors.neutral00 }]}>{optionLabel}</Text>
                  <View style={styles.votants}>
                    {votantsVisibles.length > 0 ? (
                      <View style={{ flexDirection: 'row' }}>
                        {votantsVisibles.map((voterId, rang) => (
                          <View
                            key={`${optionId}-avatar-${voterId}`}
                            style={[
                              styles.avatarDeVotant,
                              { borderColor: fondDeLaBulle, marginLeft: rang ? -6 : 0 },
                            ]}
                          >
                            <ProfileAvatar
                              enablePreview={false}
                              imageUrl={nomMasque(voterId)
                                ? undefined
                                : resolveVoterAvatar?.(voterId) || undefined}
                              name={nomDuVotant(voterId)}
                              size={18}
                            />
                          </View>
                        ))}
                      </View>
                    ) : null}
                    {canVote && loadingOptionId === optionId ? (
                      <ActivityIndicator color={Colors.primary500} size="small" />
                    ) : (
                      <Text style={[styles.compte, { color: Colors.neutral00 }]}>
                        {String(voteCount)}
                      </Text>
                    )}
                  </View>
                </View>
                <View style={[styles.barre, { backgroundColor: withAlpha(Colors.neutral00, 0.2) }]}>
                  <View
                    style={{
                      backgroundColor: Colors.primary500,
                      borderRadius: 3,
                      height: '100%',
                      width: `${(voteCount / maximum) * 100}%`,
                    }}
                  />
                </View>
                {showVoterChips && nomsDesVotants.length > 0 ? (
                  <Text numberOfLines={2} style={[styles.votantsNoms, { color: sousTexte }]}>
                    {nomsDesVotants.join(' · ')}
                  </Text>
                ) : null}
              </View>
            </>
          );

          // SONDAGE-NOMS x MSG1A — la bulle du pack dessine des PASTILLES ; les noms y restent
          // pour le lecteur d'ecran (jamais pour un sondage anonyme : la liste est vide).
          const libelleAccessible = [
            optionLabel,
            t('conversation.poll.bubble.votes', {
              count: voteCount,
              defaultValue_one: '{{count}} vote',
              defaultValue_other: '{{count}} votes',
            }),
            ...nomsDesVotants,
          ].join(', ');

          return canVote ? (
            <TouchableOpacity
              accessibilityLabel={libelleAccessible}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              activeOpacity={0.85}
              key={optionId}
              onPress={(event) => {
                event?.stopPropagation?.();
                handleOptionPress(optionId);
              }}
              style={styles.option}
              testID={`sondage-option-${optionId}`}
            >
              {ligne}
            </TouchableOpacity>
          ) : (
            <View
              accessibilityLabel={libelleAccessible}
              accessible
              key={optionId}
              style={styles.option}
              testID={`sondage-option-${optionId}`}
            >
              {ligne}
            </View>
          );
        })}
      </View>

      {meta ? <View style={{ alignItems: 'flex-end', marginTop: 4 }}>{meta}</View> : null}

      {typeof onOpenDetails === 'function' ? (
        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.85}
          onPress={onOpenDetails}
          style={[styles.pied, { borderTopColor: withAlpha(Colors.neutral00, 0.14) }]}
          testID="sondage-voir-les-votes"
        >
          <Text style={[styles.piedTexte, { color: Colors.primary500 }]}>
            {t('conversation.poll.bubble.seeVotes', 'Voir les votes')}
          </Text>
        </TouchableOpacity>
      ) : null}
    </>
  );

  if (dansLaBulle) {
    return <View style={{ width: LARGEUR_DU_SONDAGE }}>{contenu}</View>;
  }

  return (
    <View
      style={[
        styles.carteSeule,
        {
          alignSelf: isMe ? 'flex-end' : 'flex-start',
          backgroundColor: fondDeLaBulle,
          // CORR-SOCLE (point 1) : le fil du site à 390 px n'offre que 262 px.
          maxWidth: '100%',
          width: fullWidth ? '100%' : LARGEUR_DU_SONDAGE + 20,
        },
      ]}
    >
      {contenu}
    </View>
  );
}

export default PollMessageBubble;
