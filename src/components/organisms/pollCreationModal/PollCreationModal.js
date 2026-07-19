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
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;
const POLL_SNAP_POINTS = ['84%'];
const MODAL_SCROLL_VIEW_PROPS = { keyboardDismissMode: 'none' };

/**
 * Question input isolated from the modal state to avoid rerendering the whole sheet on each keystroke.
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
  Fonts,
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
        <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>
          Question
        </Text>
        <Text style={[Fonts.p4, { color: Colors.neutral300 }]}>
          {questionLength}
          /140
        </Text>
      </View>
      <TextInput
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
  Images,
  onRemove,
  onValueChange,
  placeholder,
  placeholderTextColor,
  removeAccessibilityLabel,
  selectionColor,
  Spaces,
  style,
}) => {
  const [value, setValue] = useState('');

  return (
    <View style={Spaces.gap[4]}>
      <View style={{ alignItems: 'center', flexDirection: 'row' }}>
        <TextInput
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
            onPress={onRemove}
            style={[Spaces.marginLeft[8], {
              alignItems: 'center',
              backgroundColor: 'rgba(244,67,54,0.16)',
              borderRadius: 12,
              height: 44,
              justifyContent: 'center',
              width: 44,
            }]}
          >
            <Image
              source={Images.trashAlt}
              style={{
                height: 16,
                tintColor: Colors.error500,
                width: 16,
              }}
            />
          </TouchableOpacity>
        ) : null}
      </View>
      {hasDuplicate ? (
        <Text style={[Fonts.p4, { color: Colors.error500 }]}>
          Cette option est déjà utilisée.
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
    Fonts.p2,
    {
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderColor: 'rgba(255,255,255,0.16)',
      borderRadius: 12,
      borderWidth: 1,
      color: Colors.neutral00,
      minHeight: 52,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
  ]), [Colors.neutral00, Fonts.p2]);
  const modalContentContainerStyle = useMemo(
    () => [Spaces.gap[16], { paddingBottom: 24, paddingTop: 18 }],
    [Spaces],
  );
  const handleQuestionChange = useCallback((value) => {
    questionValueRef.current = value;
    if (error) setError('');
  }, [error]);

  const handleChangeOption = useCallback((/** @type {string} */ optionId, /** @type {string} */ value) => {
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
      setError(t('conversation.poll.errors.questionRequired', 'Ajoute une question pour ton sondage.'));
      return;
    }

    if (normalizedOptions.length < MIN_OPTIONS) {
      setError(t('conversation.poll.errors.minOptions', 'Ajoute au moins deux options.'));
      return;
    }

    if (duplicateIds.size > 0) {
      setDuplicateOptionIdSet(duplicateIds);
      setError(t('conversation.poll.errors.duplicateOptions', 'Chaque option doit être differente.'));
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
      setError(
        submitError?.message
        || t('conversation.poll.errors.createFailed', 'Impossible de créer ce sondage.'),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <BottomModal
      androidKeyboardInputMode="adjustResize"
      close={handleClose}
      closeOnBackdropPress={false}
      contentContainerStyle={modalContentContainerStyle}
      enableContentPanningGesture={false}
      enablePanDownToClose={false}
      isVisible={isVisible}
      keyboardBehavior="interactive"
      scrollViewProps={MODAL_SCROLL_VIEW_PROPS}
      snapPoints={POLL_SNAP_POINTS}
    >
      <View style={[Spaces.gap[8], Spaces.marginBottom[12]]}>
        <Text style={[Fonts.h3, { color: Colors.primary500, textAlign: 'center' }]}>
          {t('conversation.attachments.createPoll', 'Créer un sondage')}
        </Text>
        <Text style={[Fonts.p3, { color: Colors.neutral300, textAlign: 'center' }]}>
          {t(
            'conversation.poll.form.subtitle',
            'Pose une question, ajoute des options et lance le vote.',
          )}
        </Text>
      </View>

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

      <View style={[Spaces.gap[12], Spaces.marginBottom[8]]}>
        <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter]}>
          <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>
            {t('conversation.poll.form.optionsLabel', 'Options')}
          </Text>
          <Text style={[Fonts.p4, { color: Colors.neutral300 }]}>
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
              borderColor: hasDuplicate ? Colors.error500 : 'rgba(255,255,255,0.16)',
              flex: 1,
              minHeight: 48,
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

        <TouchableOpacity
          accessibilityLabel={t('conversation.poll.form.addOptionA11y', 'Ajouter une option')}
          accessibilityRole="button"
          accessibilityState={{ disabled: options.length >= MAX_OPTIONS }}
          disabled={options.length >= MAX_OPTIONS}
          onPress={handleAddOption}
          style={{
            alignItems: 'center',
            borderColor: options.length >= MAX_OPTIONS
              ? 'rgba(255,255,255,0.14)'
              : Colors.primary500,
            borderRadius: 10,
            borderWidth: 1,
            justifyContent: 'center',
            minHeight: 44,
            opacity: options.length >= MAX_OPTIONS ? 0.5 : 1,
          }}
        >
          <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>
            {t('conversation.poll.form.addOption', '+ Ajouter une option')}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={[Spaces.gap[8], Spaces.marginTop[8]]}>
        <TouchableOpacity
          accessibilityLabel={t(
            'conversation.poll.form.allowMultipleVotesA11y',
            'Autoriser plusieurs votes',
          )}
          accessibilityRole="switch"
          accessibilityState={{ checked: allowMultipleVotes }}
          onPress={() => setAllowMultipleVotes((value) => !value)}
          style={{
            alignItems: 'center',
            backgroundColor: 'rgba(255,255,255,0.05)',
            borderColor: allowMultipleVotes ? Colors.primary500 : 'rgba(255,255,255,0.16)',
            borderRadius: 12,
            borderWidth: 1,
            flexDirection: 'row',
            justifyContent: 'space-between',
            minHeight: 52,
            paddingHorizontal: 12,
          }}
        >
          <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>
            {t('conversation.poll.form.allowMultipleVotes', 'Autoriser plusieurs votes')}
          </Text>
          <View style={{
            alignItems: 'center',
            backgroundColor: allowMultipleVotes ? Colors.primary500 : 'transparent',
            borderColor: allowMultipleVotes ? Colors.primary500 : Colors.neutral400,
            borderRadius: 10,
            borderWidth: 2,
            height: 20,
            justifyContent: 'center',
            width: 20,
          }}
          >
            {allowMultipleVotes ? (
              <Image
                source={Images.check}
                style={{
                  height: 10,
                  tintColor: Colors.neutral00,
                  width: 10,
                }}
              />
            ) : null}
          </View>
        </TouchableOpacity>
        <Text style={[Fonts.p4, Fonts.neutral300]}>
          {t(
            'conversation.poll.form.allowMultipleVotesHint',
            'Active cette option pour permettre a chacun de voter pour plusieurs réponses.',
          )}
        </Text>
      </View>

      <View style={[Spaces.gap[8], Spaces.marginTop[4]]}>
        <TouchableOpacity
          accessibilityLabel={t('conversation.poll.form.isAnonymousA11y', 'Sondage anonyme')}
          accessibilityRole="switch"
          accessibilityState={{ checked: isAnonymous }}
          onPress={() => setIsAnonymous((value) => !value)}
          style={{
            alignItems: 'center',
            backgroundColor: 'rgba(255,255,255,0.05)',
            borderColor: isAnonymous ? Colors.primary500 : 'rgba(255,255,255,0.16)',
            borderRadius: 12,
            borderWidth: 1,
            flexDirection: 'row',
            justifyContent: 'space-between',
            minHeight: 52,
            paddingHorizontal: 12,
          }}
        >
          <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>
            {t('conversation.poll.form.isAnonymous', 'Sondage anonyme')}
          </Text>
          <View style={{
            alignItems: 'center',
            backgroundColor: isAnonymous ? Colors.primary500 : 'transparent',
            borderColor: isAnonymous ? Colors.primary500 : Colors.neutral400,
            borderRadius: 10,
            borderWidth: 2,
            height: 20,
            justifyContent: 'center',
            width: 20,
          }}
          >
            {isAnonymous ? (
              <Image
                source={Images.check}
                style={{
                  height: 10,
                  tintColor: Colors.neutral00,
                  width: 10,
                }}
              />
            ) : null}
          </View>
        </TouchableOpacity>
        <Text style={[Fonts.p4, Fonts.neutral300]}>
          {isAnonymous
            ? t(
              'conversation.poll.form.isAnonymousEnabledHint',
              'Les votes restent anonymes pour les autres membres.',
            )
            : t(
              'conversation.poll.form.isAnonymousDisabledHint',
              'Les membres pourront voir qui a vote pour chaque option.',
            )}
        </Text>
      </View>

      {error ? <Text style={[Fonts.p3, { color: Colors.error500 }]}>{error}</Text> : null}

      <View style={[Spaces.gap[12], Spaces.paddingTop[8]]}>
        <Button
          disabled={isSubmitting}
          isLoading={isSubmitting}
          onPress={handleSubmit}
          title={t('conversation.poll.form.submit', 'Envoyer le sondage')}
          variant="PrimaryLight"
        />
        <Button
          onPress={handleClose}
          title={t('common.actions.cancel', 'Annuler')}
          variant="SecondaryLight"
        />
      </View>
    </BottomModal>
  );
}

export default PollCreationModal;
