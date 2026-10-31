import {
  SourceConnection,
  Transaction,
  AnomalyRecord,
  Invoice,
  DepartmentBudget,
  PaymentScheduleItem,
  DecisionProposal,
  WorkflowRule,
  DataQualityIssue,
  AgingBucket,
  CashForecastPoint
} from '../types';

export const INITIAL_DATA_SOURCES: SourceConnection[] = [
  {
    id: 'src-1',
    name: 'HDFC Corporate Current A/C',
    type: 'bank',
    status: 'connected',
    lastSyncTime: '12 minutes ago',
    recordCount: 1420,
    healthScore: 74,
    accountNumber: '••••••••8901',
    description: 'Primary operating account for enterprise payroll & vendor RTGS/NEFT'
  },
  {
    id: 'src-2',
    name: 'SAP S/4HANA Cloud',
    type: 'erp',
    status: 'connected',
    lastSyncTime: '28 minutes ago',
    recordCount: 3890,
    healthScore: 71,
    accountNumber: 'PRD-IND-01',
    description: 'Enterprise ERP for purchase orders, general ledger, and inventory'
  },
  {
    id: 'src-3',
    name: 'RazorpayX Vendor Payouts',
    type: 'gateway',
    status: 'connected',
    lastSyncTime: '5 minutes ago',
    recordCount: 850,
    healthScore: 76,
    accountNumber: 'acc_rzp_9841',
    description: 'Automated 24x7 instant vendor payouts and contractor disbursements'
  },
  {
    id: 'src-4',
    name: 'Zoho Books Enterprise',
    type: 'accounting',
    status: 'connected',
    lastSyncTime: '1 hour ago',
    recordCount: 2120,
    healthScore: 68,
    accountNumber: 'ORG-600129',
    description: 'Accounts receivable tracking, e-invoicing and GST portal integration'
  },
  {
    id: 'src-5',
    name: 'ICICI Treasury & Forex A/C',
    type: 'bank',
    status: 'connected',
    lastSyncTime: '3 hours ago',
    recordCount: 410,
    healthScore: 73,
    accountNumber: '••••••••4432',
    description: 'Secondary liquidity reserve and cross-border SaaS subscription account'
  }
];

export const INITIAL_DATA_QUALITY_ISSUES: DataQualityIssue[] = [
  {
    id: 'dqi-1',
    type: 'duplicate_hash',
    severity: 'high',
    title: 'Potential Duplicate Invoice Hash Detected',
    count: 2,
    sampleEntity: 'INV-2024-8849 / Zenith Cloud Services',
    action: 'Review in Risk Module'
  },
  {
    id: 'dqi-2',
    type: 'missing_gst',
    severity: 'medium',
    title: 'Unverified Vendor GSTIN in Inward Register',
    count: 4,
    sampleEntity: 'Vertex Logistics Solutions',
    action: 'Validate with GST Portal'
  },
  {
    id: 'dqi-3',
    type: 'unmapped_category',
    severity: 'low',
    title: 'Transactions without Department Tagging',
    count: 7,
    sampleEntity: 'ICICI Forex charges & Swift fees',
    action: 'Auto-categorize via ML'
  }
];

