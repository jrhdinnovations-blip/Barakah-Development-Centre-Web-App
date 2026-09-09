/** ============================================================================
 *  Barakah Corporate Email & Domain Service
 *  ============================================================================
 *  Manages official company email domains (default: @barakahdevcentre.com), username
 *  slugification, DNS record generation (MX, SPF, DKIM, DMARC), and mailbox
 *  provisioning for staff members.
 *  ============================================================================ */

export interface CompanyDomain {
  id: string;
  domain: string; // e.g. "barakahdevcentre.com"
  isPrimary: boolean;
  status: 'active' | 'pending_verification';
  createdAt: string;
  mailProvider: 'google_workspace' | 'microsoft_365' | 'zoho' | 'custom_cpanel';
  webmailUrl: string;
}

export interface StaffMailbox {
  id: string;
  userId?: string | undefined;
  fullName: string;
  email: string; // e.g. "ibrahim.musa@barakahdevcentre.com"
  domain: string;
  username: string; // e.g. "ibrahim.musa"
  department: string;
  designation: string;
  recoveryEmail?: string | undefined;
  status: 'active' | 'suspended' | 'provisioned';
  createdAt: string;
  quotaMb?: number | undefined;
}

const STORAGE_DOMAINS_KEY = 'barakah_company_domains_v2';
const STORAGE_MAILBOXES_KEY = 'barakah_staff_mailboxes_v1';

export const DEFAULT_DOMAINS: CompanyDomain[] = [
  {
    id: 'dom-barakah',
    domain: 'barakahdevcentre.com',
    isPrimary: true,
    status: 'active',
    createdAt: '2026-01-01T00:00:00Z',
    mailProvider: 'google_workspace',
    webmailUrl: 'https://mail.google.com/a/barakahdevcentre.com',
  },
  {
    id: 'dom-swiftmove',
    domain: 'swiftmove.ng',
    isPrimary: false,
    status: 'active',
    createdAt: '2026-01-01T00:00:00Z',
    mailProvider: 'google_workspace',
    webmailUrl: 'https://mail.google.com/a/swiftmove.ng',
  },
];

/**
 * Returns the list of configured corporate domains.
 */
export function getCompanyDomains(): CompanyDomain[] {
  if (typeof window === 'undefined') return DEFAULT_DOMAINS;
  try {
    const raw = localStorage.getItem(STORAGE_DOMAINS_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_DOMAINS_KEY, JSON.stringify(DEFAULT_DOMAINS));
      return DEFAULT_DOMAINS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_DOMAINS;
  } catch {
    return DEFAULT_DOMAINS;
  }
}

/**
 * Saves or updates corporate domains in local persistent storage.
 */
export function saveCompanyDomains(domains: CompanyDomain[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_DOMAINS_KEY, JSON.stringify(domains));
  } catch (e) {
    console.warn('Failed to persist company domains:', e);
  }
}

/**
 * Returns the primary corporate domain name (e.g. "barakahdevcentre.com").
 */
export function getPrimaryCompanyDomain(): string {
  const domains = getCompanyDomains();
  const primary = domains.find((d) => d.isPrimary) || domains[0];
  return primary ? primary.domain : 'barakahdevcentre.com';
}

/**
 * Adds a new custom corporate domain.
 */
export function addCompanyDomain(
  domainName: string,
  isPrimary: boolean = false,
  mailProvider: CompanyDomain['mailProvider'] = 'google_workspace'
): CompanyDomain {
  const cleanDomain = domainName.trim().toLowerCase().replace(/^@+/, '');
  const domains = getCompanyDomains();

  const newDomain: CompanyDomain = {
    id: `dom-${Date.now()}`,
    domain: cleanDomain,
    isPrimary,
    status: 'active',
    createdAt: new Date().toISOString(),
    mailProvider,
    webmailUrl: `https://mail.${cleanDomain}`,
  };

  let updated = [...domains];
  if (isPrimary) {
    updated = updated.map((d) => ({ ...d, isPrimary: false }));
  }
  updated.push(newDomain);
  saveCompanyDomains(updated);
  return newDomain;
}

/**
 * Sets a specific domain as the primary domain.
 */
export function setPrimaryDomain(domainId: string): void {
  const domains = getCompanyDomains();
  const updated = domains.map((d) => ({
    ...d,
    isPrimary: d.id === domainId,
  }));
  saveCompanyDomains(updated);
}

/**
 * Generates a clean corporate email username from a person's full name.
 * e.g. "Ibrahim Musa" -> "ibrahim.musa"
 * e.g. "Dr. Fatima Zara Bello" -> "fatima.bello"
 */
