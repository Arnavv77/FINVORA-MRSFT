"""FINVORA CAFIE Model 4 — Synthetic Enterprise Dataset Generator.

Provides realistic, hardcoded and deterministically seeded synthetic enterprise data
with 3 distinct rotational datasets/batches (Q1, Q2, Q3) so data visibly updates on reset:
- Batch 0: Q1 Enterprise IT Infrastructure & Server Upgrades
- Batch 1: Q2 Industrial Networking & Advanced Spares
- Batch 2: Q3 Cloud Data Center & High-Performance Compute

Clearly labelled as synthetic demonstration data for baseline ML models.
"""

from __future__ import annotations
import datetime
from typing import List, Dict, Any, Tuple
import numpy as np
from sqlalchemy.orm import Session
from app.cafie.model4.models import (
    Model4PurchaseOrder,
    Model4GoodsReceiptNote,
    Model4Invoice,
    Model4VendorMaster,
)


# Base Enterprise Vendors
SYNTHETIC_VENDORS_BASE = [
    {
        "vendor_code": "VEND-101",
        "vendor_name": "TechCorp Solutions Pvt Ltd",
        "category": "IT & Hardware",
        "gst_number": "29ABCDE1234F1Z5",
        "registered_bank_name": "HDFC Bank",
        "registered_bank_account": "50200012345678",
        "registered_ifsc": "HDFC0001234",
        "avg_lead_time_days": 4.5,
        "delivery_fill_rate": 99.4,
        "total_orders_completed": 84,
        "discrepancy_count": 1,
        "bank_change_count": 0,
        "compliance_status": "COMPLIANT",
        "risk_label": "LOW",
        "raw_text": "TechCorp Solutions Pvt Ltd. Vendor Code: VEND-101. Tier-1 Hardware supplier. ISO 9001:2015 certified. GSTIN: 29ABCDE1234F1Z5. Bank: HDFC Bank A/C 50200012345678 IFSC HDFC0001234. Clean financial compliance history, 99.4% SLA fill rate."
    },
    {
        "vendor_code": "VEND-102",
        "vendor_name": "Apex Cloud Infrastructure",
        "category": "Cloud & Networking",
        "gst_number": "27AABCA5678G2Z1",
        "registered_bank_name": "ICICI Bank",
        "registered_bank_account": "001105009876",
        "registered_ifsc": "ICIC0000011",
        "avg_lead_time_days": 6.2,
        "delivery_fill_rate": 88.0,
        "total_orders_completed": 42,
        "discrepancy_count": 7,
        "bank_change_count": 1,
        "compliance_status": "UNDER_AUDIT",
        "risk_label": "MEDIUM",
        "raw_text": "Apex Cloud Infrastructure. Vendor Code: VEND-102. Data center hardware and cloud storage provider. GSTIN: 27AABCA5678G2Z1. Bank: ICICI Bank A/C 001105009876 IFSC ICIC0000011. Noticeable shipment delays and packaging discrepancies over recent quarters."
    },
    {
        "vendor_code": "VEND-103",
        "vendor_name": "Quantum Chipset Ltd",
        "category": "Semiconductors & Components",
        "gst_number": "33AAACQ9876H3Z9",
        "registered_bank_name": "State Bank of India",
        "registered_bank_account": "334455667788",
        "registered_ifsc": "SBIN0004567",
        "avg_lead_time_days": 9.5,
        "delivery_fill_rate": 82.5,
        "total_orders_completed": 35,
        "discrepancy_count": 9,
        "bank_change_count": 1,
        "compliance_status": "UNDER_AUDIT",
        "risk_label": "MEDIUM",
        "raw_text": "Quantum Chipset Ltd. Vendor Code: VEND-103. Specialized microprocessors and semiconductor components. GSTIN: 33AAACQ9876H3Z9. Bank: State Bank of India A/C 334455667788 IFSC SBIN0004567. Moderate volatility in unit prices and import customs delays."
    },
    {
        "vendor_code": "VEND-104",
        "vendor_name": "CyberShield Security Systems",
        "category": "Security & Biometrics",
        "gst_number": "06AAACC1122J4Z3",
        "registered_bank_name": "Axis Bank",
        "registered_bank_account": "918020033445566",
        "registered_ifsc": "UTIB0001422",
        "avg_lead_time_days": 5.0,
        "delivery_fill_rate": 96.0,
        "total_orders_completed": 28,
        "discrepancy_count": 2,
        "bank_change_count": 0,
        "compliance_status": "COMPLIANT",
        "risk_label": "LOW",
        "raw_text": "CyberShield Security Systems. Vendor Code: VEND-104. Biometric access terminals and perimeter CCTV security systems. GSTIN: 06AAACC1122J4Z3. Bank: Axis Bank A/C 918020033445566 IFSC UTIB0001422. Strong compliance history and consistent deliverables."
    },
    {
        "vendor_code": "VEND-105",
        "vendor_name": "Global Logistics & Fleet Services",
        "category": "Supply Chain & Logistics",
        "gst_number": "29AABCG4455K5Z7",
        "registered_bank_name": "Kotak Mahindra Bank",
        "registered_bank_account": "221199884433",
        "registered_ifsc": "KKBK0000456",
        "avg_lead_time_days": 11.0,
        "delivery_fill_rate": 74.0,
        "total_orders_completed": 51,
        "discrepancy_count": 14,
        "bank_change_count": 2,
        "compliance_status": "SUSPENDED",
        "risk_label": "HIGH",
        "raw_text": "Global Logistics & Fleet Services. Vendor Code: VEND-105. Warehousing racks, forklift spare parts and logistics transport. GSTIN: 29AABCG4455K5Z7. Bank: Kotak Mahindra Bank A/C 221199884433 IFSC KKBK0000456. Repeated premature billing without delivery notes."
    },
    {
        "vendor_code": "VEND-106",
        "vendor_name": "Stellar Stationers & Printers",
        "category": "Office Supplies",
        "gst_number": "29AAECS7788L6Z2",
        "registered_bank_name": "Punjab National Bank",
        "registered_bank_account": "11223344556677",
        "registered_ifsc": "PUNB0011223",
        "avg_lead_time_days": 3.0,
        "delivery_fill_rate": 98.0,
        "total_orders_completed": 65,
        "discrepancy_count": 2,
        "bank_change_count": 0,
        "compliance_status": "COMPLIANT",
        "risk_label": "LOW",
        "raw_text": "Stellar Stationers & Printers. Vendor Code: VEND-106. Printing supplies, stationery and branded collateral. GSTIN: 29AAECS7788L6Z2. Bank: Punjab National Bank A/C 11223344556677 IFSC PUNB0011223. Reliable micro-spend vendor."
    },
    {
        "vendor_code": "VEND-107",
        "vendor_name": "Metro Facilities & Maintenance",
        "category": "Facility Management",
        "gst_number": "29AABCM9900M7Z8",
        "registered_bank_name": "HDFC Bank",
        "registered_bank_account": "50200099887766",
        "registered_ifsc": "HDFC0000984",
        "avg_lead_time_days": 14.0,
        "delivery_fill_rate": 68.0,
        "total_orders_completed": 19,
        "discrepancy_count": 11,
        "bank_change_count": 3,
        "compliance_status": "SUSPENDED",
        "risk_label": "HIGH",
        "raw_text": "Metro Facilities & Maintenance. Vendor Code: VEND-107. HVAC maintenance, facilities sanitation and electrical spares. GSTIN: 29AABCM9900M7Z8. Bank: HDFC Bank A/C 50200099887766 IFSC HDFC0000984. Flagged for unauthorized bank change requests and irregular billing."
    },
    {
        "vendor_code": "VEND-108",
        "vendor_name": "Dynamic Office Supplies",
        "category": "Office Furniture & Consumables",
        "gst_number": "29AABCD3344N8Z0",
        "registered_bank_name": "Canara Bank",
        "registered_bank_account": "0123101009988",
        "registered_ifsc": "CNRB0000123",
        "avg_lead_time_days": 5.5,
        "delivery_fill_rate": 92.0,
        "total_orders_completed": 30,
        "discrepancy_count": 4,
        "bank_change_count": 0,
        "compliance_status": "COMPLIANT",
        "risk_label": "LOW",
        "raw_text": "Dynamic Office Supplies. Vendor Code: VEND-108. Ergonomic chairs, desks and cafeteria fixtures. GSTIN: 29AABCD3344N8Z0. Bank: Canara Bank A/C 0123101009988 IFSC CNRB0000123. General commercial supplier with standard terms."
    }
]


