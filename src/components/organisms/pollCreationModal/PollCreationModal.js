import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import BottomModalTextInput from '@/components/atoms/bottomModalTextInput/BottomModalTextInput';
import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import { GRAS_FAMILLE, REGULIER_FAMILLE } from '@/components/molecules/bulleDuFil/typographieDuFil';

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;
const POLL_SNAP_POINTS = ['84%'];
const MODAL_SCROLL_VIEW_PROPS = { keyboardDismissMode: 'none' };

// 🎨 MSG1A (§3.4) — la feuille « Creer un sondage » du pack (SPECS.md §4) : etiquettes en
// capitales, champs aux couleurs de la saisie du fil, interrupteurs de 51 x 31, bouton plein.
const stylesDuPack = StyleSheet.create({
  boutonEnvoyer: {
    alignItems: 'center',
    borderRadius: 999,
    height: 52,
    justifyContent: 'center',
  },
  boutonEnvoyerTexte: {
    fontFamily: GRAS_FAMILLE,
    fontSize: 16,
    lineHeight: 22,
  },
  carteDesReglages: {
    borderRadius: 16,
    marginTop: 8,
    paddingHorizontal: 14,
  },
  enTete: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  etiquette: {
    fontFamily: GRAS_FAMILLE,
    fontSize: 12,
    letterSpacing: 1.2,
    lineHeight: 16,
    textTransform: 'uppercase',
  },
  fermer: {
    alignItems: 'center',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  interrupteur: {
    borderRadius: 999,
    height: 31,
    width: 51,
  },
  pastilleDeLInterrupteur: {
    borderRadius: 14,
    height: 27,
    position: 'absolute',
    top: 2,
    width: 27,
  },
  reglage: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
  },
  reglageAide: {
    fontFamily: REGULIER_FAMILLE,
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: 3,
  },
  reglageTitre: {
    fontFamily: GRAS_FAMILLE,
    fontSize: 15,
    lineHeight: 20,
  },
  retirer: {
    alignItems: 'center',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    marginLeft: 8,
    width: 36,
  },
  sousTitre: {
    fontFamily: REGULIER_FAMILLE,
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: 2,
  },
  titre: {
    fontFamily: GRAS_FAMILLE,
    fontSize: 18,
    lineHeight: 24,
  },
});

/**
 * L'interrupteur du pack (51 x 31, cyan quand il est allume, pastille blanche de 27).
 * @param {{ allume: boolean, Colors: any }} props
 * @returns {import('react').ReactElement} L'interrupteur, dessine seulement.
 */
function InterrupteurDuPack({ allume, Colors }) {
  return (
    <View
      style={[
        stylesDuPack.interrupteur,
        { backgroundColor: allume ? Colors.primary500 : withAlpha(Colors.neutral00, 0.18) },
      ]}
    >
      <View
        style={[
          stylesDuPack.pastilleDeLInterrupteur,
          { backgroundColor: Colors.neutral00, left: allume ? 22 : 2 },
        ]}
      />
    </View>
  );
}

/**
 * Question input isolated from the modal state to avoid rerendering the whole sheet on each
 * keystroke.
 * @param {object} props
 * @param {(value: string) => void} props.onValueChange
 * @param {string} props.placeholder
 * @param {string} props.placeholderTextColor
 * @param {string} props.cursorColor
 * @param {string} props.selectionColor
 * @param {import('react-native').TextStyle|import('react-native').TextStyle[]} props.style
 * @param {object} props.Alignments
 * @param {object} props.Colors
 * @param {object} props.Fonts
 * @param {object} props.Spaces
 * @param {import('react').ReactElement}
 */
const QuestionInputField = memo(({
  Alignments,
  Colors,
  cursorColor,
  onValueChange,
  placeholder,
  placeholderTextColor,
  selectionColor,
  Spaces,
  style,
}) => {
  const [value, setValue] = useState('');
  const questionLength = value.trim().length;

  return (
    <View style={[Spaces.gap[8], Spaces.marginBottom[4]]}>
      <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter]}>
        <Text style={[stylesDuPack.etiquette, { color: withAlpha(Colors.neutral00, 0.6) }]}>
          Question
        </Text>
        <Text
          style={[
            stylesDuPack.etiquette,
            { color: withAlpha(Colors.neutral00, 0.6), letterSpacing: 0 },
          ]}
        >
          {questionLength}
          /140
        </Text>
      </View>
      <BottomModalTextInput
        autoCapitalize="sentences"
        autoCorrect={false}
        cursorColor={cursorColor}
        maxLength={140}
        onChangeText={(nextValue) => {
          setValue(nextValue);
          onValueChange(nextValue);
        }}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor}
        selectionColor={selectionColor}
        style={style}
        underlineColorAndroid="transparent"
        value={value}
      />
    </View>
  );
});

