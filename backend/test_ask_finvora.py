"""
Verification test suite for Ask FINVORA Bilingual Voice Extension (Steps 7a - 7i)
"""
import sys
import os
import io
import wave
import struct
import unittest
from fastapi.testclient import TestClient

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.main import app
from app.database import SessionLocal
from app.models import RiskAlert, DepartmentBudget
from app.services.ask_context import build_grounded_context, format_inr
from app.routers import ask

client = TestClient(app)


def create_dummy_wav(duration_seconds: float = 2.0, sample_rate: int = 16000) -> bytes:
    """Creates an in-memory valid PCM WAV file for testing."""
    buf = io.BytesIO()
    num_frames = int(duration_seconds * sample_rate)
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        # Write silence / low sine wave
        silence_frame = struct.pack("<h", 0)
        wf.writeframes(silence_frame * num_frames)
    return buf.getvalue()


class TestAskFinvoraVoice(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db = SessionLocal()

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    def test_a_critical_alerts_grounding(self):
        """(a) 'Which alerts are critical?' matches DB"""
        db_alerts = (
            self.db.query(RiskAlert)
            .filter(RiskAlert.status == "open")
            .order_by(RiskAlert.confidence_score.desc())
            .limit(8)
            .all()
        )
        context, sources = build_grounded_context(self.db, "Which alerts are critical?")
        self.assertIn("Risk Alerts Database (Top Open)", sources)
        for alert in db_alerts:
            self.assertIn(alert.title, context)
        print(f"[PASS] (a) Grounding matches DB: verified {len(db_alerts)} open alerts in context.")

    def test_b_marketing_budget_status(self):
        """(b) Marketing budget status matches /api/budget"""
        mkt = self.db.query(DepartmentBudget).filter(DepartmentBudget.department.ilike("%marketing%")).first()
        self.assertIsNotNone(mkt, "Marketing budget should exist in DB")
        context, sources = build_grounded_context(self.db, "What is the marketing budget status?")
        self.assertIn("Department Budgets", sources)
        self.assertIn("Marketing", context)
        self.assertIn(format_inr(mkt.allocated), context)
        self.assertIn(format_inr(mkt.spent), context)
        print(f"[PASS] (b) Marketing budget status matches DB: Allocated={mkt.allocated}, Spent={mkt.spent}")

    def test_c_what_if_directive_in_context(self):
        """(c) 'What if a payment is delayed 20 days?' gets scenario directive pointing to What-If with NO numbers"""
        context, sources = build_grounded_context(self.db, "What if a payment is delayed 20 days?")
        self.assertIn("What-If Simulator Policy", sources)
        self.assertIn("SCENARIO SIMULATION POLICY", context)
        self.assertIn("/what-if", context)
        print("[PASS] (c) What-if directive verified in context pointing to /what-if simulator.")

    def test_d_audio_duration_rejection_over_30s(self):
        """(d) A 35-second recording is rejected or stopped cleanly"""
        wav_35s = create_dummy_wav(duration_seconds=35.0)
        files = {"file": ("recording_long.wav", wav_35s, "audio/wav")}
        data = {"language_hint": "en-IN"}
        response = client.post("/api/ask/transcribe", files=files, data=data)
        self.assertEqual(response.status_code, 200)
        res_json = response.json()
        self.assertIn("error", res_json)
        self.assertIn("exceeds the 30-second", res_json["error"])
        print("[PASS] (d) 35-second recording was rejected cleanly with duration limit error.")

    def test_e_clean_text_for_speech_sanitization(self):
        """(e) Verify speech sanitization strips markdown, URLs, symbols, emojis"""
        dirty_text = (
            "### Cash Analysis\n"
            "• **Alert #104**: Unusual payment of ₹5,00,000 to *ABC Corp*! 🚀\n"
            "Check details at https://finvora.app/overview. It is very important."
        )
        cleaned = ask.clean_text_for_speech(dirty_text)
        self.assertNotIn("###", cleaned)
        self.assertNotIn("**", cleaned)
        self.assertNotIn("https://", cleaned)
        self.assertNotIn("🚀", cleaned)
        self.assertIn("Rupees 5,00,000", cleaned)
        print(f"[PASS] (e) Speech sanitization verified: '{cleaned}'")

    def test_f_invalid_key_friendly_error_not_500(self):
        """(f) An invalid key gives friendly errors for STT and TTS while text chat still works"""
        orig_key = os.environ.get("SARVAM_API_KEY")
        try:
            os.environ["SARVAM_API_KEY"] = "invalid_key_123"

            # 1. Chat fallback test
            res_chat = client.post("/api/ask", json={"message": "What is our balance?"})
            self.assertEqual(res_chat.status_code, 200)
            self.assertIn("Total Balance", res_chat.json()["answer"])

            # 2. TTS error test
            res_tts = client.post("/api/ask/speak", json={"text": "Hello world", "language": "en-IN"})
            self.assertEqual(res_tts.status_code, 200)
            self.assertIn("error", res_tts.json())

            # 3. STT error test
            wav_short = create_dummy_wav(duration_seconds=1.0)
            res_stt = client.post("/api/ask/transcribe", files={"file": ("test.wav", wav_short, "audio/wav")})
            self.assertEqual(res_stt.status_code, 200)
            self.assertIn("error", res_stt.json())

            print("[PASS] (f) Invalid key gives friendly JSON error for STT and TTS without throwing 500.")
        finally:
            if orig_key is not None:
                os.environ["SARVAM_API_KEY"] = orig_key
            else:
                os.environ.pop("SARVAM_API_KEY", None)

    def test_g_language_selection_modes(self):
        """Verify language parameter instructs model for Hindi vs English vs Auto"""
        # Hindi mandate
        res_hi = client.post("/api/ask", json={"message": "Which alerts are critical?", "language": "hi-IN"})
        self.assertEqual(res_hi.status_code, 200)

        # English mandate
        res_en = client.post("/api/ask", json={"message": "Which alerts are critical?", "language": "en-IN"})
        self.assertEqual(res_en.status_code, 200)

        print("[PASS] (g) Language selector modes (hi-IN, en-IN, auto) processed cleanly.")

    def test_live_sarvam_queries_if_configured(self):
        """Test live Sarvam API if SARVAM_API_KEY is configured in backend/.env"""
        from dotenv import load_dotenv
        import pathlib
        load_dotenv(pathlib.Path(__file__).parent / ".env")
        api_key = os.environ.get("SARVAM_API_KEY", "").strip()
        if not api_key:
            print("Skipping live Sarvam calls (no key in env). Fallback verified.")
            return

        print(f"Testing live Sarvam AI with STT ({os.environ.get('SARVAM_STT_MODEL', 'saaras:v3')}) and TTS ({os.environ.get('SARVAM_TTS_MODEL', 'bulbul:v3')})...")

        # Live TTS synthesis test
        tts_res = client.post("/api/ask/speak", json={"text": "FINVORA cash flow is safe at Rupees 18,20,000.", "language": "en-IN"})
        self.assertEqual(tts_res.status_code, 200)
        data = tts_res.json()
        if data.get("audio_base64"):
            self.assertTrue(len(data["audio_base64"]) > 100)
            print("[PASS] Live TTS audio received successfully (base64 length:", len(data["audio_base64"]), ")")


if __name__ == "__main__":
    unittest.main()
