import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;

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
  const {
    Alignments,
    Colors,
    Fonts,
    Images,
    Spaces,
  } = useTheme();

  const [allowMultipleVotes, setAllowMultipleVotes] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [options, setOptions] = useState(() => getDefaultOptions());
  const [question, setQuestion] = useState('');

  const resetDraft = () => {
    setAllowMultipleVotes(false);
    setIsAnonymous(false);
    setError('');
    setIsSubmitting(false);
    setOptions(getDefaultOptions());
    setQuestion('');
  };

  useEffect(() => {
    if (!isVisible) return;
    resetDraft();
  }, [isVisible]);

  const normalizedOptions = useMemo(
    () => options
      .map((option) => option.value.trim())
      .filter((value) => value.length > 0),
    [options],
  );

  const duplicateOptionIdSet = useMemo(() => {
    /** @type {Record<string, string[]>} */
    const buckets = {};

    options.forEach((option) => {
      const normalized = option.value.trim().toLowerCase();
      if (!normalized) return;
      buckets[normalized] = [...(buckets[normalized] || []), option.id];
    });

    const duplicateIds = new Set();
    Object.values(buckets).forEach((ids) => {
      if (ids.length <= 1) return;
      ids.forEach((id) => duplicateIds.add(id));
    });

    return duplicateIds;
  }, [options]);

  const questionLength = question.trim().length;

  const canSubmit = useMemo(() => {
    if (question.trim().length === 0) return false;
    if (normalizedOptions.length < MIN_OPTIONS) return false;
    const uniqueCount = new Set(normalizedOptions.map((value) => value.toLowerCase())).size;
    return uniqueCount === normalizedOptions.length;
  }, [question, normalizedOptions]);

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

  const handleChangeOption = (/** @type {string} */ optionId, /** @type {string} */ value) => {
    setOptions((prev) => prev.map((entry) => (
      entry.id === optionId ? { ...entry, value } : entry
    )));
    setError('');
  };

  const handleAddOption = () => {
    setOptions((prev) => (prev.length >= MAX_OPTIONS ? prev : [...prev, createDraftOption()]));
  };

  const handleRemoveOption = (/** @type {string} */ optionId) => {
    setOptions((prev) => {
      if (prev.length <= MIN_OPTIONS) return prev;
      return prev.filter((entry) => entry.id !== optionId);
    });
    setError('');
  };

  const handleClose = () => {
    resetDraft();
    onClose();
  };

  const handleSubmit = async () => {
    const trimmedQuestion = question.trim();
    const uniqueCount = new Set(normalizedOptions.map((value) => value.toLowerCase())).size;

    if (!trimmedQuestion) {
      setError('Ajoute une question pour ton sondage.');
      return;
    }

    if (normalizedOptions.length < MIN_OPTIONS) {
      setError('Ajoute au moins deux options.');
      return;
    }

    if (uniqueCount !== normalizedOptions.length) {
      setError('Chaque option doit être differente.');
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
      handleClose();
    } catch (submitError) {
      setError(submitError?.message || 'Impossible de créer ce sondage.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <BottomModal
      androidKeyboardInputMode="adjustResize"
      close={handleClose}
      closeOnBackdropPress={false}
      contentContainerStyle={[Spaces.gap[16], { paddingBottom: 20 }]}
      enableContentPanningGesture={false}
      enablePanDownToClose={false}
      isVisible={isVisible}
      keyboardBehavior="interactive"
      scrollViewProps={{ keyboardDismissMode: 'none' }}
      snapPoints={['86%']}
    >
      <View style={[Spaces.gap[8], Spaces.marginBottom[12]]}>
        <Text style={[Fonts.h3, { color: Colors.primary500, textAlign: 'center' }]}>
          Créer un sondage
        </Text>
        <Text style={[Fonts.p3, { color: Colors.neutral300, textAlign: 'center' }]}>
          Pose une question, ajoute des options et lance le vote.
        </Text>
      </View>

      <View style={[Spaces.gap[8], Spaces.marginBottom[4]]}>
        <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter]}>
          <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>Question</Text>
          <Text style={[Fonts.p4, { color: Colors.neutral300 }]}>
            {questionLength}
            /140
          </Text>
        </View>
        <BottomSheetTextInput
          autoCorrect={false}
          maxLength={140}
          onChangeText={(value) => {
            setQuestion(value);
            setError('');
          }}
          placeholder="Ex: Quel créneau vous convient ?"
          placeholderTextColor={Colors.neutral400}
          style={inputStyle}
          value={question}
        />
      </View>

      <View style={[Spaces.gap[12], Spaces.marginBottom[8]]}>
        <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter]}>
          <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>Options</Text>
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
              minHeight: 48,
              paddingVertical: 9,
            },
          ];

          return (
            <View key={optionEntry.id} style={Spaces.gap[4]}>
              <View style={{ alignItems: 'center', flexDirection: 'row' }}>
                <BottomSheetTextInput
                  autoCorrect={false}
                  maxLength={80}
                  onChangeText={(value) => handleChangeOption(optionEntry.id, value)}
                  placeholder={`Option ${index + 1}`}
                  placeholderTextColor={Colors.neutral400}
                  style={optionInputStyle}
                  value={optionEntry.value}
                />
                {options.length > MIN_OPTIONS ? (
                  <TouchableOpacity
                    onPress={() => handleRemoveOption(optionEntry.id)}
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
                  Cette option est déjà utilisee.
                </Text>
              ) : null}
            </View>
          );
        })}

        <TouchableOpacity
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
          <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>+ Ajouter une option</Text>
        </TouchableOpacity>
      </View>

      <View style={[Spaces.gap[8], Spaces.marginTop[8]]}>
        <TouchableOpacity
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
          <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>Autoriser plusieurs votes</Text>
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
              <Text style={[Fonts.p4Bold, { color: Colors.neutral00 }]}>OK</Text>
            ) : null}
          </View>
        </TouchableOpacity>
        <Text style={[Fonts.p4, Fonts.neutral300]}>
          Active cette option pour permettre a chacun de voter pour plusieurs réponses.
        </Text>
      </View>

      <View style={[Spaces.gap[8], Spaces.marginTop[4]]}>
        <TouchableOpacity
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
          <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>Sondage anonyme</Text>
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
              <Text style={[Fonts.p4Bold, { color: Colors.neutral00 }]}>OK</Text>
            ) : null}
          </View>
        </TouchableOpacity>
        <Text style={[Fonts.p4, Fonts.neutral300]}>
          {isAnonymous
            ? 'Les votes restent anonymes pour les autres membres.'
            : 'Les membres pourront voir qui a vote pour chaque option.'}
        </Text>
      </View>

      {error ? <Text style={[Fonts.p3, { color: Colors.error500 }]}>{error}</Text> : null}

      <View style={Spaces.gap[12]}>
        <Button
          disabled={!canSubmit || isSubmitting}
          isLoading={isSubmitting}
          onPress={handleSubmit}
          title="Envoyer le sondage"
          variant="PrimaryLight"
        />
        <Button
          onPress={handleClose}
          title="Annuler"
          variant="SecondaryLight"
        />
      </View>
    </BottomModal>
  );
}

export default PollCreationModal;