/**
 * Option input row isolated from modal state to keep typing smooth on Android.
 * @param {object} props
 * @param {boolean} props.canRemove
 * @param {boolean} props.hasDuplicate
 * @param {string} props.placeholder
 * @param {string} props.placeholderTextColor
 * @param {string} props.cursorColor
 * @param {string} props.selectionColor
 * @param {(value: string) => void} props.onValueChange
 * @param {() => void} props.onRemove
 * @param {string} props.removeAccessibilityLabel
 * @param {import('react-native').TextStyle|import('react-native').TextStyle[]} props.style
 * @param {object} props.Colors
 * @param {object} props.Fonts
 * @param {object} props.Images
 * @param {object} props.Spaces
 * @returns {import('react').ReactElement}
 */
const OptionInputRow = memo(({
  canRemove,
  Colors,
  cursorColor,
  Fonts,
  hasDuplicate,
  onRemove,
  onValueChange,
  placeholder,
  placeholderTextColor,
  removeAccessibilityLabel,
  selectionColor,
  Spaces,
  style,
}) => {
  const { t } = useTranslation();
  const [value, setValue] = useState('');

  return (
    <View style={Spaces.gap[4]}>
      <View style={{ alignItems: 'center', flexDirection: 'row' }}>
        <BottomModalTextInput
          autoCapitalize="none"
          autoCorrect={false}
          cursorColor={cursorColor}
          maxLength={80}
          onChangeText={(nextValue) => {
            setValue(nextValue);
            onValueChange(nextValue);
          }}
          placeholder={placeholder}
          placeholderTextColor={placeholderTextColor}
          selectionColor={selectionColor}
          style={style}
          underlineColorAndroid="transparent"
          value={value}
        />
        {canRemove ? (
          <TouchableOpacity
            accessibilityLabel={removeAccessibilityLabel}
            accessibilityRole="button"
            hitSlop={4}
            onPress={onRemove}
            style={[stylesDuPack.retirer, { backgroundColor: withAlpha(Colors.neutral00, 0.08) }]}
          >
            <GlyphIcon color={Colors.neutral00} name="xmark" size={16} />
          </TouchableOpacity>
        ) : null}
      </View>
      {hasDuplicate ? (
        <Text style={[Fonts.p4, { color: Colors.chatDanger }]}>
          {t('pollCreationModal.thisOptionIsAlreadyUsed', 'Cette option est déjà utilisée.')}
        </Text>
      ) : null}
    </View>
  );
});

