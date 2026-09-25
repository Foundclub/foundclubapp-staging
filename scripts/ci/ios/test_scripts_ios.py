#!/usr/bin/env python3
"""Controle executable des scripts iOS partages (GitHub + Codemagic).

    python scripts/ci/ios/test_scripts_ios.py

Tourne sur n'importe quel poste (Windows compris) avec python3 et openssl --
sans Mac, sans compte Apple, sans aucune vraie clef :
  - preparer_build.py joue sur des COPIES du vrai pbxproj et du vrai Info.plist ;
  - testflight_asc.py parle a un FAUX serveur App Store Connect local, signe
    avec une clef EC jetable generee pour l'occasion.
Une build Mac coute 20 a 35 min ; ce controle coute quelques secondes. A lancer
avant chaque modification de ces scripts.
"""
import base64
import json
import os
import plistlib
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ICI = Path(__file__).resolve().parent
RACINE = ICI.parents[2]
PREPARER = ICI / "preparer_build.py"
ASC = ICI / "testflight_asc.py"
CODEMAGIC = ICI / "codemagic.py"


def lancer(script, args, cwd, env_extra):
    env = {k: v for k, v in os.environ.items()
           if not k.startswith(("APPSTORE_", "APP_STORE_CONNECT_", "GITHUB_", "CM_", "IOS_",
                                "TESTFLIGHT_", "GOOGLE_SERVICE_INFO_PLIST_"))}
    env.update(env_extra)
    # Les scripts impriment « » et — : sous Windows la console n'est pas en UTF-8.
    env["PYTHONIOENCODING"] = "utf-8"
    return subprocess.run([sys.executable, str(script)] + args, cwd=cwd, env=env,
                          capture_output=True, text=True, encoding="utf-8")


class DepotJetable(unittest.TestCase):
    """Un faux depot : copies du pbxproj et de l'Info.plist reels."""

    def setUp(self):
        self.dossier = Path(tempfile.mkdtemp(prefix="ci-ios-"))
        (self.dossier / "ios/foundclub.xcodeproj").mkdir(parents=True)
        (self.dossier / "ios/foundclub").mkdir(parents=True)
        shutil.copy(RACINE / "ios/foundclub.xcodeproj/project.pbxproj",
                    self.dossier / "ios/foundclub.xcodeproj/project.pbxproj")
        shutil.copy(RACINE / "ios/foundclub/Info.plist", self.dossier / "ios/foundclub/Info.plist")

    def tearDown(self):
        shutil.rmtree(self.dossier, ignore_errors=True)