export const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: 'TXN-8091',
    date: '2024-09-24',
    referenceNo: 'HDFC-NEFT-99120',
    description: 'Monthly SaaS Infrastructure Hosting - Production AWS',
    vendorId: 'VND-101',
    vendorName: 'Zenith Cloud Services Pvt Ltd',
    category: 'Software & Cloud',
    department: 'IT & Infrastructure',
    amount: 680000,
    type: 'outflow',
    status: 'flagged',
    source: 'HDFC Corporate Current A/C',
    isAnomaly: true,
    notes: 'Triggered rule: Duplicate invoice matching INV-2024-8841'
  },
  {
    id: 'TXN-8090',
    date: '2024-09-23',
    referenceNo: 'RZP-PAY-44102',
    description: 'Q3 Enterprise Software Development Retainer',
    vendorId: 'VND-104',
    vendorName: 'Cognitive Infotech Solutions',
    category: 'Software & Cloud',
    department: 'Engineering',
    amount: 1450000,
    type: 'outflow',
    status: 'cleared',
    source: 'RazorpayX Vendor Payouts'
  },
  {
    id: 'TXN-8089',
    date: '2024-09-22',
    referenceNo: 'CMS-INV-REC-110',
    description: 'Enterprise License Renewal - Bharat Petroleum Corp Ltd',
    vendorName: 'Bharat Petroleum Corp Ltd',
    category: 'Customer Revenue',
    department: 'Sales & Operations',
    amount: 4850000,
    type: 'inflow',
    status: 'cleared',
    source: 'HDFC Corporate Current A/C'
  },
  {
    id: 'TXN-8088',
    date: '2024-09-20',
    referenceNo: 'HDFC-RTGS-55410',
    description: 'Server Rack Upgrade & GPU Nodes Expansion PO #8891',
    vendorId: 'VND-108',
    vendorName: 'HyperScale Systems Pvt Ltd',
    category: 'Capital Equipment',
    department: 'Engineering',
    amount: 3850000,
    type: 'outflow',
    status: 'pending',
    source: 'SAP S/4HANA Cloud',
    isAnomaly: true,
    notes: '9.1x higher than 90-day moving average spend'
  },
  {
    id: 'TXN-8087',
    date: '2024-09-19',
    referenceNo: 'SAP-AP-33219',
    description: 'AWS Kubernetes Reserved Capacity & Direct Connect Q3',
    vendorId: 'VND-101',
    vendorName: 'Zenith Cloud Services Pvt Ltd',
    category: 'Software & Cloud',
    department: 'IT & Infrastructure',
    amount: 680000,
    type: 'outflow',
    status: 'cleared',
    source: 'SAP S/4HANA Cloud',
    notes: 'Cleared original payment for Inv #8841'
  },
  {
    id: 'TXN-8086',
    date: '2024-09-18',
    referenceNo: 'HDFC-SAL-0924',
    description: 'Engineering & Product Staff Payroll Advance - Sep 2024',
    vendorName: 'Internal Payroll Disbursal',
    category: 'Salaries & Benefits',
    department: 'HR & Admin',
    amount: 4200000,
    type: 'outflow',
    status: 'cleared',
    source: 'HDFC Corporate Current A/C'
  },
  {
    id: 'TXN-8085',
    date: '2024-09-17',
    referenceNo: 'CMS-REC-9941',
    description: 'Platform Annual Subscription - Tata Digital Ltd',
    vendorName: 'Tata Digital Ltd',
    category: 'Customer Revenue',
    department: 'Sales & Operations',
    amount: 6200000,
    type: 'inflow',
    status: 'cleared',
    source: 'HDFC Corporate Current A/C'
  },
  {
    id: 'TXN-8084',
    date: '2024-09-16',
    referenceNo: 'ZOHO-EXP-7721',
    description: 'Performance Marketing & Lead Acquisition Ads - Google/Meta',
    vendorId: 'VND-112',
    vendorName: 'Apex Growth Media LLP',
    category: 'Marketing & Media',
    department: 'Marketing',
    amount: 1850000,
    type: 'outflow',
    status: 'cleared',
    source: 'ICICI Treasury & Forex A/C',
    notes: 'Marketing category is 8% over allocated monthly run-rate'
  },
  {
    id: 'TXN-8083',
    date: '2024-09-15',
    referenceNo: 'RZP-PAY-11029',
    description: 'Corporate Legal & M&A Advisory Services Q2 Retainer',
    vendorId: 'VND-115',
    vendorName: 'Shardul Amarchand & Partners',
    category: 'Legal & Professional',
    department: 'Finance & Legal',
    amount: 750000,
    type: 'outflow',
    status: 'cleared',
    source: 'RazorpayX Vendor Payouts'
  },
  {
    id: 'TXN-8082',
    date: '2024-09-14',
    referenceNo: 'CMS-REC-8842',
    description: 'Milestone 2 Delivery Payment - Reliance Retail',
    vendorName: 'Reliance Retail Ventures',
    category: 'Customer Revenue',
    department: 'Sales & Operations',
    amount: 3400000,
    type: 'inflow',
    status: 'cleared',
    source: 'HDFC Corporate Current A/C'
  },
  {
    id: 'TXN-8081',
    date: '2024-09-12',
    referenceNo: 'SAP-AP-99014',
    description: 'Bengaluru Corporate Office Lease & Maintenance - Oct',
    vendorId: 'VND-120',
    vendorName: 'Embassy Tech Parks REIT',
    category: 'Office & Facilities',
    department: 'HR & Admin',
    amount: 980000,
    type: 'outflow',
    status: 'cleared',
    source: 'SAP S/4HANA Cloud'
  },
  {
    id: 'TXN-8080',
    date: '2024-09-10',
    referenceNo: 'RZP-PAY-7740',
    description: 'Pan-India Cold Chain Freight & Fulfillment',
    vendorId: 'VND-122',
    vendorName: 'BlueDart DHL Express Ltd',
    category: 'Logistics & Supply',
    department: 'Sales & Operations',
    amount: 820000,
    type: 'outflow',
    status: 'cleared',
    source: 'RazorpayX Vendor Payouts'
  }
];

