import i18next from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import localeDesFormats from '@/theme/strings/localeDesFormats';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import { PastilleAPoint } from '@/views/admin/components/CollectiviteBadges';
import ConsoleSheet from '@/views/admin/components/ConsoleSheet';

import {
  useFoundclubClubOffer,
  useGrantFoundclubClubOffer,
  useRevokeFoundclubClubOffer,
} from '@/services/admin/foundclubOfferQueries';
import { FOUNDCLUB_OFFER_DURATIONS } from '@/services/admin/foundclubOfferService';

import { getErrorMessage, getServerErrorCode } from '@/utils/errors/displayError';

// Le motif tient en une ligne d audit : le serveur refuse au-dela
// (FOUNDCLUB_OFFER_REASON_TOO_LONG).
const MOTIF_MAX = 200;
// « 1 an » d abord : une offre qui s eteint toute seule, sans que personne n ait a y penser.
const DUREE_PAR_DEFAUT = '1y';

/**
 * Un jour lisible : « 7 octobre 2027 ».
 * @param {string | null | undefined} valeur - Une date ISO.
 * @returns {string} Le jour, ou '' si la date est illisible.
 */
export const formatJourOffre = (valeur) => {
  const date = valeur ? new Date(valeur) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(localeDesFormats(), {
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(date);
};

/**
 * « Jusqu’au 7 octobre 2027 », ou « Sans fin ».
 * @param {string | null | undefined} fin - La fin de l offre.
 * @returns {string} La phrase.
 */
export const libelleFinOffre = (fin) => {
  const jour = formatJourOffre(fin);
  return jour
    ? i18next.t('offreFoundclub.jusquAu', { date: jour, ...SANS_ECHAPPEMENT })
    : i18next.t('offreFoundclub.sansFin');
};

/**
 * La phrase d un refus du serveur : chaque code a la sienne, sinon le message general.
 * @param {any} erreur - L erreur de la requete.
 * @returns {string} La phrase.
 */
const messageDuRefus = (erreur) => {
  switch (getServerErrorCode(erreur)) {
    case 'FOUNDCLUB_OFFER_CLUB_NOT_FOUND':
      return i18next.t('offreFoundclub.erreurs.clubIntrouvable');
    case 'FOUNDCLUB_OFFER_INVALID_DURATION':
      return i18next.t('offreFoundclub.erreurs.duree');
    case 'FOUNDCLUB_OFFER_REASON_TOO_LONG':
      return i18next.t('offreFoundclub.erreurs.motifTropLong', { max: MOTIF_MAX });
    default:
      return getErrorMessage(erreur, 'generic');
  }
};

/**
 * La confirmation de « Retirer l’offre » (fiche du club et liste des offres) : le club perd
 * l offre de FoundClub, rien d autre ne bouge.
 * @param {{ clubId: string | null, clubName: string, onClose: () => void,
 *   onDone?: (verdict: any) => void }} props - Le club (null : fermee), la fermeture, et ce
 *   qu on fait du verdict du serveur.
 * @returns {import('react').ReactElement | null} La fenetre.
 */
export function FeuilleRetraitOffreFoundclub({
  clubId, clubName, onClose, onDone = undefined,
}) {
  const { t } = useTranslation();
  const { Fonts } = useTheme();
  const retrait = useRevokeFoundclubClubOffer({
    onSuccess: (/** @type {any} */ reponse) => {
      onClose();
      onDone?.(reponse?.data || null);
    },
  });
  const fermer = () => {
    retrait.reset?.();
    onClose();
  };
  return (
    <ConsoleSheet
      error={retrait.error ? messageDuRefus(retrait.error) : null}
      onClose={fermer}
      primary={{
        isLoading: Boolean(retrait.isPending),
        label: t('offreFoundclub.retirer'),
        onPress: () => retrait.mutate({ clubId, reason: '' }),
        variant: 'Danger',
      }}
      secondary={{ label: t('offreFoundclub.annuler'), onPress: fermer }}
      subtitle={clubName}
      testID="offre-foundclub-retrait"
      title={t('offreFoundclub.retirer')}
      visible={Boolean(clubId)}
    >
      <Text style={[Fonts.p2, Fonts.neutral100]}>{t('offreFoundclub.retraitExplication')}</Text>
    </ConsoleSheet>
  );
}

/**
 * 🎁 OFFRIR-ABONNEMENT (07/10/2026) — le bloc « Abonnement » de la fiche d un club dans la console
 * SuperAdmin. « Je prends mon téléphone, deux clics, et hop, je t’abonne » (Adel) :
 * « Offrir l’abonnement » ouvre la feuille (offre Club, durée « 1 an » déjà choisie, motif déjà
 * écrit), « Offrir » pose l offre. Un club offert dit jusqu’à quand et se retire (confirmation).
 * Un club qui paie : on le dit, rien à offrir. Le serveur décide de tout ; le bloc relit son état
 * après chaque geste.
 * @param {{ clubId: string, clubName?: string | null }} props - Le club de la fiche.
 * @returns {import('react').ReactElement} Le bloc.
 */
function OffreFoundclubClub({ clubId, clubName = null }) {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const nom = String(clubName || '').trim();
  const lecture = useFoundclubClubOffer(clubId);
  const [feuilleOuverte, setFeuilleOuverte] = useState(false);
  const [retraitOuvert, setRetraitOuvert] = useState(false);
  const [duree, setDuree] = useState(DUREE_PAR_DEFAUT);
  const [motif, setMotif] = useState('');
  const [compteRendu, setCompteRendu] = useState(/** @type {string | null} */ (null));
  const offre = useGrantFoundclubClubOffer({
    onSuccess: (/** @type {any} */ reponse) => {
      setFeuilleOuverte(false);
      const verdict = reponse?.data || {};
      if (verdict.offer === 'already-paid') {
        setCompteRendu(t('offreFoundclub.dejaPaye'));
        return;
      }
      setCompteRendu(verdict.currentPeriodEnd
        ? t('offreFoundclub.offertJusquAu', {
          date: formatJourOffre(verdict.currentPeriodEnd), ...SANS_ECHAPPEMENT,
        })
        : t('offreFoundclub.offertSansFin'));
    },
  });

  const ouvrir = () => {
    offre.reset?.();
    setCompteRendu(null);
    setDuree(DUREE_PAR_DEFAUT);
    setMotif(t('offreFoundclub.motifParDefaut'));
    setFeuilleOuverte(true);
  };
  const fermer = () => {
    offre.reset?.();
    setFeuilleOuverte(false);
  };

  const etat = lecture.data?.data || null;
  const libellesDurees = {
    '1m': t('offreFoundclub.durees.unMois'),
    '1y': t('offreFoundclub.durees.unAn'),
    '3m': t('offreFoundclub.durees.troisMois'),
    none: t('offreFoundclub.durees.sansFin'),
  };

  /** @type {import('react').ReactNode} */
  let corps;
  if (lecture.isLoading) {
    corps = <Text style={[Fonts.p2, Fonts.neutral300]}>{t('offreFoundclub.lecture')}</Text>;
  } else if (lecture.error || !etat) {
    corps = (
      <View style={{ gap: 12 }}>
        <Text style={[Fonts.p2, Fonts.error300]}>{t('offreFoundclub.lectureImpossible')}</Text>
        <Button
          onPress={() => lecture.refetch?.()}
          size="sm"
          title={t('offreFoundclub.reessayer')}
          variant="Secondary"
        />
      </View>
    );
  } else if (etat.kind === 'foundclub') {
    corps = (
      <View style={{ gap: 8 }}>
        <PastilleAPoint color={Colors.success500} label={t('offreFoundclub.offertParFoundclub')} />
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{libelleFinOffre(etat.until)}</Text>
        {etat.since ? (
          <Text style={[Fonts.p3, Fonts.neutral300]}>
            {t('offreFoundclub.depuis', { date: formatJourOffre(etat.since), ...SANS_ECHAPPEMENT })}
          </Text>
        ) : null}
        {etat.reason ? (
          <Text style={[Fonts.p3, Fonts.neutral300]}>
            {t('offreFoundclub.motif', { motif: etat.reason, ...SANS_ECHAPPEMENT })}
          </Text>
        ) : null}
        <Button
          onPress={() => { setCompteRendu(null); setRetraitOuvert(true); }}
          size="sm"
          title={t('offreFoundclub.retirer')}
          variant="Danger"
        />
      </View>
    );
  } else if (etat.kind === 'paid') {
    corps = <Text style={[Fonts.p2, Fonts.neutral100]}>{t('offreFoundclub.paieDeja')}</Text>;
  } else {
    corps = (
      <View style={{ gap: 12 }}>
        <Text style={[Fonts.p2, Fonts.neutral100]}>
          {etat.collectivite ? t('offreFoundclub.offertParLaVille') : t('offreFoundclub.gratuit')}
        </Text>
        <Button onPress={ouvrir} title={t('offreFoundclub.offrirLAbonnement')} />
      </View>
    );
  }

  const champ = [
    Fonts.p1,
    Fonts.neutral00,
    ApplicationStyle.borderRadius12,
    {
      backgroundColor: Colors.primary900,
      borderColor: withAlpha(Colors.primary500, 0.4),
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
  ];

  return (
    <View
      style={[
        ApplicationStyle.backgroundColor.primary700,
        ApplicationStyle.borderRadius16,
        Spaces.padding[16],
        { borderColor: Colors.primary500, borderWidth: 1, gap: 12 },
      ]}
      testID="offre-foundclub"
    >
      <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00]}>
        {t('offreFoundclub.titre')}
      </Text>
      <View testID={lecture.isLoading ? undefined : 'offre-foundclub-etat'}>{corps}</View>
      {compteRendu ? (
        <Text style={[Fonts.p3Bold, Fonts.success500]} testID="offre-foundclub-compte-rendu">
          {compteRendu}
        </Text>
      ) : null}

      <ConsoleSheet
        error={offre.error ? messageDuRefus(offre.error) : null}
        onClose={fermer}
        primary={{
          isLoading: Boolean(offre.isPending),
          label: t('offreFoundclub.offrir'),
          onPress: () => offre.mutate({ clubId, duration: duree, reason: motif.trim() }),
        }}
        secondary={{ label: t('offreFoundclub.annuler'), onPress: fermer }}
        subtitle={nom || null}
        testID="offre-foundclub-feuille"
        title={t('offreFoundclub.offrirLAbonnement')}
        visible={feuilleOuverte}
      >
        <View style={{ gap: 6 }}>
          <Text style={[Fonts.p3Bold, Fonts.neutral300]}>{t('offreFoundclub.offre')}</Text>
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{t('offreFoundclub.offreClub')}</Text>
        </View>
        <View style={{ gap: 8 }}>
          <Text style={[Fonts.p3Bold, Fonts.neutral300]}>{t('offreFoundclub.duree')}</Text>
          <View
            accessibilityRole="radiogroup"
            style={[Alignments.row, Alignments.wrap, { gap: 8 }]}
          >
            {FOUNDCLUB_OFFER_DURATIONS.map((valeur) => {
              const choisie = valeur === duree;
              return (
                <TouchableOpacity
                  accessibilityRole="radio"
                  accessibilityState={{ checked: choisie, selected: choisie }}
                  disabled={Boolean(offre.isPending)}
                  key={valeur}
                  onPress={() => setDuree(valeur)}
                  style={[
                    ApplicationStyle.borderRadius12,
                    {
                      backgroundColor: choisie ? Colors.primary500 : Colors.primary700,
                      borderColor: Colors.primary500,
                      borderWidth: 1,
                      justifyContent: 'center',
                      minHeight: 44,
                      paddingHorizontal: 14,
                    },
                  ]}
                  testID={`offre-foundclub-duree-${valeur}`}
                >
                  <Text
                    style={[
                      Fonts.p2Bold,
                      { color: choisie ? Colors.neutral00 : Colors.primary200 },
                    ]}
                  >
                    {libellesDurees[/** @type {'1m' | '3m' | '1y' | 'none'} */ (valeur)]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        <View style={{ gap: 6 }}>
          <Text style={[Fonts.p3Bold, Fonts.neutral300]}>
            {t('offreFoundclub.motifFacultatif')}
          </Text>
          <TextInput
            accessibilityLabel={t('offreFoundclub.motifFacultatif')}
            editable={!offre.isPending}
            maxLength={MOTIF_MAX}
            onChangeText={setMotif}
            placeholder={t('offreFoundclub.motifParDefaut')}
            placeholderTextColor={Colors.neutral300}
            style={champ}
            testID="offre-foundclub-motif"
            value={motif}
          />
        </View>
      </ConsoleSheet>

      {retraitOuvert ? (
        <FeuilleRetraitOffreFoundclub
          clubId={clubId}
          clubName={nom}
          onClose={() => setRetraitOuvert(false)}
          onDone={(/** @type {any} */ verdict) => setCompteRendu(verdict?.offer === 'revoked'
            ? t('offreFoundclub.retiree')
            : t('offreFoundclub.rienARetirer'))}
        />
      ) : null}
    </View>
  );
}

export default OffreFoundclubClub;
