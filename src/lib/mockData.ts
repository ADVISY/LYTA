// Mock data utilities for CRM 2.0

export interface MockContract {
  id: string;
  client: string;
  type: string;
  company: string;
  status: 'Signé' | 'En attente' | 'Refusé' | 'Résilié';
  premiumMonthly: number | null;
  premiumYearly: number | null;
  renewal: string | null;
  createdAt: string;
  contactEmail?: string;
  contactPhone?: string;
  policyNumber?: string;
  agentAdvisy?: string;
  managerAdvisy?: string;
  sourceAcquisition?: string;
  dateSignature?: string;
  modeEncaissement?: string;
}

export interface MockDocument {
  id: string;
  name: string;
  kind: string;
  size: string;
  date: string;
  url?: string;
  contractId?: string;
}

export interface MockCommission {
  id: string;
  contractId: string;
  product: string;
  amount: number;
  status: 'À verser' | 'Versée' | 'En validation';
  date: string;
  company: string;
}

// Mock Contracts Data
export const mockContracts: MockContract[] = [
  { 
    id: "C-2025-0012", 
    client: "Dupont SA", 
    type: "RC Pro", 
    company: "Allianz", 
    status: "Signé", 
    premiumMonthly: 0, 
    premiumYearly: 2450, 
    renewal: "2026-01-01",
    createdAt: "2025-01-15",
    contactEmail: "contact@dupont.ch",
    contactPhone: "+41 22 123 45 67",
    policyNumber: "AL-2025-RC-0012",
    agentAdvisy: "Sophie Martin",
    managerAdvisy: "Jean-Pierre Durand",
    sourceAcquisition: "Référence client",
    dateSignature: "2025-01-15",
    modeEncaissement: "Annuel"
  },
  { 
    id: "C-2025-0041", 
    client: "Martin Pierre", 
    type: "Auto", 
    company: "AXA", 
    status: "En attente", 
    premiumMonthly: 120, 
    premiumYearly: 1440, 
    renewal: "2026-03-15",
    createdAt: "2025-03-10",
    contactEmail: "p.martin@email.ch",
    contactPhone: "+41 79 234 56 78",
    policyNumber: "AXA-2025-AU-0041",
    agentAdvisy: "Marie Leclerc",
    managerAdvisy: "Jean-Pierre Durand",
    sourceAcquisition: "Site web",
    dateSignature: null,
    modeEncaissement: "Mensuel"
  },
  { 
    id: "C-2025-0048", 
    client: "Edelweiss GmbH", 
    type: "Multirisque", 
    company: "Zurich", 
    status: "Refusé", 
    premiumMonthly: null, 
    premiumYearly: null, 
    renewal: null,
    createdAt: "2025-04-05",
    contactEmail: "info@edelweiss.ch",
    contactPhone: "+41 21 345 67 89",
    policyNumber: null,
    agentAdvisy: "Thomas Rochat",
    managerAdvisy: "Claire Bertrand",
    sourceAcquisition: "Prospection téléphonique",
    dateSignature: null,
    modeEncaissement: null
  },
  { 
    id: "C-2025-0055", 
    client: "Rochat Famille", 
    type: "Santé", 
    company: "Helsana", 
    status: "Signé", 
    premiumMonthly: 450, 
    premiumYearly: 5400, 
    renewal: "2026-01-01",
    createdAt: "2025-05-20",
    contactEmail: "rochat@email.ch",
    contactPhone: "+41 78 456 78 90",
    policyNumber: "HEL-2025-SA-0055",
    agentAdvisy: "Sophie Martin",
    managerAdvisy: "Jean-Pierre Durand",
    sourceAcquisition: "Parrainage",
    dateSignature: "2025-05-20",
    modeEncaissement: "Mensuel"
  },
  { 
    id: "C-2025-0062", 
    client: "Tech Solutions SA", 
    type: "RC Pro", 
    company: "Mobilière", 
    status: "Signé", 
    premiumMonthly: 0, 
    premiumYearly: 3200, 
    renewal: "2026-06-01",
    createdAt: "2025-06-15",
    contactEmail: "admin@techsolutions.ch",
    contactPhone: "+41 22 567 89 01",
    policyNumber: "MOB-2025-RC-0062",
    agentAdvisy: "Marie Leclerc",
    managerAdvisy: "Claire Bertrand",
    sourceAcquisition: "LinkedIn",
    dateSignature: "2025-06-15",
    modeEncaissement: "Annuel"
  },
  { 
    id: "C-2025-0078", 
    client: "Fontaine Marie", 
    type: "3e Pilier", 
    company: "Swiss Life", 
    status: "Signé", 
    premiumMonthly: 500, 
    premiumYearly: 6000, 
    renewal: "2026-12-31",
    createdAt: "2025-07-22",
    contactEmail: "m.fontaine@email.ch",
    contactPhone: "+41 79 678 90 12",
    policyNumber: "SWL-2025-3P-0078",
    agentAdvisy: "Thomas Rochat",
    managerAdvisy: "Jean-Pierre Durand",
    sourceAcquisition: "Salon professionnel",
    dateSignature: "2025-07-22",
    modeEncaissement: "Mensuel"
  },
  { 
    id: "C-2025-0089", 
    client: "Boulangerie Centrale", 
    type: "Incendie", 
    company: "Vaudoise", 
    status: "Résilié", 
    premiumMonthly: 0, 
    premiumYearly: 1800, 
    renewal: null,
    createdAt: "2025-08-10",
    contactEmail: "contact@boulangerie-centrale.ch",
    contactPhone: "+41 21 789 01 23",
    policyNumber: "VAU-2025-IN-0089",
    agentAdvisy: "Sophie Martin",
    managerAdvisy: "Claire Bertrand",
    sourceAcquisition: "Agence physique",
    dateSignature: "2024-08-10",
    modeEncaissement: "Annuel"
  }
];

