import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import {
  useRepondreEvenement,
  useReponsesEvenement,
} from '@/services/collectivite/collectiviteEvenementQueries';

const CHOIX = ['present', 'absent'];

/**
 * « 9 présents · 3 absents ».
 * @param {(key: string, options?: any) => string} t - La traduction.
 * @param {{ absent?: number, present?: number } | null | undefined} compte - Les nombres.
 * @returns {string} La phrase.
 */
const totauxLabel = (t, compte) => [
  t('collectiviteEvenement.presence.presents', { count: Number(compte?.present) || 0 }),
  t('collectiviteEvenement.presence.absents', { count: Number(compte?.absent) || 0 }),
].join(' · ');

/**
 * 🏛️ T3-VILLE-PRESENCE (03/11/2026, fiche 9 option A d'Adel) — sur la fiche d'un événement
 * de la Ville :
 *   - le lecteur dit s'il vient (`evenement.presence`, écrit par le serveur) ;
 *   - le parent répond aussi pour son enfant de moins de 13 ans, et lit la réponse de son jeune
 *     de 13 à 17 ans (tranche 2, règle Q8 A du 19/10) ;
 *   - la Ville lit les totaux et les encadrants nommés ; le dirigeant, la liste de son club
 *     (règles Q9 B et Q10 B du 19/10 : c'est le serveur qui choisit ce qu'il rend).
 * Les places restent une information : rien ici ne les compte. Un serveur pas encore à jour n'écrit
 * pas `presence` et ne connaît pas `/reponses` : rien ne s'affiche.
 * @param {{ deLaVille: boolean, evenement: any }} props - La fiche, et si la Ville la regarde.
 * @returns {import('react').ReactElement | null} La section.
 */