export const INITIAL_ANOMALIES: AnomalyRecord[] = [
  {
    id: 'ANOM-2024-001',
    title: 'Duplicate Invoice Detected: Same Amount, Vendor & Hash',
    type: 'duplicate_invoice',
    severity: 'critical',
    detectedDate: '2024-09-24',
    vendorName: 'Zenith Cloud Services Pvt Ltd',
    amount: 680000,
    estimatedExposure: 680000,
    status: 'open',
    confidenceScore: 97.4,
    ruleTriggered: 'RULE-AP-002: Dual Invoice Hash & Amount Collision within 14 Days',
    evidence: [
      { label: 'Original Invoice', value: 'INV-2024-8841 (Cleared on 19 Sep 2024)' },
      { label: 'Duplicate Candidate', value: 'INV-2024-8849 (Submitted on 24 Sep 2024)', matchHighlight: true },
      { label: 'Amount Match', value: '₹6,80,000.00 (100% exact match)', matchHighlight: true },
      { label: 'Vendor GSTIN', value: '27AAACZ4921M1ZX (Identical)', matchHighlight: true },
      { label: 'Beneficiary Bank A/C', value: 'HDFC0000240 - 502000481920 (Identical)', matchHighlight: true },
      { label: 'Description Overlap', value: 'AWS Kubernetes Reserved Capacity & Direct Connect Q3 (96% semantic similarity)' }
    ],
    supportingRecords: [
      {
        recordId: 'INV-2024-8841',
        description: 'Original cleared invoice for AWS Q3 Reserved Capacity',
        date: '2024-09-18',
        amount: 680000,
        source: 'SAP S/4HANA Cloud'
      },
      {
        recordId: 'INV-2024-8849',
        description: 'New pending invoice with duplicate PO line item',
        date: '2024-09-24',
        amount: 680000,
        source: 'Zoho Books Enterprise'
      }
    ],
    recommendedAction: 'Propose immediate payment hold on INV-2024-8849 and flag vendor accounting department',
    assignedTo: 'Finance Ops Lead',
    reviewHistory: [
      {
        timestamp: '2024-09-24 09:14:02 IST',
        user: 'FINVORA Predictive Engine',
        action: 'Anomaly Detected',
        note: 'High confidence duplicate detected upon Zoho Books sync.'
      }
    ]
  },
  {
    id: 'ANOM-2024-002',
    title: 'Unusually Large Vendor Invoice Spike (9.1x Historical Baseline)',
    type: 'unusual_transaction',
    severity: 'critical',
    detectedDate: '2024-09-21',
    vendorName: 'HyperScale Systems Pvt Ltd',
    amount: 3850000,
    estimatedExposure: 3850000,
    status: 'under_review',
    confidenceScore: 92.1,
    ruleTriggered: 'RULE-AP-008: Outlier Detection > 3 Sigma against 90-day Vendor Mean',
    evidence: [
      { label: 'Submitted Invoice Amount', value: '₹38,50,000.00', matchHighlight: true },
      { label: '90-Day Average Spend', value: '₹4,20,000.00' },
      { label: 'Spike Ratio', value: '9.16x standard deviation envelope', matchHighlight: true },
      { label: 'Matching PO', value: 'PO #8891 (Unsigned by CTO)' },
      { label: 'Budget Category', value: 'Capital Equipment (Engineering)' }
    ],
    supportingRecords: [
      {
        recordId: 'PO-8891',
        description: 'Purchase Order created by Infrastructure team',
        date: '2024-09-15',
        amount: 3850000,
        source: 'SAP S/4HANA Cloud'
      }
    ],
    recommendedAction: 'Require VP Engineering and CFO dual sign-off before scheduling payment',
    assignedTo: 'Senior Finance Analyst',
    reviewHistory: [
      {
        timestamp: '2024-09-21 14:22:10 IST',
        user: 'FINVORA Rule Engine',
        action: 'Anomaly Detected',
        note: 'Outlier flag triggered based on 90-day moving window.'
      },
      {
        timestamp: '2024-09-22 11:05:00 IST',
        user: 'Pooja Sharma (Analyst)',
        action: 'Review Started',
        note: 'Requested signed contract and delivery receipts from Engineering PM.'
      }
    ]
  },
  {
    id: 'ANOM-2024-003',
    title: 'Department Monthly Spend Exceeded Pre-Approved Threshold',
    type: 'budget_deviations',
    severity: 'warning',
    detectedDate: '2024-09-19',
    vendorName: 'Apex Growth Media LLP',
    amount: 1850000,
    estimatedExposure: 360000,
    status: 'open',
    confidenceScore: 88.5,
    ruleTriggered: 'RULE-BUD-004: Departmental Variance > 105% of Monthly Allocation',
    evidence: [
      { label: 'Department', value: 'Marketing & Growth' },
      { label: 'Monthly Budget Allocated', value: '₹45,00,000.00' },
      { label: 'Committed + Spent', value: '₹48,60,000.00', matchHighlight: true },
      { label: 'Overrun Variance', value: '+₹3,60,000.00 (+8.0% Unfavorable)', matchHighlight: true },
      { label: 'Primary Driver', value: 'Unplanned Festive Paid Acquisition Ad Blitz' }
    ],
    supportingRecords: [
      {
        recordId: 'INV-2024-8712',
        description: 'Google & Meta Ads Invoice for mid-month campaign',
        date: '2024-09-16',
        amount: 1850000,
        source: 'Zoho Books Enterprise'
      }
    ],
    recommendedAction: 'Propose reallocation of ₹4,50,000 from Engineering surplus or freeze discretionary ad campaigns',
    assignedTo: 'Budget Controller',
    reviewHistory: [
      {
        timestamp: '2024-09-19 16:40:00 IST',
        user: 'FINVORA Budget Engine',
        action: 'Anomaly Detected',
        note: 'Marketing variance threshold exceeded.'
      }
    ]
  },
  {
    id: 'ANOM-2024-004',
    title: 'Vendor Bank Account Routing Details Changed Prior to Release',
    type: 'abnormal_vendor_activity',
    severity: 'warning',
    detectedDate: '2024-09-18',
    vendorName: 'Vertex Logistics Solutions',
    amount: 1240000,
    estimatedExposure: 1240000,
    status: 'under_review',
    confidenceScore: 84.0,
    ruleTriggered: 'RULE-SEC-012: Beneficiary IFSC & Account Modified within 48h of Payout',
    evidence: [
      { label: 'Previous Account', value: 'HDFC Bank - ••••9921' },
      { label: 'Modified Account', value: 'Yes Bank - ••••3312', matchHighlight: true },
      { label: 'Initiated By', value: 'Vendor Portal Web Submission' },
      { label: 'Penny Drop Status', value: 'Pending Name Match Verification' }
    ],
    supportingRecords: [
      {
        recordId: 'VND-MOD-991',
        description: 'Vendor master update request',
        date: '2024-09-18',
        amount: 1240000,
        source: 'RazorpayX Vendor Payouts'
      }
    ],
    recommendedAction: 'Execute automated penny-drop verification and obtain verbal confirmation from vendor CFO',
    assignedTo: 'Treasury Manager',
    reviewHistory: [
      {
        timestamp: '2024-09-18 10:11:00 IST',
        user: 'FINVORA Security Guard',
        action: 'Anomaly Detected',
        note: 'Beneficiary change detected before payment batch release.'
      }
    ]
  }
];

