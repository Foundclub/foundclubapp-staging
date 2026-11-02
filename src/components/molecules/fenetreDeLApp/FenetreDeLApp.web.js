// REPRISE-ROBUSTESSE (01/11/2026, Adel « 1- B ») — LA fenêtre de l'app du site, posée une fois à
// la racine (web/src/main.tsx). Elle dessine, aux couleurs de l'app, ce que le navigateur
// affichait dans ses boîtes grises : les `Alert.alert` (via la doublure du site), les
// `window.alert` écrits en dur (redirigés tant qu'elle est posée), et les questions de
// `confirmerDansLApp` / `demanderDansLApp`. Les textes sont ceux des appelants : rien ne change
// à part la fenêtre. Même brique que les autres confirmations : BottomModal en dialogue.
import {
  useEffect, useId, useRef, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import Input from '@/components/molecules/input/Input';

import { poserHoteDeFenetre } from '@/utils/fenetreDeLApp';

// Au-dessus des feuilles (1100) et des <Modal> de react-native-web (9999) : une confirmation
// demandée depuis une feuille ouverte s'affiche devant elle.
const COUCHE_DE_LA_FENETRE = 10000;

/** @type {Record<string, 'Secondary' | 'DangerFilled'>} */
const VARIANTE_DU_STYLE = { cancel: 'Secondary', destructive: 'DangerFilled' };

/**
 * La fenêtre de l'app, et sa file d'attente (une fenêtre à la fois, dans l'ordre).
 * @returns {JSX.Element | null} La fenêtre du moment.
 */
function FenetreDeLApp() {
  const { t } = useTranslation();
  const { Fonts, Spaces } = useTheme();
  const [file, setFile] = useState(/** @type {import('@/utils/fenetreDeLApp').Fenetre[]} */ ([]));
  const [reponse, setReponse] = useState('');
  const origineDuFocus = useRef(/** @type {HTMLElement | null} */ (null));
  const idDuTitre = useId();
  const idDuTexte = useId();
  const fenetre = file[0] || null;

  useEffect(() => {
    const retirer = poserHoteDeFenetre((nouvelle) => setFile((avant) => [...avant, nouvelle]));
    const alerteDuNavigateur = window.alert;
    // ponytail: la redirection n'agit que tant que cette fenêtre est posée (racine du site), et
    // la suite d'un window.alert part sans attendre « OK » (aucun appelant n'en dépend : un
    // message, puis rien). Sortie : remplacer ces appels un par un par ouvrirFenetre.
    window.alert = (message) => {
      setFile((avant) => [...avant, { message: message == null ? '' : String(message) }]);
    };
    return () => {
      retirer();
      window.alert = alerteDuNavigateur;
    };
  }, []);

  useEffect(() => {
    setReponse(fenetre?.champ?.defaultValue ?? '');
  }, [fenetre]);

  // Le focus va sur le premier bouton (le champ, pour une question écrite : autoFocus) et revient,
  // la file vidée, à l'élément qui avait ouvert la fenêtre.
  useEffect(() => {
    if (!fenetre) {
      const origine = origineDuFocus.current;
      origineDuFocus.current = null;
      origine?.focus?.();
      return undefined;
    }
    if (!origineDuFocus.current) {
      origineDuFocus.current = /** @type {HTMLElement | null} */ (document.activeElement);
    }
    if (fenetre.champ) return undefined;
    const minuterie = setTimeout(() => {
      /** @type {HTMLElement | null} */
      // Button ne transmet pas testID : le premier bouton se trouve par son rôle.
      const premier = document.querySelector(
        '[role="alertdialog"] button, [role="alertdialog"] [role="button"]',
      );
      premier?.focus();
    }, 0);
    return () => clearTimeout(minuterie);
  }, [fenetre]);

  if (!fenetre) return null;

  /** @type {import('@/utils/fenetreDeLApp').BoutonDeFenetre[]} */
  let boutons = fenetre.buttons?.length ? fenetre.buttons : [{}];
  if (fenetre.champ) {
    const { champ } = fenetre;
    boutons = [
      { onPress: () => champ.onSubmit(null), style: 'cancel' },
      { isPreferred: true, onPress: () => champ.onSubmit(reponse) },
    ];
  }

  /**
   * Ferme la fenêtre, puis lance le geste du bouton.
   * @param {import('@/utils/fenetreDeLApp').BoutonDeFenetre | undefined} bouton - Le bouton.
   */
  const fermer = (bouton) => {
    setFile((avant) => avant.slice(1));
    bouton?.onPress?.();
  };

  // Fond, croix ou Échap : le bouton « Annuler » s'il existe ; sinon, une alerte à un seul bouton
  // lance quand même sa suite (T19-RESTES : « Club créé ! · OK » ouvre la fiche du club).
  const boutonDeSortie = boutons.find((bouton) => bouton.style === 'cancel')
    || (boutons.length === 1 ? boutons[0] : undefined);

  return (
    <BottomModal
      close={() => fermer(boutonDeSortie)}
      hideCloseButton
      isVisible
      style={{ maxWidth: 480 }}
      webPresentation="dialog"
      webZIndex={COUCHE_DE_LA_FENETRE}
    >
      {/* Fond, croix absente, Échap (écouté à la descente par BottomModal : un TextInput de
          react-native-web l'arrête sinon) : tout passe par le bouton de sortie. */}
      <View
        aria-describedby={fenetre.message ? idDuTexte : undefined}
        aria-labelledby={fenetre.title ? idDuTitre : undefined}
        aria-modal
        role="alertdialog"
        style={[Spaces.paddingBottom[8], { gap: 16 }]}
        testID="fenetre-de-l-app"
      >
        {fenetre.title ? (
          <Text nativeID={idDuTitre} style={[Fonts.h4Bold, Fonts.neutral00]}>{fenetre.title}</Text>
        ) : null}
        {fenetre.message ? (
          <Text nativeID={idDuTexte} style={[Fonts.p2, Fonts.neutral200]}>{fenetre.message}</Text>
        ) : null}
        {fenetre.champ ? (
          <Input
            accessibilityLabel={fenetre.title}
            autoFocus
            onChangeText={setReponse}
            onSubmitEditing={() => fermer(boutons[1])}
            value={reponse}
          />
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {boutons.map((bouton, index) => (
            <Button
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              onPress={() => fermer(bouton)}
              style={{ flexGrow: 1 }}
              title={bouton.text || (bouton.style === 'cancel'
                ? t('common.cancel', 'Annuler')
                : t('common.ok', 'OK'))}
              variant={VARIANTE_DU_STYLE[bouton.style || ''] || 'Primary'}
            />
          ))}
        </View>
      </View>
    </BottomModal>
  );
}

export default FenetreDeLApp;
