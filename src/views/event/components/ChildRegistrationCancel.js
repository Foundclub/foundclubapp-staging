import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { cancelSituation } from '@/domains/participation/childRegistrationFlow';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Icone from '@/components/atoms/SvgIcon/SvgIcon';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';

import {
  useCancelChildRegistration,
} from '@/services/eventChildRegistration/eventChildRegistrationQueries';

/**
 * 👪 PAR-L11c (14/10) — « ANNULER L INSCRIPTION » D UN ENFANT A UN EVENEMENT (PAR-012).
 *
 * Le meme motif que l annulation d une demande de place (PAR-L8, design parent E19,
 * planche 8) : un lien rouge sous la ligne, une FEUILLE de confirmation qui nomme l enfant ET
 * l evenement (jamais une fenetre systeme : sur le site, `Alert` devient `window.confirm`),
 * puis l issue dans un bandeau. Sert sous l evenement (EventChildRegistration) et sur la fiche
 * de l enfant (bloc « Ses evenements », DeclaredChildPage).
 * Les issues (`cancelSituation`) : annulee · n existe plus · serveur d avant · echec.
 * Temoins : __tests__/EventChildRegistration.PARL11C.test.js,
 * profile/parent/__tests__/DeclaredChildPage.PARL11C.test.js.
 */

const PREFIX = 'childEventRegistration.cancel';

/**
 * L etat d une annulation : la ligne dont la feuille est ouverte, puis l issue.
 * @returns {{
 *   ask: (registration: any) => void, close: () => void,
 *   confirm: (registration: any) => void, outcome: any, pendingId: string,
 *   retry: () => void, toCancel: any,
 * }} Les gestes et l etat.
 */
export function useChildRegistrationCancel() {
  const { isPending, mutate, variables } = /** @type {any} */ (useCancelChildRegistration());
  const [toCancel, setToCancel] = useState(/** @type {any} */ (null));
  const [outcome, setOutcome] = useState(/** @type {any} */ (null));

  const close = useCallback(() => setToCancel(null), []);
  const confirm = useCallback((/** @type {any} */ registration) => {
    setToCancel(null);
    setOutcome(null);
    const conclude = (/** @type {string} */ situation) => setOutcome({ registration, situation });
    mutate(registration, {
      onError: (/** @type {any} */ error) => conclude(cancelSituation(error)),
      onSuccess: () => conclude('done'),
    });
  }, [mutate]);
  const retry = useCallback(() => confirm(outcome?.registration), [confirm, outcome]);

  return {
    ask: setToCancel,
    close,
    confirm,
    outcome,
    pendingId: isPending ? String(variables?.documentId || '') : '',
    retry,
    toCancel,
  };
}

/**
 * Le lien rouge « Annuler l inscription » (44 px de haut au moins).
 * @param {object} props - Les proprietes.
 * @param {boolean} [props.disabled] - Eteint (l annulation de cette ligne est partie).
 * @param {string} props.firstname - L enfant, pour le lecteur d ecran.
 * @param {() => void} props.onPress - Ouvre la feuille.
 * @param {string} props.testID - L etiquette de test.
 * @returns {import('react').ReactElement} Le lien.
 */
export function ChildRegistrationCancelLink({
  disabled = false, firstname, onPress, testID,
}) {
  const { t } = useTranslation();
  const { Colors, Fonts } = useTheme();
  return (
    <TouchableOpacity
      accessibilityLabel={t(`${PREFIX}.linkLabel`, { firstname, ...SANS_ECHAPPEMENT })}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={{ alignSelf: 'flex-start', justifyContent: 'center', minHeight: 44 }}
      testID={testID}
    >
      <Text style={[Fonts.p2Bold, { color: Colors.error300 }]}>{t(`${PREFIX}.link`)}</Text>
    </TouchableOpacity>
  );
}