export const INITIAL_INVOICES: Invoice[] = [
  {
    id: 'INV-2024-8849',
    invoiceNumber: 'INV-2024-8849',
    vendorName: 'Zenith Cloud Services Pvt Ltd',
    vendorCategory: 'Software & Cloud',
    department: 'IT & Infrastructure',
    amount: 680000,
    issueDate: '2024-09-18',
    dueDate: '2024-09-28',
    status: 'pending_approval',
    riskLevel: 'high',
    priorityScore: 94,
    priorityReason: 'Identified as duplicate candidate of INV-2024-8841. Immediate hold advised.',
    isDuplicateCandidate: true,
    duplicateMatchedId: 'INV-2024-8841',
    gstNumber: '27AAACZ4921M1ZX',
    paymentTerms: 'Net 10 Days',
    lineItems: [
      { description: 'AWS Kubernetes Reserved Capacity Cluster (Q3)', quantity: 1, unitPrice: 500000, total: 500000 },
      { description: 'Direct Connect 10Gbps Dedicated Port Lease', quantity: 1, unitPrice: 76271, total: 76271 },
      { description: 'Integrated GST (18%)', quantity: 1, unitPrice: 103729, total: 103729 }
    ]
  },
  {
    id: 'INV-2024-8841',
    invoiceNumber: 'INV-2024-8841',
    vendorName: 'Zenith Cloud Services Pvt Ltd',
    vendorCategory: 'Software & Cloud',
    department: 'IT & Infrastructure',
    amount: 680000,
    issueDate: '2024-09-12',
    dueDate: '2024-09-22',
    status: 'paid',
    riskLevel: 'low',
    priorityScore: 20,
    priorityReason: 'Settled via HDFC NetBanking on 19 Sep 2024',
    isDuplicateCandidate: false,
    gstNumber: '27AAACZ4921M1ZX',
    paymentTerms: 'Net 10 Days',
    lineItems: [
      { description: 'AWS Kubernetes Reserved Capacity Cluster (Q3)', quantity: 1, unitPrice: 500000, total: 500000 },
      { description: 'Direct Connect 10Gbps Dedicated Port Lease', quantity: 1, unitPrice: 76271, total: 76271 },
      { description: 'Integrated GST (18%)', quantity: 1, unitPrice: 103729, total: 103729 }
    ]
  },
  {
    id: 'INV-2024-8902',
    invoiceNumber: 'INV-2024-8902',
    vendorName: 'HyperScale Systems Pvt Ltd',
    vendorCategory: 'Capital Equipment',
    department: 'Engineering',
    amount: 3850000,
    issueDate: '2024-09-15',
    dueDate: '2024-09-30',
    status: 'pending_approval',
    riskLevel: 'high',
    priorityScore: 88,
    priorityReason: 'Significant cash drain. Requires dual tier approval per workflow rule.',
    isDuplicateCandidate: false,
    gstNumber: '29AABCH9912K1ZY',
    paymentTerms: 'Net 15 Days',
    lineItems: [
      { description: 'NVIDIA H100 Enterprise Rack Server Nodes (2x)', quantity: 2, unitPrice: 1631355, total: 3262710 },
      { description: 'High-speed InfiniBand switches & cabling', quantity: 1, unitPrice: 0, total: 0 },
      { description: 'GST (18%)', quantity: 1, unitPrice: 587290, total: 587290 }
    ]
  },
  {
    id: 'INV-2024-8712',
    invoiceNumber: 'INV-2024-8712',
    vendorName: 'Apex Growth Media LLP',
    vendorCategory: 'Marketing & Media',
    department: 'Marketing',
    amount: 1850000,
    issueDate: '2024-09-10',
    dueDate: '2024-09-25',
    status: 'pending_approval',
    riskLevel: 'medium',
    priorityScore: 78,
    priorityReason: 'Marketing department variance > 105%. Recommend budget reallocation verification.',
    isDuplicateCandidate: false,
    gstNumber: '27AABCA3319L1ZP',
    paymentTerms: 'Net 15 Days',
    lineItems: [
      { description: 'Google Ads Paid Search & Performance Max Budget Disbursal', quantity: 1, unitPrice: 1150000, total: 1150000 },
      { description: 'Meta Paid Social Lead Generation Campaign', quantity: 1, unitPrice: 417796, total: 417796 },
      { description: 'GST (18%)', quantity: 1, unitPrice: 282204, total: 282204 }
    ]
  },
  {
    id: 'INV-2024-8660',
    invoiceNumber: 'INV-2024-8660',
    vendorName: 'Shardul Amarchand & Partners',
    vendorCategory: 'Legal & Professional',
    department: 'Finance & Legal',
    amount: 750000,
    issueDate: '2024-09-05',
    dueDate: '2024-09-20',
    status: 'overdue',
    riskLevel: 'medium',
    priorityScore: 82,
    priorityReason: 'Overdue by 4 days. Critical legal counsel retainer; risk of penalty.',
    isDuplicateCandidate: false,
    gstNumber: '07AAAFS4410H1ZZ',
    paymentTerms: 'Net 15 Days',
    lineItems: [
      { description: 'Series B Corporate Restructuring & Compliance Filing Retainer', quantity: 1, unitPrice: 635593, total: 635593 },
      { description: 'GST (18%)', quantity: 1, unitPrice: 114407, total: 114407 }
    ]
  },
  {
    id: 'INV-2024-8991',
    invoiceNumber: 'INV-2024-8991',
    vendorName: 'Embassy Tech Parks REIT',
    vendorCategory: 'Office & Facilities',
    department: 'HR & Admin',
    amount: 980000,
    issueDate: '2024-09-18',
    dueDate: '2024-10-05',
    status: 'approved',
    riskLevel: 'low',
    priorityScore: 65,
    priorityReason: 'Fixed monthly facility cost. Scheduled for early October release.',
    isDuplicateCandidate: false,
    gstNumber: '29AAATE1120Q1ZM',
    paymentTerms: 'Net 20 Days',
    lineItems: [
      { description: 'Bengaluru Tech Park Floor 4 Lease - Oct 2024', quantity: 1, unitPrice: 830508, total: 830508 },
      { description: 'Common Area Maintenance & DG Power Backup', quantity: 1, unitPrice: 0, total: 0 },
      { description: 'GST (18%)', quantity: 1, unitPrice: 149492, total: 149492 }
    ]
  },
  {
    id: 'INV-2024-9014',
    invoiceNumber: 'INV-2024-9014',
    vendorName: 'BlueDart DHL Express Ltd',
    vendorCategory: 'Logistics & Supply',
    department: 'Sales & Operations',
    amount: 820000,
    issueDate: '2024-09-20',
    dueDate: '2024-10-02',
    status: 'approved',
    riskLevel: 'low',
    priorityScore: 70,
    priorityReason: 'Essential supply chain fulfillment. Pre-cleared by Operations VP.',
    isDuplicateCandidate: false,
    gstNumber: '27AAACB0012E1ZN',
    paymentTerms: 'Net 15 Days',
    lineItems: [
      { description: 'Pan-India Express Surface Logistics (6,420 Consignments)', quantity: 1, unitPrice: 694915, total: 694915 },
      { description: 'GST (18%)', quantity: 1, unitPrice: 125085, total: 125085 }
    ]
  }
];

