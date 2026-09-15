import i18next from 'i18next';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import InputStepper from '@/components/molecules/inputStepper/InputStepper';
import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';

// I18N-2 : des GETTERS, pas des textes — ce tableau est lu à l import, avant
// l initialisation d i18next ; le libellé se traduit au moment où il s affiche.
const TASK_TYPE_OPTIONS = [
  {
    get label() { return i18next.t('eventTasksEditor.typeCompanion', 'Accompagnateur'); },
    value: 'accompagnateur',
  },
  {
    get label() { return i18next.t('eventTasksEditor.typeTransport', 'Voiture / transport'); },
    value: 'transport',
  },
  {
    get label() { return i18next.t('eventTasksEditor.typeScoreTable', 'Table de marque'); },
    value: 'table_mark',
  },
  {
    get label() { return i18next.t('eventTasksEditor.typeRefereeing', 'Arbitrage'); },
    value: 'arbitrage',
  },
  {
    get label() { return i18next.t('eventTasksEditor.typeEquipment', 'Materiel'); },
    value: 'materiel',
  },
  {
    get label() { return i18next.t('eventTasksEditor.typeRefreshments', 'Buvette'); },
    value: 'buvette',
  },
  {
    get label() { return i18next.t('eventTasksEditor.typePhotos', 'Photos / videos'); },
    value: 'photos',
  },
  {
    get label() { return i18next.t('eventTasksEditor.typeKits', 'Responsable maillots'); },
    value: 'maillots',
  },
  {
    get label() { return i18next.t('eventTasksEditor.typeOther', 'Autre'); },
    value: 'other',
  },
];

const DEFAULT_TASK_TYPE = 'accompagnateur';

const getTaskTypeLabel = (type) => (
  TASK_TYPE_OPTIONS.find((option) => option.value === type)?.label || ''
);

const getSuggestedTaskTitle = (type, customLabel = '') => {
  if (type === 'other') {
    return String(customLabel || '').trim();
  }

  return getTaskTypeLabel(type);
};

const createNewTaskDraft = () => ({
  customLabel: '',
  description: '',
  requiredCount: 1,
  title: getSuggestedTaskTitle(DEFAULT_TASK_TYPE),
  type: DEFAULT_TASK_TYPE,
  validationMode: 'AUTO',
});

const getTaskKey = (task, index) => String(task?.documentId || task?.id || `${task?.type || 'task'}-${task?.title || index}`);

