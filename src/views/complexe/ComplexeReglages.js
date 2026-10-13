import { useRoute } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import {
  CHOIX_AGE_MINIMUM,
  CHOIX_ANNULATION,
  messageDeRefus,
  REGLES_DU_SERVEUR,
} from '@/domains/complexe/complexeGerant';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Loader from '@/components/atoms/loader/Loader';
import ChoiceChipGroup from '@/components/molecules/choiceChipGroup/ChoiceChipGroup';
import Input from '@/components/molecules/input/Input';
import ScreenContainer from '@/components/templates/ScreenContainer';
import BandeauComplexe from '@/views/complexe/components/BandeauComplexe';

import { useComplexeGere, useModifierComplexe } from '@/services/complexe/complexeQueries';

const MOT_MAX = 500;

/**
 * E-G16 — LES RÉGLAGES DU COMPLEXE — RESA-L5A1 (13/10/2026), planches EG16 et RA6 (retour d'Adel
 * du 13/10 13h03 : « le mot aux joueurs », un champ libre juste après « Annuler et réserver »).
 *   · « Qui peut réserver » : l'âge minimum (13 à 18 ans, R2).
 *   · « Annuler et réserver » : annulation gratuite, réserver au plus tard, réservations à venir.
 *   · « Ton message aux joueurs » : 500 caractères au plus ; vide, il n'apparaît nulle part.
 *   · « Collectes » : la date limite au plus tard (Q3) ; « Non honorées » : le x du
 *     bannissement automatique (Q1, « Jamais » = 0) ; « Notifications » : résumé du matin,
 *     confirmation la veille.
 * Les bornes sont celles du serveur (`RULE_SPECS`) : une valeur hors bornes est impossible. Un
 * réglage ne vaut que pour les réservations faites après. L'avertissement « 2 réservations à venir
 * comptent des joueurs plus jeunes » attend le lot L2A (les réservations).
 * Paramètre de route : `complexeId`. Caché par `COMPLEXES_GERANT`.
 * @returns {import('react').ReactElement} L'écran.
 */