export const INITIAL_DEPARTMENT_BUDGETS: DepartmentBudget[] = [
  {
    id: 'dept-eng',
    department: 'Engineering',
    headOfDepartment: 'Dr. Vikramaditya Sen (VP Eng)',
    allocated: 12000000, // 1.20 Cr
    spent: 9450000,
    committed: 1550000,
    projectedMonthEnd: 11000000,
    historicalSpend: 9200000,
    varianceAmount: -1000000, // 10 L under budget (favorable)
    variancePercentage: -8.3,
    isUnfavorable: false,
    status: 'on_track',
    categories: [
      { name: 'Cloud Infrastructure', allocated: 4500000, spent: 3900000 },
      { name: 'Tooling & Licenses', allocated: 2500000, spent: 2100000 },
      { name: 'Contract Staffing', allocated: 3500000, spent: 2600000 },
      { name: 'R&D Hardware', allocated: 1500000, spent: 850000 }
    ]
  },
  {
    id: 'dept-mktg',
    department: 'Marketing & Growth',
    headOfDepartment: 'Ananya Deshmukh (CMO)',
    allocated: 4500000, // 45 L
    spent: 4860000,
    committed: 450000,
    projectedMonthEnd: 5310000,
    historicalSpend: 4100000,
    varianceAmount: 810000, // Overspend!
    variancePercentage: 18.0,
    isUnfavorable: true, // Higher spending is unfavorable
    status: 'over_budget',
    categories: [
      { name: 'Performance Advertising', allocated: 2200000, spent: 2750000 },
      { name: 'Agency Retainers', allocated: 1000000, spent: 980000 },
      { name: 'Events & Conferences', allocated: 800000, spent: 780000 },
      { name: 'Brand & Creative Assets', allocated: 500000, spent: 350000 }
    ]
  },
  {
    id: 'dept-sales',
    department: 'Sales & Operations',
    headOfDepartment: 'Rohan Mehra (VP Sales)',
    allocated: 7500000, // 75 L
    spent: 5820000,
    committed: 900000,
    projectedMonthEnd: 6720000,
    historicalSpend: 6100000,
    varianceAmount: -780000,
    variancePercentage: -10.4,
    isUnfavorable: false,
    status: 'on_track',
    categories: [
      { name: 'Logistics & Warehousing', allocated: 3500000, spent: 2900000 },
      { name: 'Sales Commissions & Incentives', allocated: 2500000, spent: 1800000 },
      { name: 'Client Travel & Entertainment', allocated: 1000000, spent: 780000 },
      { name: 'CRM & Data Subscriptions', allocated: 500000, spent: 340000 }
    ]
  },
  {
    id: 'dept-it',
    department: 'IT & Infrastructure',
    headOfDepartment: 'Suresh Iyer (CIO)',
    allocated: 6000000, // 60 L
    spent: 5780000,
    committed: 150000,
    projectedMonthEnd: 5930000,
    historicalSpend: 5400000,
    varianceAmount: -70000,
    variancePercentage: -1.2,
    isUnfavorable: false,
    status: 'at_risk',
    categories: [
      { name: 'Enterprise SaaS & Email', allocated: 2800000, spent: 2750000 },
      { name: 'Cybersecurity & Audits', allocated: 1800000, spent: 1720000 },
      { name: 'Network Leased Lines & Telecom', allocated: 900000, spent: 890000 },
      { name: 'Workstation Replacements', allocated: 500000, spent: 420000 }
    ]
  },
  {
    id: 'dept-hr',
    department: 'HR & Admin',
    headOfDepartment: 'Kavita Menon (CHRO)',
    allocated: 3000000, // 30 L
    spent: 2410000,
    committed: 250000,
    projectedMonthEnd: 2660000,
    historicalSpend: 2350000,
    varianceAmount: -340000,
    variancePercentage: -11.3,
    isUnfavorable: false,
    status: 'on_track',
    categories: [
      { name: 'Office Leases & Pantry', allocated: 1500000, spent: 1250000 },
      { name: 'Recruiting Portals & Fees', allocated: 800000, spent: 620000 },
      { name: 'Employee Wellness & Health', allocated: 450000, spent: 380000 },
      { name: 'Training & L&D', allocated: 250000, spent: 160000 }
    ]
  },
  {
    id: 'dept-fin',
    department: 'Finance & Legal',
    headOfDepartment: 'Rajesh Gopinathan (CFO)',
    allocated: 2500000, // 25 L
    spent: 1840000,
    committed: 210000,
    projectedMonthEnd: 2050000,
    historicalSpend: 1900000,
    varianceAmount: -450000,
    variancePercentage: -18.0,
    isUnfavorable: false,
    status: 'on_track',
    categories: [
      { name: 'Legal Counsel & Retainers', allocated: 1200000, spent: 950000 },
      { name: 'Statutory Audit Fees', allocated: 700000, spent: 500000 },
      { name: 'Tax Consultancy & Transfer Pricing', allocated: 400000, spent: 270000 },
      { name: 'Bank Charges & Forex Fees', allocated: 200000, spent: 120000 }
    ]
  }
];

