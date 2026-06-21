export const clients = [
  {
    id: 1,
    name: "Alexandros Papadopoulos",
    email: "alex.papa@tradefast.com",
    phone: "+357 99 123456",
    country: "Cyprus",
    company: "TradeFast Ltd",
    industry: "Forex",
    kycStatus: "approved",
    stage: "active",
    assignedTo: "Maria K.",
    createdAt: "2026-05-10",
    dob: "1985-03-22",
    documents: [
      { name: "Passport", status: "verified", uploadedAt: "2026-05-11" },
      { name: "Proof of Address", status: "verified", uploadedAt: "2026-05-11" },
      { name: "Source of Funds", status: "verified", uploadedAt: "2026-05-12" },
    ],
    notes: [
      { author: "Maria K.", date: "2026-05-13", text: "Client passed all KYC checks. Account activated." },
      { author: "Nikos P.", date: "2026-05-15", text: "Client requested MT5 access. Approved." },
    ],
    activity: [
      { date: "2026-05-10", event: "Lead created" },
      { date: "2026-05-11", event: "Documents submitted" },
      { date: "2026-05-12", event: "Under review" },
      { date: "2026-05-13", event: "KYC Approved" },
      { date: "2026-05-13", event: "Account activated" },
    ]
  },
  {
    id: 2,
    name: "Sophie Müller",
    email: "sophie.m@capitaledge.de",
    phone: "+49 30 9876543",
    country: "Germany",
    company: "CapitalEdge GmbH",
    industry: "Forex",
    kycStatus: "under_review",
    stage: "under_review",
    assignedTo: "Nikos P.",
    createdAt: "2026-06-01",
    dob: "1990-07-14",
    documents: [
      { name: "Passport", status: "verified", uploadedAt: "2026-06-02" },
      { name: "Proof of Address", status: "pending", uploadedAt: "2026-06-02" },
      { name: "Source of Funds", status: "pending", uploadedAt: null },
    ],
    notes: [
      { author: "Nikos P.", date: "2026-06-03", text: "Waiting for proof of address resubmission." },
    ],
    activity: [
      { date: "2026-06-01", event: "Lead created" },
      { date: "2026-06-02", event: "Documents submitted" },
      { date: "2026-06-03", event: "Under review" },
    ]
  },
  {
    id: 3,
    name: "Carlos Rivera",
    email: "c.rivera@mexfx.mx",
    phone: "+52 55 4567890",
    country: "Mexico",
    company: "MexFX Corp",
    industry: "Forex",
    kycStatus: "pending",
    stage: "docs_submitted",
    assignedTo: "Maria K.",
    createdAt: "2026-06-10",
    dob: "1988-11-05",
    documents: [
      { name: "Passport", status: "pending", uploadedAt: "2026-06-11" },
      { name: "Proof of Address", status: "pending", uploadedAt: null },
    ],
    notes: [],
    activity: [
      { date: "2026-06-10", event: "Lead created" },
      { date: "2026-06-11", event: "Documents submitted" },
    ]
  },
  {
    id: 4,
    name: "Yuki Tanaka",
    email: "yuki.t@tokyopay.jp",
    phone: "+81 3 12345678",
    country: "Japan",
    company: "TokyoPay Inc",
    industry: "Payments",
    kycStatus: "approved",
    stage: "active",
    assignedTo: "Nikos P.",
    createdAt: "2026-04-20",
    dob: "1992-01-30",
    documents: [
      { name: "Passport", status: "verified", uploadedAt: "2026-04-21" },
      { name: "Proof of Address", status: "verified", uploadedAt: "2026-04-21" },
      { name: "Business License", status: "verified", uploadedAt: "2026-04-22" },
    ],
    notes: [
      { author: "Nikos P.", date: "2026-04-23", text: "All documents verified. Premium client onboarded." },
    ],
    activity: [
      { date: "2026-04-20", event: "Lead created" },
      { date: "2026-04-21", event: "Documents submitted" },
      { date: "2026-04-22", event: "Under review" },
      { date: "2026-04-23", event: "KYC Approved" },
    ]
  },
  {
    id: 5,
    name: "Emma Johnson",
    email: "emma.j@spinwingames.uk",
    phone: "+44 20 7890123",
    country: "United Kingdom",
    company: "SpinWin Games Ltd",
    industry: "iGaming",
    kycStatus: "rejected",
    stage: "rejected",
    assignedTo: "Maria K.",
    createdAt: "2026-05-28",
    dob: "1987-09-19",
    documents: [
      { name: "Passport", status: "verified", uploadedAt: "2026-05-29" },
      { name: "Proof of Address", status: "rejected", uploadedAt: "2026-05-29" },
    ],
    notes: [
      { author: "Maria K.", date: "2026-05-30", text: "Proof of address rejected — document older than 3 months. Client notified to resubmit." },
    ],
    activity: [
      { date: "2026-05-28", event: "Lead created" },
      { date: "2026-05-29", event: "Documents submitted" },
      { date: "2026-05-30", event: "KYC Rejected" },
    ]
  },
  {
    id: 6,
    name: "Ibrahim Al-Rashid",
    email: "i.alrashid@gulfprime.ae",
    phone: "+971 50 9876543",
    country: "UAE",
    company: "GulfPrime Trading",
    industry: "Forex",
    kycStatus: "pending",
    stage: "lead",
    assignedTo: "Nikos P.",
    createdAt: "2026-06-18",
    dob: "1983-06-12",
    documents: [],
    notes: [
      { author: "Nikos P.", date: "2026-06-18", text: "Warm lead from LinkedIn. Follow up scheduled." },
    ],
    activity: [
      { date: "2026-06-18", event: "Lead created" },
    ]
  },
];

export const teamMembers = [
  { id: 1, name: "Maria K.", email: "maria@veridox.net", role: "admin", status: "active" },
  { id: 2, name: "Nikos P.", email: "nikos@veridox.net", role: "agent", status: "active" },
  { id: 3, name: "Anna S.", email: "anna@veridox.net", role: "agent", status: "inactive" },
];

export const dashboardStats = {
  totalClients: 6,
  pendingKyc: 2,
  approvedToday: 0,
  approvedThisMonth: 2,
  rejected: 1,
  underReview: 1,
};

export const monthlyData = [
  { month: "Jan", approved: 3, rejected: 1 },
  { month: "Feb", approved: 5, rejected: 0 },
  { month: "Mar", approved: 4, rejected: 2 },
  { month: "Apr", approved: 7, rejected: 1 },
  { month: "May", approved: 6, rejected: 1 },
  { month: "Jun", approved: 2, rejected: 0 },
];
