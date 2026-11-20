/* Copyright (c) 2026 reika140. SPDX-License-Identifier: MIT. */
/** Serializable, versioned scan contract. Content is collected exclusively from the active tab. */
export type Severity = 'error' | 'warning' | 'info';
export type Section = 'overview' | 'metadata' | 'headings' | 'images' | 'links' | 'structured' | 'settings';
export type LinkKind = 'internal' | 'external' | 'special' | 'invalid';

export interface LocatedValue {
  value: string;
  locator: string;
}
export interface MetaEntry extends LocatedValue {
  key: string;
}
export interface AlternateLink extends LocatedValue {
  language: string;
}
export interface RawHeading {
  id: number;
  level: number;
  text: string;
  locator: string;
}
export interface RawImage {
  id: number;
  alt: string | null;
  src: string;
  currentSrc: string;
  srcset: string;
  lazySrc: string;
  width: number | null;
  height: number | null;
  naturalWidth: number | null;
  naturalHeight: number | null;
  loading: string;
  locator: string;
}
export interface RawLink {
  id: number;
  text: string;
  href: string | null;
  resolvedHref: string;
  accessibleName: string;
  target: string;
  rel: string;
  locator: string;
}
export interface RawJsonLd {
  id: number;
  text: string;
  tooLarge: boolean;
  locator: string;
}
export interface ScanCounts {
  headings: number;
  images: number;
  links: number;
  jsonLd: number;
}
export interface RawSnapshot {
  url: string;
  title: string;
  titleTags: LocatedValue[];
  descriptions: LocatedValue[];
  canonicals: LocatedValue[];
  robots: MetaEntry[];
  viewports: LocatedValue[];
  openGraph: MetaEntry[];
  twitter: MetaEntry[];
  hreflang: AlternateLink[];
  headings: RawHeading[];
  images: RawImage[];
  links: RawLink[];
  jsonLd: RawJsonLd[];
  counts: ScanCounts;
  linkTypeCounts?: { internal: number; external: number; special: number; invalid: number };
  limits: { headings: number; images: number; links: number; jsonLd: number };
}
export interface Metadata {
  title: string;
  titleTags: LocatedValue[];
  description: string;
  descriptions: LocatedValue[];
  canonical: string;
  canonicals: LocatedValue[];
  robots: MetaEntry[];
  viewport: string;
  viewports: LocatedValue[];
  openGraph: MetaEntry[];
  twitter: MetaEntry[];
  hreflang: AlternateLink[];
}
export interface Heading extends RawHeading { skippedLevels: number[] }
export interface InspectedImage extends RawImage {
  source: string;
  sourceStatus: 'present' | 'lazy-candidate' | 'missing' | 'unsafe';
  altStatus: 'missing' | 'empty' | 'present';
}
export interface InspectedLink extends RawLink {
  kind: LinkKind;
  url: string;
  hasAccessibleName: boolean;
}
export interface JsonLdBlock {
  id: number;
  locator: string;
  source: string;
  formatted: string;
  types: string[];
  valid: boolean;
  error: string;
  tooLarge: boolean;
}
export interface Finding {
  id: string;
  severity: Severity;
  section: Section;
  title: string;
  description: string;
  actual: string;
  locator: string | null;
}
export interface Heuristics {
  enabled: boolean;
  titleMin: number;
  titleMax: number;
  descriptionMin: number;
  descriptionMax: number;
}
export interface ScanResult {
  schemaVersion: 1;
  scannedAt: string;
  url: string;
  metadata: Metadata;
  headings: Heading[];
  images: InspectedImage[];
  links: InspectedLink[];
  jsonLd: JsonLdBlock[];
  counts: ScanCounts & { internal: number; external: number; special: number; invalid: number };
  limits: RawSnapshot['limits'];
  findings: Finding[];
}
export const DEFAULT_HEURISTICS: Heuristics = {
  enabled: true,
  titleMin: 30,
  titleMax: 65,
  descriptionMin: 70,
  descriptionMax: 165,
};
