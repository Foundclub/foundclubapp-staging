import { useRoute } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Linking, ScrollView, Text, TouchableOpacity, View,
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

import {
  useApercuAgeMinimum,
  useComplexeChoisi,
  useComplexeGere,
  useModifierComplexe,
} from '@/services/complexe/complexeQueries';

import { buildPublicWebUrl } from '@/utils/shareLinks';

import { LEGAL_COMPLEXE_RULES_PATH, LEGAL_COMPLEXE_RULES_URL } from '@/config/legalUrls';

const MOT_MAX = 500;

/**
 * E-G16 — LES RÉGLAGES DU COMPLEXE — RESA-L5A1 (13/10/2026), planches EG16 et RA6 (retour d'Adel
 * du 13/10 13h03 : « le mot aux joueurs », un champ libre juste après « Annuler et réserver »).
 *   · « Qui peut réserver » : l'âge minimum (13 à 18 ans, R2).
 *   · « Annuler et réserver » : annulation gratuite, réserver au plus tard.
 *     COMPLEXE-TERRAINS (10/11/2026, point 9, décision d'Adel) : « Réservations à venir par
 *     personne » est SUPPRIMÉ (le serveur ne lit plus `maxUpcomingPerUser`) ; un « ? » ouvre
 *     l'explication des réglages qui ne s'expliquent pas d'eux-mêmes, dans une même petite bulle.
 *   · « Ton message aux joueurs » : 500 caractères au plus ; vide, il n'apparaît nulle part.
 *   · « Collectes » : la date limite au plus tard (Q3) ; « Non honorées » : le x du
 *     bannissement automatique (Q1, « Jamais » = 0) ; « Notifications » : résumé du matin,
 *     confirmation la veille.
 * Les bornes sont celles du serveur (`RULE_SPECS`) : une valeur hors bornes est impossible. Un
 * réglage ne vaut que pour les réservations faites après.
 * RESA-L5B-1, partie B (serveur RESA-L2C, planche EG16 état 4) : un âge minimum RELEVÉ fait lire
 * l'aperçu du serveur (`PUT …/manage` en `dryRun`, rien n'est écrit) ; s'il y en a, « 2
 * réservations à venir comptent des joueurs de moins de 18 ans. Elles sont gardées. »
 * Paramètre de route : `complexeId`. Caché par `COMPLEXES_GERANT`.
 * @returns {import('react').ReactElement} L'écran.
 */