function EventTasksEditor({
  editable = true,
  onChange,
  value = [],
}) {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState(createNewTaskDraft);
  const [titleEditedManually, setTitleEditedManually] = useState(false);

  const tasks = useMemo(() => (Array.isArray(value) ? value : []), [value]);
  const canSave = Boolean(String(draft.title || '').trim());

  const resetDraft = () => {
    setDraft(createNewTaskDraft());
    setTitleEditedManually(false);
  };

  const closeModal = () => {
    resetDraft();
    setIsOpen(false);
  };

  const openModal = () => {
    resetDraft();
    setIsOpen(true);
  };

  const handleTaskTypeChange = (nextType) => {
    const previousSuggestedTitle = getSuggestedTaskTitle(draft.type, draft.customLabel);
    const nextSuggestedTitle = getSuggestedTaskTitle(nextType, draft.customLabel);
    const currentTitle = String(draft.title || '').trim();
    const shouldSyncTitle = !currentTitle || !titleEditedManually || currentTitle === previousSuggestedTitle;

    setDraft((current) => ({
      ...current,
      title: shouldSyncTitle ? nextSuggestedTitle : current.title,
      type: nextType,
    }));

    if (shouldSyncTitle) {
      setTitleEditedManually(false);
    }
  };

  const handleCustomLabelChange = (customLabel) => {
    const previousSuggestedTitle = getSuggestedTaskTitle(draft.type, draft.customLabel);
    const nextSuggestedTitle = getSuggestedTaskTitle(draft.type, customLabel);
    const currentTitle = String(draft.title || '').trim();
    const shouldSyncTitle = draft.type === 'other'
      && (!currentTitle || !titleEditedManually || currentTitle === previousSuggestedTitle);

    setDraft((current) => ({
      ...current,
      customLabel,
      title: shouldSyncTitle ? nextSuggestedTitle : current.title,
    }));

    if (shouldSyncTitle) {
      setTitleEditedManually(false);
    }
  };

  const handleTitleChange = (title) => {
    const suggestedTitle = getSuggestedTaskTitle(draft.type, draft.customLabel);
    setDraft((current) => ({ ...current, title }));
    setTitleEditedManually(String(title || '').trim() !== suggestedTitle);
  };

  const addTask = () => {
    const nextTask = {
      ...draft,
      customLabel: draft.type === 'other' ? String(draft.customLabel || '').trim() : null,
      description: String(draft.description || '').trim(),
      isActive: true,
      requiredCount: Math.max(1, Number(draft.requiredCount || 1)),
      title: String(draft.title || '').trim() || getSuggestedTaskTitle(draft.type, draft.customLabel),
      validationMode: draft.validationMode === 'MANUAL' ? 'MANUAL' : 'AUTO',
    };
    onChange?.([...tasks, nextTask]);
    closeModal();
  };

  const removeTask = (index) => {
    onChange?.(tasks.filter((_task, taskIndex) => taskIndex !== index));
  };

  return (
    <View style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[12], { backgroundColor: `${Colors.primary700}66` }]}>
      <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter]}>
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
          {t('eventTasksEditor.extraTasks', 'Tâches annexes')}
        </Text>
        {editable ? (
          <Button
            onPress={openModal}
            title={t(
              'eventTasksEditor.add',
              'Ajouter',
            )}
            variant="Secondary"
          />
        ) : null}
      </View>

      {tasks.length ? (
        <View style={Spaces.gap[12]}>
          {tasks.map((task, index) => (
            <View
              key={getTaskKey(task, index)}
              style={[
                ApplicationStyle.card,
                Spaces.padding[12],
                Spaces.gap[8],
                {
                  backgroundColor: `${Colors.primary800}A6`,
                  borderColor: `${Colors.primary500}44`,
                },
              ]}
            >
              <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter]}>
                <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
                  {task?.title || t(
                    'eventTasksEditor.task',
                    'Tache',
                  )}
                </Text>
                {editable ? (
                  <TouchableOpacity onPress={() => removeTask(index)}>
                    <Text style={[Fonts.p3Bold, Fonts.error500]}>
                      {t('eventTasksEditor.delete', 'Supprimer')}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                {task?.requiredCount || 1}
                {' place(s) - '}
                {task?.validationMode === 'MANUAL' ? t('eventTasksEditor.manualApproval', 'Validation manuelle') : t('eventTasksEditor.automaticApproval', 'Validation automatique')}
              </Text>
              {task?.description ? (
                <Text style={[Fonts.p3, Fonts.neutral300]}>{task.description}</Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : (
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {t('eventTasksEditor.noTaskYet', 'Aucune tâche pour le moment.')}
        </Text>
      )}

      {isOpen ? (
        <BottomModal
          close={closeModal}
          enableContentPanningGesture={false}
          enablePanDownToClose={false}
          isVisible
          scrollable={false}
          snapPoints={['78%']}
          webPresentation="dialog"
        >
          <View style={[Spaces.gap[16], Spaces.paddingBottom[24]]}>
            <Text style={[Fonts.h3, Fonts.neutral00]}>
              {t('eventTasksEditor.newTask', 'Nouvelle tâche')}
            </Text>

            <View style={Spaces.gap[8]}>
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                {t('eventTasksEditor.taskType', 'Type de tâche')}
              </Text>
              <SegmentedControl
                onChange={handleTaskTypeChange}
                options={TASK_TYPE_OPTIONS}
                value={draft.type}
              />
            </View>

            {draft.type === 'other' ? (
              <TextInput
                onChangeText={handleCustomLabelChange}
                placeholder={t('eventTasksEditor.typeName', 'Nom du type')}
                placeholderTextColor={Colors.neutral400}
                style={{
                  borderBottomColor: Colors.neutral200,
                  borderBottomWidth: 1,
                  color: Colors.neutral00,
                  paddingVertical: 10,
                }}
                value={draft.customLabel || ''}
              />
            ) : null}

            <View style={Spaces.gap[8]}>
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                {t('eventTasksEditor.displayedTitle', 'Titre affiche')}
              </Text>
              <TextInput
                onChangeText={handleTitleChange}
                placeholder={t('eventTasksEditor.title', 'Titre')}
                placeholderTextColor={Colors.neutral400}
                style={{
                  borderBottomColor: Colors.neutral200,
                  borderBottomWidth: 1,
                  color: Colors.neutral00,
                  paddingVertical: 10,
                }}
                value={draft.title}
              />
              <Text style={[Fonts.p4, Fonts.neutral300]}>
                {titleEditedManually
                  ? t('eventTasksEditor.customTitle', 'Titre personnalise.')
                  : t(
                    'eventTasksEditor.theTitleFillsInFrom',
                    'Le titre se remplit à partir du type choisi, puis tu peux le modifier.',
                  )}
              </Text>
            </View>

            <TextInput
              multiline
              onChangeText={(description) => setDraft((current) => ({ ...current, description }))}
              placeholder="Description"
              placeholderTextColor={Colors.neutral400}
              style={{
                borderBottomColor: Colors.neutral200,
                borderBottomWidth: 1,
                color: Colors.neutral00,
                minHeight: 72,
                paddingVertical: 10,
              }}
              value={draft.description}
            />

            <InputStepper
              label={t('eventTasksEditor.numberOfPeople', 'Nombre de personnes')}
              max={50}
              min={1}
              onDecrement={() => setDraft((current) => ({ ...current, requiredCount: Math.max(1, Number(current.requiredCount || 1) - 1) }))}
              onIncrement={() => setDraft((current) => ({ ...current, requiredCount: Math.min(50, Number(current.requiredCount || 1) + 1) }))}
              // D58 — pack §2.8 : le compteur de la fiche Tache prend le
              // registre du tunnel. « Fini le stepper blanc. »
              tone="tunnel"
              value={Number(draft.requiredCount || 1)}
            />

            <SegmentedControl
              onChange={(validationMode) => setDraft((current) => ({ ...current, validationMode }))}
              options={[
                { label: 'Auto', value: 'AUTO' },
                { label: t('eventTasksEditor.manual', 'Manuelle'), value: 'MANUAL' },
              ]}
              value={draft.validationMode}
            />

            <View style={[Alignments.row, Spaces.gap[8]]}>
              <Button onPress={closeModal} style={{ flex: 1 }} title={t('eventTasksEditor.cancel', 'Annuler')} variant="Secondary" />
              <Button
                disabled={!canSave}
                onPress={addTask}
                style={{ flex: 1 }}
                title={t(
                  'eventTasksEditor.add',
                  'Ajouter',
                )}
              />
            </View>
          </View>
        </BottomModal>
      ) : null}
    </View>
  );
}

export default EventTasksEditor;