class TestPreparerBuild(DepotJetable):
    def test_version(self):
        for bonne in ("2.6.66", "2.7"):
            self.assertEqual(lancer(PREPARER, ["version"], self.dossier,
                                    {"IOS_MARKETING_VERSION": bonne}).returncode, 0, bonne)
        for mauvaise in ("", "2", "2.6.x", "2.6.66 "):
            self.assertEqual(lancer(PREPARER, ["version"], self.dossier,
                                    {"IOS_MARKETING_VERSION": mauvaise}).returncode, 1, repr(mauvaise))

    def test_env_production_et_staging(self):
        cles = {"TOMTOM_API_KEY_PRODUCTION": "tt", "REVENUECAT_APPLE_API_KEY": "appl_x",
                "SENTRY_DSN": "https://dsn", "FC_FORCE_REVENUECAT_RAIL": ""}
        r = lancer(PREPARER, ["env"], self.dossier, dict(cles, API_ENV="production"))
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn("CIBLE API DU BUILD : https://api.foundclubpro.com/api", r.stdout)
        texte = (self.dossier / ".env.production").read_bytes().decode("utf-8")
        self.assertEqual(texte.splitlines(), [
            "APP_ENV=production",
            "API_URL=https://api.foundclubpro.com/api",
            "SOCKET_URL=https://api.foundclubpro.com",
            "WEB_APP_URL=https://foundclub.app",
            "SENTRY_DSN=https://dsn",
            "FC_ENABLE_PUSH_NOTIFICATIONS=1",
            "FC_ENABLE_SMART_NOTIFICATIONS=1",
            "FC_ENABLE_NOTIFICATION_TEST_TRIGGER=0",
            "FC_SEARCH_MAP_PROVIDER=tomtom",
            "TOMTOM_API_KEY=tt",
            "REVENUECAT_APPLE_API_KEY=appl_x",
            "FC_FORCE_REVENUECAT_RAIL=",
            "DELETE_ACCOUNT_URL=https://api.foundclubpro.com/suppression.html",
            "CONTACT_URL=https://foundclubpro.com",
        ])
        self.assertNotIn("\r", texte)

        r = lancer(PREPARER, ["env"], self.dossier, dict(cles, API_ENV="staging"))
        self.assertIn("CIBLE API DU BUILD : https://api-staging.foundclubpro.com/api", r.stdout)
        # La valeur d'un secret ne s'imprime jamais.
        self.assertNotIn("appl_x", r.stdout)

        r = lancer(PREPARER, ["env"], self.dossier, {"TOMTOM_API_KEY_PRODUCTION": "tt"})
        self.assertEqual(r.returncode, 1)
        self.assertIn("REVENUECAT_APPLE_API_KEY", r.stdout)

    def _plist(self, projet):
        return base64.b64encode(plistlib.dumps({
            "PROJECT_ID": projet, "GOOGLE_APP_ID": "1:111:ios:abc"})).decode("ascii")

    def test_firebase(self):
        r = lancer(PREPARER, ["firebase"], self.dossier,
                   {"GOOGLE_SERVICE_INFO_PLIST_PRODUCTION_BASE64": self._plist("found-club")})
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn("PROJET FIREBASE DU BUILD : found-club", r.stdout)
        info = plistlib.loads((self.dossier / "ios/foundclub/Info.plist").read_bytes())
        self.assertEqual(info["CFBundleURLTypes"][0]["CFBundleURLSchemes"][0], "app-1-111-ios-abc")

        # Un collage avec retours a la ligne passe (b64decode sans validation).
        coupe = "\n".join(re.findall(".{1,60}", self._plist("found-club")))
        self.assertEqual(lancer(PREPARER, ["firebase"], self.dossier,
                                {"GOOGLE_SERVICE_INFO_PLIST_PRODUCTION_BASE64": coupe}).returncode, 0)

        r = lancer(PREPARER, ["firebase"], self.dossier,
                   {"GOOGLE_SERVICE_INFO_PLIST_PRODUCTION_BASE64": self._plist("autre-projet")})
        self.assertEqual(r.returncode, 1)
        self.assertIn("incorrect aud claim", r.stdout)

        r = lancer(PREPARER, ["firebase"], self.dossier, {"API_ENV": "staging"})
        self.assertEqual(r.returncode, 1)
        self.assertIn("GOOGLE_SERVICE_INFO_PLIST_PRODUCTION_BASE64", r.stdout)

    def test_numeroter_sans_signature_ne_touche_que_les_numeros(self):
        avant = (self.dossier / "ios/foundclub.xcodeproj/project.pbxproj").read_bytes()
        r = lancer(PREPARER, ["numeroter"], self.dossier,
                   {"IOS_MARKETING_VERSION": "2.6.66", "IOS_BUILD_NUMBER": "1522"})
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        apres = (self.dossier / "ios/foundclub.xcodeproj/project.pbxproj").read_bytes()
        changees = [(a, b) for a, b in zip(avant.split(b"\n"), apres.split(b"\n")) if a != b]
        self.assertEqual(len(avant.split(b"\n")), len(apres.split(b"\n")))
        self.assertEqual(len(changees), 4, changees)
        for _, ligne in changees:
            self.assertRegex(ligne.decode(), r"(CURRENT_PROJECT_VERSION = 1522;|MARKETING_VERSION = 2\.6\.66;)")

    def test_numeroter_avec_signature_manuelle(self):
        r = lancer(PREPARER, ["numeroter", "--signature-manuelle"], self.dossier,
                   {"IOS_MARKETING_VERSION": "2.6.66", "IOS_BUILD_NUMBER": "1531",
                    "PROFILE_NAME": "FoundClub AppStore 2026-08", "APPLE_TEAM_ID": "TEAMID"})
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        texte = (self.dossier / "ios/foundclub.xcodeproj/project.pbxproj").read_text(encoding="utf-8")
        self.assertEqual(texte.count('PROVISIONING_PROFILE_SPECIFIER = "FoundClub AppStore 2026-08";'), 2)
        self.assertEqual(texte.count('"CODE_SIGN_IDENTITY[sdk=iphoneos*]" = "Apple Distribution";'), 2)
        self.assertNotIn('"iPhone Developer"', texte)

    def test_archive(self):
        app = self.dossier / "a.xcarchive/Products/Applications/foundclub.app"
        app.mkdir(parents=True)
        (app / "Info.plist").write_bytes(plistlib.dumps(
            {"CFBundleShortVersionString": "2.6.66", "CFBundleVersion": "1522"}, fmt=plistlib.FMT_BINARY))
        bon = {"IOS_MARKETING_VERSION": "2.6.66", "IOS_BUILD_NUMBER": "1522"}
        self.assertEqual(lancer(PREPARER, ["archive", "a.xcarchive"], self.dossier, bon).returncode, 0)
        self.assertEqual(lancer(PREPARER, ["archive", "a.xcarchive"], self.dossier,
                                dict(bon, IOS_BUILD_NUMBER="1523")).returncode, 1)


