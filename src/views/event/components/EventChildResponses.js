import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

import {
  useAnswerForChild,
  useChildEventResponsesForOrganizer,
  useMyChildEventResponses,
} from '@/services/eventChildResponse/eventChildResponseQueries';

/**
 * Display independent replies for this parent's member children.
 * @param {{ eventId: string }} props
 * @returns {import('react').ReactElement}
 */
export default function EventChildResponses({ eventId }) {
  const { t } = useTranslation();
  const { Alignments, Fonts, Spaces } = useTheme();
  const query = useMyChildEventResponses(eventId);
  const mutation = useAnswerForChild(eventId);
  const [errors, setErrors] = useState(/** @type {Record<string,string>} */ ({}));
  const rows = Array.isArray(query.data) ? query.data : [];
  const respond = async (/** @type {string} */ child, /** @type {string} */ answer) => {
    setErrors((previous) => ({ ...previous, [child]: '' }));
    try {
      await mutation.mutateAsync({ answer, child });
    } catch (error) {
      setErrors((previous) => ({ ...previous, [child]: t('childEventResponse.sendError') }));
    }
  };
  if (query.isError) {
    return (
      <View style={[Spaces.gap[8]]}>
        <Text style={[Fonts.p2, Fonts.neutral00]}>{t('childEventResponse.readError')}</Text>
        <Button
          onPress={() => query.refetch()}
          title={t('childEventResponse.retry')}
          variant="Secondary"
        />
      </View>
    );
  }
  return (
    <View style={[Spaces.gap[12]]}>
      {rows.map((row) => {
        const child = row.child.documentId;
        const disabled = !row.canAnswer || mutation.isPending || query.isFetching;
        return (
          <View key={child} style={[Spaces.gap[8]]} testID={`child-rsvp-${child}`}>
            <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
              {t('childEventResponse.title', { firstname: row.child.firstname, ...SANS_ECHAPPEMENT })}
            </Text>
            <Text
              accessibilityLiveRegion="polite"
              style={[Fonts.p2, Fonts.neutral100]}
              testID={`child-rsvp-state-${child}`}
            >
              {t(`childEventResponse.state.${row.answer || 'none'}`)}
            </Text>
            <View style={[Alignments.row, Spaces.gap[12]]}>
              <Button
                accessibilityLabel={t('childEventResponse.presentFor', {
                  firstname: row.child.firstname, ...SANS_ECHAPPEMENT,
                })}
                disabled={disabled}
                onPress={() => respond(child, 'present')}
                style={{ flex: 1 }}
                title={t('childEventResponse.present')}
                variant={row.answer === 'present' ? 'Primary' : 'Secondary'}
              />
              <Button
                accessibilityLabel={t('childEventResponse.absentFor', {
                  firstname: row.child.firstname, ...SANS_ECHAPPEMENT,
                })}
                disabled={disabled}
                onPress={() => respond(child, 'absent')}
                style={{ flex: 1 }}
                title={t('childEventResponse.absent')}
                variant={row.answer === 'absent' ? 'Primary' : 'Secondary'}
              />
            </View>
            {!row.canAnswer ? (
              <Text style={[Fonts.p2, Fonts.neutral100]}>
                {t(`childEventResponse.blocked.${row.blockedCode}`, {
                  defaultValue: t('childEventResponse.unavailable'),
                })}
              </Text>
            ) : null}
            {errors[child] ? (
              <Text
                accessibilityLiveRegion="polite"
                style={[Fonts.p2, Fonts.error300]}
                testID={`child-rsvp-error-${child}`}
              >
                {errors[child]}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

/**
 * Display persisted child replies to authorized staff.
 * @param {{ eventId: string }} props
 * @returns {import('react').ReactElement|null}
 */
export function EventChildResponsesForOrganizer({ eventId }) {
  const { t } = useTranslation();
  const { Fonts, Spaces } = useTheme();
  const query = useChildEventResponsesForOrganizer(eventId);
  const rows = Array.isArray(query.data) ? query.data : [];
  if (query.isError) {
    return (
      <View>
        <Text style={[Fonts.p2, Fonts.neutral00]}>{t('childEventResponse.readError')}</Text>
        <Button
          onPress={() => query.refetch()}
          title={t('childEventResponse.retry')}
          variant="Secondary"
        />
      </View>
    );
  }
  if (!rows.length) return null;
  return (
    <View style={[Spaces.gap[8]]}>
      <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{t('childEventResponse.organizerTitle')}</Text>
      <Text style={[Fonts.p2, Fonts.neutral100]}>{t('childEventResponse.responseOnly')}</Text>
      {rows.map((row) => (
        <Text key={row.child.documentId} style={[Fonts.p2, Fonts.neutral00]}>
          {t('childEventResponse.organizerLine', {
            answer: t(`childEventResponse.state.${row.answer || 'none'}`),
            firstname: row.child.firstname,
            team: row.team?.name || '',
            ...SANS_ECHAPPEMENT,
          })}
        </Text>
      ))}
    </View>
  );
}