function ComplexeReglages() {
  const { t } = useTranslation();
  const { Alignments, Colors, Fonts } = useTheme();
  const texteLireRegles = t(
    'complexeGerant.reglages.lireRegles',
    'Lire les règles d’utilisation des complexes',
  );
  const route = useRoute();
  const params = /** @type {{ complexeId?: string } | undefined} */ (route?.params);
  // RESA-L5B-2 : sans `?complexeId=` (site), le complexe du compte.
  const { complexeId } = useComplexeChoisi(params?.complexeId);
  const complexe = useComplexeGere(complexeId);
  const modifier = useModifierComplexe();

  const [regles, setRegles] = useState(/** @type {Record<string, any> | null} */ (null));
  const [mot, setMot] = useState('');
  const [enregistre, setEnregistre] = useState(false);
  const [refus, setRefus] = useState('');
  // COMPLEXE-TERRAINS (9) : le réglage dont l'explication est ouverte (une à la fois).
  const [aideOuverte, setAideOuverte] = useState('');
  // RESA-L5B-1, partie B — l'âge enregistré, et l'aperçu SEULEMENT quand on le relève.
  const ageEnregistre = Number(complexe.data?.rules?.minAge ?? REGLES_DU_SERVEUR.defauts.minAge);
  const ageChoisi = Number(regles?.minAge ?? ageEnregistre);
  const apercuAge = useApercuAgeMinimum(complexeId, ageChoisi, {
    enabled: Boolean(regles) && ageChoisi > ageEnregistre,
  });
  const plusJeunes = ageChoisi > ageEnregistre
    ? Number(apercuAge.data?.reservationsPlusJeunes) || 0
    : 0;

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
  // COMPLEXE-TERRAINS (9) : le titre d'un réglage, et son « ? » qui ouvre (ou referme) une petite
  // bulle d'explication juste dessous ; sans explication, le titre seul.
  const titreDuReglage = (
    /** @type {string} */ cle,
    /** @type {string} */ libelle,
    /** @type {string | undefined} */ explication,
  ) => {
    const ouverte = Boolean(explication) && aideOuverte === cle;
    return (
      <View style={{ gap: 6 }}>
        <View style={[Alignments.row, Alignments.alignCenter, { gap: 4 }]}>
          <Text style={[Fonts.p2Bold, Fonts.neutral100, { flexShrink: 1 }]}>{libelle}</Text>
          {explication ? (
            <TouchableOpacity
              accessibilityLabel={t('complexeGerant.reglages.aide', 'Aide : {{reglage}}', {
                reglage: libelle,
                ...SANS_ECHAPPEMENT,
              })}
              accessibilityRole="button"
              accessibilityState={{ expanded: ouverte }}
              onPress={() => setAideOuverte(ouverte ? '' : cle)}
              style={[Alignments.alignCenter, Alignments.justifyCenter, { height: 44, width: 44 }]}
              testID={`complexe-reglages-aide-${cle}`}
            >
              <View
                style={[
                  Alignments.alignCenter,
                  Alignments.justifyCenter,
                  {
                    borderColor: Colors.primary500,
                    borderRadius: 11,
                    borderWidth: 1,
                    height: 22,
                    width: 22,
                  },
                ]}
              >
                <Text style={[Fonts.p3Bold, Fonts.primary500]}>?</Text>
              </View>
            </TouchableOpacity>
          ) : null}
        </View>
        {ouverte ? (
          <View
            style={{
              backgroundColor: withAlpha(Colors.primary500, 0.12),
              borderColor: withAlpha(Colors.primary500, 0.4),
              borderRadius: 12,
              borderWidth: 1,
              padding: 12,
            }}
          >
            <Text style={[Fonts.p3, Fonts.neutral100]}>{explication}</Text>
          </View>
        ) : null}
      </View>
    );
  };
  const compteur = (
    /** @type {string} */ cle,
    /** @type {string} */ libelle,
    /** @type {(valeur: number) => string} */ ecrire,
    /** @type {string} [explication] */ explication = undefined,
  ) => (
    <View style={{ gap: 8 }}>
      {titreDuReglage(cle, libelle, explication)}
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
              {plusJeunes > 0 ? (
                <BandeauComplexe
                  testID="complexe-reglages-plus-jeunes"
                  texte={t(
                    'complexeGerant.reglages.plusJeunes',
                    // eslint-disable-next-line max-len
                    '{{count}} réservations à venir comptent des joueurs de moins de {{age}} ans. Elles sont gardées.',
                    {
                      age: ageChoisi,
                      count: plusJeunes,
                      // eslint-disable-next-line max-len
                      defaultValue_one: '{{count}} réservation à venir compte des joueurs de moins de {{age}} ans. Elle est gardée.',
                      // eslint-disable-next-line max-len
                      defaultValue_other: '{{count}} réservations à venir comptent des joueurs de moins de {{age}} ans. Elles sont gardées.',
                      ...SANS_ECHAPPEMENT,
                    },
                  )}
                  ton="attention"
                />
              ) : null}
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
                t(
                  'complexeGerant.reglages.auPlusTardAide',
                  'Un joueur ne peut plus réserver un créneau qui commence dans moins de ce délai.',
                ),
              )}
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
          t(
            'complexeGerant.reglages.dateLimiteAide',
            // eslint-disable-next-line max-len
            'Une collecte attend que ses joueurs la rejoignent. Elle doit être complète au plus tard ce délai avant le créneau ; sinon elle s’arrête et le créneau reste libre.',
          ),
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
                t(
                  'complexeGerant.reglages.bannirExplication',
                  // eslint-disable-next-line max-len
                  'Une réservation non honorée : le joueur n’est pas venu. À ce nombre, il ne peut plus réserver chez toi.',
                ),
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
        {/* REGLES-COMPLEXES (10/11, « 225- A ») : relire ce que la création a fait accepter. */}
        <TouchableOpacity
          accessibilityLabel={texteLireRegles}
          accessibilityRole="link"
          onPress={() => {
            const adresse = buildPublicWebUrl(
              /** @type {any} */ ({ path: LEGAL_COMPLEXE_RULES_PATH }),
            ) || LEGAL_COMPLEXE_RULES_URL;
            Promise.resolve(Linking.openURL(adresse)).catch(() => {});
          }}
          style={{ alignSelf: 'center', justifyContent: 'center', minHeight: 44 }}
          testID="complexe-reglages-lire-regles"
        >
          <Text style={[Fonts.p2Bold, Fonts.primary500, { textDecorationLine: 'underline' }]}>
            {texteLireRegles}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}

export default ComplexeReglages;