# ── Faux App Store Connect ────────────────────────────────────────────────


class FauxApple(BaseHTTPRequestHandler):
    etat_sequence = []
    appels = []

    def log_message(self, *args):
        pass

    def _repondre(self, code, corps):
        brut = json.dumps(corps).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(brut)))
        self.end_headers()
        self.wfile.write(brut)

    def _jeton_valide(self):
        jeton = self.headers.get("Authorization", "").replace("Bearer ", "")
        morceaux = jeton.split(".")
        if len(morceaux) != 3:
            return False
        entete = json.loads(base64.urlsafe_b64decode(morceaux[0] + "=="))
        signature = base64.urlsafe_b64decode(morceaux[2] + "==")
        return entete.get("alg") == "ES256" and entete.get("kid") == "KEYID" and len(signature) == 64

    def do_GET(self):
        FauxApple.appels.append(("GET", self.path))
        if not self._jeton_valide():
            return self._repondre(401, {"errors": [{"code": "NOT_AUTHORIZED", "title": "jeton"}]})
        url = urlparse(self.path)
        q = parse_qs(url.query)
        if url.path == "/v1/apps":
            return self._repondre(200, {"data": [{"id": "APP1"}]} if q["filter[bundleId]"] == ["com.foundclub"]
                                  else {"data": []})
        if url.path == "/v1/builds" and "filter[version]" in q:
            etat = FauxApple.etat_sequence.pop(0) if FauxApple.etat_sequence else "VALID"
            return self._repondre(200, {"data": [{"id": "BUILD1", "attributes": {"processingState": etat}}]})
        if url.path == "/v1/builds":
            return self._repondre(200, {
                "data": [
                    {"id": "b3", "attributes": {"version": "1521", "processingState": "VALID",
                                                "uploadedDate": "2026-09-24T21:00:00Z"},
                     "relationships": {"preReleaseVersion": {"data": {"id": "p65"}}}},
                    {"id": "b2", "attributes": {"version": "999", "processingState": "VALID"},
                     "relationships": {"preReleaseVersion": {"data": {"id": "p10"}}}},
                    # Numero-horodatage de l'ancienne agence, vu chez Apple le 2026-09-25.
                    {"id": "b1", "attributes": {"version": "1761054327", "processingState": "VALID",
                                                "uploadedDate": "2025-10-21T13:45:27Z"},
                     "relationships": {"preReleaseVersion": {"data": {"id": "p10"}}}},
                ],
                "included": [{"type": "preReleaseVersions", "id": "p65", "attributes": {"version": "2.6.65"}},
                             {"type": "preReleaseVersions", "id": "p10", "attributes": {"version": "2.6.10"}}],
            })
        if url.path == "/v1/betaGroups":
            return self._repondre(200, {"data": [
                {"id": "G1", "attributes": {"name": "FoundClub internal", "isInternalGroup": True}},
                {"id": "G2", "attributes": {"name": "FoundClub external", "isInternalGroup": False}},
            ]})
        return self._repondre(404, {"errors": [{"code": "NOT_FOUND", "title": url.path}]})

    def do_POST(self):
        FauxApple.appels.append(("POST", self.path))
        longueur = int(self.headers.get("Content-Length", 0))
        self.rfile.read(longueur)
        # Ce que repond Apple pour un groupe INTERNE, mot pour mot (2026-08-11).
        return self._repondre(422, {"errors": [{"code": "ENTITY_UNPROCESSABLE",
                                                "title": "Builds cannot be assigned to this internal group.",
                                                "detail": "Cannot add internal group to a build."}]})