/**
 * La feuille « Annuler l inscription pour Anissa ? » : elle nomme l enfant et l evenement,
 * puis « Annuler l inscription » (Danger) et « Garder l inscription » (Ghost).
 * @param {object} props - Les proprietes.
 * @param {string} props.eventName - Le nom de l evenement.
 * @param {() => void} props.onClose - « Garder l inscription ».
 * @param {(registration: any) => void} props.onConfirm - « Annuler l inscription ».
 * @param {any|null} props.registration - La ligne ; rien = fermee.
 * @returns {import('react').ReactElement} La feuille.
 */
export function ChildRegistrationCancelSheet({
  eventName, onClose, onConfirm, registration,
}) {
  const { t } = useTranslation();
  const { Fonts } = useTheme();
  const values = {
    event: eventName,
    firstname: String(registration?.child?.firstname || '').trim(),
    ...SANS_ECHAPPEMENT,
  };
  return (
    <BottomModal
      close={onClose}
      footerComponent={(
        <View style={{ gap: 8 }}>
          <Button
            onPress={() => onConfirm(registration)}
            title={t(`${PREFIX}.confirm`)}
            variant="Danger"
          />
          <Button onPress={onClose} title={t(`${PREFIX}.keep`)} variant="Ghost" />
        </View>
      )}
      isVisible={Boolean(registration)}
    >
      <View style={{ gap: 4 }} testID="child-registration-cancel-sheet">
        <Text style={[Fonts.h4Bold, Fonts.neutral00]}>{t(`${PREFIX}.confirmTitle`, values)}</Text>
        <Text style={[Fonts.p2, Fonts.neutral200]}>{t(`${PREFIX}.confirmMessage`, values)}</Text>
      </View>
    </BottomModal>
  );
}

/**
 * Chaque issue : son ton et son icone.
 * @type {Record<string, { icon: string, tone: 'error'|'info'|'ok' }>}
 */
const OUTCOMES = {
  done: { icon: 'check', tone: 'ok' },
  failed: { icon: '', tone: 'error' },
  gone: { icon: '', tone: 'info' },
  unavailable: { icon: '', tone: 'info' },
};

/**
 * Le bandeau de l issue : « Inscription annulée. » (vert), « Cette inscription n existe
 * plus. », « L annulation n est pas encore disponible. », ou l echec avec « Réessayer » (rouge).
 * @param {object} props - Les proprietes.
 * @param {() => void} [props.onRetry] - « Réessayer » (l echec seulement).
 * @param {{ registration: any, situation: string }|null} props.outcome - La derniere issue.
 * @returns {import('react').ReactElement|null} Le bandeau, ou rien.
 */
export function ChildRegistrationCancelBanner({ onRetry = undefined, outcome }) {
  const { t } = useTranslation();
  const { Colors, Fonts } = useTheme();
  const issue = outcome ? OUTCOMES[outcome.situation] : null;
  if (!issue) return null;
  const ink = {
    error: Colors.error500,
    info: Colors.primary500,
    ok: Colors.success500,
  }[issue.tone];
  const values = {
    firstname: String(outcome?.registration?.child?.firstname || '').trim(),
    ...SANS_ECHAPPEMENT,
  };
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        alignItems: 'center',
        backgroundColor: withAlpha(ink, 0.12),
        borderColor: withAlpha(ink, 0.45),
        borderRadius: 16,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 12,
        padding: 12,
      }}
      testID={`child-registration-cancel-banner-${outcome?.situation}`}
    >
      {issue.icon ? (
        <Icone color={Colors.success200} height={20} name={issue.icon} width={20} />
      ) : null}
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
          {t(`${PREFIX}.${outcome?.situation}`, values)}
        </Text>
        <Text style={[Fonts.p3, Fonts.neutral100]}>
          {t(`${PREFIX}.${outcome?.situation}Hint`, values)}
        </Text>
        {issue.tone === 'error' && onRetry ? (
          <TouchableOpacity
            accessibilityRole="button"
            onPress={onRetry}
            style={{ alignSelf: 'flex-start', justifyContent: 'center', minHeight: 44 }}
            testID="child-registration-cancel-retry"
          >
            <Text style={[Fonts.p2Bold, { color: Colors.primary300 }]}>
              {t('errorWrapper.retry')}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}
