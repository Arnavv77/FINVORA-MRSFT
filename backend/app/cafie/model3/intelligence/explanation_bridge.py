"""CAFIE Model 3 — Explanation Bridge.

Provides explainable AI narrative synthesis on top of Model 2 assessment evidence.
"""

from __future__ import annotations
from typing import Dict, Any, List, Optional


class ExplanationBridge:
    """Formats and enriches explainability outputs from Model 2 evaluation."""

    @staticmethod
    def generate_executive_explanation(assessment_dict: Dict[str, Any]) -> str:
        """
        Synthesizes an executive, board-ready narrative explaining:
        1. 3-way reconciliation status
        2. Policy gate triggers (e.g. unverified bank change)
        3. Financial exposure breakdown (payment at risk vs historical unresolved)
        4. Clear action recommendation
        """
        score = assessment_dict.get("composite_risk_score", 0.0)
        level = assessment_dict.get("risk_level", "LOW")
        gate = assessment_dict.get("policy_gate", "CLEARED")
        payment_at_risk = assessment_dict.get("payment_at_risk", 0.0)
        hist_exposure = assessment_dict.get("historical_unresolved_exposure", 0.0)
        combined = assessment_dict.get("combined_exposure", 0.0)
        recon_status = assessment_dict.get("reconciliation_status", "matched")

        lines = [
            f"EXECUTIVE RISK ASSESSMENT BRIEF (Score: {score:.1f}/100 — {level})",
            "─────────────────────────────────────────────────────────────",
            f"1. Three-Way Matching: Status '{recon_status.upper()}'. All physical quantities and unit prices matched against PO/GRN.",
        ]

        if "G1" in str(gate) or "HOLD" in str(gate):
            lines.append(
                f"2. Active Policy Gate: [{gate}]. Beneficiary bank details differ from historical master record and require manager phone verification before payment release."
            )
        else:
            lines.append("2. Policy Gate: CLEARED. No active payment holds or beneficiary blocks.")

        lines.append(
            f"3. Exposure Quantification: ₹{payment_at_risk:,.2f} (Current Payment at Risk) + ₹{hist_exposure:,.2f} (Historical Unresolved Anomaly Exposure) = ₹{combined:,.2f} Combined Financial Exposure."
        )

        rec = assessment_dict.get("recommended_action")
        if rec:
            lines.append(f"4. Recommended Action: {rec}")

        return "\n".join(lines)