class TestTestflightAsc(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.serveur = ThreadingHTTPServer(("127.0.0.1", 0), FauxApple)
        threading.Thread(target=cls.serveur.serve_forever, daemon=True).start()
        cls.dossier = Path(tempfile.mkdtemp(prefix="ci-asc-"))
        # Clef EC P-256 JETABLE, au format d'une clef App Store Connect (.p8).
        ec = subprocess.run(["openssl", "ecparam", "-name", "prime256v1", "-genkey", "-noout"],
                            capture_output=True, check=True).stdout
        pkcs8 = subprocess.run(["openssl", "pkcs8", "-topk8", "-nocrypt"], input=ec,
                               capture_output=True, check=True).stdout
        cls.clef_pem = pkcs8.decode("ascii")
        cls.clef = cls.dossier / "AuthKey_KEYID.p8"
        cls.clef.write_text(cls.clef_pem, encoding="ascii")

    @classmethod
    def tearDownClass(cls):
        cls.serveur.shutdown()
        shutil.rmtree(cls.dossier, ignore_errors=True)

    def env(self, **extra):
        self.env_file = self.dossier / "cm_env"
        self.env_file.write_text("", encoding="utf-8")
        base = {"ASC_API_ROOT": "http://127.0.0.1:{}".format(self.serveur.server_address[1]),
                "CM_ENV": str(self.env_file), "IOS_BUNDLE_ID": "com.foundclub"}
        base.update(extra)
        return base

    def lu(self):
        return dict(l.split("=", 1) for l in self.env_file.read_text(encoding="utf-8").splitlines() if l)

    def test_prochain_numero_avec_la_clef_facon_codemagic(self):
        # Codemagic donne le CONTENU de la clef, pas un fichier.
        r = lancer(ASC, ["prochain-numero"], self.dossier, self.env(
            APP_STORE_CONNECT_KEY_IDENTIFIER="KEYID", APP_STORE_CONNECT_ISSUER_ID="ISS",
            APP_STORE_CONNECT_PRIVATE_KEY=self.clef_pem))
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn("NUMERO DE BUILD CHOISI : 1522", r.stdout)
        self.assertIn("2.6.65 (1521) | traitee", r.stdout)
        self.assertIn("NUMEROS HORS SERIE IGNORES (1)", r.stdout)
        self.assertEqual(self.lu()["IOS_BUILD_NUMBER"], "1522")
        self.assertNotIn("BEGIN PRIVATE KEY", r.stdout + r.stderr)

    def test_prochain_numero_sans_clef_echoue(self):
        r = lancer(ASC, ["prochain-numero"], self.dossier, self.env())
        self.assertEqual(r.returncode, 1)

    def test_chaine_complete_facon_github(self):
        FauxApple.etat_sequence = ["PROCESSING", "VALID"]
        commun = dict(APPSTORE_KEY_ID="KEYID", APPSTORE_ISSUER_ID="ISS", APPSTORE_KEY_PATH=str(self.clef),
                      IOS_MARKETING_VERSION="2.6.66", IOS_BUILD_NUMBER="1522",
                      TESTFLIGHT_POLL_SECONDS="0", TESTFLIGHT_MAX_WAIT_MINUTES="1",
                      TESTFLIGHT_GROUP="FoundClub internal")
        r = lancer(ASC, ["attendre"], self.dossier, self.env(**commun))
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn("2.6.66 (1522) | PROCESSING", r.stdout)
        self.assertIn("est traitee (build id BUILD1)", r.stdout)
        etat = self.lu()
        self.assertEqual(etat["TESTFLIGHT_STATE"], "VALID")

        r = lancer(ASC, ["distribuer"], self.dossier, dict(self.env(**commun), **{
            k: etat[k] for k in ("TESTFLIGHT_STATE", "TESTFLIGHT_BUILD_ID", "TESTFLIGHT_APP_ID")}))
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn("« FoundClub internal »  (interne)", r.stdout)
        self.assertIn("Refus attendu", r.stdout)
        # Les deux sens de la relation ont ete essayes, dans cet ordre.
        posts = [p for m, p in FauxApple.appels if m == "POST"][-2:]
        self.assertEqual(posts, ["/v1/builds/BUILD1/relationships/betaGroups",
                                 "/v1/betaGroups/G1/relationships/builds"])
        etat.update(self.lu())

        r = lancer(ASC, ["temoin"], self.dossier, dict(self.env(), **etat))
        self.assertIn("ETAT TESTFLIGHT : 2.6.66 (1522) — traitee — groupe interne « FoundClub internal »",
                      r.stdout)

    def test_suivre_en_un_seul_processus_facon_codemagic(self):
        FauxApple.etat_sequence = ["VALID"]
        r = lancer(ASC, ["suivre"], self.dossier, self.env(
            APP_STORE_CONNECT_KEY_IDENTIFIER="KEYID", APP_STORE_CONNECT_ISSUER_ID="ISS",
            APP_STORE_CONNECT_PRIVATE_KEY=self.clef_pem, IOS_MARKETING_VERSION="2.6.66",
            IOS_BUILD_NUMBER="1522", TESTFLIGHT_POLL_SECONDS="0", TESTFLIGHT_MAX_WAIT_MINUTES="1",
            TESTFLIGHT_GROUP="FoundClub internal"))
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn("ETAT TESTFLIGHT : 2.6.66 (1522) — traitee — groupe interne", r.stdout)

    def test_attendre_sans_clef_ne_fait_pas_echouer(self):
        r = lancer(ASC, ["attendre"], self.dossier, self.env(
            IOS_MARKETING_VERSION="2.6.66", IOS_BUILD_NUMBER="1522"))
        self.assertEqual(r.returncode, 0)
        self.assertIn("etat non relu", r.stdout)


# ── Faux Codemagic ────────────────────────────────────────────────────────


class FauxCodemagic(BaseHTTPRequestHandler):
    recus = []

    def log_message(self, *args):
        pass

    def _repondre(self, code, corps):
        brut = json.dumps(corps).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(brut)))
        self.end_headers()
        self.wfile.write(brut)

    def _autorise(self):
        FauxCodemagic.recus.append(("jeton", self.headers.get("x-auth-token")))
        return self.headers.get("x-auth-token") == "JETON-SECRET-DE-TEST"

    def do_GET(self):
        if not self._autorise():
            return self._repondre(401, {"error": "Unauthorized"})
        if self.path == "/apps":
            return self._repondre(200, {"applications": [
                {"_id": "AUTRE", "appName": "autre-depot"},
                {"_id": "APPX", "appName": "foundclubapp-staging",
                 "repository": {"htmlUrl": "https://github.com/Foundclub/foundclubapp-staging"}}]})
        if self.path == "/builds?appId=APPX":
            return self._repondre(200, {"builds": [
                {"_id": "B1", "status": "finished", "labels": ["2.6.66 production"], "branch": "staging",
                 "startedAt": "2026-09-25T15:00:00Z", "finishedAt": "2026-09-25T15:22:00Z"}]})
        if self.path == "/builds/B2":
            return self._repondre(200, {"build": {"_id": "B2", "status": "failed", "branch": "staging"}})
        return self._repondre(404, {"error": "not found"})

    def do_POST(self):
        if not self._autorise():
            return self._repondre(401, {"error": "Unauthorized"})
        corps = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))))
        FauxCodemagic.recus.append(("corps", corps))
        return self._repondre(200, {"buildId": "B2"})


