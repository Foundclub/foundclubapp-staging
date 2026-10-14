import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import {
  canCancelRegistration,
  describeChildChoices,
  errorKey,
  REFUSAL_REASON_MAX_LENGTH,
  resolveChildRegistrationOffer,
  resultLine,
  statusLine,
} from '@/domains/participation/childRegistrationFlow';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Checkable from '@/components/atoms/checkable/Checkable';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import Input from '@/components/molecules/input/Input';
import WizardOptionCard from '@/components/molecules/wizardOptionCard/WizardOptionCard';
import {
  ChildRegistrationCancelBanner,
  ChildRegistrationCancelLink,
  ChildRegistrationCancelSheet,
  useChildRegistrationCancel,
} from '@/views/event/components/ChildRegistrationCancel';

import { RouteNames } from '@/navigation/routeNames';

import { useGetMyDeclaredChildren } from '@/services/declaredChild/declaredChildQueries';
import {
  useDecideChildRegistration,
  useEventChildRegistrations,
  useMyChildRegistrations,
  useRegisterChildren,
} from '@/services/eventChildRegistration/eventChildRegistrationQueries';

/**
 * 👪 PAR-L11b (13/10) — « INSCRIRE MES ENFANTS » SUR UN EVENEMENT PUBLIC (PAR-012, D4 B).
 *
 * Le parent ne repond pas pour lui (`resolveParticipationOffer` rend `children`) : il coche
 * un ou plusieurs enfants, relit, envoie, et lit le resultat ENFANT PAR ENFANT. Sous
 * l evenement, il retrouve ensuite l etat de chacun (« en attente », « confirmee »,
 * « refusee : motif »). Tournoi, match amical, ferme : pas de bouton, une phrase qui dit
 * pourquoi. Le serveur reste juge ; l ecran ne fait que montrer (`childRegistrationFlow.js`).
 * PAR-L11c (14/10) : sous chaque ligne en attente ou confirmee, « Annuler l inscription »
 * (feuille + bandeau, `ChildRegistrationCancel.js`).
 *
 * ⚠️ Ce module charge des services : chaque temoin qui monte `EventDetails` le double
 * (EventDetails.js:123-128). Temoin : `__tests__/EventChildRegistration.PARL11.test.js`.
 */

/**
 * Ce que ce bloc lit des crochets react-query (leurs modules sont en `@ts-nocheck`).
 * @typedef {{ data?: any[], isError?: boolean, isFetching?: boolean,
 * refetch?: () => Promise<any> }} ListeLue
 * @typedef {{ isPending: boolean, mutateAsync: (variables: any) => Promise<any> }} GesteServeur
 */

const STEP_TITLES = {
  choose: 'childEventRegistration.sheet.title',
  recap: 'childEventRegistration.recap.title',
  result: 'childEventRegistration.result.title',
};

/**
 * Le style d une ligne selon son ton (palette inchangee, aucune couleur ecrite en dur).
 * @param {any} Fonts - Les styles de texte du theme.
 * @returns {Record<string, any>} Un style par ton.
 */
const toneStyles = (Fonts) => ({
  ok: Fonts.primary100,
  refused: Fonts.error300,
  waiting: Fonts.neutral100,
});

/**
 * Le rappel en tete de la feuille : « Detection / Seance d essai · U11 · 18/10/2026 ».
 * PAR-L11c (14/10) point 5 : la CATEGORIE de l equipe organisatrice, lue comme l en-tete de
 * l evenement (EventHeader.js) ; montree, jamais bloquante (design planche 9). Sans
 * categorie : « type · date », comme avant.
 * @param {any} event - L evenement.
 * @param {any} t - La traduction (TFunction d i18next, `any` comme ailleurs dans src/domains).
 * @returns {string} Le rappel.
 */
const eventReminder = (event, t) => {
  const start = event?.date ? new Date(event.date) : null;
  const date = start && Number.isFinite(start.getTime())
    ? start.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '';
  const category = String(event?.team?.category?.name || '').trim();
  return t(
    category
      ? 'childEventRegistration.sheet.reminderWithCategory'
      : 'childEventRegistration.sheet.reminder',
    {
      category,
      date,
      type: event?.type?.name || t('childEventRegistration.sheet.defaultType'),
      ...SANS_ECHAPPEMENT,
    },
  );
};

