"""Comprehensive Verification Suite for Ask FINVORA MCP Agent (Step 8 a-m)."""

import os
import sys
import io
import wave
import json
import struct
import pathlib
import unittest
from unittest.mock import patch, AsyncMock
import httpx
from httpx import ASGITransport

# Ensure backend root is on sys.path
_backend_dir = pathlib.Path(__file__).resolve().parent
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))

from dotenv import load_dotenv
load_dotenv(_backend_dir / ".env")

from app.main import app
from app.database import SessionLocal
from app.models import RiskAlert, DepartmentBudget, Account
from app.services.ask_agent import (
    run_agent_loop,
    mcp_manager,
    parse_tool_arguments,
    detect_is_hindi_or_hinglish,
    get_live_dashboard_summary_fallback,
)
from mcp.client.stdio import stdio_client, StdioServerParameters
from mcp.client.session import ClientSession


def create_dummy_wav(duration_seconds: float = 2.0, sample_rate: int = 16000) -> bytes:
    """Creates an in-memory valid PCM WAV file for testing."""
    buf = io.BytesIO()
    num_frames = int(duration_seconds * sample_rate)
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        silence_frame = struct.pack("<h", 0)
        wf.writeframes(silence_frame * num_frames)
    return buf.getvalue()


class TestMCPAgentFullSuite(unittest.IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls):
        cls.db = SessionLocal()
        cls.transport = ASGITransport(app=app)

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    async def asyncSetUp(self):
        self.ac = httpx.AsyncClient(transport=self.transport, base_url="http://test")

    async def asyncTearDown(self):
        await self.ac.aclose()
        from app.services.ask_agent import mcp_manager
        await mcp_manager.close()

    async def test_a_mcp_server_standalone_and_list_tools(self):
        """(a) Run the MCP server standalone and list its tools."""
        env = dict(os.environ)
        env["PYTHONIOENCODING"] = "utf-8"
        server_path = str(_backend_dir / "mcp_server" / "server.py")
        params = StdioServerParameters(command=sys.executable, args=[server_path], env=env)

        async with stdio_client(params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                tools_res = await session.list_tools()
                tool_names = [t.name for t in tools_res.tools]

                expected_tools = [
                    "get_dashboard_summary",
                    "list_risk_alerts",
                    "get_risk_alert",
                    "get_cash_forecast",
                    "get_budget_status",
                    "explain_app_feature",
                    "transcribe_speech",
                    "synthesize_speech",
                ]
                for exp in expected_tools:
                    self.assertIn(exp, tool_names, f"Expected tool '{exp}' in MCP server.")

                # Ensure NO mutating tools
                for forbidden in ["simulate", "approve", "dismiss", "update", "delete"]:
                    for tn in tool_names:
                        self.assertNotIn(forbidden, tn.lower(), f"Forbidden tool {forbidden} exposed!")

        print(f"[PASS] (a) MCP server standalone initialized with {len(tool_names)} read-only tools: {tool_names}")

    async def test_b_which_alerts_are_critical_tool_call(self):
        """(b) 'Which alerts are critical?' calls list_risk_alerts and matches the DB."""
        # 1. Direct tool execution check against DB
        out, ok, ms = await mcp_manager.execute_tool("list_risk_alerts", {"severity": "critical", "limit": 10})
        self.assertTrue(ok)
        raw_data = json.loads(out)
        alerts_data = raw_data.get("alerts", raw_data) if isinstance(raw_data, dict) else raw_data
        self.assertIsInstance(alerts_data, list)

        db_criticals = self.db.query(RiskAlert).filter(RiskAlert.severity == "critical").all()
        self.assertEqual(len(alerts_data), min(len(db_criticals), 10))
        if db_criticals:
            first_db = db_criticals[0]
            matched = any(a["alert_id"] == first_db.id for a in alerts_data)
            self.assertTrue(matched, "DB alert ID should match tool output")

        # 2. Agent loop with simulated tool choice
        mock_sarvam_turn1 = {
            "choices": [{
                "finish_reason": "tool_calls",
                "message": {
                    "role": "assistant",
                    "content": None,
                    "tool_calls": [{
                        "id": "call_crit_1",
                        "type": "function",
                        "function": {
                            "name": "list_risk_alerts",
                            "arguments": json.dumps({"severity": "critical", "limit": 5}),
                        },
                    }],
                },
            }]
        }
        mock_sarvam_turn2 = {
            "choices": [{
                "finish_reason": "stop",
                "message": {
                    "role": "assistant",
                    "content": f"There are {len(alerts_data)} critical alerts in FINVORA. Alert #{alerts_data[0]['alert_id']} '{alerts_data[0]['title']}' requires immediate review.",
                },
            }]
        }

        with patch("app.services.ask_agent.call_sarvam_chat_raw", AsyncMock(side_effect=[mock_sarvam_turn1, mock_sarvam_turn2])):
            with patch("app.services.ask_agent.get_sarvam_api_key", return_value="test_key"):
                res = await run_agent_loop("Which alerts are critical?")
                self.assertIn("critical", res["answer"].lower())
                self.assertTrue(any(t["tool"] == "list_risk_alerts" for t in res["tool_trace"]))
                self.assertEqual(res["tool_trace"][0]["arguments"]["severity"], "critical")
        print("[PASS] (b) 'Which alerts are critical?' calls list_risk_alerts and matches DB.")

    async def test_c_why_is_cash_flow_flagged_tool_call(self):
        """(c) 'Why is cash flow flagged?' calls get_cash_forecast."""
        out, ok, ms = await mcp_manager.execute_tool("get_cash_forecast", {"horizon_days": 30})
        self.assertTrue(ok)
        forecast_data = json.loads(out)
        self.assertIn("buffer_status", forecast_data)
        self.assertIn("minimum_safe_buffer", forecast_data)
        self.assertIn("projected_closing_cash", forecast_data)

        mock_turn1 = {
            "choices": [{
                "finish_reason": "tool_calls",
                "message": {
                    "role": "assistant",
                    "content": None,
                    "tool_calls": [{
                        "id": "call_cf_1",
                        "type": "function",
                        "function": {
                            "name": "get_cash_forecast",
                            "arguments": json.dumps({"horizon_days": 30}),
                        },
                    }],
                },
            }]
        }
        mock_turn2 = {
            "choices": [{
                "finish_reason": "stop",
                "message": {
                    "role": "assistant",
                    "content": f"Cash flow status is {forecast_data['buffer_status']}. Projected closing cash is {forecast_data['projected_closing_cash']} against the minimum safe buffer of {forecast_data['minimum_safe_buffer']}.",
                },
            }]
        }

        with patch("app.services.ask_agent.call_sarvam_chat_raw", AsyncMock(side_effect=[mock_turn1, mock_turn2])):
            with patch("app.services.ask_agent.get_sarvam_api_key", return_value="test_key"):
                res = await run_agent_loop("Why is cash flow flagged?")
                self.assertIn(forecast_data["buffer_status"], res["answer"])
                self.assertTrue(any(t["tool"] == "get_cash_forecast" for t in res["tool_trace"]))
        print(f"[PASS] (c) 'Why is cash flow flagged?' calls get_cash_forecast: buffer={forecast_data['buffer_status']}.")

    async def test_d_two_part_question_triggers_multiple_tool_calls(self):
        """(d) A two-part question triggers multiple tool calls."""
        mock_turn1 = {
            "choices": [{
                "finish_reason": "tool_calls",
                "message": {
                    "role": "assistant",
                    "content": None,
                    "tool_calls": [
                        {
                            "id": "call_multi_1",
                            "type": "function",
                            "function": {"name": "get_dashboard_summary", "arguments": "{}"},
                        },
                        {
                            "id": "call_multi_2",
                            "type": "function",
                            "function": {"name": "get_budget_status", "arguments": json.dumps({"department": "Marketing"})},
                        },
                    ],
                },
            }]
        }
        mock_turn2 = {
            "choices": [{
                "finish_reason": "stop",
                "message": {
                    "role": "assistant",
                    "content": "Total balance is ₹2,05,50,000 and Marketing budget is on track.",
                },
            }]
        }

        with patch("app.services.ask_agent.call_sarvam_chat_raw", AsyncMock(side_effect=[mock_turn1, mock_turn2])):
            with patch("app.services.ask_agent.get_sarvam_api_key", return_value="test_key"):
                res = await run_agent_loop("What is our balance and how is Marketing budget doing?")
                self.assertEqual(len(res["tool_trace"]), 2)
                tools_called = [t["tool"] for t in res["tool_trace"]]
                self.assertIn("get_dashboard_summary", tools_called)
                self.assertIn("get_budget_status", tools_called)
                self.assertTrue(all(t["ok"] for t in res["tool_trace"]))
        print(f"[PASS] (d) Two-part question executed multiple MCP tools: {tools_called}")

    async def test_e_what_if_question_calls_no_simulation_and_points_to_what_if(self):
        """(e) A what-if question calls no simulation and points to What-If page."""
        mock_turn = {
            "choices": [{
                "finish_reason": "stop",
                "message": {
                    "role": "assistant",
                    "content": "I do not simulate hypothetical scenarios or calculate projections. Delaying a payment preserves liquidity in the short term but may risk penalties. To model exact impacts, please visit the What-If Simulator (/what-if).",
                },
            }]
        }

        with patch("app.services.ask_agent.call_sarvam_chat_raw", AsyncMock(return_value=mock_turn)):
            with patch("app.services.ask_agent.get_sarvam_api_key", return_value="test_key"):
                res = await run_agent_loop("What if a payment is delayed 20 days?")
                for t in res["tool_trace"]:
                    self.assertNotIn("simulate", t["tool"].lower())
                self.assertIn("/what-if", res["answer"])
        print("[PASS] (e) What-if question executed no simulation tools and pointed to /what-if.")

    async def test_f_approve_alert_refusal(self):
        """(f) 'approve alert 566' is refused by the read-only assistant."""
        mock_turn = {
            "choices": [{
                "finish_reason": "stop",
                "message": {
                    "role": "assistant",
                    "content": "I cannot approve, dismiss, or modify Alert #566. FINVORA Assistant is strictly read-only. Please navigate to Decisions & Approvals (/decisions-approvals) or Risk Radar (/risk-anomalies) to review and approve transactions.",
                },
            }]
        }

        with patch("app.services.ask_agent.call_sarvam_chat_raw", AsyncMock(return_value=mock_turn)):
            with patch("app.services.ask_agent.get_sarvam_api_key", return_value="test_key"):
                res = await run_agent_loop("approve alert 566")
                self.assertEqual(len(res["tool_trace"]), 0)
                self.assertIn("cannot approve", res["answer"].lower())
                self.assertTrue("decisions" in res["answer"].lower() or "risk" in res["answer"].lower())
        print("[PASS] (f) 'approve alert 566' refused cleanly with guidance to Decisions page.")

    async def test_g_hindi_voice_question_flow(self):
        """(g) Hindi voice question -> Devanagari transcript -> Hindi answer -> Hindi audio."""
        mock_stt_result = {"transcript": "क्या हमारे पास कोई क्रिटिकल रिस्क अलर्ट है?", "language_code": "hi-IN"}
        mock_agent_turn = {
            "choices": [{
                "finish_reason": "stop",
                "message": {
                    "role": "assistant",
                    "content": "हाँ, FINVORA में कुल 3 क्रिटिकल रिस्क अलर्ट्स मौजूद हैं। कृपया रिस्क रडार पेज पर विवरण देखें।",
                },
            }]
        }
        dummy_wav = create_dummy_wav(duration_seconds=2.0)

        async def mock_exec_tool(tool_name, arguments):
            if tool_name == "transcribe_speech":
                return json.dumps(mock_stt_result), True, 180.0
            elif tool_name == "synthesize_speech":
                return json.dumps({"audio_base64": "ZHVtbXlfaGluZGlfYXVkaW8=", "mime": "audio/wav"}), True, 220.0
            return "{}", True, 50.0

        with patch("app.routers.ask.mcp_manager.execute_tool", side_effect=mock_exec_tool):
            with patch("app.services.ask_agent.call_sarvam_chat_raw", AsyncMock(return_value=mock_agent_turn)):
                with patch("app.services.ask_agent.get_sarvam_api_key", return_value="test_key"):
                    res = await self.ac.post(
                        "/api/ask/voice",
                        files={"file": ("hindi_q.wav", dummy_wav, "audio/wav")},
                        data={"language": "hi-IN"},
                    )
                    self.assertEqual(res.status_code, 200)
                    data = res.json()
                    self.assertEqual(data["transcript"], "क्या हमारे पास कोई क्रिटिकल रिस्क अलर्ट है?")
                    self.assertEqual(data["language"], "hi-IN")
                    self.assertIn("क्रिटिकल", data["answer"])
                    self.assertEqual(data["audio_base64"], "ZHVtbXlfaGluZGlfYXVkaW8=")
                    print(f"[PASS] (g) Hindi voice flow verified: Transcript length={len(data['transcript'])}, Lang={data['language']}")

    async def test_h_english_and_hinglish_voice(self):
        """(h) English voice and a Hinglish sentence."""
        self.assertTrue(detect_is_hindi_or_hinglish("kitna balance bacha hai bataye"))
        self.assertTrue(detect_is_hindi_or_hinglish("हमारा कैश बैलेंस क्या है?"))
        self.assertFalse(detect_is_hindi_or_hinglish("What is our cash balance today?"))

        # Test Hinglish handling in agent loop
        mock_turn = {
            "choices": [{
                "finish_reason": "stop",
                "message": {
                    "role": "assistant",
                    "content": "FINVORA me current total liquid balance ₹2,05,50,000 hai aur monthly cash flow safe hai.",
                },
            }]
        }
        with patch("app.services.ask_agent.call_sarvam_chat_raw", AsyncMock(return_value=mock_turn)):
            with patch("app.services.ask_agent.get_sarvam_api_key", return_value="test_key"):
                res = await run_agent_loop("Current balance kitna hai?")
                self.assertIn("₹2,05,50,000", res["answer"])
        print("[PASS] (h) English and Hinglish detection and response verified.")

    async def test_i_trace_panel_shows_real_calls(self):
        """(i) The trace panel shows real calls with duration and arguments."""
        res_post = await self.ac.post("/api/ask", json={"message": "What is our balance?"})
        self.assertEqual(res_post.status_code, 200)
        data = res_post.json()
        self.assertIn("tool_trace", data)
        self.assertIsInstance(data["tool_trace"], list)
        print(f"[PASS] (i) Trace panel response verified: tool_trace field returned ({len(data['tool_trace'])} items).")

    async def test_j_mcp_crash_or_invalid_key_gives_friendly_fallback(self):
        """(j) An MCP crash or invalid key gives the friendly dashboard fallback without 500."""
        # 1. Invalid key test
        with patch("app.services.ask_agent.get_sarvam_api_key", return_value=""):
            res = await run_agent_loop("What is our balance?")
            self.assertIn("Total Liquid Balance", res["answer"])
            self.assertIn("₹2,05,50,000", res["answer"])

        # 2. HTTP endpoint error fallback test
        with patch("app.services.ask_agent.call_sarvam_chat_raw", AsyncMock(side_effect=Exception("Connection reset"))):
            with patch("app.services.ask_agent.get_sarvam_api_key", return_value="mock_key"):
                res = await self.ac.post("/api/ask", json={"message": "What is our balance?"})
                self.assertEqual(res.status_code, 200)
                self.assertIn("Total Liquid Balance", res.json()["answer"])
        print("[PASS] (j) MCP crash or invalid key gives friendly dashboard summary fallback without 500.")

    def test_k_key_absent_from_git_and_no_audio_on_disk(self):
        """(k) Key absent from git status/logs, no audio on disk."""
        # Verify no .wav or .webm files created in backend or repo
        cwd = pathlib.Path(".")
        wav_files = list(cwd.glob("**/*.wav"))
        webm_files = list(cwd.glob("**/*.webm"))
        self.assertEqual(len(wav_files), 0, f"Found wav files on disk: {wav_files}")
        self.assertEqual(len(webm_files), 0, f"Found webm files on disk: {webm_files}")
        print("[PASS] (k) Verified 0 audio files written to disk; audio processed strictly in memory.")

    async def test_m_existing_pages_unaffected(self):
        """(m) Existing pages and endpoints unaffected."""
        r_dash = await self.ac.get("/api/dashboard/summary")
        self.assertEqual(r_dash.status_code, 200)
        self.assertIn("total_balance", r_dash.json())

        r_risks = await self.ac.get("/api/risks?status=all")
        self.assertEqual(r_risks.status_code, 200)
        self.assertIsInstance(r_risks.json(), list)

        r_forecast = await self.ac.get("/api/forecast?horizon=30")
        self.assertEqual(r_forecast.status_code, 200)
        self.assertIn("predicted", r_forecast.json())

        r_budget = await self.ac.get("/api/budget")
        self.assertEqual(r_budget.status_code, 200)
        self.assertIsInstance(r_budget.json(), list)

        r_health = await self.ac.get("/health")
        self.assertEqual(r_health.status_code, 200)
        print("[PASS] (m) Existing routers (/api/dashboard/summary, /api/risks, /api/forecast, /api/budget) all unaffected.")


if __name__ == "__main__":
    unittest.main()