class TestCodemagic(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.serveur = ThreadingHTTPServer(("127.0.0.1", 0), FauxCodemagic)
        threading.Thread(target=cls.serveur.serve_forever, daemon=True).start()
        cls.dossier = Path(tempfile.mkdtemp(prefix="ci-cm-"))
        cls.fichier = cls.dossier / "api_token.txt"
        # Tel que l'ecrit la commande PowerShell donnee a Adel (sans fin de ligne),
        # ici avec un BOM et un retour a la ligne en plus, pour la robustesse.
        cls.fichier.write_bytes("\ufeffJETON-SECRET-DE-TEST\r\n".encode("utf-8"))

    @classmethod
    def tearDownClass(cls):
        cls.serveur.shutdown()
        shutil.rmtree(cls.dossier, ignore_errors=True)

    def env(self, fichier=None):
        return {"CODEMAGIC_API_ROOT": "http://127.0.0.1:{}".format(self.serveur.server_address[1]),
                "CODEMAGIC_TOKEN_FILE": str(fichier or self.fichier)}

    def test_lancer_envoie_entrees_et_variables_sans_imprimer_le_jeton(self):
        r = lancer(CODEMAGIC, ["lancer", "2.6.68", "--attendre-apple"], self.dossier, self.env())
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn("BUILD CODEMAGIC LANCEE : B2 — version 2.6.68 — cible production — attendre Apple true", r.stdout)
        self.assertNotIn("JETON-SECRET", r.stdout + r.stderr)
        corps = [c for k, c in FauxCodemagic.recus if k == "corps"][-1]
        self.assertEqual((corps["appId"], corps["workflowId"], corps["branch"]), ("APPX", "ios-testflight", "staging"))
        self.assertEqual(corps["inputs"]["marketing_version"], "2.6.68")
        self.assertEqual(corps["environment"]["variables"]["IOS_MARKETING_VERSION"], "2.6.68")
        self.assertEqual(corps["environment"]["variables"]["ATTENDRE_APPLE"], "true")
        self.assertTrue(all(v == "JETON-SECRET-DE-TEST" for k, v in FauxCodemagic.recus if k == "jeton"))

    def test_dernieres_et_etat(self):
        r = lancer(CODEMAGIC, ["dernieres"], self.dossier, self.env())
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn("B1 | finished | 2.6.66 production | branche staging", r.stdout)
        r = lancer(CODEMAGIC, ["etat", "B2"], self.dossier, self.env())
        self.assertEqual(r.returncode, 1)
        self.assertIn("B2 | failed", r.stdout)

    def test_sans_jeton_message_clair_et_pas_de_trace(self):
        r = lancer(CODEMAGIC, ["dernieres"], self.dossier, self.env(self.dossier / "absent.txt"))
        self.assertEqual(r.returncode, 1)
        self.assertIn("Jeton Codemagic introuvable", r.stderr)
        self.assertNotIn("Traceback", r.stderr)


if __name__ == "__main__":
    unittest.main(verbosity=2)