# THREE HARDCODED ENTERPRISE DATASET BATCHES (Rotating on Reset)
DATASET_BATCHES = [
    # BATCH 0: Q1 Enterprise IT Hardware & Desktops
    {
        "batch_id": "BATCH-Q1",
        "batch_name": "Q1 Enterprise IT Hardware & Compute Upgrades",
        "prefix": "10",
        "scenarios": [
            {
                "po_number": "PO-2026-101", "grn_number": "GRN-2026-101", "invoice_number": "INV-2026-101",
                "vendor_code": "VEND-101", "vendor_name": "TechCorp Solutions Pvt Ltd", "department": "IT Operations", "date_offset": 25,
                "po_items": [
                    {"line_number": 1, "item_code": "HW-DESK-01", "description": "Dell OptiPlex 7090 Business Desktop", "quantity": 50.0, "unit_price": 45000.0, "total_price": 2250000.0, "unit_of_measure": "EA"},
                    {"line_number": 2, "item_code": "HW-MON-24", "description": "Dell UltraSharp 24 Monitor", "quantity": 50.0, "unit_price": 15000.0, "total_price": 750000.0, "unit_of_measure": "EA"}
                ],
                "grn_items": [
                    {"line_number": 1, "item_code": "HW-DESK-01", "description": "Dell OptiPlex 7090 Business Desktop", "received_quantity": 50.0, "accepted_quantity": 50.0, "rejected_quantity": 0.0},
                    {"line_number": 2, "item_code": "HW-MON-24", "description": "Dell UltraSharp 24 Monitor", "received_quantity": 50.0, "accepted_quantity": 50.0, "rejected_quantity": 0.0}
                ],
                "invoice_items": [
                    {"line_number": 1, "item_code": "HW-DESK-01", "description": "Dell OptiPlex 7090 Business Desktop", "quantity": 50.0, "unit_price": 45000.0, "total_price": 2250000.0},
                    {"line_number": 2, "item_code": "HW-MON-24", "description": "Dell UltraSharp 24 Monitor", "quantity": 50.0, "unit_price": 15000.0, "total_price": 750000.0}
                ],
                "grn_quality": "PASSED", "invoice_bank": "50200012345678", "invoice_ifsc": "HDFC0001234",
                "expected_match_status": "MATCHED", "expected_risk_level": "LOW", "scenario_type": "CLEAN_MATCH"
            },
            {
                "po_number": "PO-2026-102", "grn_number": "GRN-2026-102", "invoice_number": "INV-2026-102",
                "vendor_code": "VEND-102", "vendor_name": "Apex Cloud Infrastructure", "department": "Data Center", "date_offset": 20,
                "po_items": [{"line_number": 1, "item_code": "HW-SSD-NVME", "description": "Enterprise NVMe SSD 3.84TB U.2", "quantity": 100.0, "unit_price": 12000.0, "total_price": 1200000.0, "unit_of_measure": "EA"}],
                "grn_items": [{"line_number": 1, "item_code": "HW-SSD-NVME", "description": "Enterprise NVMe SSD 3.84TB U.2", "received_quantity": 100.0, "accepted_quantity": 80.0, "rejected_quantity": 20.0, "rejection_reason": "Damaged static-shield packaging on 20 units"}],
                "invoice_items": [{"line_number": 1, "item_code": "HW-SSD-NVME", "description": "Enterprise NVMe SSD 3.84TB U.2", "quantity": 100.0, "unit_price": 12000.0, "total_price": 1200000.0}],
                "grn_quality": "CONDITIONAL", "invoice_bank": "001105009876", "invoice_ifsc": "ICIC0000011",
                "expected_match_status": "QUANTITY_MISMATCH", "expected_risk_level": "HIGH", "scenario_type": "QUANTITY_MISMATCH"
            },
            {
                "po_number": "PO-2026-103", "grn_number": "GRN-2026-103", "invoice_number": "INV-2026-103",
                "vendor_code": "VEND-103", "vendor_name": "Quantum Chipset Ltd", "department": "R&D Hardware", "date_offset": 15,
                "po_items": [{"line_number": 1, "item_code": "CHIP-ARM-CORTEX", "description": "Industrial Microcontroller Core IC", "quantity": 200.0, "unit_price": 1500.0, "total_price": 300000.0, "unit_of_measure": "EA"}],
                "grn_items": [{"line_number": 1, "item_code": "CHIP-ARM-CORTEX", "description": "Industrial Microcontroller Core IC", "received_quantity": 200.0, "accepted_quantity": 200.0, "rejected_quantity": 0.0}],
                "invoice_items": [{"line_number": 1, "item_code": "CHIP-ARM-CORTEX", "description": "Industrial Microcontroller Core IC", "quantity": 200.0, "unit_price": 1800.0, "total_price": 360000.0}],
                "grn_quality": "PASSED", "invoice_bank": "334455667788", "invoice_ifsc": "SBIN0004567",
                "expected_match_status": "PRICE_MISMATCH", "expected_risk_level": "HIGH", "scenario_type": "PRICE_MISMATCH"
            },
            {
                "po_number": "PO-2026-104", "grn_number": "GRN-2026-104", "invoice_number": "INV-2026-104-DUP",
                "vendor_code": "VEND-104", "vendor_name": "CyberShield Security Systems", "department": "Physical Security", "date_offset": 12,
                "po_items": [{"line_number": 1, "item_code": "SEC-CAM-4K", "description": "Outdoor IP Dome Security Camera 4K", "quantity": 25.0, "unit_price": 18000.0, "total_price": 450000.0, "unit_of_measure": "EA"}],
                "grn_items": [{"line_number": 1, "item_code": "SEC-CAM-4K", "description": "Outdoor IP Dome Security Camera 4K", "received_quantity": 25.0, "accepted_quantity": 25.0, "rejected_quantity": 0.0}],
                "invoice_items": [{"line_number": 1, "item_code": "SEC-CAM-4K", "description": "Outdoor IP Dome Security Camera 4K", "quantity": 25.0, "unit_price": 18000.0, "total_price": 450000.0}],
                "grn_quality": "PASSED", "invoice_bank": "918020033445566", "invoice_ifsc": "UTIB0001422",
                "expected_match_status": "DUPLICATE", "expected_risk_level": "HIGH", "scenario_type": "DUPLICATE_INVOICE"
            },
            {
                "po_number": "PO-2026-105", "grn_number": None, "invoice_number": "INV-2026-105",
                "vendor_code": "VEND-105", "vendor_name": "Global Logistics & Fleet Services", "department": "Logistics", "date_offset": 8,
                "po_items": [{"line_number": 1, "item_code": "LOG-PALLET-RACK", "description": "Heavy Duty Warehouse Pallet Rack", "quantity": 15.0, "unit_price": 50000.0, "total_price": 750000.0, "unit_of_measure": "EA"}],
                "grn_items": [],
                "invoice_items": [{"line_number": 1, "item_code": "LOG-PALLET-RACK", "description": "Heavy Duty Warehouse Pallet Rack", "quantity": 15.0, "unit_price": 50000.0, "total_price": 750000.0}],
                "grn_quality": None, "invoice_bank": "221199884433", "invoice_ifsc": "KKBK0000456",
                "expected_match_status": "MISSING_GRN", "expected_risk_level": "HIGH", "scenario_type": "MISSING_GRN"
            },
            {
                "po_number": None, "grn_number": None, "invoice_number": "INV-2026-106",
                "vendor_code": "VEND-106", "vendor_name": "Stellar Stationers & Printers", "department": "Administration", "date_offset": 6,
                "po_items": [], "grn_items": [],
                "invoice_items": [{"line_number": 1, "item_code": "OFF-PAPER-A4", "description": "Premium Copier Paper A4 75GSM", "quantity": 50.0, "unit_price": 2500.0, "total_price": 125000.0}],
                "grn_quality": None, "invoice_bank": "11223344556677", "invoice_ifsc": "PUNB0011223",
                "expected_match_status": "MISSING_PO", "expected_risk_level": "MEDIUM", "scenario_type": "MISSING_PO"
            },
            {
                "po_number": "PO-2026-107", "grn_number": "GRN-2026-107", "invoice_number": "INV-2026-107",
                "vendor_code": "VEND-107", "vendor_name": "Metro Facilities & Maintenance", "department": "Facilities", "date_offset": 5,
                "po_items": [{"line_number": 1, "item_code": "FAC-HVAC-SVC", "description": "Chiller Plant Overhaul & Annual Servicing", "quantity": 1.0, "unit_price": 380000.0, "total_price": 380000.0, "unit_of_measure": "JOB"}],
                "grn_items": [{"line_number": 1, "item_code": "FAC-HVAC-SVC", "description": "Chiller Plant Overhaul & Annual Servicing", "received_quantity": 1.0, "accepted_quantity": 1.0, "rejected_quantity": 0.0}],
                "invoice_items": [{"line_number": 1, "item_code": "FAC-HVAC-SVC", "description": "Chiller Plant Overhaul & Annual Servicing", "quantity": 1.0, "unit_price": 380000.0, "total_price": 380000.0}],
                "grn_quality": "PASSED", "invoice_bank": "99887766554433", "invoice_ifsc": "YESB0000999",
                "expected_match_status": "3-WAY MISMATCH", "expected_risk_level": "HIGH", "scenario_type": "BANK_MISMATCH"
            },
            {
                "po_number": "PO-2026-108", "grn_number": "GRN-2026-108", "invoice_number": "INV-2026-108",
                "vendor_code": "VEND-108", "vendor_name": "Dynamic Office Supplies", "department": "HR & Admin", "date_offset": 3,
                "po_items": [{"line_number": 1, "item_code": "FUR-ERG-CHAIR", "description": "Ergonomic Mesh Task Chair", "quantity": 10.0, "unit_price": 12500.0, "total_price": 125000.0, "unit_of_measure": "EA"}],
                "grn_items": [{"line_number": 1, "item_code": "FUR-ERG-CHAIR", "description": "Ergonomic Mesh Task Chair", "received_quantity": 10.0, "accepted_quantity": 10.0, "rejected_quantity": 0.0}],
                "invoice_items": [{"line_number": 1, "item_code": "FUR-ERG-CHAIR", "description": "Ergonomic Mesh Task Chair", "quantity": 10.0, "unit_price": 12500.0, "total_price": 125000.0}],
                "grn_quality": "PASSED", "invoice_bank": "0123101009988", "invoice_ifsc": "CNRB0000123",
                "custom_tax_amount": 112500.0, "expected_match_status": "MULTI_ANOMALY", "expected_risk_level": "HIGH", "scenario_type": "FINANCIAL_ANOMALY"
            }
        ]
    },

    # BATCH 1: Q2 Industrial Networking & Advanced Spares
    {
        "batch_id": "BATCH-Q2",
        "batch_name": "Q2 Industrial Networking & Fiber Infrastructure",
        "prefix": "20",
        "scenarios": [
            {
                "po_number": "PO-2026-201", "grn_number": "GRN-2026-201", "invoice_number": "INV-2026-201",
                "vendor_code": "VEND-101", "vendor_name": "TechCorp Solutions Pvt Ltd", "department": "Core Network", "date_offset": 22,
                "po_items": [
                    {"line_number": 1, "item_code": "NET-SW-9300", "description": "Cisco Catalyst 9300 48-Port Switch", "quantity": 25.0, "unit_price": 110000.0, "total_price": 2750000.0, "unit_of_measure": "EA"},
                    {"line_number": 2, "item_code": "NET-MOD-10G", "description": "10G Network Uplink Module", "quantity": 25.0, "unit_price": 28000.0, "total_price": 700000.0, "unit_of_measure": "EA"}
                ],
                "grn_items": [
                    {"line_number": 1, "item_code": "NET-SW-9300", "description": "Cisco Catalyst 9300 48-Port Switch", "received_quantity": 25.0, "accepted_quantity": 25.0, "rejected_quantity": 0.0},
                    {"line_number": 2, "item_code": "NET-MOD-10G", "description": "10G Network Uplink Module", "received_quantity": 25.0, "accepted_quantity": 25.0, "rejected_quantity": 0.0}
                ],
                "invoice_items": [
                    {"line_number": 1, "item_code": "NET-SW-9300", "description": "Cisco Catalyst 9300 48-Port Switch", "quantity": 25.0, "unit_price": 110000.0, "total_price": 2750000.0},
                    {"line_number": 2, "item_code": "NET-MOD-10G", "description": "10G Network Uplink Module", "quantity": 25.0, "unit_price": 28000.0, "total_price": 700000.0}
                ],
                "grn_quality": "PASSED", "invoice_bank": "50200012345678", "invoice_ifsc": "HDFC0001234",
                "expected_match_status": "MATCHED", "expected_risk_level": "LOW", "scenario_type": "CLEAN_MATCH"
            },
            {
                "po_number": "PO-2026-202", "grn_number": "GRN-2026-202", "invoice_number": "INV-2026-202",
                "vendor_code": "VEND-102", "vendor_name": "Apex Cloud Infrastructure", "department": "Metro Fiber", "date_offset": 18,
                "po_items": [{"line_number": 1, "item_code": "FIBER-SFP-10G", "description": "SFP+ 10G Optical Transceiver LC Single Mode", "quantity": 150.0, "unit_price": 8500.0, "total_price": 1275000.0, "unit_of_measure": "EA"}],
                "grn_items": [{"line_number": 1, "item_code": "FIBER-SFP-10G", "description": "SFP+ 10G Optical Transceiver LC Single Mode", "received_quantity": 150.0, "accepted_quantity": 110.0, "rejected_quantity": 40.0, "rejection_reason": "Optical test failed on 40 units due to dust contamination"}],
                "invoice_items": [{"line_number": 1, "item_code": "FIBER-SFP-10G", "description": "SFP+ 10G Optical Transceiver LC Single Mode", "quantity": 150.0, "unit_price": 8500.0, "total_price": 1275000.0}],
                "grn_quality": "CONDITIONAL", "invoice_bank": "001105009876", "invoice_ifsc": "ICIC0000011",
                "expected_match_status": "QUANTITY_MISMATCH", "expected_risk_level": "HIGH", "scenario_type": "QUANTITY_MISMATCH"
            },
            {
                "po_number": "PO-2026-203", "grn_number": "GRN-2026-203", "invoice_number": "INV-2026-203",
                "vendor_code": "VEND-103", "vendor_name": "Quantum Chipset Ltd", "department": "Hardware Lab", "date_offset": 14,
                "po_items": [{"line_number": 1, "item_code": "FPGA-XILINX-7", "description": "Xilinx UltraScale FPGA Accelerator Board", "quantity": 50.0, "unit_price": 42000.0, "total_price": 2100000.0, "unit_of_measure": "EA"}],
                "grn_items": [{"line_number": 1, "item_code": "FPGA-XILINX-7", "description": "Xilinx UltraScale FPGA Accelerator Board", "received_quantity": 50.0, "accepted_quantity": 50.0, "rejected_quantity": 0.0}],
                "invoice_items": [{"line_number": 1, "item_code": "FPGA-XILINX-7", "description": "Xilinx UltraScale FPGA Accelerator Board", "quantity": 50.0, "unit_price": 49500.0, "total_price": 2475000.0}],
                "grn_quality": "PASSED", "invoice_bank": "334455667788", "invoice_ifsc": "SBIN0004567",
                "expected_match_status": "PRICE_MISMATCH", "expected_risk_level": "HIGH", "scenario_type": "PRICE_MISMATCH"
            },
            {
                "po_number": "PO-2026-204", "grn_number": "GRN-2026-204", "invoice_number": "INV-2026-204-DUP",
                "vendor_code": "VEND-104", "vendor_name": "CyberShield Security Systems", "department": "Site Security", "date_offset": 10,
                "po_items": [{"line_number": 1, "item_code": "BIO-TURNSTILE-GATE", "description": "Optical Flap Barrier Turnstile Gate", "quantity": 6.0, "unit_price": 145000.0, "total_price": 870000.0, "unit_of_measure": "EA"}],
                "grn_items": [{"line_number": 1, "item_code": "BIO-TURNSTILE-GATE", "description": "Optical Flap Barrier Turnstile Gate", "received_quantity": 6.0, "accepted_quantity": 6.0, "rejected_quantity": 0.0}],
                "invoice_items": [{"line_number": 1, "item_code": "BIO-TURNSTILE-GATE", "description": "Optical Flap Barrier Turnstile Gate", "quantity": 6.0, "unit_price": 145000.0, "total_price": 870000.0}],
                "grn_quality": "PASSED", "invoice_bank": "918020033445566", "invoice_ifsc": "UTIB0001422",
                "expected_match_status": "DUPLICATE", "expected_risk_level": "HIGH", "scenario_type": "DUPLICATE_INVOICE"
            },
            {
                "po_number": "PO-2026-205", "grn_number": None, "invoice_number": "INV-2026-205",
                "vendor_code": "VEND-105", "vendor_name": "Global Logistics & Fleet Services", "department": "Fleet", "date_offset": 7,
                "po_items": [{"line_number": 1, "item_code": "FL-FORKLIFT-BAT", "description": "Lithium-Ion Electric Forklift Battery 48V", "quantity": 8.0, "unit_price": 125000.0, "total_price": 1000000.0, "unit_of_measure": "EA"}],
                "grn_items": [],
                "invoice_items": [{"line_number": 1, "item_code": "FL-FORKLIFT-BAT", "description": "Lithium-Ion Electric Forklift Battery 48V", "quantity": 8.0, "unit_price": 125000.0, "total_price": 1000000.0}],
                "grn_quality": None, "invoice_bank": "221199884433", "invoice_ifsc": "KKBK0000456",
                "expected_match_status": "MISSING_GRN", "expected_risk_level": "HIGH", "scenario_type": "MISSING_GRN"
            },
            {
                "po_number": None, "grn_number": None, "invoice_number": "INV-2026-206",
                "vendor_code": "VEND-106", "vendor_name": "Stellar Stationers & Printers", "department": "Marketing", "date_offset": 5,
                "po_items": [], "grn_items": [],
                "invoice_items": [{"line_number": 1, "item_code": "MKT-ACRYLIC-BOARD", "description": "Corporate 3D Acrylic Signage & Exhibition Backdrop", "quantity": 1.0, "unit_price": 285000.0, "total_price": 285000.0}],
                "grn_quality": None, "invoice_bank": "11223344556677", "invoice_ifsc": "PUNB0011223",
                "expected_match_status": "MISSING_PO", "expected_risk_level": "MEDIUM", "scenario_type": "MISSING_PO"
            },
            {
                "po_number": "PO-2026-207", "grn_number": "GRN-2026-207", "invoice_number": "INV-2026-207",
                "vendor_code": "VEND-107", "vendor_name": "Metro Facilities & Maintenance", "department": "Electrical Engineering", "date_offset": 4,
                "po_items": [{"line_number": 1, "item_code": "ELEC-TRANS-SVC", "description": "11KV HT Transformer Oil Filtration & Testing", "quantity": 1.0, "unit_price": 450000.0, "total_price": 450000.0, "unit_of_measure": "JOB"}],
                "grn_items": [{"line_number": 1, "item_code": "ELEC-TRANS-SVC", "description": "11KV HT Transformer Oil Filtration & Testing", "received_quantity": 1.0, "accepted_quantity": 1.0, "rejected_quantity": 0.0}],
                "invoice_items": [{"line_number": 1, "item_code": "ELEC-TRANS-SVC", "description": "11KV HT Transformer Oil Filtration & Testing", "quantity": 1.0, "unit_price": 450000.0, "total_price": 450000.0}],
                "grn_quality": "PASSED", "invoice_bank": "88776655443322", "invoice_ifsc": "PAYT0123456",
                "expected_match_status": "3-WAY MISMATCH", "expected_risk_level": "HIGH", "scenario_type": "BANK_MISMATCH"
            },
            {
                "po_number": "PO-2026-208", "grn_number": "GRN-2026-208", "invoice_number": "INV-2026-208",
                "vendor_code": "VEND-108", "vendor_name": "Dynamic Office Supplies", "department": "Procurement", "date_offset": 2,
                "po_items": [{"line_number": 1, "item_code": "CON-BOARDROOM-TBL", "description": "Solid Teak 16-Seater Executive Conference Table", "quantity": 1.0, "unit_price": 220000.0, "total_price": 220000.0, "unit_of_measure": "EA"}],
                "grn_items": [{"line_number": 1, "item_code": "CON-BOARDROOM-TBL", "description": "Solid Teak 16-Seater Executive Conference Table", "received_quantity": 1.0, "accepted_quantity": 1.0, "rejected_quantity": 0.0}],
                "invoice_items": [{"line_number": 1, "item_code": "CON-BOARDROOM-TBL", "description": "Solid Teak 16-Seater Executive Conference Table", "quantity": 1.0, "unit_price": 220000.0, "total_price": 220000.0}],
                "grn_quality": "PASSED", "invoice_bank": "0123101009988", "invoice_ifsc": "CNRB0000123",
                "custom_tax_amount": 198000.0, "expected_match_status": "MULTI_ANOMALY", "expected_risk_level": "HIGH", "scenario_type": "FINANCIAL_ANOMALY"
            }
        ]
    },

    # BATCH 2: Q3 Cloud Data Center & AI Compute Accelerators
    {
        "batch_id": "BATCH-Q3",
        "batch_name": "Q3 Cloud Data Center & High-Performance Compute",
        "prefix": "30",
        "scenarios": [
            {
                "po_number": "PO-2026-301", "grn_number": "GRN-2026-301", "invoice_number": "INV-2026-301",
                "vendor_code": "VEND-101", "vendor_name": "TechCorp Solutions Pvt Ltd", "department": "AI Infrastructure", "date_offset": 24,
                "po_items": [
                    {"line_number": 1, "item_code": "HPC-SERVER-4U", "description": "4U High-Density GPU Compute Node (Dual Xeon)", "quantity": 10.0, "unit_price": 420000.0, "total_price": 4200000.0, "unit_of_measure": "EA"},
                    {"line_number": 2, "item_code": "HPC-INFI-CARD", "description": "InfiniBand HDR 200Gb/s Dual-Port Adapter", "quantity": 10.0, "unit_price": 65000.0, "total_price": 650000.0, "unit_of_measure": "EA"}
                ],
                "grn_items": [
                    {"line_number": 1, "item_code": "HPC-SERVER-4U", "description": "4U High-Density GPU Compute Node (Dual Xeon)", "received_quantity": 10.0, "accepted_quantity": 10.0, "rejected_quantity": 0.0},
                    {"line_number": 2, "item_code": "HPC-INFI-CARD", "description": "InfiniBand HDR 200Gb/s Dual-Port Adapter", "received_quantity": 10.0, "accepted_quantity": 10.0, "rejected_quantity": 0.0}
                ],
                "invoice_items": [
                    {"line_number": 1, "item_code": "HPC-SERVER-4U", "description": "4U High-Density GPU Compute Node (Dual Xeon)", "quantity": 10.0, "unit_price": 420000.0, "total_price": 4200000.0},
                    {"line_number": 2, "item_code": "HPC-INFI-CARD", "description": "InfiniBand HDR 200Gb/s Dual-Port Adapter", "quantity": 10.0, "unit_price": 65000.0, "total_price": 650000.0}
                ],
                "grn_quality": "PASSED", "invoice_bank": "50200012345678", "invoice_ifsc": "HDFC0001234",
                "expected_match_status": "MATCHED", "expected_risk_level": "LOW", "scenario_type": "CLEAN_MATCH"
            },
            {
                "po_number": "PO-2026-302", "grn_number": "GRN-2026-302", "invoice_number": "INV-2026-302",
                "vendor_code": "VEND-102", "vendor_name": "Apex Cloud Infrastructure", "department": "Power Management", "date_offset": 19,
                "po_items": [{"line_number": 1, "item_code": "PWR-MOD-3000W", "description": "Titanium Redundant Server Power Supply 3000W", "quantity": 80.0, "unit_price": 18500.0, "total_price": 1480000.0, "unit_of_measure": "EA"}],
                "grn_items": [{"line_number": 1, "item_code": "PWR-MOD-3000W", "description": "Titanium Redundant Server Power Supply 3000W", "received_quantity": 80.0, "accepted_quantity": 60.0, "rejected_quantity": 20.0, "rejection_reason": "High-voltage surge test failed on 20 PSU units"}],
                "invoice_items": [{"line_number": 1, "item_code": "PWR-MOD-3000W", "description": "Titanium Redundant Server Power Supply 3000W", "quantity": 80.0, "unit_price": 18500.0, "total_price": 1480000.0}],
                "grn_quality": "CONDITIONAL", "invoice_bank": "001105009876", "invoice_ifsc": "ICIC0000011",
                "expected_match_status": "QUANTITY_MISMATCH", "expected_risk_level": "HIGH", "scenario_type": "QUANTITY_MISMATCH"
            },
            {
                "po_number": "PO-2026-303", "grn_number": "GRN-2026-303", "invoice_number": "INV-2026-303",
                "vendor_code": "VEND-103", "vendor_name": "Quantum Chipset Ltd", "department": "Silicon Design", "date_offset": 16,
                "po_items": [{"line_number": 1, "item_code": "NPU-CHIP-TENSOR", "description": "Neural Processing Unit (NPU) Edge Tensor IC", "quantity": 100.0, "unit_price": 7500.0, "total_price": 750000.0, "unit_of_measure": "EA"}],
                "grn_items": [{"line_number": 1, "item_code": "NPU-CHIP-TENSOR", "description": "Neural Processing Unit (NPU) Edge Tensor IC", "received_quantity": 100.0, "accepted_quantity": 100.0, "rejected_quantity": 0.0}],
                "invoice_items": [{"line_number": 1, "item_code": "NPU-CHIP-TENSOR", "description": "Neural Processing Unit (NPU) Edge Tensor IC", "quantity": 100.0, "unit_price": 9400.0, "total_price": 940000.0}],
                "grn_quality": "PASSED", "invoice_bank": "334455667788", "invoice_ifsc": "SBIN0004567",
                "expected_match_status": "PRICE_MISMATCH", "expected_risk_level": "HIGH", "scenario_type": "PRICE_MISMATCH"
            },
            {
                "po_number": "PO-2026-304", "grn_number": "GRN-2026-304", "invoice_number": "INV-2026-304-DUP",
                "vendor_code": "VEND-104", "vendor_name": "CyberShield Security Systems", "department": "Perimeter Control", "date_offset": 11,
                "po_items": [{"line_number": 1, "item_code": "SEC-RADAR-PERIM", "description": "Perimeter Surveillance Microwave Radar Sensor", "quantity": 8.0, "unit_price": 160000.0, "total_price": 1280000.0, "unit_of_measure": "EA"}],
                "grn_items": [{"line_number": 1, "item_code": "SEC-RADAR-PERIM", "description": "Perimeter Surveillance Microwave Radar Sensor", "received_quantity": 8.0, "accepted_quantity": 8.0, "rejected_quantity": 0.0}],
                "invoice_items": [{"line_number": 1, "item_code": "SEC-RADAR-PERIM", "description": "Perimeter Surveillance Microwave Radar Sensor", "quantity": 8.0, "unit_price": 160000.0, "total_price": 1280000.0}],
                "grn_quality": "PASSED", "invoice_bank": "918020033445566", "invoice_ifsc": "UTIB0001422",
                "expected_match_status": "DUPLICATE", "expected_risk_level": "HIGH", "scenario_type": "DUPLICATE_INVOICE"
            },
            {
                "po_number": "PO-2026-305", "grn_number": None, "invoice_number": "INV-2026-305",
                "vendor_code": "VEND-105", "vendor_name": "Global Logistics & Fleet Services", "department": "Logistics Ops", "date_offset": 6,
                "po_items": [{"line_number": 1, "item_code": "CRANE-HOIST-2T", "description": "Electric Overhead Crane Hoist 2-Ton Capacity", "quantity": 3.0, "unit_price": 320000.0, "total_price": 960000.0, "unit_of_measure": "EA"}],
                "grn_items": [],
                "invoice_items": [{"line_number": 1, "item_code": "CRANE-HOIST-2T", "description": "Electric Overhead Crane Hoist 2-Ton Capacity", "quantity": 3.0, "unit_price": 320000.0, "total_price": 960000.0}],
                "grn_quality": None, "invoice_bank": "221199884433", "invoice_ifsc": "KKBK0000456",
                "expected_match_status": "MISSING_GRN", "expected_risk_level": "HIGH", "scenario_type": "MISSING_GRN"
            },
            {
                "po_number": None, "grn_number": None, "invoice_number": "INV-2026-306",
                "vendor_code": "VEND-106", "vendor_name": "Stellar Stationers & Printers", "department": "Executive Office", "date_offset": 4,
                "po_items": [], "grn_items": [],
                "invoice_items": [{"line_number": 1, "item_code": "EXE-LEATHER-DIARY", "description": "Bespoke Embossed Leather Executive Planners (300 Units)", "quantity": 300.0, "unit_price": 1200.0, "total_price": 360000.0}],
                "grn_quality": None, "invoice_bank": "11223344556677", "invoice_ifsc": "PUNB0011223",
                "expected_match_status": "MISSING_PO", "expected_risk_level": "MEDIUM", "scenario_type": "MISSING_PO"
            },
            {
                "po_number": "PO-2026-307", "grn_number": "GRN-2026-307", "invoice_number": "INV-2026-307",
                "vendor_code": "VEND-107", "vendor_name": "Metro Facilities & Maintenance", "department": "Data Center Environmental", "date_offset": 3,
                "po_items": [{"line_number": 1, "item_code": "FAC-UPS-BAT-SVC", "description": "Modular 500KVA Online UPS Battery Bank Replacement", "quantity": 1.0, "unit_price": 520000.0, "total_price": 520000.0, "unit_of_measure": "JOB"}],
                "grn_items": [{"line_number": 1, "item_code": "FAC-UPS-BAT-SVC", "description": "Modular 500KVA Online UPS Battery Bank Replacement", "received_quantity": 1.0, "accepted_quantity": 1.0, "rejected_quantity": 0.0}],
                "invoice_items": [{"line_number": 1, "item_code": "FAC-UPS-BAT-SVC", "description": "Modular 500KVA Online UPS Battery Bank Replacement", "quantity": 1.0, "unit_price": 520000.0, "total_price": 520000.0}],
                "grn_quality": "PASSED", "invoice_bank": "77665544332211", "invoice_ifsc": "AIRP0000001",
                "expected_match_status": "3-WAY MISMATCH", "expected_risk_level": "HIGH", "scenario_type": "BANK_MISMATCH"
            },
            {
                "po_number": "PO-2026-308", "grn_number": "GRN-2026-308", "invoice_number": "INV-2026-308",
                "vendor_code": "VEND-108", "vendor_name": "Dynamic Office Supplies", "department": "Workplace Tech", "date_offset": 1,
                "po_items": [{"line_number": 1, "item_code": "DESK-MOT-ADJ", "description": "Dual-Motor Electric Height Adjustable Standing Desk", "quantity": 15.0, "unit_price": 32000.0, "total_price": 480000.0, "unit_of_measure": "EA"}],
                "grn_items": [{"line_number": 1, "item_code": "DESK-MOT-ADJ", "description": "Dual-Motor Electric Height Adjustable Standing Desk", "received_quantity": 15.0, "accepted_quantity": 15.0, "rejected_quantity": 0.0}],
                "invoice_items": [{"line_number": 1, "item_code": "DESK-MOT-ADJ", "description": "Dual-Motor Electric Height Adjustable Standing Desk", "quantity": 15.0, "unit_price": 32000.0, "total_price": 480000.0}],
                "grn_quality": "PASSED", "invoice_bank": "0123101009988", "invoice_ifsc": "CNRB0000123",
                "custom_tax_amount": 336000.0, "expected_match_status": "MULTI_ANOMALY", "expected_risk_level": "HIGH", "scenario_type": "FINANCIAL_ANOMALY"
            }
        ]
    }
]