function PresenceEvenementVille({ deLaVille, evenement }) {
  const { t } = useTranslation();
  const { Colors, Fonts } = useTheme();
  const presence = evenement?.presence || null;
  const evenementId = evenement?.documentId || null;
  const repondre = useRepondreEvenement(evenementId);
  const lecture = useReponsesEvenement(
    deLaVille || presence?.voitLesReponses ? evenementId : null,
  );
  const reponses = lecture.data || null;

  const motDeLaReponse = (/** @type {string} */ reponse) => (reponse === 'present'
    ? t('collectiviteEvenement.presence.present', 'Présent')
    : t('collectiviteEvenement.presence.absent', 'Absent'));

  const ligneDePersonne = (
    /** @type {any} */ personne,
    /** @type {string} */ detail,
    /** @type {number} */ rang,
  ) => (
    <View key={`${personne.nom}-${rang}`} style={{ gap: 2 }}>
      <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{personne.nom}</Text>
      <Text style={[Fonts.p3, Fonts.neutral200]}>{detail}</Text>
    </View>
  );

  const fonctionLabel = (/** @type {string} */ fonction) => {
    if (fonction === 'dirigeant') return t('collectiviteEvenement.presence.dirigeant', 'Dirigeant');
    if (fonction === 'entraineur') {
      return t('collectiviteEvenement.presence.entraineur', 'Entraîneur');
    }
    return '';
  };

  const boutonsDeReponse = (
    /** @type {string|null} */ choisie,
    /** @type {string|undefined} */ enfant,
    /** @type {string} */ prefixe,
    /** @type {(choix: string) => string|undefined} */ libelle,
  ) => (
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 12 }}>
      {CHOIX.map((choix) => {
        const choisi = choisie === choix;
        return (
          <TouchableOpacity
            accessibilityLabel={libelle(choix)}
            accessibilityRole="radio"
            accessibilityState={{ selected: choisi }}
            disabled={repondre.isPending}
            key={choix}
            onPress={() => repondre.mutateAsync({ answer: choix, enfant }).catch(() => undefined)}
            style={{
              alignItems: 'center',
              backgroundColor: choisi ? Colors.primary100 : 'transparent',
              borderColor: choisi ? Colors.primary100 : withAlpha(Colors.neutral00, 0.32),
              borderRadius: 12,
              borderWidth: 1,
              flex: 1,
              justifyContent: 'center',
              minHeight: 48,
              opacity: repondre.isPending ? 0.6 : 1,
            }}
            testID={`${prefixe}-${choix}`}
          >
            <Text
              style={[
                Fonts.p2Bold,
                { color: choisi ? Colors.primary900 : Colors.neutral00 },
              ]}
            >
              {motDeLaReponse(choix)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const sectionEnfants = () => {
    const enfants = Array.isArray(presence?.enfants) ? presence.enfants : [];
    if (!enfants.length) return null;
    const ouverte = presence.etat !== 'annulee' && presence.etat !== 'terminee';
    return enfants.map((/** @type {any} */ enfant) => {
      const {
        documentId, peutRepondre, prenom, reponse: laSienne,
      } = enfant;
      const valeurs = {
        mot: laSienne ? motDeLaReponse(laSienne).toLowerCase() : '',
        prenom,
        ...SANS_ECHAPPEMENT,
      };
      if (!peutRepondre) {
        return (
          <Text
            key={documentId}
            style={[Fonts.p2, Fonts.neutral200]}
            testID={`presence-jeune-${documentId}`}
          >
            {laSienne
              ? t(
                'collectiviteEvenement.presence.jeuneReponse',
                '{{prenom}} a répondu : {{mot}}.',
                valeurs,
              )
              : t(
                'collectiviteEvenement.presence.jeuneAucune',
                '{{prenom}} n’a pas encore répondu.',
                valeurs,
              )}
          </Text>
        );
      }
      if (!ouverte && !laSienne) return null;
      const enErreur = repondre.isError && repondre.variables?.enfant === documentId;
      return (
        <View key={documentId} style={{ gap: 12 }} testID={`presence-enfant-${documentId}`}>
          {ouverte ? (
            <>
              <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00]}>
                {t('collectiviteEvenement.presence.pour', 'Pour {{prenom}}', valeurs)}
              </Text>
              {boutonsDeReponse(laSienne, documentId, `presence-enfant-${documentId}`, (choix) => (
                choix === 'present'
                  ? t(
                    'collectiviteEvenement.presence.presentPour',
                    'Présent pour {{prenom}}',
                    valeurs,
                  )
                  : t(
                    'collectiviteEvenement.presence.absentPour',
                    'Absent pour {{prenom}}',
                    valeurs,
                  )
              ))}
            </>
          ) : null}
          {laSienne ? (
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {ouverte
                ? t(
                  'collectiviteEvenement.presence.enfantReponseOuverte',
                  'Réponse pour {{prenom}} : {{mot}}. Tu peux changer d’avis.',
                  valeurs,
                )
                : t(
                  'collectiviteEvenement.presence.enfantReponse',
                  'Réponse pour {{prenom}} : {{mot}}.',
                  valeurs,
                )}
            </Text>
          ) : null}
          {enErreur ? (
            <Text accessibilityRole="alert" style={[Fonts.p3, { color: Colors.error300 }]}>
              {t(
                'collectiviteEvenement.presence.enfantErreur',
                'La réponse pour {{prenom}} n’est pas partie. Réessaie.',
                valeurs,
              )}
            </Text>
          ) : null}
        </View>
      );
    });
  };

  const sectionReponse = () => {
    if (!presence) return null;
    const { etat, maReponse } = presence;
    const ouverte = etat === 'ouverte';
    if (etat === 'parent') {
      return (
        <Text style={[Fonts.p2, Fonts.neutral200]} testID="presence-parent">
          {t(
            'collectiviteEvenement.presence.parent',
            'Tu as moins de 13 ans : c’est à ton parent de répondre.',
          )}
        </Text>
      );
    }
    if (!ouverte && !maReponse) return null;
    const mot = maReponse ? motDeLaReponse(maReponse).toLowerCase() : '';
    return (
      <View style={{ gap: 12 }} testID="presence-reponse">
        {ouverte ? (
          <>
            <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00]}>
              {t('collectiviteEvenement.presence.titre', 'Tu viens ?')}
            </Text>
            {boutonsDeReponse(maReponse, undefined, 'presence', () => undefined)}
          </>
        ) : null}
        {maReponse ? (
          <Text style={[Fonts.p3, Fonts.neutral200]} testID="presence-ma-reponse">
            {ouverte
              ? t(
                'collectiviteEvenement.presence.maReponseOuverte',
                'Ta réponse : {{mot}}. Tu peux changer d’avis.',
                { mot },
              )
              : t('collectiviteEvenement.presence.maReponse', 'Ta réponse : {{mot}}.', { mot })}
          </Text>
        ) : null}
        {repondre.isError && !repondre.variables?.enfant ? (
          <Text
            accessibilityRole="alert"
            style={[Fonts.p3, { color: Colors.error300 }]}
            testID="presence-erreur"
          >
            {t('collectiviteEvenement.presence.erreur', 'Ta réponse n’est pas partie. Réessaie.')}
          </Text>
        ) : null}
      </View>
    );
  };

  const sectionLecture = () => {
    if (!reponses) return null;
    const personne = reponses.vue === 'ville' ? reponses.encadrants : reponses.reponses;
    const aucune = !(Number(reponses.totaux?.present) || Number(reponses.totaux?.absent));
    return (
      <View
        style={{
          backgroundColor: withAlpha(Colors.neutral00, 0.06),
          borderRadius: 12,
          gap: 12,
          padding: 16,
        }}
        testID="presence-lecture"
      >
        <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00]}>
          {reponses.vue === 'club' && reponses.club
            ? t('collectiviteEvenement.presence.duClub', 'Les réponses de {{club}}', {
              club: reponses.club,
              interpolation: { escapeValue: false },
            })
            : t('collectiviteEvenement.presence.lectureTitre', 'Les réponses')}
        </Text>
        {aucune ? (
          <Text style={[Fonts.p2, Fonts.neutral200]} testID="presence-aucune">
            {t('collectiviteEvenement.presence.aucune', 'Personne n’a encore répondu.')}
          </Text>
        ) : (
          <>
            <Text style={[Fonts.p2Bold, Fonts.primary200]} testID="presence-totaux">
              {totauxLabel(t, reponses.totaux)}
            </Text>
            {(personne || []).map((/** @type {any} */ ligne, /** @type {number} */ rang) => (
              ligneDePersonne(
                ligne,
                [
                  ligne.pourEnfant
                    ? t('collectiviteEvenement.presence.parentARepondu', 'Réponse de son parent')
                    : fonctionLabel(ligne.fonction),
                  ligne.club,
                  motDeLaReponse(ligne.reponse),
                ]
                  .filter(Boolean)
                  .join(' · '),
                rang,
              )
            ))}
            {reponses.vue === 'ville' ? (
              <Text style={[Fonts.p3, Fonts.neutral200]} testID="presence-autres">
                {t('collectiviteEvenement.presence.autres', 'Joueurs et parents : {{totaux}}', {
                  interpolation: { escapeValue: false },
                  totaux: totauxLabel(t, reponses.autres),
                })}
              </Text>
            ) : null}
          </>
        )}
      </View>
    );
  };

  const reponse = sectionReponse();
  const pourLesEnfants = sectionEnfants();
  const lue = sectionLecture();
  if (!reponse && !pourLesEnfants && !lue) return null;
  return (
    <View style={{ gap: 16 }}>
      {reponse}
      {pourLesEnfants}
      {lue}
    </View>
  );
}

export default PresenceEvenementVille;