export const INITIAL_DECISION_PROPOSALS: DecisionProposal[] = [
  {
    id: 'PROP-2024-001',
    title: 'Payment Hold on Duplicate Invoice #INV-2024-8849',
    type: 'payment_hold',
    severity: 'critical',
    amount: 680000,
    description: 'Prevent double disbursement to Zenith Cloud Services by enforcing an automated payment hold pending invoice verification.',
    evidence: [
      'Identical amount (₹6,80,000.00) matching cleared invoice INV-2024-8841 on 19 Sep 2024.',
      'Identical vendor GSTIN (27AAACZ4921M1ZX) and beneficiary IFSC/account.',
      'Line item description match: "AWS Kubernetes Reserved Capacity & Direct Connect Q3" with 96% token similarity.',
      'Zero purchase order variance reported by Engineering VP.'
    ],
    expectedImpact: 'Protects ₹6,80,000 working capital immediately; prevents erroneous cash outflow; averts lowest cash trough on Day 48.',
    assumptions: [
      'Vendor invoice was auto-generated twice due to a webhook retry from their billing system.',
      'No operational disruption will occur since AWS infrastructure capacity is already secured under INV-2024-8841.'
    ],
    confidence: 78.4,
    status: 'draft',
    requestedBy: 'Pooja Sharma (Finance Analyst)',
    assignedReviewer: 'Rajesh Gopinathan (Finance Manager / CFO)',
    createdAt: '2024-09-24 09:30 IST',
    updatedAt: '2024-09-24 09:30 IST',
    targetEntityId: 'INV-2024-8849'
  },
  {
    id: 'PROP-2024-002',
    title: 'Inter-Departmental Budget Reallocation to Marketing',
    type: 'budget_reallocation',
    severity: 'warning',
    amount: 450000,
    description: 'Transfer ₹4,50,000 surplus from Engineering tooling buffer to Marketing & Growth to offset Q3 festive acquisition overspend.',
    evidence: [
      'Engineering projected month-end surplus is ₹10,00,000.',
      'Marketing spend is currently ₹48,60,000 against ₹45,00,000 allocation (108% run rate).',
      'Festive customer acquisition CPA is performing at ₹240 (target: ₹290), justifying incremental ad spend.'
    ],
    expectedImpact: 'Eliminates Marketing overspend red-flag; maintains zero net impact on total enterprise monthly expenditure limit.',
    assumptions: [
      'Engineering will not need to procure unannounced on-premise hardware before October 15.',
      'CMO commits to capping incremental performance ad spend at ₹4,50,000.'
    ],
    confidence: 73.2,
    status: 'pending_approval',
    requestedBy: 'Ananya Deshmukh (CMO)',
    assignedReviewer: 'Rajesh Gopinathan (Finance Manager / CFO)',
    createdAt: '2024-09-23 15:45 IST',
    updatedAt: '2024-09-23 15:45 IST',
    targetEntityId: 'dept-mktg'
  },
  {
    id: 'PROP-2024-003',
    title: 'Dual Approval Clearance for Server Rack PO #8891',
    type: 'payment_approval',
    severity: 'warning',
    amount: 3850000,
    description: 'Release 50% milestone payment (₹19,25,000) for HyperScale Systems upon physical delivery inspection at Bengaluru datacenter.',
    evidence: [
      'Vendor issued invoice for full ₹38,50,000 upfront.',
      'Contract terms specify 50% on bill of lading, 50% post-burn-in test.',
      'Splitting payment safeguards ₹19,25,000 cash balance for 3 weeks.'
    ],
    expectedImpact: 'Smoothes cash outflow curve; guarantees hardware delivery compliance prior to final settlement.',
    assumptions: [
      'Datacenter team will complete node mounting within 5 working days.',
      'HyperScale Systems will accept milestone split.'
    ],
    confidence: 76.5,
    status: 'pending_approval',
    requestedBy: 'Vikramaditya Sen (VP Eng)',
    assignedReviewer: 'Rajesh Gopinathan (Finance Manager / CFO)',
    createdAt: '2024-09-22 17:10 IST',
    updatedAt: '2024-09-22 17:10 IST',
    targetEntityId: 'INV-2024-8902'
  }
];