def generate_synthetic_documents(seed: int = 42) -> Tuple[List[str], List[str]]:
    """Generates synthetic labelled text documents for training Document Classifier (TF-IDF + LogisticRegression)."""
    rng = np.random.RandomState(seed)
    texts: List[str] = []
    labels: List[str] = []

    po_templates = [
        "PURCHASE ORDER No: {po}. Vendor: {vendor}. Delivery Date: {date}. Line Items: {items}. Terms: Net 30 days. Authorized procurement officer signature required. Goods subject to warehouse receipt acceptance.",
        "ENTERPRISE PO #{po} issued to {vendor}. Total contracted amount: INR {amount}. Shipping to Central Fulfillment Warehouse. Requisition authorized by Finance Director.",
        "OFFICIAL PURCHASE ORDER {po}. Department: IT Infrastructure. Bill to: Finvora HQ. Vendor Code: {vcode}. Line item descriptions: Dell OptiPlex, Intel Xeon Servers, Cisco Catalyst Switches. Standard warranty included.",
        "STANDARD PURCHASE ORDER CONTRACT {po}. Buyer acknowledges purchase of industrial hardware from {vendor}. Contracted rate fixed per Schedule B.",
        "PO REQUISITION {po}. Vendor: {vendor}. Incoterms: DDP Bangalore. Payment Milestone: 30 days from Goods Receipt Note signoff."
    ]

    grn_templates = [
        "GOODS RECEIPT NOTE GRN-{grn}. Reference PO: {po}. Received from {vendor}. Warehouse Gate Entry Pass verified. Package intact. QC Inspection Status: PASSED. Received Units: {rec}. Accepted: {acc}. Rejected: {rej}.",
        "MATERIAL RECEIPT VOUCHER #{grn} at Warehouse WH-BLR-01. PO Reference: {po}. Consignment received via carrier BlueDart Logistics. Accepted quantity: {acc} items. Visual defect check passed.",
        "WAREHOUSE GRN ENTRY {grn}. Inspection Report for PO {po}. Dock supervisor inspection recorded. Damaged items: {rej} units rejected due to transit seal breakage.",
        "GOODS INWARD NOTE GRN-{grn}. Inbound logistics verification completed for vendor {vendor}. Items checked against bill of lading and PO packing slip.",
        "QUALITY INSPECTION & GOODS RECEIPT {grn}. PO #{po}. Quantity accepted: {acc}. Storekeeper signoff logged in warehouse management system."
    ]

    inv_templates = [
        "TAX INVOICE #{inv}. Vendor: {vendor}. GSTIN: {gst}. Billed To: FINVORA Enterprises. Line Total: INR {amount}. Tax (GST 18%): INR {tax}. Net Payable: INR {total}. Bank Account: {bank} IFSC: {ifsc}. Payment due in 15 days.",
        "COMMERCIAL INVOICE {inv} for Purchase Order {po}. Supplier: {vendor}. HSN Code: 8471. Subtotal: {amount}. GSTIN verified. Remittance instructions: Wire transfer to {bank}.",
        "BILL OF SUPPLY / TAX INVOICE {inv}. PO Ref: {po}. Description of services and delivered equipment. Payment terms: Electronic Fund Transfer (EFT). Please remit to IFSC {ifsc}.",
        "SUPPLIER INVOICE {inv}. PO Number: {po}. Total Invoice Amount: INR {total}. GST Registration Number: {gst}. Bank Details: State Bank / HDFC Bank.",
        "TAX INVOICE ORIGINAL FOR RECIPIENT {inv}. Reference Purchase Order: {po}. Taxable value: INR {amount}, Integrated GST: INR {tax}."
    ]

    vendor_templates = [
        "VENDOR MASTER PROFILE {vcode}. Entity: {vendor}. Category: Enterprise IT & Hardware. GSTIN: {gst}. Registered Bank Account: {bank}. Delivery Fill Rate: {fill}%. Compliance Status: COMPLIANT. Low risk enterprise supplier.",
        "SUPPLIER MASTER RECORD {vcode} - {vendor}. Historical transaction rating: A+. Discrepancy count: {disc}. Average lead time: {lead} days. Compliance certification ISO/IEC 27001.",
        "VENDOR BEHAVIORAL PROFILE {vcode}. Corporate name: {vendor}. Bank change history: {bchg} requests. Ongoing risk score evaluation: {risk_label}. Status: {comp}.",
        "VENDOR REGISTRATION DOSSIER {vcode}. Vendor Name: {vendor}. Master banking credentials recorded and dual-custody authorized.",
        "VENDOR PROFILE SHEET {vcode}. Trade creditor classification: Approved Preferred Vendor. Annual procurement spend: Tier 1."
    ]

    vendors = SYNTHETIC_VENDORS_BASE

    for i in range(25):
        v = vendors[i % len(vendors)]
        po_num = f"PO-2026-{100 + i}"
        grn_num = f"GRN-2026-{100 + i}"
        inv_num = f"INV-2026-{100 + i}"
        amt = float(rng.randint(50000, 3500000))
        tax = amt * 0.18
        tot = amt + tax
        rec = float(rng.randint(20, 200))
        rej = 0.0 if rng.rand() > 0.3 else float(rng.randint(1, 10))
        acc = rec - rej

        # PO Document
        tmpl_po = rng.choice(po_templates)
        texts.append(tmpl_po.format(
            po=po_num, vendor=v["vendor_name"], vcode=v["vendor_code"],
            date="2026-10-15", items="Server blades, Cisco Routers", amount=f"{tot:,.2f}"
        ))
        labels.append("PURCHASE_ORDER")

        # GRN Document
        tmpl_grn = rng.choice(grn_templates)
        texts.append(tmpl_grn.format(
            grn=grn_num, po=po_num, vendor=v["vendor_name"],
            rec=int(rec), acc=int(acc), rej=int(rej)
        ))
        labels.append("GOODS_RECEIPT_NOTE")

        # Invoice Document
        tmpl_inv = rng.choice(inv_templates)
        texts.append(tmpl_inv.format(
            inv=inv_num, vendor=v["vendor_name"], gst=v["gst_number"],
            amount=f"{amt:,.2f}", tax=f"{tax:,.2f}", total=f"{tot:,.2f}",
            bank=v["registered_bank_account"], ifsc=v["registered_ifsc"], po=po_num
        ))
        labels.append("INVOICE")

        # Vendor Profile Document
        tmpl_vend = rng.choice(vendor_templates)
        texts.append(tmpl_vend.format(
            vcode=v["vendor_code"], vendor=v["vendor_name"], gst=v["gst_number"],
            bank=v["registered_bank_account"], fill=v["delivery_fill_rate"],
            disc=v["discrepancy_count"], lead=v["avg_lead_time_days"],
            bchg=v["bank_change_count"], risk_label=v["risk_label"], comp=v["compliance_status"]
        ))
        labels.append("VENDOR_PROFILE")

    return texts, labels