/**
 * Le bloc du parent : l etat de ses enfants, puis « Inscrire mes enfants » ou la phrase
 * qui dit pourquoi pas, et la feuille en trois temps (choix, recapitulatif, resultat).
 * @param {object} props - Les proprietes.
 * @param {any} props.event - L evenement.
 * @param {any} [props.navigation] - Pour « Ajouter un enfant ».
 * @param {number} [props.nowMs] - L instant (temoins).
 * @returns {import('react').ReactElement} Le bloc du parent.
 */
function EventChildRegistration({ event, navigation = null, nowMs = undefined }) {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Fonts, Spaces,
  } = useTheme();
  const tones = toneStyles(Fonts);
  const eventId = event?.documentId || '';
  const now = typeof nowMs === 'number' ? nowMs : Date.now();
  const offer = resolveChildRegistrationOffer(event, now);
  // Le nom dit dans la feuille d annulation : le sien, sinon son type.
  const eventName = String(event?.name || event?.type?.name || '').trim()
    || t('childEventRegistration.sheet.defaultType');
  const cancel = useChildRegistrationCancel();

  const { data: children = [] } = /** @type {ListeLue} */ (useGetMyDeclaredChildren());
  const { data: registrations = [] } = /** @type {ListeLue} */ (useMyChildRegistrations(eventId));
  const registerChildren = /** @type {GesteServeur} */ (useRegisterChildren(eventId));

  const [step, setStep] = useState(/** @type {null|'choose'|'recap'|'result'} */ (null));
  const [selected, setSelected] = useState(/** @type {string[]} */ ([]));
  const [acceptResponsibility, setAcceptResponsibility] = useState(false);
  const [acceptConditions, setAcceptConditions] = useState(false);
  const [results, setResults] = useState(/** @type {any[]} */ ([]));
  const [errorMessage, setErrorMessage] = useState('');

  const choices = useMemo(
    () => describeChildChoices(children, registrations),
    [children, registrations],
  );
  const chosen = choices.filter((choice) => selected.includes(choice.documentId));
  const canContinue = chosen.length > 0 && acceptResponsibility && acceptConditions;

  const open = useCallback(() => {
    setSelected([]);
    setAcceptResponsibility(false);
    setAcceptConditions(false);
    setResults([]);
    setErrorMessage('');
    setStep('choose');
  }, []);
  const close = useCallback(() => setStep(null), []);
  const toggle = useCallback((/** @type {string} */ documentId) => setSelected((previous) => (
    previous.includes(documentId)
      ? previous.filter((id) => id !== documentId)
      : [...previous, documentId]
  )), []);

  const send = useCallback(async () => {
    setErrorMessage('');
    try {
      const response = await registerChildren.mutateAsync(
        chosen.map((choice) => choice.documentId),
      );
      setResults(Array.isArray(response?.results) ? response.results : []);
      setStep('result');
    } catch (error) {
      setErrorMessage(t(errorKey(error)));
    }
  }, [chosen, registerChildren, t]);

  const childLabel = (/** @type {any} */ choice) => (typeof choice.age === 'number'
    ? t('childEventRegistration.sheet.childLine', {
      age: choice.age,
      firstname: choice.firstname,
      ...SANS_ECHAPPEMENT,
    })
    : choice.firstname);

  const checkableWrapperStyle = [
    ApplicationStyle.borderWidth0,
    ApplicationStyle.backgroundColor.transparent,
    Spaces.padding[0],
    Alignments.rowReverse,
    { flex: 0, width: '100%' },
  ];
  const cardStyle = [
    ApplicationStyle.borderRadius16,
    ApplicationStyle.borderWidth1,
    Spaces.padding[16],
    { marginBottom: 10 },
  ];

  const renderNoChild = () => (
    <View style={[Spaces.gap[12]]}>
      <Text style={[Fonts.p1, Fonts.neutral00]}>{t('childEventRegistration.sheet.noChild')}</Text>
      {navigation ? (
        <Button
          onPress={() => {
            close();
            navigation.navigate(RouteNames.MyChildren);
          }}
          title={t('childEventRegistration.actions.addChild')}
          variant="Secondary"
        />
      ) : null}
    </View>
  );

  const renderChoice = (/** @type {any} */ choice) => (choice.selectable ? (
    <WizardOptionCard
      key={choice.documentId}
      multi
      onPress={() => toggle(choice.documentId)}
      selected={selected.includes(choice.documentId)}
      title={childLabel(choice)}
    />
  ) : (
    <View
      key={choice.documentId}
      style={cardStyle}
      testID={`child-registration-unavailable-${choice.documentId}`}
    >
      <Text style={[Fonts.p1, Fonts.neutral00]}>{childLabel(choice)}</Text>
      <Text style={[Fonts.p3, Fonts.neutral100]}>
        {t(choice.reasonKey, { firstname: choice.firstname, ...SANS_ECHAPPEMENT })}
      </Text>
    </View>
  ));

  const renderChoose = () => (
    <View style={[Spaces.gap[16]]}>
      <Text style={[Fonts.p2, Fonts.neutral100]}>{eventReminder(event, t)}</Text>
      {choices.length === 0 ? renderNoChild() : <View>{choices.map(renderChoice)}</View>}
      <Text style={[Fonts.p2, Fonts.neutral00]}>
        {t('eventList.joinModal.description', {
          clubName: event?.club?.name || '',
          ...SANS_ECHAPPEMENT,
        })}
      </Text>
      <View style={[Spaces.gap[16]]}>
        <Checkable
          fontStyle={[Fonts.p2, Fonts.neutral00]}
          isChecked={acceptResponsibility}
          setIsChecked={() => setAcceptResponsibility((previous) => !previous)}
          text={t('eventList.joinModal.checkboxes.responsibility')}
          type="square"
          wrapperStyle={checkableWrapperStyle}
        />
        <Checkable
          fontStyle={[Fonts.p2, Fonts.neutral00]}
          isChecked={acceptConditions}
          setIsChecked={() => setAcceptConditions((previous) => !previous)}
          text={t('eventList.joinModal.checkboxes.conditions')}
          type="square"
          wrapperStyle={checkableWrapperStyle}
        />
      </View>
    </View>
  );

  const recapNoteKey = offer.admission === 'immediate'
    ? 'childEventRegistration.recap.immediate'
    : 'childEventRegistration.recap.request';
  const renderRecap = () => (
    <View style={[Spaces.gap[12]]}>
      {chosen.map((choice) => (
        <Text key={choice.documentId} style={[Fonts.p1, Fonts.neutral00]}>
          {childLabel(choice)}
        </Text>
      ))}
      <Text style={[Fonts.p2, Fonts.primary100]}>{t(recapNoteKey)}</Text>
      {errorMessage ? (
        <Text style={[Fonts.p2Bold, Fonts.error300]}>{errorMessage}</Text>
      ) : null}
    </View>
  );

  const renderResult = () => (
    <View style={[Spaces.gap[12]]}>
      {results.map((result) => {
        const line = resultLine(result);
        return (
          <Text
            key={String(result?.child || line.params.firstname)}
            style={[Fonts.p1, tones[line.tone]]}
          >
            {t(line.key, { ...line.params, ...SANS_ECHAPPEMENT })}
          </Text>
        );
      })}
    </View>
  );

  const footers = {
    choose: (
      <View style={[Spaces.gap[12]]}>
        <Button
          disabled={!canContinue}
          onPress={() => setStep('recap')}
          title={t('childEventRegistration.actions.continue', { count: chosen.length })}
          variant="Primary"
        />
        <Button
          onPress={close}
          title={t('childEventRegistration.actions.cancel')}
          variant="Secondary"
        />
      </View>
    ),
    recap: (
      <View style={[Spaces.gap[12]]}>
        <Button
          isLoading={registerChildren.isPending}
          onPress={send}
          title={t('childEventRegistration.actions.send', { count: chosen.length })}
          variant="Primary"
        />
        <Button
          onPress={() => setStep('choose')}
          title={t('childEventRegistration.actions.back')}
          variant="Secondary"
        />
      </View>
    ),
    result: (
      <Button onPress={close} title={t('childEventRegistration.actions.close')} variant="Primary" />
    ),
  };

  return (
    <View style={[Spaces.gap[12]]} testID="child-registration-block">
      <ChildRegistrationCancelBanner onRetry={cancel.retry} outcome={cancel.outcome} />
      {registrations.map((registration) => {
        const line = statusLine(registration);
        return (
          <View key={registration.documentId}>
            <Text style={[Fonts.p2, tones[line.tone]]}>
              {t(line.key, { ...line.params, ...SANS_ECHAPPEMENT })}
            </Text>
            {canCancelRegistration(registration, now) ? (
              <ChildRegistrationCancelLink
                disabled={cancel.pendingId === registration.documentId}
                firstname={String(registration?.child?.firstname || '')}
                onPress={() => cancel.ask(registration)}
                testID={`child-registration-cancel-${registration.documentId}`}
              />
            ) : null}
          </View>
        );
      })}
      {offer.canAct ? (
        <Button
          onPress={open}
          title={t('childEventRegistration.actions.register')}
          variant="Primary"
        />
      ) : null}
      {!offer.canAct && offer.blockedKey ? (
        <Text style={[Fonts.p2, Fonts.neutral100]}>{t(offer.blockedKey)}</Text>
      ) : null}
      <BottomModal
        close={close}
        footerComponent={step ? footers[step] : null}
        headerComponent={(
          <Text style={[Fonts.p1Black, Fonts.neutral00, { textAlign: 'center' }]}>
            {step ? t(STEP_TITLES[step]) : ''}
          </Text>
        )}
        hideCloseButton
        isVisible={Boolean(step)}
        snapPoints={['90%']}
      >
        {step === 'choose' ? renderChoose() : null}
        {step === 'recap' ? renderRecap() : null}
        {step === 'result' ? renderResult() : null}
      </BottomModal>
      <ChildRegistrationCancelSheet
        eventName={eventName}
        onClose={cancel.close}
        onConfirm={cancel.confirm}
        registration={cancel.toCancel}
      />
    </View>
  );
}