export const INITIAL_WORKFLOW_RULES: WorkflowRule[] = [
  {
    id: 'RULE-WF-01',
    name: 'High-Value AP Dual Sign-off',
    description: 'Any invoice exceeding ₹10,00,000 must be routed to the Finance Manager and Department VP for approval before scheduling.',
    condition: 'Invoice Amount > ₹10,00,000',
    action: 'Route to Finance Manager & Department VP',
    isActive: true,
    triggerCount: 14
  },
  {
    id: 'RULE-WF-02',
    name: 'Duplicate Invoice Auto-Quarantine',
    description: 'If semantic or hash match score > 90% against invoices in last 30 days, freeze payout and alert AP team.',
    condition: 'Duplicate Match Score ≥ 90%',
    action: 'Automated Payment Hold & Alert AP Ops',
    isActive: true,
    triggerCount: 3
  },
  {
    id: 'RULE-WF-03',
    name: 'Department Spend Rate Circuit Breaker',
    description: 'If department month-to-date spend reaches 95% before day 22 of the billing cycle, flag all non-essential POs.',
    condition: 'MTD Spend ≥ 95% before Day 22',
    action: 'Freeze Discretionary POs & Notify Controller',
    isActive: true,
    triggerCount: 1
  },
  {
    id: 'RULE-WF-04',
    name: 'Beneficiary Bank Details Guard',
    description: 'If vendor IFSC or Account Number changes within 72 hours of scheduled payout, require Penny Drop + verbal confirmation.',
    condition: 'Beneficiary Modified within 72h of Payout',
    action: 'Trigger Penny Drop Verification & Block Batch',
    isActive: true,
    triggerCount: 6
  }
];

export const INITIAL_RECEIVABLES_AGING: AgingBucket[] = [
  { range: '0 - 30 Days', amount: 14500000, count: 28, percentage: 65.9 },
  { range: '31 - 60 Days', amount: 4800000, count: 9, percentage: 21.8 },
  { range: '61 - 90 Days', amount: 1900000, count: 4, percentage: 8.6 },
  { range: '90+ Days', amount: 800000, count: 2, percentage: 3.7 }
];

export const INITIAL_PAYABLES_AGING: AgingBucket[] = [
  { range: '0 - 15 Days', amount: 8400000, count: 18, percentage: 56.4 },
  { range: '16 - 30 Days', amount: 4200000, count: 8, percentage: 28.2 },
  { range: '31 - 45 Days', amount: 1540000, count: 3, percentage: 10.3 },
  { range: '45+ Days', amount: 750000, count: 1, percentage: 5.1 }
];