def generate_synthetic_features(seed: int = 42):
    """Generates synthetic feature matrices and target vectors for ML models."""
    rng = np.random.RandomState(seed)
    n_invoices = 120

    inv_features = []
    inv_labels = []

    for _ in range(n_invoices):
        cat = rng.choice(["LOW", "MEDIUM", "HIGH"], p=[0.55, 0.25, 0.20])
        if cat == "LOW":
            qty_dev = float(rng.uniform(0.0, 0.02))
            price_dev = float(rng.uniform(0.0, 0.01))
            tax_dev = float(rng.uniform(0.0, 0.03))
            amount = float(rng.uniform(25000, 800000))
            lead_time = float(rng.uniform(2, 7))
            disc_rate = float(rng.uniform(0.0, 0.05))
        elif cat == "MEDIUM":
            qty_dev = float(rng.uniform(0.03, 0.15))
            price_dev = float(rng.uniform(0.02, 0.08))
            tax_dev = float(rng.uniform(0.04, 0.12))
            amount = float(rng.uniform(300000, 2000000))
            lead_time = float(rng.uniform(6, 14))
            disc_rate = float(rng.uniform(0.08, 0.20))
        else:  # HIGH
            qty_dev = float(rng.uniform(0.15, 0.60))
            price_dev = float(rng.uniform(0.10, 0.40))
            tax_dev = float(rng.uniform(0.15, 0.50))
            amount = float(rng.uniform(800000, 7500000))
            lead_time = float(rng.uniform(12, 30))
            disc_rate = float(rng.uniform(0.25, 0.70))

        inv_features.append([qty_dev, price_dev, tax_dev, amount, lead_time, disc_rate])
        inv_labels.append(cat)

    inv_features = np.array(inv_features, dtype=float)
    inv_labels = np.array(inv_labels)

    # Anomaly Detection Dataset (Isolation Forest)
    anomaly_features = []
    for _ in range(100):
        amt = float(rng.uniform(20000, 1500000))
        tax_ratio = float(rng.uniform(0.175, 0.185))
        up_ratio = float(rng.uniform(0.98, 1.02))
        q_ratio = float(rng.uniform(0.98, 1.02))
        anomaly_features.append([amt, tax_ratio, up_ratio, q_ratio])

    # Outliers
    for _ in range(15):
        amt = float(rng.uniform(4000000, 12000000))
        tax_ratio = float(rng.choice([0.05, 0.45, 0.60]))
        up_ratio = float(rng.uniform(1.30, 2.50))
        q_ratio = float(rng.uniform(1.25, 3.00))
        anomaly_features.append([amt, tax_ratio, up_ratio, q_ratio])

    anomaly_features = np.array(anomaly_features, dtype=float)

    # Vendor Risk Dataset (RandomForest)
    vend_features = []
    vend_labels = []
    for _ in range(80):
        vcat = rng.choice(["LOW", "MEDIUM", "HIGH"], p=[0.50, 0.30, 0.20])
        if vcat == "LOW":
            fill = float(rng.uniform(95.0, 100.0))
            disc = int(rng.randint(0, 3))
            bchg = 0
            lead = float(rng.uniform(2.0, 6.0))
            orders = int(rng.randint(30, 150))
        elif vcat == "MEDIUM":
            fill = float(rng.uniform(80.0, 94.0))
            disc = int(rng.randint(4, 9))
            bchg = int(rng.choice([0, 1]))
            lead = float(rng.uniform(6.0, 12.0))
            orders = int(rng.randint(15, 60))
        else:  # HIGH
            fill = float(rng.uniform(50.0, 78.0))
            disc = int(rng.randint(10, 25))
            bchg = int(rng.randint(2, 5))
            lead = float(rng.uniform(12.0, 25.0))
            orders = int(rng.randint(5, 30))

        vend_features.append([fill, disc, bchg, lead, orders])
        vend_labels.append(vcat)

    vend_features = np.array(vend_features, dtype=float)
    vend_labels = np.array(vend_labels)

    return inv_features, inv_labels, anomaly_features, vend_features, vend_labels


