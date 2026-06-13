// @ts-nocheck
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import Button from '@/components/atoms/button/Button';

import { navigate } from '@/navigation/navigationService';
import { RouteNames } from '@/navigation/routeNames';

import { useClubScope } from '@/context/ClubScopeContext';

const normalizeId = (value) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

/**
 * Compact switch used by multisport directors to toggle between the multisport
 * dashboard and a managed section context.
 * @param {object} props
 * @param {string} [props.clubId]
 * @param {string} [props.parentMultisportId]
 * @param {string} [props.title]
 * @param {import('react-native').StyleProp<import('react-native').ViewStyle>} [props.style]
 * @returns {import('react').ReactElement | null}
 */
function ClubScopeToggle({
  clubId,
  parentMultisportId,
  style,
  title,
}) {
  const { t } = useTranslation();
  const {
    activateMultisportScope,
    activateSectionScope,
    activeMode,
    activeMultisportClubId,
    activeSectionClubId,
    hasMultisportAccess,
    isSectionMode,
    isSwitching,
    toggleClubScope,
  } = useClubScope() || {};

  const normalizedClubId = normalizeId(clubId);
  const normalizedParentMultisportId = normalizeId(parentMultisportId);
  const isTargetSectionActive = Boolean(
    normalizedClubId
    && normalizeId(activeSectionClubId) === normalizedClubId,
  );
  const canShowSwitch = Boolean(
    hasMultisportAccess
    && (
      normalizedClubId
      || normalizeId(activeSectionClubId)
      || isSectionMode
    ),
  );

  let resolvedTitle = title;
  if (!resolvedTitle) {
    if (normalizedClubId) {
      if (isTargetSectionActive && isSectionMode) {
        resolvedTitle = t('clubScope.toggle.backToMultisport', 'Retour multisport');
      } else {
        resolvedTitle = t('clubScope.toggle.sectionMode', 'Passer en mode section');
      }
    } else if (activeMode === 'section') {
      resolvedTitle = t('clubScope.toggle.sectionActive', 'Mode section');
    } else {
      resolvedTitle = t('clubScope.toggle.multisportActive', 'Mode multisport');
    }
  }

  const handlePress = useCallback(async () => {
    let result;
    if (normalizedClubId) {
      if (isTargetSectionActive && isSectionMode) {
        result = activateMultisportScope?.();
      } else {
        result = activateSectionScope?.({
          clubId: normalizedClubId,
          parentMultisportClubId: normalizedParentMultisportId || activeMultisportClubId,
        });
      }
    } else {
      result = toggleClubScope?.();
    }

    const resolvedResult = await Promise.resolve(result);
    if (resolvedResult?.ok === false) {
      return;
    }

    navigate(RouteNames.MyTeamList);
  }, [
    activeMultisportClubId,
    activateMultisportScope,
    activateSectionScope,
    isSectionMode,
    isTargetSectionActive,
    normalizedClubId,
    normalizedParentMultisportId,
    toggleClubScope,
  ]);

  if (!canShowSwitch) {
    return null;
  }

  return (
    <Button
      accessibilityHint={t(
        'clubScope.toggle.hint',
        'Basculer entre le contexte multisport et la section active.',
      )}
      accessibilityLabel={resolvedTitle}
      isLoading={isSwitching}
      isOption
      onPress={handlePress}
      size="small"
      style={style}
      title={resolvedTitle}
      variant="Secondary"
    />
  );
}

export default ClubScopeToggle;