// Mock Documents Data
export const mockDocuments: MockDocument[] = [
  { 
    id: "DOC-001",
    name: "Contrat_RC_Pro_Dupont.pdf", 
    kind: "Contrat signé", 
    size: "342 Ko", 
    date: "2025-11-01",
    contractId: "C-2025-0012"
  },
  { 
    id: "DOC-002",
    name: "Attestation_Auto_Martin.pdf", 
    kind: "Attestation", 
    size: "128 Ko", 
    date: "2025-10-28",
    contractId: "C-2025-0041"
  },
  { 
    id: "DOC-003",
    name: "Conditions_Generales_2025.pdf", 
    kind: "CGV", 
    size: "512 Ko", 
    date: "2025-09-10"
  },
  { 
    id: "DOC-004",
    name: "Police_Sante_Rochat.pdf", 
    kind: "Contrat signé", 
    size: "456 Ko", 
    date: "2025-11-05",
    contractId: "C-2025-0055"
  },
  { 
    id: "DOC-005",
    name: "Attestation_RC_Tech_Solutions.pdf", 
    kind: "Attestation", 
    size: "198 Ko", 
    date: "2025-11-08",
    contractId: "C-2025-0062"
  },
  { 
    id: "DOC-006",
    name: "Proposition_3P_Fontaine.pdf", 
    kind: "Proposition", 
    size: "234 Ko", 
    date: "2025-10-15",
    contractId: "C-2025-0078"
  },
  { 
    id: "DOC-007",
    name: "Resiliation_Boulangerie.pdf", 
    kind: "Résiliation", 
    size: "87 Ko", 
    date: "2025-10-01",
    contractId: "C-2025-0089"
  },
  { 
    id: "DOC-008",
    name: "Guide_Assurances_2025.pdf", 
    kind: "Guide", 
    size: "1.2 Mo", 
    date: "2025-01-01"
  }
];

// Mock Commissions Data
export const mockCommissions: MockCommission[] = [
  { 
    id: "COM-001",
    contractId: "C-2025-0012", 
    product: "RC Pro", 
    amount: 820, 
    status: "À verser", 
    date: "2025-11-05",
    company: "Allianz"
  },
  { 
    id: "COM-002",
    contractId: "C-2025-0041", 
    product: "Auto", 
    amount: 140, 
    status: "Versée", 
    date: "2025-10-28",
    company: "AXA"
  },
  { 
    id: "COM-003",
    contractId: "C-2025-0055", 
    product: "Santé", 
    amount: 220, 
    status: "En validation", 
    date: "2025-11-03",
    company: "Helsana"
  },
  { 
    id: "COM-004",
    contractId: "C-2025-0062", 
    product: "RC Pro", 
    amount: 960, 
    status: "Versée", 
    date: "2025-10-15",
    company: "Mobilière"
  },
  { 
    id: "COM-005",
    contractId: "C-2025-0078", 
    product: "3e Pilier", 
    amount: 450, 
    status: "À verser", 
    date: "2025-11-10",
    company: "Swiss Life"
  },
  { 
    id: "COM-006",
    contractId: "C-2025-0012", 
    product: "RC Pro", 
    amount: 820, 
    status: "Versée", 
    date: "2025-10-05",
    company: "Allianz"
  },
  { 
    id: "COM-007",
    contractId: "C-2025-0055", 
    product: "Santé", 
    amount: 220, 
    status: "Versée", 
    date: "2025-10-03",
    company: "Helsana"
  }
];

// Export utilities
export const exportToCSV = (data: any[], filename: string) => {
  if (!data.length) return;
  
  const headers = Object.keys(data[0]);
  const csv = [
    headers.join(','),
    ...data.map(row => headers.map(header => {
      const value = row[header];
      return typeof value === 'string' && value.includes(',') 
        ? `"${value}"` 
        : value;
    }).join(','))
  ].join('\n');
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
};
