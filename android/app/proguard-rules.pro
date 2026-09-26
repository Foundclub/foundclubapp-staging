# Regles R8 propres a FoundClub — relues le 2026-09-26 (lot ANDROID-R8).
#
# R8 est allume en release (android/app/build.gradle, enableProguardInReleaseBuilds).
# Ce fichier s AJOUTE aux regles que chaque bibliotheque apporte deja :
#   - React Native : modules natifs (NativeModule), @ReactProp, @DoNotStrip, JNI ;
#   - Firebase, Google Play services, RevenueCat, Sentry, notifee, reanimated,
#     svg, nitro-sound : leurs propres fichiers de regles ;
#   - AGP : les methodes @JavascriptInterface (pont de la carte TomTom).
# La liste fusionnee se relit apres une construction :
#   android/app/build/outputs/mapping/<variante>/configuration.txt
#
# NE RIEN AJOUTER « au cas ou ». Jusqu au 26/09, ce fichier gardait en clair
# com.google.android.gms.** et com.google.firebase.auth.** en entier, alors que
# R8 n avait jamais ete allume : chaque -keep large empeche d obscurcir et fait
# redescendre le score de Google Play (alerte « Obscurcissement 4 % », 2.6.65).
# Une regle se pose quand un ecran plante, avec son symptome et sa date.
# Garde-fou : __tests__/androidReleaseR8.test.js.
