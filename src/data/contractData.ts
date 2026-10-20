import rawContracts from './contracts.json';

export interface ContractEntry {
  name: string;
  pos: string;
  salary2026: number | null;
  contractYears: number;
  contractEnd: number;
  aav: number | null;
  totalRemaining: number;
  serviceTime: number | null;
  status: 'pre-arb' | 'arb' | 'fa' | 'unknown';
  team: string;
}

const CONTRACT_DATA = rawContracts as Record<string, ContractEntry>;

export function lookupContract(name: string): ContractEntry | null {
  const key = name.toLowerCase().replace(/[^a-z ]/g, '').trim();
  return CONTRACT_DATA[key] ?? null;
}

export function formatSalary(millions: number | null | undefined): string {
  if (millions == null) return '—';
  if (millions >= 1) return `$${millions.toFixed(1)}M`;
  return `$${(millions * 1000).toFixed(0)}K`;
}

export function statusLabel(status: ContractEntry['status']): string {
  switch (status) {
    case 'pre-arb': return 'Pre-Arb';
    case 'arb': return 'Arb';
    case 'fa': return 'FA';
    default: return '—';
  }
}