function ComplexeReglages() {
  const { t } = useTranslation();
  const { Alignments, Colors, Fonts } = useTheme();
  const route = useRoute();
  const params = /** @type {{ complexeId?: string } | undefined} */ (route?.params);
  const complexeId = params?.complexeId || null;
  const complexe = useComplexeGere(complexeId);
  const modifier = useModifierComplexe();

  const [regles, setRegles] = useState(/** @type {Record<string, any> | null} */ (null));
  const [mot, setMot] = useState('');
  const [enregistre, setEnregistre] = useState(false);
  const [refus, setRefus] = useState('');

  // Les réglages se lisent UNE fois (jamais par-dessus une saisie en cours).
  useEffect(() => {
    if (regles || !complexe.data) return;
    setRegles({ ...REGLES_DU_SERVEUR.defauts, ...(complexe.data.rules || {}) });
    setMot(String(complexe.data.playersNote || ''));
  }, [complexe.data, regles]);

  const changer = (/** @type {string} */ cle, /** @type {any} */ valeur) => {
    setEnregistre(false);
    setRegles((avant) => ({ ...avant, [cle]: valeur }));
  };
  const borne = (/** @type {string} */ cle, /** @type {number} */ valeur) => {
    const { max, min } = /** @type {Record<string, { max: number, min: number }>} */ (
      REGLES_DU_SERVEUR.bornes
    )[cle];
    return Math.min(max, Math.max(min, valeur));
  };

  const enregistrer = async () => {
    setRefus('');
    setEnregistre(false);
    try {
      await modifier.mutateAsync({
        complexeId,
        donnees: { ...regles, playersNote: mot.trim() || null },
      });
      setEnregistre(true);
    } catch (erreur) {
      setRefus(messageDeRefus(
        t,
        erreur,
        t('complexeGerant.reglages.echec', 'Les réglages ne sont pas partis. Réessaie.'),
      ));
    }
  };

  const groupe = (/** @type {string} */ legende, /** @type {any} */ contenu) => (
    <View
      style={{
        backgroundColor: withAlpha(Colors.primary700, 0.45),
        borderColor: withAlpha(Colors.primary500, 0.24),
        borderRadius: 16,
        borderWidth: 1,
        gap: 16,
        padding: 16,
      }}
    >
      <Text style={[Fonts.p3Bold, Fonts.primary200, { letterSpacing: 0.5 }]}>
        {legende.toUpperCase()}
      </Text>
      {contenu}
    </View>
  );
  const aide = (/** @type {string} */ texte) => (
    <Text style={[Fonts.p3, Fonts.neutral200]}>{texte}</Text>
  );
  const boutonDuCompteur = (
    /** @type {string} */ libelle,
    /** @type {string} */ signe,
    /** @type {() => void} */ onPress,
  ) => (
    <TouchableOpacity
      accessibilityLabel={libelle}
      accessibilityRole="button"
      onPress={onPress}
      style={[
        Alignments.alignCenter,
        Alignments.justifyCenter,
        {
          borderColor: Colors.primary500, borderRadius: 14, borderWidth: 1, height: 44, width: 44,
        },
      ]}
    >
      <Text style={[Fonts.h4Black, Fonts.primary500]}>{signe}</Text>
    </TouchableOpacity>
  );
  const compteur = (
    /** @type {string} */ cle,
    /** @type {string} */ libelle,
    /** @type {(valeur: number) => string} */ ecrire,
  ) => (
    <View style={{ gap: 8 }}>
      <Text style={[Fonts.p2Bold, Fonts.neutral100]}>{libelle}</Text>
      <View style={[Alignments.row, Alignments.alignCenter, { gap: 12 }]}>
        {boutonDuCompteur(
          t('complexeGerant.reglages.moins', 'Moins : {{reglage}}', {
            reglage: libelle,
            ...SANS_ECHAPPEMENT,
          }),
          '-',
          () => changer(cle, borne(cle, Number(regles?.[cle]) - 1)),
        )}
        <Text
          style={[Fonts.p1Bold, Fonts.neutral00, { flexShrink: 1 }]}
          testID={`complexe-reglages-valeur-${cle}`}
        >
          {ecrire(Number(regles?.[cle]))}
        </Text>
        {boutonDuCompteur(
          t('complexeGerant.reglages.plus', 'Plus : {{reglage}}', {
            reglage: libelle,
            ...SANS_ECHAPPEMENT,
          }),
          '+',
          () => changer(cle, borne(cle, Number(regles?.[cle]) + 1)),
        )}
      </View>
    </View>
  );
  const interrupteur = (
    /** @type {string} */ cle,
    /** @type {string} */ libelle,
    /** @type {string} */ testID,
  ) => {
    const allume = regles?.[cle] === true;
    return (
      <TouchableOpacity
        accessibilityLabel={libelle}
        accessibilityRole="switch"
        accessibilityState={{ checked: allume }}
        onPress={() => changer(cle, !allume)}
        style={[Alignments.row, Alignments.alignCenter, { gap: 12, minHeight: 44 }]}
        testID={testID}
      >
        <Text style={[Fonts.p2, Fonts.neutral100, { flex: 1 }]}>{libelle}</Text>
        <View
          style={{
            backgroundColor: allume
              ? withAlpha(Colors.primary500, 0.6)
              : withAlpha(Colors.neutral00, 0.16),
            borderRadius: 14,
            height: 28,
            justifyContent: 'center',
            paddingHorizontal: 3,
            width: 48,
          }}
        >
          <View
            style={{
              alignSelf: allume ? 'flex-end' : 'flex-start',
              backgroundColor: Colors.primary100,
              borderRadius: 11,
              height: 22,
              width: 22,
            }}
          />
        </View>
      </TouchableOpacity>
    );
  };
  const heuresAvant = (/** @type {number} */ heures) => t(
    'complexeGerant.reglages.heuresAvant',
    '{{heures}} h avant le créneau',
    { heures, ...SANS_ECHAPPEMENT },
  );

  if (complexe.error && !regles) {
    return (
      <ScreenContainer
        bgImage="bg2"
        contentContainerStyle={[Alignments.fill, { gap: 12, padding: 24 }]}
      >
        <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
          {t('complexeGerant.reglages.erreur', 'Impossible de charger tes réglages.')}
        </Text>
        <Button
          onPress={() => complexe.refetch?.()}
          title={t('complexeGerant.accueil.reessayer', 'Réessayer')}
          variant="Secondary"
        />
      </ScreenContainer>
    );
  }
  if (!regles) {
    return (
      <ScreenContainer
        bgImage="bg2"
        contentContainerStyle={[Alignments.fill, Alignments.justifyCenter]}
      >
        <Loader />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="screen"
      contentContainerStyle={[Alignments.fill]}
      keyboardAvoiding
    >
      <ScrollView
        contentContainerStyle={{
          alignSelf: 'center',
          gap: 16,
          maxWidth: 640,
          paddingBottom: 24,
          paddingTop: 12,
          width: '100%',
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: 2 }}>
          <Text accessibilityRole="header" style={[Fonts.h2Black, Fonts.neutral00]}>
            {t('complexeGerant.gerer.reglages', 'Réglages')}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral200]}>{String(complexe.data?.name || '')}</Text>
        </View>

        {groupe(
          t('complexeGerant.reglages.quiPeutReserver', 'Qui peut réserver'), (
            <View style={{ gap: 8 }}>
              <ChoiceChipGroup
                onSelect={(valeur) => changer('minAge', Number(valeur))}
                options={CHOIX_AGE_MINIMUM.map((age) => ({
                  label: t('complexeGerant.creation.ans', '{{age}} ans', {
                    age,
                    ...SANS_ECHAPPEMENT,
                  }),
                  value: age,
                }))}
                selectedValue={regles.minAge}
                title={t('complexeGerant.reglages.ageMinimum', 'Âge minimum')}
              />
              {aide(t(
                'complexeGerant.reglages.ageAide',
                // eslint-disable-next-line max-len
                'Un joueur plus jeune ne peut ni réserver, ni rejoindre une partie, ni recevoir tes annonces. Un joueur qui a cet âge peut t’écrire dans sa réservation.',
              ))}
            </View>
          ),
        )}

        {groupe(
          t('complexeGerant.reglages.annulerReserver', 'Annuler et réserver'), (
            <>
              <ChoiceChipGroup
                onSelect={(valeur) => changer('cancellationDelayHours', Number(valeur))}
                options={CHOIX_ANNULATION.map((heures) => ({
                  label: t('complexeGerant.creation.heures', '{{heures}} h', {
                    heures,
                    ...SANS_ECHAPPEMENT,
                  }),
                  value: heures,
                }))}
                selectedValue={regles.cancellationDelayHours}
                title={t('complexeGerant.reglages.annulation', 'Annulation gratuite jusqu’à')}
              />
              {compteur(
                'minLeadTimeHours',
                t('complexeGerant.reglages.auPlusTard', 'Réserver au plus tard'),
                heuresAvant,
              )}
              {compteur(
                'maxUpcomingPerUser',
                t('complexeGerant.reglages.aVenir', 'Réservations à venir par personne'),
                (valeur) => String(valeur),
              )}
              {aide(t(
                'complexeGerant.reglages.aVenirAide',
                'Les demandes et les collectes en cours comptent.',
              ))}
            </>
          ),
        )}

        {groupe(
          t('complexeGerant.reglages.message', 'Ton message aux joueurs'), (
            <View style={{ gap: 4 }}>
              <Input
                label={t(
                  'complexeGerant.reglages.messageChamp',
                  'Ce que les joueurs doivent savoir (facultatif)',
                )}
                maxLength={MOT_MAX}
                multiline
                onChangeText={(texte) => {
                  setEnregistre(false);
                  setMot(String(texte).slice(0, MOT_MAX));
                }}
                value={mot}
              />
              <Text style={[Fonts.p3, Fonts.neutral200, { alignSelf: 'flex-end' }]}>
                {t('complexeGerant.reglages.compte', '{{nombre}} / {{max}}', {
                  max: MOT_MAX,
                  nombre: mot.length,
                  ...SANS_ECHAPPEMENT,
                })}
              </Text>
              {aide(t(
                'complexeGerant.reglages.messageAide',
                'Les joueurs le lisent sur ta page, avant de réserver et en rejoignant une partie.',
              ))}
            </View>
          ),
        )}

        {groupe(t('complexeGerant.reglages.collectes', 'Collectes'), compteur(
          'collectDeadlineHours',
          t('complexeGerant.reglages.dateLimite', 'Date limite de collecte au plus tard'),
          heuresAvant,
        ))}

        {groupe(
          t('complexeGerant.reglages.nonHonorees', 'Non honorées'), (
            <>
              {compteur(
                'autoBanNoShows',
                t('complexeGerant.reglages.bannir', 'Bannir automatiquement après'),
                (valeur) => (valeur === 0
                  ? t('complexeGerant.reglages.jamais', 'Jamais')
                  : t(
                    'complexeGerant.reglages.nonHonoreesCompte',
                    '{{nombre}} réservations non honorées',
                    { nombre: valeur, ...SANS_ECHAPPEMENT },
                  )),
              )}
              {aide(t(
                'complexeGerant.reglages.bannirAide',
                'Le bannissement ne vaut que chez toi. Tu peux le lever à tout moment.',
              ))}
            </>
          ),
        )}

        {groupe(
          t('complexeGerant.reglages.notifications', 'Notifications'), (
            <>
              {interrupteur(
                'morningDigest',
                t('complexeGerant.reglages.resumeMatin', 'Résumé du matin à 8 h'),
                'complexe-reglages-resume-matin',
              )}
              {interrupteur(
                'dayBeforeConfirmation',
                t('complexeGerant.reglages.veille', 'Demander aux joueurs de confirmer la veille'),
                'complexe-reglages-veille',
              )}
            </>
          ),
        )}

        {enregistre ? (
          <BandeauComplexe
            texte={t(
              'complexeGerant.reglages.enregistres',
              'Réglages enregistrés. Ils valent pour les prochaines réservations.',
            )}
            ton="ok"
          />
        ) : null}
        {refus ? (
          <Text accessibilityRole="alert" style={[Fonts.p2Bold, Fonts.error300]}>{refus}</Text>
        ) : null}
        <Button
          disabled={Boolean(modifier.isPending)}
          isLoading={Boolean(modifier.isPending)}
          onPress={enregistrer}
          title={t('complexeGerant.terrain.enregistrer', 'Enregistrer')}
          variant="Primary"
        />
      </ScrollView>
    </ScreenContainer>
  );
}

export default ComplexeReglages;
