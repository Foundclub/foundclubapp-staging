import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Icone from '@/components/atoms/SvgIcon/SvgIcon';
import { equipeDeLaDemande } from '@/views/profile/parent/FeuilleDAnnulation';

/**
 * Chaque issue : sa phrase, sa phrase d appoint, son ton et son icone (planche 8).
 * @type {Record<string, { cle: string, icone: string, ton: 'ok' | 'info' | 'erreur' }>}
 */
const ISSUES = {
  acceptee: { cle: 'accepted', icone: 'shield', ton: 'info' },
  annulee: { cle: 'done', icone: 'check', ton: 'ok' },
  echec: { cle: 'failed', icone: '', ton: 'erreur' },
  indisponible: { cle: 'unavailable', icone: '', ton: 'info' },
  repondue: { cle: 'answered', icone: '', ton: 'info' },
};

/**
 * PAR-L8 (13/10, design parent E19, planche 8) — CE QUI EST ARRIVE A « ANNULER LA DEMANDE », en
 * tete de la fiche de l enfant :
 *   · « Demande annulée. » / « Lea peut faire une nouvelle demande. » (vert) ;
 *   · « Le club a déjà répondu. » / « Lea est dans U11. Rien n'a été annulé. » ;
 *   · « Le club a déjà répondu à cette demande. » / « Il n'y a plus rien à annuler. » ;
 *   · « L'annulation n'est pas encore disponible. » (serveur d avant : ni route ni droit) ;
 *   · « La demande n'a pas pu être annulée. » / « Vérifie ta connexion… » + « Réessayer » (rouge).
 * @param {object} props - Les proprietes.
 * @param {any} props.enfant - La fiche de l enfant.
 * @param {() => void} [props.onRetry] - « Réessayer » (l echec seulement).
 * @param {{ demande: any, situation: string } | null} props.resultat - La derniere issue.
 * @returns {import('react').ReactElement | null} - Le bandeau, ou rien.
 */
function BandeauDAnnulation({ enfant, onRetry = undefined, resultat }) {
  const { t } = useTranslation();
  const { Colors, Fonts } = useTheme();
  const issue = resultat ? ISSUES[resultat.situation] : null;
  if (!issue) return null;

  const encre = {
    erreur: Colors.error500,
    info: Colors.primary500,
    ok: Colors.success500,
  }[issue.ton];
  const valeurs = {
    firstname: enfant?.firstname || '',
    team: equipeDeLaDemande(resultat.demande),
    ...SANS_ECHAPPEMENT,
  };

  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        alignItems: 'center',
        backgroundColor: withAlpha(encre, 0.12),
        borderColor: withAlpha(encre, 0.45),
        borderRadius: 16,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 12,
        padding: 12,
      }}
      testID={`cancel-request-banner-${resultat.situation}`}
    >
      {issue.icone ? (
        <Icone
          color={issue.ton === 'ok' ? Colors.success200 : Colors.primary200}
          height={20}
          name={issue.icone}
          width={20}
        />
      ) : null}
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
          {t(`myChildren.cancelRequest.${issue.cle}`, valeurs)}
        </Text>
        <Text style={[Fonts.p3, Fonts.neutral100]}>
          {t(`myChildren.cancelRequest.${issue.cle}Hint`, valeurs)}
        </Text>
        {issue.ton === 'erreur' && onRetry ? (
          <TouchableOpacity
            accessibilityRole="button"
            onPress={onRetry}
            style={{ alignSelf: 'flex-start', justifyContent: 'center', minHeight: 44 }}
            testID="cancel-request-retry"
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

export default BandeauDAnnulation;