export const INITIAL_PAYMENT_SCHEDULE: PaymentScheduleItem[] = [
  {
    id: 'SCH-01',
    invoiceId: 'INV-2024-8660',
    vendorName: 'Shardul Amarchand & Partners',
    amount: 750000,
    scheduledDate: '2024-09-25',
    batchName: 'Critical Legal & Overdue Run',
    status: 'scheduled',
    impactOnCash: -750000,
    cashBufferAfterPayment: 17450000
  },
  {
    id: 'SCH-02',
    invoiceId: 'INV-2024-8712',
    vendorName: 'Apex Growth Media LLP',
    amount: 1850000,
    scheduledDate: '2024-09-26',
    batchName: 'Marketing Media Disbursal',
    status: 'scheduled',
    impactOnCash: -1850000,
    cashBufferAfterPayment: 15600000
  },
  {
    id: 'SCH-03',
    invoiceId: 'INV-2024-8849',
    vendorName: 'Zenith Cloud Services Pvt Ltd',
    amount: 680000,
    scheduledDate: '2024-09-28',
    batchName: 'IT SaaS Weekly Batch',
    status: 'scheduled', // Will become 'on_hold' when user executes hold!
    impactOnCash: -680000,
    cashBufferAfterPayment: 14920000
  },
  {
    id: 'SCH-04',
    invoiceId: 'INV-2024-8902',
    vendorName: 'HyperScale Systems Pvt Ltd',
    amount: 3850000,
    scheduledDate: '2024-09-30',
    batchName: 'Capex Infrastructure Batch',
    status: 'scheduled',
    impactOnCash: -3850000,
    cashBufferAfterPayment: 11070000
  },
  {
    id: 'SCH-05',
    invoiceId: 'INV-2024-9014',
    vendorName: 'BlueDart DHL Express Ltd',
    amount: 820000,
    scheduledDate: '2024-10-02',
    batchName: 'Operations Logistics Run',
    status: 'scheduled',
    impactOnCash: -820000,
    cashBufferAfterPayment: 10250000
  }
];

/**
 * Generate 90-day time series data for cash flow forecasting:
 * - 30 days of historical actuals
 * - 60 days of forward projections with Base, Optimistic, Conservative bands
 */
export function generateCashForecastPoints(hasDuplicateHold: boolean = false): CashForecastPoint[] {
  const points: CashForecastPoint[] = [];
  const baseCash = 18200000; // Starting baseline ₹1.82 Cr
  let rollingCash = baseCash;

  // 30 days historical actuals (Day -30 to Day 0)
  for (let i = -30; i <= 0; i++) {
    const d = new Date(2024, 8, 24); // 24 Sep 2024
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);

    const inflow = (Math.sin(i * 0.4) * 800000) + 1200000;
    const outflow = (Math.cos(i * 0.3) * 600000) + 1050000;
    const net = inflow - outflow;
    rollingCash += net;

    points.push({
      date: dateStr,
      dayIndex: i,
      isHistorical: true,
      actualBalance: Math.round(rollingCash),
      forecastBalanceBase: Math.round(rollingCash),
      forecastBalanceOptimistic: Math.round(rollingCash),
      forecastBalanceConservative: Math.round(rollingCash),
      uncertaintyUpper: Math.round(rollingCash),
      uncertaintyLower: Math.round(rollingCash),
      inflows: Math.round(inflow),
      outflows: Math.round(outflow),
      netCashFlow: Math.round(net)
    });
  }

  // 60 days forecast (Day 1 to Day 60)
  let baseRunning = rollingCash;
  let optRunning = rollingCash;
  let consRunning = rollingCash;

  for (let i = 1; i <= 60; i++) {
    const d = new Date(2024, 8, 24);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);

    // If duplicate hold is executed, on day 4 (28 Sep), we save ₹6,80,000 outflow!
    const duplicateAdjustment = (hasDuplicateHold && i >= 4) ? 680000 : 0;

    // Normal cyclical enterprise inflows (collections on 1st & 15th)
    const isPayday = i % 15 === 0;
    const isBillingCycle = i % 30 === 5;

    let baseInflow = isBillingCycle ? 4500000 : 750000 + (Math.sin(i * 0.3) * 300000);
    let baseOutflow = isPayday ? 4200000 : 650000 + (Math.cos(i * 0.25) * 250000);

    if (i === 4 && hasDuplicateHold) {
      baseOutflow = Math.max(0, baseOutflow - 680000);
    }

    baseRunning += (baseInflow - baseOutflow);
    optRunning += (baseInflow * 1.12 - baseOutflow * 0.95);
    consRunning += (baseInflow * 0.82 - baseOutflow * 1.08);

    const uncertaintySpread = i * 45000; // spreads wider over time

    points.push({
      date: dateStr,
      dayIndex: i,
      isHistorical: false,
      forecastBalanceBase: Math.round(baseRunning + duplicateAdjustment),
      forecastBalanceOptimistic: Math.round(optRunning + duplicateAdjustment),
      forecastBalanceConservative: Math.round(consRunning + duplicateAdjustment),
      uncertaintyUpper: Math.round(baseRunning + duplicateAdjustment + uncertaintySpread),
      uncertaintyLower: Math.round(baseRunning + duplicateAdjustment - uncertaintySpread),
      inflows: Math.round(baseInflow),
      outflows: Math.round(baseOutflow),
      netCashFlow: Math.round(baseInflow - baseOutflow)
    });
  }

  return points;
}