export function suggestEmailUsername(fullName: string): string {
  if (!fullName || !fullName.trim()) return '';

  const clean = fullName
    .toLowerCase()
    .replace(/^(dr|mr|mrs|ms|prof|engr|alhaji|hajiya)\.?\s+/i, '')
    .trim();

  const parts = clean
    .split(/\s+/)
    .map((p) => p.replace(/[^a-z0-9]/g, ''))
    .filter(Boolean);

  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0]!;
  // firstName.lastName
  return `${parts[0]}.${parts[parts.length - 1]}`;
}

/**
 * Checks whether an email belongs to any registered Barakah corporate domain.
 */
export function isCorporateEmail(email: string | null | undefined): boolean {
  if (!email || !email.includes('@')) return false;
  const domainPart = email.split('@')[1]?.toLowerCase().trim();
  if (!domainPart) return false;

  const domains = getCompanyDomains();
  return domains.some((d) => d.domain.toLowerCase() === domainPart);
}

/**
 * Returns copyable DNS configuration records for the domain.
 */
export function getDnsRecordsForDomain(domain: string, provider: CompanyDomain['mailProvider']) {
  if (provider === 'google_workspace') {
    return [
      { type: 'MX', host: '@', value: '1 ASPMX.L.GOOGLE.COM', priority: 1, ttl: '3600' },
      { type: 'MX', host: '@', value: '5 ALT1.ASPMX.L.GOOGLE.COM', priority: 5, ttl: '3600' },
      { type: 'MX', host: '@', value: '5 ALT2.ASPMX.L.GOOGLE.COM', priority: 5, ttl: '3600' },
      { type: 'MX', host: '@', value: '10 ALT3.ASPMX.L.GOOGLE.COM', priority: 10, ttl: '3600' },
      { type: 'MX', host: '@', value: '10 ALT4.ASPMX.L.GOOGLE.COM', priority: 10, ttl: '3600' },
      { type: 'TXT', host: '@', value: 'v=spf1 include:_spf.google.com ~all', ttl: '3600' },
      { type: 'TXT', host: 'google._domainkey', value: `v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCg...`, ttl: '3600' },
      { type: 'TXT', host: '_dmarc', value: `v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@${domain}`, ttl: '3600' },
    ];
  }

  if (provider === 'microsoft_365') {
    const slug = domain.replace(/\./g, '-');
    return [
      { type: 'MX', host: '@', value: `0 ${slug}.mail.protection.outlook.com`, priority: 0, ttl: '3600' },
      { type: 'TXT', host: '@', value: 'v=spf1 include:spf.protection.outlook.com ~all', ttl: '3600' },
      { type: 'CNAME', host: 'autodiscover', value: 'autodiscover.outlook.com', ttl: '3600' },
      { type: 'TXT', host: '_dmarc', value: `v=DMARC1; p=reject; rua=mailto:dmarc-reports@${domain}`, ttl: '3600' },
    ];
  }

  // Custom / cPanel / Standard Mail Server
  return [
    { type: 'MX', host: '@', value: `10 mail.${domain}`, priority: 10, ttl: '3600' },
    { type: 'A', host: 'mail', value: 'SERVER_IP_ADDRESS', ttl: '14400' },
    { type: 'TXT', host: '@', value: `v=spf1 +a +mx +ip4:SERVER_IP ~all`, ttl: '3600' },
    { type: 'TXT', host: 'default._domainkey', value: `v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQ...`, ttl: '3600' },
    { type: 'TXT', host: '_dmarc', value: `v=DMARC1; p=none; sp=none; rua=mailto:postmaster@${domain}`, ttl: '3600' },
  ];
}

/**
 * Returns saved staff mailboxes.
 */
export function getStaffMailboxes(): StaffMailbox[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_MAILBOXES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Records a provisioned staff mailbox in local storage.
 */
export function saveStaffMailbox(mailbox: StaffMailbox): void {
  if (typeof window === 'undefined') return;
  try {
    const list = getStaffMailboxes();
    const existingIndex = list.findIndex(
      (m) => m.email.toLowerCase() === mailbox.email.toLowerCase() || (mailbox.userId && m.userId === mailbox.userId)
    );
    if (existingIndex >= 0) {
      list[existingIndex] = { ...list[existingIndex], ...mailbox };
    } else {
      list.unshift(mailbox);
    }
    localStorage.setItem(STORAGE_MAILBOXES_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('Failed to save staff mailbox:', e);
  }
}