/**
 * 👪 PAR-L11b — CHEZ L ORGANISATEUR : les enfants inscrits par leurs parents, « Anissa,
 * 9 ans » et « Parent : Maryline Monroe », jamais une coordonnee (registre des mineurs,
 * lignes 9, 17, 19). Une demande en attente s accepte ou se refuse ici ; le serveur recompte
 * la place. PAR-L11c (14/10) : le SITE la monte aussi (EventDetails.web.js) ; un refus du
 * serveur s ecrit donc sous la ligne, jamais par `Alert` (une fenetre systeme sur le site).
 * @param {object} props - Les proprietes.
 * @param {string} props.eventId - L evenement.
 * @returns {import('react').ReactElement|null} La liste, ou rien sans enfant inscrit.
 */
export function EventChildRegistrationsForOrganizer({ eventId }) {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Fonts, Spaces,
  } = useTheme();
  const {
    data, isError, isFetching, refetch,
  } = /** @type {ListeLue} */ (useEventChildRegistrations(eventId));
  const rows = Array.isArray(data) ? data : [];
  const decide = /** @type {GesteServeur} */ (useDecideChildRegistration(eventId));
  // La phrase du dernier refus du serveur, par ligne.
  const [errors, setErrors] = useState(/** @type {Record<string, string>} */ ({}));

  /** @typedef {{ decision: string, registrationId: string }} Decision */
  const run = useCallback(async (/** @type {Decision} */ variables) => {
    const id = variables.registrationId;
    setErrors(({ [id]: _old, ...others }) => others);
    try {
      await decide.mutateAsync(variables);
    } catch (error) {
      setErrors((previous) => ({ ...previous, [id]: t(errorKey(error)) }));
    }
  }, [decide, t]);

  // 👪 PAR-L11c (14/10) point 4 — « Refuser » ouvre une feuille : la ligne visee, le motif
  // saisi (facultatif, borne comme au serveur), et le refus du serveur, dit DANS la feuille
  // pour que le motif ne se perde pas.
  const [refusing, setRefusing] = useState(/** @type {any} */ (null));
  const [reason, setReason] = useState('');
  const [refuseError, setRefuseError] = useState('');
  const openRefuse = useCallback((/** @type {any} */ row) => {
    setReason('');
    setRefuseError('');
    setRefusing(row);
  }, []);
  const closeRefuse = useCallback(() => setRefusing(null), []);
  const confirmRefuse = useCallback(async () => {
    setRefuseError('');
    try {
      await decide.mutateAsync({
        decision: 'refuse',
        reason: reason.trim(),
        registrationId: refusing?.documentId,
      });
      setRefusing(null);
    } catch (error) {
      setRefuseError(t(errorKey(error)));
    }
  }, [decide, reason, refusing, t]);

  if (!isError && rows.length === 0) return null;

  const rowStyle = [
    ApplicationStyle.borderRadius16,
    ApplicationStyle.borderWidth1,
    Spaces.padding[16],
    Spaces.gap[8],
  ];

  const renderRow = (/** @type {any} */ row) => {
    const firstname = String(row?.child?.firstname || '');
    const age = row?.child?.age;
    const parentName = `${row?.parent?.firstname || ''} ${row?.parent?.lastname || ''}`.trim();
    return (
      <View
        key={row.documentId}
        style={rowStyle}
        testID={`child-registration-row-${row.documentId}`}
      >
        <Text style={[Fonts.p1, Fonts.neutral00]}>
          {typeof age === 'number'
            ? t('childEventRegistration.organizer.childLine', {
              age,
              firstname,
              ...SANS_ECHAPPEMENT,
            })
            : firstname}
        </Text>
        {parentName ? (
          <Text style={[Fonts.p3, Fonts.neutral100]}>
            {t('childEventRegistration.organizer.parentLine', {
              name: parentName,
              ...SANS_ECHAPPEMENT,
            })}
          </Text>
        ) : null}
        {row.status === 'pending' ? (
          <View style={[Alignments.row, Spaces.gap[12]]}>
            <Button
              isLoading={decide.isPending}
              onPress={() => run({ decision: 'accept', registrationId: row.documentId })}
              style={{ flex: 1 }}
              title={t('childEventRegistration.organizer.accept')}
              variant="Primary"
            />
            <Button
              onPress={() => openRefuse(row)}
              style={{ flex: 1 }}
              title={t('childEventRegistration.organizer.refuse')}
              variant="Secondary"
            />
          </View>
        ) : (
          <Text style={[Fonts.p2Bold, Fonts.primary100]}>
            {t('childEventRegistration.organizer.accepted')}
          </Text>
        )}
        {errors[row.documentId] ? (
          <Text
            accessibilityLiveRegion="polite"
            style={[Fonts.p2Bold, Fonts.error300]}
            testID={`child-registration-error-${row.documentId}`}
          >
            {errors[row.documentId]}
          </Text>
        ) : null}
      </View>
    );
  };

  return (
    <View style={[Spaces.gap[12], { marginTop: 16 }]} testID="child-registrations-organizer">
      <Text style={[Fonts.p1Black, Fonts.neutral00]}>
        {t('childEventRegistration.organizer.title')}
      </Text>
      {isError ? (
        <View style={[Spaces.gap[8]]}>
          <Text accessibilityLiveRegion="polite" style={[Fonts.p2, Fonts.error300]}>
            {t('childEventRegistration.organizer.loadError')}
          </Text>
          <Button
            isLoading={isFetching}
            onPress={() => { refetch?.(); }}
            title={t('childEventRegistration.organizer.retry')}
            variant="Secondary"
          />
        </View>
      ) : null}
      {rows.map(renderRow)}
      <BottomModal
        close={closeRefuse}
        footerComponent={(
          <View style={[Spaces.gap[8]]}>
            <Button
              isLoading={decide.isPending}
              onPress={confirmRefuse}
              title={t('childEventRegistration.organizer.refuseSheet.confirm')}
              variant="Danger"
            />
            <Button
              onPress={closeRefuse}
              title={t('childEventRegistration.actions.cancel')}
              variant="Ghost"
            />
          </View>
        )}
        isVisible={Boolean(refusing)}
      >
        <View style={[Spaces.gap[12]]} testID="child-registration-refuse-sheet">
          <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
            {t('childEventRegistration.organizer.refuseSheet.title', {
              firstname: String(refusing?.child?.firstname || ''),
              ...SANS_ECHAPPEMENT,
            })}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            {t('childEventRegistration.organizer.refuseSheet.hint')}
          </Text>
          <Input
            label={t('childEventRegistration.organizer.refuseSheet.label')}
            maxLength={REFUSAL_REASON_MAX_LENGTH}
            multiline
            onChangeText={setReason}
            placeholder={t('childEventRegistration.organizer.refuseSheet.placeholder')}
            value={reason}
          />
          {refuseError ? (
            <Text accessibilityLiveRegion="polite" style={[Fonts.p2Bold, Fonts.error300]}>
              {refuseError}
            </Text>
          ) : null}
        </View>
      </BottomModal>
    </View>
  );
}

export default EventChildRegistration;