def seed_model4_database(db: Session, seed: int = 42, dataset_version: str = "v4.0.0-seed-42") -> Dict[str, Any]:
    """Cleans and re-seeds all Model 4 database tables with rotational hardcoded datasets.
    
    Rotates across 3 distinct batches based on the seed so data visibly updates on reset:
    - Batch 0: Q1 Enterprise IT Hardware (e.g. PO-2026-101, Dell Desktops)
    - Batch 1: Q2 Industrial Networking (e.g. PO-2026-201, Cisco Switches)
    - Batch 2: Q3 Cloud Data Center (e.g. PO-2026-301, AI Compute Nodes)
    """
    today = datetime.date.today()
    batch_idx = int(seed) % len(DATASET_BATCHES)
    active_batch = DATASET_BATCHES[batch_idx]
    scenarios = active_batch["scenarios"]
    batch_name = active_batch["batch_name"]

    # 1. Clear existing Model 4 data safely
    from app.cafie.model4.models import (
        Model4DecisionRecord,
        Model4ValidationResult,
        Model4Invoice,
        Model4GoodsReceiptNote,
        Model4PurchaseOrder,
        Model4VendorMaster,
    )
    db.query(Model4DecisionRecord).delete()
    db.query(Model4ValidationResult).delete()
    db.query(Model4Invoice).delete()
    db.query(Model4GoodsReceiptNote).delete()
    db.query(Model4PurchaseOrder).delete()
    db.query(Model4VendorMaster).delete()
    db.commit()

    # 2. Populate Vendor Master (with slight seed-based variance)
    rng = np.random.RandomState(seed)
    for v_data in SYNTHETIC_VENDORS_BASE:
        # Subtle variance in orders and fill rate depending on seed
        orders_jitter = max(5, v_data["total_orders_completed"] + int(rng.randint(-4, 5)))
        fill_jitter = round(min(100.0, max(50.0, v_data["delivery_fill_rate"] + float(rng.uniform(-0.8, 0.8)))), 1)

        vendor = Model4VendorMaster(
            company_id=1,
            vendor_code=v_data["vendor_code"],
            vendor_name=v_data["vendor_name"],
            category=v_data["category"],
            gst_number=v_data["gst_number"],
            registered_bank_name=v_data["registered_bank_name"],
            registered_bank_account=v_data["registered_bank_account"],
            registered_ifsc=v_data["registered_ifsc"],
            avg_lead_time_days=v_data["avg_lead_time_days"],
            delivery_fill_rate=fill_jitter,
            total_orders_completed=orders_jitter,
            discrepancy_count=v_data["discrepancy_count"],
            bank_change_count=v_data["bank_change_count"],
            compliance_status=v_data["compliance_status"],
            risk_label=v_data["risk_label"],
            raw_text=v_data["raw_text"],
        )
        db.add(vendor)
    db.commit()

    # 3. Populate PO, GRN, and Invoices from the active rotational batch
    po_count = 0
    grn_count = 0
    inv_count = 0

    for sc in scenarios:
        offset_days = sc["date_offset"]
        doc_date = today - datetime.timedelta(days=offset_days)
        due_date = doc_date + datetime.timedelta(days=30)

        # A. Purchase Order
        if sc["po_number"] is not None:
            subtotal = sum(item["total_price"] for item in sc["po_items"])
            tax = round(subtotal * 0.18, 2)
            total = round(subtotal + tax, 2)
            po = Model4PurchaseOrder(
                company_id=1,
                po_number=sc["po_number"],
                vendor_code=sc["vendor_code"],
                vendor_name=sc["vendor_name"],
                department=sc["department"],
                issue_date=doc_date,
                delivery_due_date=due_date,
                subtotal_amount=subtotal,
                tax_amount=tax,
                total_amount=total,
                currency="INR",
                approval_status="APPROVED",
                items=sc["po_items"],
            )
            db.add(po)
            po_count += 1

        # B. Goods Receipt Note
        if sc["grn_number"] is not None:
            total_rec = sum(item["received_quantity"] for item in sc["grn_items"])
            total_acc = sum(item["accepted_quantity"] for item in sc["grn_items"])
            total_rej = sum(item["rejected_quantity"] for item in sc["grn_items"])
            grn = Model4GoodsReceiptNote(
                company_id=1,
                grn_number=sc["grn_number"],
                po_number=sc["po_number"],
                vendor_code=sc["vendor_code"],
                receipt_date=doc_date + datetime.timedelta(days=3),
                warehouse_id="WH-BLR-01",
                carrier_name="BlueDart Express",
                received_quantity=total_rec,
                accepted_quantity=total_acc,
                rejected_quantity=total_rej,
                quality_inspection_status=sc.get("grn_quality") or "PASSED",
                rejection_reason=sc["grn_items"][0].get("rejection_reason") if sc["grn_items"] and total_rej > 0 else None,
                items=sc["grn_items"],
            )
            db.add(grn)
            grn_count += 1

        # C. Invoice
        if sc["invoice_number"] is not None:
            inv_subtotal = sum(item["total_price"] for item in sc["invoice_items"])
            inv_tax = sc.get("custom_tax_amount") if "custom_tax_amount" in sc else round(inv_subtotal * 0.18, 2)
            inv_total = round(inv_subtotal + inv_tax, 2)

            raw_txt = (
                f"TAX INVOICE: {sc['invoice_number']}\n"
                f"PO Ref: {sc['po_number']}\n"
                f"Vendor: {sc['vendor_name']} ({sc['vendor_code']})\n"
                f"Date: {doc_date}\n"
                f"Subtotal: INR {inv_subtotal:,.2f}\n"
                f"Tax: INR {inv_tax:,.2f}\n"
                f"Total Amount: INR {inv_total:,.2f}\n"
                f"Bank A/C: {sc['invoice_bank']} | IFSC: {sc['invoice_ifsc']}"
            )

            inv = Model4Invoice(
                company_id=1,
                invoice_number=sc["invoice_number"],
                po_number=sc["po_number"],
                vendor_code=sc["vendor_code"],
                vendor_name=sc["vendor_name"],
                invoice_date=doc_date + datetime.timedelta(days=5),
                due_date=due_date + datetime.timedelta(days=5),
                subtotal_amount=inv_subtotal,
                tax_amount=inv_tax,
                total_amount=inv_total,
                currency="INR",
                bank_name="Commercial Bank",
                bank_account_number=sc["invoice_bank"],
                ifsc_code=sc["invoice_ifsc"],
                payment_status="PENDING_APPROVAL",
                items=sc["invoice_items"],
                raw_text=raw_txt,
            )
            db.add(inv)
            inv_count += 1

    # 4. Add duplicate tracking invoice baseline
    orig_inv_num = f"INV-2026-{active_batch['prefix']}4-ORIG"
    dup_po = f"PO-2026-{active_batch['prefix']}4"
    orig_inv = Model4Invoice(
        company_id=1,
        invoice_number=orig_inv_num,
        po_number=dup_po,
        vendor_code="VEND-104",
        vendor_name="CyberShield Security Systems",
        invoice_date=today - datetime.timedelta(days=20),
        due_date=today + datetime.timedelta(days=10),
        subtotal_amount=750000.0,
        tax_amount=135000.0,
        total_amount=885000.0,
        currency="INR",
        bank_name="Axis Bank",
        bank_account_number="918020033445566",
        ifsc_code="UTIB0001422",
        payment_status="PAID",
        items=[
            {"line_number": 1, "item_code": "SEC-CAM-4K", "description": "Security Device Line Item", "quantity": 10.0, "unit_price": 75000.0, "total_price": 750000.0}
        ],
        raw_text=f"TAX INVOICE {orig_inv_num}. PAID IN FULL."
    )
    db.add(orig_inv)
    inv_count += 1

    db.commit()

    return {
        "batch_id": active_batch["batch_id"],
        "batch_name": batch_name,
        "vendors_count": len(SYNTHETIC_VENDORS_BASE),
        "purchase_orders_count": po_count,
        "goods_receipts_count": grn_count,
        "invoices_count": inv_count,
    }