const createDraftOption = () => ({
  id: `poll-draft-option-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  value: '',
});

const getDefaultOptions = () => [createDraftOption(), createDraftOption()];

/**
 * Poll creation modal.
 * @param {object} props
 * @param {boolean} props.isVisible
 * @param {() => void} props.onClose
 * @param {(payload: {
 *   question: string;
 *   options: string[];
 *   allowMultipleVotes: boolean;
 *   isAnonymous: boolean;
 * }) => Promise<void> | void} props.onSubmit
 * @returns {import('react').ReactElement}
 */
function PollCreationModal({ isVisible, onClose, onSubmit }) {
  const { t } = useTranslation();
  const {
    Alignments,
    Colors,
    Fonts,
    Images,
    Spaces,
  } = useTheme();

  const [allowMultipleVotes, setAllowMultipleVotes] = useState(false);
  const [draftKey, setDraftKey] = useState(0);
  const [duplicateOptionIdSet, setDuplicateOptionIdSet] = useState(() => new Set());
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [error, setError] = useState('');
  // SMF (T20) — le champ que l erreur concerne : sur le site, elle s affiche SOUS lui.
  const [champEnErreur, setChampEnErreur] = useState(
    /** @type {'' | 'question' | 'options'} */ (''),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [options, setOptions] = useState(() => getDefaultOptions().map(({ id }) => ({ id })));
  const optionValuesRef = useRef({});
  const questionValueRef = useRef('');

  const resetDraft = () => {
    const defaultOptions = getDefaultOptions().map(({ id }) => ({ id }));
    setAllowMultipleVotes(false);
    setDraftKey((current) => current + 1);
    setDuplicateOptionIdSet(new Set());
    setIsAnonymous(false);
    setError('');
    setChampEnErreur('');
    setIsSubmitting(false);
    setOptions(defaultOptions);
    optionValuesRef.current = Object.fromEntries(defaultOptions.map((option) => [option.id, '']));
    questionValueRef.current = '';
  };

  useEffect(() => {
    if (!isVisible) return;
    resetDraft();
  }, [isVisible]);

  const inputStyle = useMemo(() => ([
    {
      backgroundColor: Colors.primary800,
      borderColor: Colors.primary700,
      borderRadius: 14,
      borderWidth: 1,
      color: Colors.neutral00,
      fontFamily: REGULIER_FAMILLE,
      fontSize: 15,
      lineHeight: 21,
      minHeight: 52,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
  ]), [Colors.neutral00, Colors.primary700, Colors.primary800]);
  const modalContentContainerStyle = useMemo(
    () => [Spaces.gap[16], { paddingBottom: 24, paddingTop: 18 }],
    [Spaces],
  );
  const handleQuestionChange = useCallback((value) => {
    questionValueRef.current = value;
    if (error) setError('');
  }, [error]);

  const handleChangeOption = useCallback((
    /** @type {string} */ optionId,
    /** @type {string} */ value,
  ) => {
    optionValuesRef.current[optionId] = value;
    if (duplicateOptionIdSet.size > 0) {
      setDuplicateOptionIdSet(new Set());
    }
    if (error) setError('');
  }, [duplicateOptionIdSet.size, error]);

  const handleAddOption = () => {
    if (options.length >= MAX_OPTIONS) return;
    const nextOption = createDraftOption();
    optionValuesRef.current[nextOption.id] = '';
    setOptions((prev) => [...prev, { id: nextOption.id }]);
  };

  const handleRemoveOption = (/** @type {string} */ optionId) => {
    setOptions((prev) => {
      if (prev.length <= MIN_OPTIONS) return prev;
      return prev.filter((entry) => entry.id !== optionId);
    });
    const nextValues = { ...optionValuesRef.current };
    delete nextValues[optionId];
    optionValuesRef.current = nextValues;
    if (duplicateOptionIdSet.size > 0) {
      setDuplicateOptionIdSet(new Set());
    }
    if (error) setError('');
  };

  const handleClose = () => {
    resetDraft();
    onClose();
  };

  const handleSubmit = async () => {
    const trimmedQuestion = questionValueRef.current.trim();
    /** @type {Record<string, string[]>} */
    const duplicateBuckets = {};
    const normalizedOptions = options
      .map((option) => {
        const normalizedValue = String(optionValuesRef.current[option.id] || '').trim();
        if (normalizedValue) {
          const duplicateKey = normalizedValue.toLowerCase();
          duplicateBuckets[duplicateKey] = [...(duplicateBuckets[duplicateKey] || []), option.id];
        }
        return normalizedValue;
      })
      .filter((value) => value.length > 0);

    const duplicateIds = new Set();
    Object.values(duplicateBuckets).forEach((ids) => {
      if (ids.length <= 1) return;
      ids.forEach((id) => duplicateIds.add(id));
    });

    if (!trimmedQuestion) {
      setChampEnErreur('question');
      setError(t(
        'conversation.poll.errors.questionRequired',
        'Ajoute une question pour ton sondage.',
      ));
      return;
    }

    if (normalizedOptions.length < MIN_OPTIONS) {
      setChampEnErreur('options');
      setError(t('conversation.poll.errors.minOptions', 'Ajoute au moins deux options.'));
      return;
    }

    if (duplicateIds.size > 0) {
      setDuplicateOptionIdSet(duplicateIds);
      setChampEnErreur('options');
      setError(t(
        'conversation.poll.errors.duplicateOptions',
        'Chaque option doit être differente.',
      ));
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit({
        allowMultipleVotes,
        isAnonymous,
        options: normalizedOptions,
        question: trimmedQuestion,
      });
    } catch (submitError) {
      setChampEnErreur('');
      setError(
        submitError?.message
        || t('conversation.poll.errors.createFailed', 'Impossible de créer ce sondage.'),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const reglages = [
    {
      aide: t(
        'conversation.poll.form.allowMultipleVotesHint',
        'Active cette option pour permettre a chacun de voter pour plusieurs réponses.',
      ),
      allume: allowMultipleVotes,
      basculer: () => setAllowMultipleVotes((value) => !value),
      cle: 'multiple',
      libelleAccessible: t(
        'conversation.poll.form.allowMultipleVotesA11y',
        'Autoriser plusieurs votes',
      ),
      titre: t('conversation.poll.form.allowMultipleVotes', 'Autoriser plusieurs votes'),
    },
    {
      aide: isAnonymous
        ? t(
          'conversation.poll.form.isAnonymousEnabledHint',
          'Les votes restent anonymes pour les autres membres.',
        )
        : t(
          'conversation.poll.form.isAnonymousDisabledHint',
          'Les membres pourront voir qui a vote pour chaque option.',
        ),
      allume: isAnonymous,
      basculer: () => setIsAnonymous((value) => !value),
      cle: 'anonyme',
      libelleAccessible: t('conversation.poll.form.isAnonymousA11y', 'Sondage anonyme'),
      titre: t('conversation.poll.form.isAnonymous', 'Sondage anonyme'),
    },
  ];

  // 🖥️ SMF (T20, SITE_M04) — SUR LE SITE, la fenetre suit la regle du systeme de design : la
  // croix et le titre en tete FIXE, « Envoyer le sondage » dans un pied FIXE (il etait sous le
  // pli d un ecran de 900 px), un clic sur le voile ferme (Echap : Conversation.web.js), et
  // l erreur s affiche sous le champ qu elle concerne. Le telephone ne change pas.
  const surLeSite = Platform.OS === 'web';
  let lieuDeLErreur = '';
  if (error) lieuDeLErreur = surLeSite && champEnErreur ? champEnErreur : 'pied';
  const styleDErreurSousLeChamp = [Fonts.p3, { color: Colors.chatDanger }];

  // MSG1A (§3.4) — en-tete du pack : fermer (rond de 36) a gauche, titre 18, sous-titre.
  const enTete = (
    <View style={[stylesDuPack.enTete, surLeSite ? null : Spaces.marginBottom[8]]}>
      <TouchableOpacity
        accessibilityLabel={t('common.close', 'Fermer')}
        accessibilityRole="button"
        onPress={handleClose}
        style={[stylesDuPack.fermer, { backgroundColor: withAlpha(Colors.neutral00, 0.08) }]}
        testID="sondage-fermer"
      >
        <GlyphIcon color={Colors.neutral00} name="xmark" size={18} />
      </TouchableOpacity>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[stylesDuPack.titre, { color: Colors.neutral00 }]}>
          {t('conversation.attachments.createPoll', 'Créer un sondage')}
        </Text>
        <Text style={[stylesDuPack.sousTitre, { color: withAlpha(Colors.neutral00, 0.6) }]}>
          {t(
            'conversation.poll.form.subtitle',
            'Pose une question, ajoute des options et lance le vote.',
          )}
        </Text>
      </View>
    </View>
  );
  const erreurDuPied = lieuDeLErreur === 'pied' ? (
    <Text
      accessibilityLiveRegion="polite"
      style={[
        Fonts.p3,
        { color: Colors.chatDanger, textAlign: 'center' },
        surLeSite ? Spaces.marginBottom[12] : null,
      ]}
    >
      {error}
    </Text>
  ) : null;
  const boutonEnvoyer = (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ busy: isSubmitting, disabled: isSubmitting }}
      disabled={isSubmitting}
      onPress={handleSubmit}
      style={[stylesDuPack.boutonEnvoyer, { backgroundColor: Colors.primary500 }]}
    >
      {isSubmitting ? (
        <ActivityIndicator color={Colors.primary900} />
      ) : (
        <Text style={[stylesDuPack.boutonEnvoyerTexte, { color: Colors.primary900 }]}>
          {t('conversation.poll.form.submit', 'Envoyer le sondage')}
        </Text>
      )}
    </TouchableOpacity>
  );

  return (
    <BottomModal
      close={handleClose}
      closeOnBackdropPress={surLeSite}
      contentContainerStyle={modalContentContainerStyle}
      enableContentPanningGesture={false}
      enablePanDownToClose={false}
      footerComponent={surLeSite ? (
        <>
          {erreurDuPied}
          {boutonEnvoyer}
        </>
      ) : undefined}
      headerComponent={surLeSite ? enTete : undefined}
      isVisible={isVisible}
      keyboardBehavior="interactive"
      scrollViewProps={MODAL_SCROLL_VIEW_PROPS}
      snapPoints={POLL_SNAP_POINTS}
      // MSG1A — demande de MESSAGERIE-1W : sur le site, une fenetre centree plutot qu'une
      // feuille pleine largeur. Le telephone ignore ce reglage (BottomModal.js).
      webPresentation="dialog"
    >
      {surLeSite ? null : enTete}

      <QuestionInputField
        Alignments={Alignments}
        Colors={Colors}
        cursorColor={Colors.primary500}
        Fonts={Fonts}
        key={`poll-question-${draftKey}`}
        onValueChange={handleQuestionChange}
        placeholder={t(
          'conversation.poll.form.questionPlaceholder',
          'Ex: Quel créneau te convient ?',
        )}
        placeholderTextColor={Colors.neutral400}
        selectionColor={Colors.primary500}
        Spaces={Spaces}
        style={inputStyle}
      />
      {lieuDeLErreur === 'question' ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[...styleDErreurSousLeChamp, { marginTop: -12 }]}
        >
          {error}
        </Text>
      ) : null}

      <View style={[Spaces.gap[12], Spaces.marginBottom[8]]}>
        <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter]}>
          <Text style={[stylesDuPack.etiquette, { color: withAlpha(Colors.neutral00, 0.6) }]}>
            {t('conversation.poll.form.optionsLabel', 'Options')}
          </Text>
          <Text
            style={[
              stylesDuPack.etiquette,
              { color: withAlpha(Colors.neutral00, 0.6), letterSpacing: 0 },
            ]}
          >
            {options.length}
            /
            {MAX_OPTIONS}
          </Text>
        </View>

        {options.map((optionEntry, index) => {
          const hasDuplicate = duplicateOptionIdSet.has(optionEntry.id);
          const optionInputStyle = [
            ...inputStyle,
            {
              borderColor: hasDuplicate ? Colors.chatDanger : Colors.primary700,
              flex: 1,
              minHeight: 46,
              paddingVertical: 9,
            },
          ];

          return (
            <OptionInputRow
              canRemove={options.length > MIN_OPTIONS}
              Colors={Colors}
              cursorColor={Colors.primary500}
              Fonts={Fonts}
              hasDuplicate={hasDuplicate}
              Images={Images}
              key={`poll-option-${draftKey}-${optionEntry.id}`}
              onRemove={() => handleRemoveOption(optionEntry.id)}
              onValueChange={(value) => handleChangeOption(optionEntry.id, value)}
              placeholder={t('conversation.poll.form.optionPlaceholder', {
                defaultValue: 'Option {{index}}',
                index: index + 1,
              })}
              placeholderTextColor={Colors.neutral400}
              removeAccessibilityLabel={t('conversation.poll.form.removeOptionA11y', {
                defaultValue: 'Supprimer l option {{index}}',
                index: index + 1,
              })}
              selectionColor={Colors.primary500}
              Spaces={Spaces}
              style={optionInputStyle}
            />
          );
        })}
        {lieuDeLErreur === 'options' ? (
          <Text accessibilityLiveRegion="polite" style={styleDErreurSousLeChamp}>{error}</Text>
        ) : null}

        {/* « + Ajouter une option » : un lien cyan, tant qu'on n'est pas a 6. */}
        {options.length < MAX_OPTIONS ? (
          <TouchableOpacity
            accessibilityLabel={t('conversation.poll.form.addOptionA11y', 'Ajouter une option')}
            accessibilityRole="button"
            hitSlop={8}
            onPress={handleAddOption}
            style={{ alignSelf: 'flex-start', paddingVertical: 6 }}
          >
            <Text style={[stylesDuPack.reglageTitre, { color: Colors.primary500 }]}>
              {t('conversation.poll.form.addOption', '+ Ajouter une option')}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Les deux reglages, dans une carte : titre, aide, interrupteur. */}
      <View style={[stylesDuPack.carteDesReglages, { backgroundColor: Colors.primary700 }]}>
        {reglages.map((reglage, index) => (
          <TouchableOpacity
            accessibilityLabel={reglage.libelleAccessible}
            accessibilityRole="switch"
            accessibilityState={{ checked: reglage.allume }}
            activeOpacity={0.85}
            key={reglage.cle}
            onPress={reglage.basculer}
            style={[
              stylesDuPack.reglage,
              index > 0
                ? { borderTopColor: withAlpha(Colors.neutral00, 0.08), borderTopWidth: 1 }
                : null,
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[stylesDuPack.reglageTitre, { color: Colors.neutral00 }]}>
                {reglage.titre}
              </Text>
              <Text style={[stylesDuPack.reglageAide, { color: withAlpha(Colors.neutral00, 0.6) }]}>
                {reglage.aide}
              </Text>
            </View>
            <InterrupteurDuPack allume={reglage.allume} Colors={Colors} />
          </TouchableOpacity>
        ))}
      </View>

      {surLeSite ? null : erreurDuPied}
      {surLeSite ? null : <View style={Spaces.paddingTop[8]}>{boutonEnvoyer}</View>}
    </BottomModal>
  );
}

export default PollCreationModal;
