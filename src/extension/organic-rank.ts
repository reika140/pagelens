/* Copyright (c) 2026 reika140. SPDX-License-Identifier: MIT. */
/** Page-one organic numbering. The DOM logic is shared by the Google-only
 *  content script and the on-demand popup inspector. No network requests.
 */
import './browser-api.js';

export const ORGANIC_RANKING_PREF = 'pagelens-organic-ranking-enabled';
export type OrganicRankingMode = 'show' | 'hide' | 'status';
export interface OrganicRankingResult {
  eligible: boolean;
  active: boolean;
  count: number;
  reason: 'ok' | 'not-google-search' | 'later-page' | 'unsupported-search-type' | 'no-organic-results';
}

/** Do not display a SERP action on non-Google sites or vertical/later pages. */
export function isGoogleFirstResultsPage(rawUrl: string | undefined): boolean {
  if (!rawUrl) return false;
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
    if (!/^(?:www\.)?google\.[a-z]{2,3}(?:\.[a-z]{2})?$/.test(url.hostname.toLowerCase())) return false;
    if (url.pathname !== '/search' || !url.searchParams.get('q')?.trim()) return false;
    const start = url.searchParams.get('start');
    if (start !== null && (!/^\d+$/.test(start) || Number(start) !== 0)) return false;
    if (url.searchParams.get('tbm')) return false;
    const udm = url.searchParams.get('udm');
    return udm === null || udm === '14'; // Google's Web results tab.
  } catch { return false; }
}

/** Self-contained DOM routine for Chrome executeScript and the Google-only content script. */
export function rankOrganicResultsInPage(mode: OrganicRankingMode): OrganicRankingResult {
  const result: OrganicRankingResult = { eligible: false, active: false, count: 0, reason: 'not-google-search' };
  // A single root-level overlay avoids inherited CSS/transforms from Google
  // result cards. The displayed digits are vector outlines rather than text:
  // neither Google fonts nor text-direction/writing-mode rules can flip them.
  const overlaySelector = 'pagelens-organic-overlay[data-pagelens-overlay-root]';
  const overlays = Array.from(document.querySelectorAll<HTMLElement>(overlaySelector));
  const legacy = Array.from(document.querySelectorAll<HTMLElement>('[data-pagelens-organic-position]'));
  const cleanup = (): void => {
    for (const overlay of overlays) overlay.remove();
    // Remove labels created by versions <= 1.3.2 if the page survived an
    // extension reload. Restore any parent positioning changed by those builds.
    for (const badge of legacy) {
      const parent = badge.parentElement;
      badge.remove();
      if (parent?.hasAttribute('data-pagelens-position-original')) {
        parent.style.position = parent.getAttribute('data-pagelens-position-original') ?? '';
        parent.removeAttribute('data-pagelens-position-original');
      }
    }
  };
  let url: URL;
  try { url = new URL(window.location.href); } catch { cleanup(); return result; }
  const googleDomain = (name: string): boolean => /^(?:www\.)?google\.[a-z]{2,3}(?:\.[a-z]{2})?$/.test(name);
  if ((url.protocol !== 'https:' && url.protocol !== 'http:') || !googleDomain(url.hostname.toLowerCase()) ||
    url.pathname !== '/search' || !url.searchParams.get('q')?.trim()) { cleanup(); return result; }
  const start = url.searchParams.get('start');
  if (start !== null && (!/^\d+$/.test(start) || Number(start) !== 0)) {
    result.reason = 'later-page'; cleanup(); return result;
  }
  if (url.searchParams.get('tbm') || (url.searchParams.get('udm') !== null && url.searchParams.get('udm') !== '14')) {
    result.reason = 'unsupported-search-type'; cleanup(); return result;
  }
  result.eligible = true;
  result.reason = 'ok';
  if (mode === 'status') {
    result.count = overlays.reduce((sum, el) => sum + Math.max(0, Number(el.dataset.pagelensOrganicCount) || 0), 0) + legacy.length;
    result.active = result.count > 0;
    return result;
  }
  cleanup();
  if (mode === 'hide') return result;

  // Organic links have an H3 title within a recognizable result-card wrapper.
  // A bare H3 link from an AI citation or special module is not enough.
  const root = document.querySelector<HTMLElement>('#rso') ?? document.querySelector<HTMLElement>('#search') ??
    document.querySelector<HTMLElement>('#main') ?? document.querySelector<HTMLElement>('[role="main"]') ??
    document.querySelector<HTMLElement>('main');
  if (!root) { result.reason = 'no-organic-results'; return result; }
  const cardSelector = '.MjjYud,.g,[data-sokoban-container]';
  const excluded = '#tads,#bottomads,#tadsb,#rhs,#kp-wp-tab-overview,#Odp5De,#m-x-content,' +
    '[data-text-ad],[data-ad],.uEierd,[role="dialog"],[role="navigation"],nav,header,footer,aside,' +
    '[role="complementary"],.related-question-pair,g-scrolling-carousel,.g-scrolling-carousel,' +
    '.commercial-unit-desktop-top,[data-attrid="wa:/description"],#ai-overview,#people-also-ask,#top-stories,' +
    '[data-attrid*="ai-overview"],[data-attrid*="ai_overview"],#botstuff,#fprs';
  const normalize = (value: string): string => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ').trim().toLowerCase();
  const featureName = /^(?:ai overview|overview by ai|people also ask|top stories|featured snippet|short videos|videos|images|places|local results|popular products|related searches|discussions and forums|things to know|shops|shopping|sponsored|advertisements|ads|tong quan do ai|moi nguoi cung hoi|tin bai hang dau|tin tuc hang dau|quang cao|duoc tai tro|video|hinh anh|dia diem|san pham pho bien|tim kiem co lien quan)(?:$|\b|\s)/i;
  const featureGroup = (card: Element): boolean => {
    let node: Element | null = card;
    let depth = 0;
    while (node && node !== root && depth++ < 6) {
      if (node.matches(excluded)) return true;
      const named = normalize(node.getAttribute('aria-label') ?? '');
      if (named && featureName.test(named)) return true;
      const headings = Array.from(node.querySelectorAll<HTMLElement>('h2,[role="heading"][aria-level="2"]'));
      if (headings.some((h) => featureName.test(normalize(h.textContent ?? ''))) &&
          (node === card || node.querySelectorAll(cardSelector).length <= 3)) return true;
      // Newer AI modules can use a plain text label rather than an H2.
      // Only suppress a small, separate card collection with an AI heading,
      // never the entire result list when it contains many regular cards.
      if (node !== card && node.querySelectorAll(cardSelector).length <= 4 &&
          /^(?:ai overview|tong quan do ai)(?:$|\s)/.test(normalize(node.textContent ?? '').slice(0, 70))) return true;
      // Rich result modules sometimes render their label as ordinary text.
      if (node === card && featureName.test(normalize(node.textContent ?? '').slice(0, 70))) return true;
      node = node.parentElement;
    }
    return false;
  };
  type ResultCandidate = { anchor: HTMLAnchorElement; h3: HTMLElement; group: Element; top: number; left: number; index: number };
  const candidates: ResultCandidate[] = [];
  const links = Array.from(root.querySelectorAll<HTMLAnchorElement>('a:has(h3)'));
  for (const [index, anchor] of links.entries()) {
    if (anchor.closest(excluded)) continue;
    const h3 = anchor.querySelector<HTMLElement>('h3');
    const group = anchor.closest(cardSelector);
    if (!h3 || !group || !root.contains(group) || !h3.textContent?.trim() || featureGroup(group)) continue;
    const style = window.getComputedStyle(h3);
    if (style.display === 'none' || style.visibility === 'hidden' || h3.getClientRects().length === 0) continue;
    const rect = h3.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    let destination: URL;
    try { destination = new URL(anchor.href, window.location.href); } catch { continue; }
    if (!['http:', 'https:'].includes(destination.protocol)) continue;
    // Resolve Google /url?url= redirects without making network requests.
    if (googleDomain(destination.hostname) && destination.pathname === '/url') {
      const actual = destination.searchParams.get('q') ?? destination.searchParams.get('url');
      if (!actual) continue;
      try { destination = new URL(actual); } catch { continue; }
      if (!['http:', 'https:'].includes(destination.protocol)) continue;
    }
    if (googleDomain(destination.hostname) &&
        ['/search','/preferences','/advanced_search','/setprefs'].includes(destination.pathname)) continue;
    if (featureName.test(normalize(h3.textContent))) continue;
    candidates.push({ anchor, h3, group, top: rect.top, left: rect.left, index });
  }

  // Google occasionally separates visual and DOM order. Rank by the vertical
  // order users actually see, keeping DOM order for exact ties.
  candidates.sort((a, b) => a.top - b.top || a.left - b.left || a.index - b.index);
  // The vector glyphs below are derived from the locally bundled Be Vietnam
  // Pro Medium (SIL OFL 1.1; assets/fonts/OFL.txt). These are static SVG
  // outlines: no rendered numeral depends on Google's font or inline spans.
  const digitPaths: Record<string, {a: number; d: string}> = {"0":{"a":684,"d":"M342 -9Q271 -9 216.5 21.0Q162 51 125.0 104.0Q88 157 69.0 225.5Q50 294 50 371Q50 448 69.0 516.5Q88 585 125.0 638.0Q162 691 216.5 721.0Q271 751 342 751Q413 751 467.5 721.0Q522 691 559.0 638.0Q596 585 615.0 516.5Q634 448 634 371Q634 294 615.0 225.5Q596 157 559.0 104.0Q522 51 467.5 21.0Q413 -9 342 -9ZM342 96Q416 96 465.0 165.5Q514 235 514 371Q514 506 465.0 575.0Q416 644 342 644Q268 644 219.0 575.0Q170 506 170 371Q170 236 218.5 166.0Q267 96 342 96Z"},"1":{"a":400,"d":"M296 740V0H181V559L41 558V627L65 634Q121 651 155.5 672.0Q190 693 221 730L230 740Z"},"2":{"a":655,"d":"M73 0V81L224 218Q296 282 349.0 329.5Q402 377 431.5 420.5Q461 464 461 516Q461 557 441.0 586.0Q421 615 390.0 630.5Q359 646 325 646Q284 646 257.5 632.5Q231 619 215.5 598.5Q200 578 193.0 556.5Q186 535 184.0 518.5Q182 502 182 498H70Q70 509 74.5 538.0Q79 567 93.5 602.5Q108 638 136.5 672.0Q165 706 211.5 728.0Q258 750 328 750Q395 750 452.0 723.0Q509 696 543.5 644.5Q578 593 578 520Q578 453 544.5 398.5Q511 344 454.5 291.5Q398 239 329 179L246 104H592V0Z"},"3":{"a":667,"d":"M330 -10Q247 -10 188.0 22.0Q129 54 98.0 107.0Q67 160 67 224H177Q177 162 220.0 125.0Q263 88 330 88Q370 88 403.5 103.0Q437 118 457.0 147.0Q477 176 477 217Q477 270 441.0 302.0Q405 334 343 334H243V425H343Q395 425 430.5 455.5Q466 486 466 535Q466 571 447.5 597.5Q429 624 398.0 638.5Q367 653 330 653Q270 653 229.5 614.5Q189 576 189 515H81Q81 578 111.0 631.5Q141 685 197.5 717.5Q254 750 332 750Q395 750 451.5 725.5Q508 701 543.5 655.0Q579 609 579 545Q579 483 546.5 442.0Q514 401 470 384V379Q522 361 557.5 319.0Q593 277 593 212Q593 142 556.5 92.5Q520 43 460.0 16.5Q400 -10 330 -10Z"},"4":{"a":713,"d":"M411 0V165L51 166V270L385 740H528V265H652V165H528V0ZM169 265H411V608Z"},"5":{"a":667,"d":"M330 -10Q259 -10 211.5 10.5Q164 31 134.5 62.5Q105 94 89.5 127.0Q74 160 68.5 186.0Q63 212 63 221H172Q172 221 174.5 207.5Q177 194 184.5 174.0Q192 154 209.0 134.5Q226 115 255.0 101.5Q284 88 329 88Q383 88 418.5 111.0Q454 134 471.5 170.0Q489 206 489 246Q489 286 471.5 323.5Q454 361 419.0 384.5Q384 408 333 408Q293 408 266.5 395.0Q240 382 224.5 365.5Q209 349 202.5 336.0Q196 323 196 323H81L142 740H552V637H225L197 440H200Q209 450 227.0 464.5Q245 479 275.5 490.5Q306 502 354 502Q435 502 490.5 465.5Q546 429 574.5 370.5Q603 312 603 248Q603 200 586.0 154.0Q569 108 535.5 71.0Q502 34 450.5 12.0Q399 -10 330 -10Z"},"6":{"a":687,"d":"M355 -10Q282 -10 228.0 17.0Q174 44 139.0 91.5Q104 139 87.0 200.0Q70 261 70 328Q70 384 82.5 443.0Q95 502 122.5 557.0Q150 612 194.0 655.5Q238 699 300.0 724.5Q362 750 445 750Q491 750 525.0 743.0Q559 736 559 736V631Q559 631 541.5 634.0Q524 637 497.5 640.5Q471 644 444 644Q374 644 326.0 619.0Q278 594 249.0 555.5Q220 517 206.5 475.0Q193 433 191 398Q199 412 220.0 433.0Q241 454 278.0 470.5Q315 487 373 487Q454 487 508.0 451.5Q562 416 589.5 360.5Q617 305 617 244Q617 196 600.5 151.0Q584 106 551.5 69.5Q519 33 470.0 11.5Q421 -10 355 -10ZM354 88Q393 88 427.0 105.5Q461 123 482.0 157.0Q503 191 503 240Q503 289 482.0 323.0Q461 357 427.0 374.5Q393 392 354 392Q315 392 281.0 374.5Q247 357 226.0 323.0Q205 289 205 240Q205 191 226.0 157.0Q247 123 281.0 105.5Q315 88 354 88Z"},"7":{"a":595,"d":"M172 0Q176 94 197.0 179.0Q218 264 249.5 336.5Q281 409 316.0 468.0Q351 527 383.0 570.0Q415 613 435 637H49V740H567V655Q567 655 548.0 633.5Q529 612 498.5 571.0Q468 530 433.0 472.0Q398 414 366.5 341.0Q335 268 313.0 182.5Q291 97 288 0Z"},"8":{"a":645,"d":"M322 -10Q245 -10 185.5 17.5Q126 45 92.0 93.0Q58 141 58 204Q58 258 77.5 293.5Q97 329 122.5 349.5Q148 370 167.5 379.0Q187 388 187 388V394Q187 394 170.0 401.5Q153 409 131.5 427.0Q110 445 93.5 475.0Q77 505 77 549Q77 608 108.0 653.0Q139 698 194.5 724.0Q250 750 322 750Q395 750 450.5 724.0Q506 698 537.0 653.0Q568 608 568 550Q568 505 551.5 475.0Q535 445 513.0 427.0Q491 409 474.5 401.5Q458 394 458 394V388Q458 388 477.5 379.0Q497 370 522.5 349.5Q548 329 567.5 293.5Q587 258 587 204Q587 141 553.0 93.0Q519 45 459.5 17.5Q400 -10 322 -10ZM322 433Q387 433 422.0 467.5Q457 502 457 545Q457 590 422.0 624.5Q387 659 322 659Q258 659 223.0 624.5Q188 590 188 545Q188 502 223.0 467.5Q258 433 322 433ZM322 83Q373 83 407.0 102.5Q441 122 458.5 152.5Q476 183 476 216Q476 248 459.0 277.5Q442 307 408.0 326.0Q374 345 322 345Q271 345 237.0 326.0Q203 307 186.0 277.5Q169 248 169 216Q169 183 186.5 152.5Q204 122 238.0 102.5Q272 83 322 83Z"},"9":{"a":687,"d":"M331 750Q405 750 458.5 723.0Q512 696 547.0 648.5Q582 601 599.5 540.0Q617 479 617 412Q617 356 604.0 297.0Q591 238 564.0 183.0Q537 128 493.0 84.5Q449 41 386.5 15.5Q324 -10 241 -10Q195 -10 161.0 -3.0Q127 4 127 4V109Q127 109 144.5 106.0Q162 103 189.0 99.5Q216 96 243 96Q313 96 360.5 121.0Q408 146 437.0 184.5Q466 223 480.0 265.0Q494 307 496 342Q487 328 466.5 307.0Q446 286 408.5 269.5Q371 253 314 253Q233 253 178.5 288.5Q124 324 97.0 379.5Q70 435 70 496Q70 544 86.5 589.0Q103 634 135.5 670.5Q168 707 217.0 728.5Q266 750 331 750ZM333 652Q294 652 259.5 634.5Q225 617 204.0 583.0Q183 549 183 500Q183 451 204.0 417.0Q225 383 259.5 365.5Q294 348 333 348Q372 348 406.0 365.5Q440 383 461.0 417.0Q482 451 482 500Q482 549 461.0 583.0Q440 617 406.0 634.5Q372 652 333 652Z"}};
  const svgNS = 'http://www.w3.org/2000/svg';
  const overlay = document.createElement('pagelens-organic-overlay');
  overlay.setAttribute('data-pagelens-overlay-root', '');
  overlay.setAttribute('aria-hidden', 'true');
  overlay.style.cssText = 'all:initial!important;display:block!important;' +
    'position:absolute!important;top:0!important;left:0!important;' +
    'width:0!important;height:0!important;overflow:visible!important;' +
    'z-index:2147483647!important;transform:none!important;' +
    'pointer-events:none!important;user-select:none!important;contain:none!important;';
  const shadow = overlay.attachShadow({ mode: 'open' });
  const processedGroups = new Set<Element>();
  for (const { h3, group } of candidates) {
    if (processedGroups.has(group)) continue;
    const headingRect = h3.getBoundingClientRect();
    if (headingRect.width <= 0 || headingRect.height <= 0) continue;
    const rank = String(result.count + 1);
    // Layout coordinates are document-relative. Since the overlay is a direct
    // child of <html> rather than a Google result, labels track scrolling
    // naturally without moving the original card or changing its CSS.
    const x = Math.max(0, Math.round(headingRect.left + window.scrollX - 32));
    const y = Math.round(headingRect.top + window.scrollY + (headingRect.height - 24) / 2);
    const badge = document.createElement('span');
    badge.dataset.pagelensOrganicPosition = rank;
    badge.style.cssText = 'all:initial!important;display:block!important;' +
      `position:absolute!important;left:${x}px!important;top:${y}px!important;` +
      'width:28px!important;height:24px!important;overflow:visible!important;' +
      'pointer-events:none!important;transform:none!important;';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 28 24');
    svg.setAttribute('width', '28');
    svg.setAttribute('height', '24');
    svg.setAttribute('focusable', 'false');
    svg.style.cssText = 'all:initial!important;display:block!important;' +
      'width:28px!important;height:24px!important;overflow:visible!important;' +
      'transform:none!important;pointer-events:none!important;';
    const scale = 0.0195;
    const totalWidth = [...rank].reduce((sum, char) => sum + (digitPaths[char]?.a ?? 0) * scale, 0);
    let advance = Math.max(0, 27 - totalWidth);
    for (const char of rank) {
      const glyph = digitPaths[char];
      if (!glyph) continue;
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', glyph.d);
      path.setAttribute('fill', '#817a75');
      path.setAttribute('transform', `translate(${advance.toFixed(2)} 19) scale(${scale} -${scale})`);
      svg.append(path);
      advance += glyph.a * scale;
    }
    badge.append(svg);
    shadow.append(badge);
    processedGroups.add(group);
    result.count++;
  }
  if (result.count > 0) {
    overlay.dataset.pagelensOrganicCount = String(result.count);
    document.documentElement.append(overlay);
  }
  result.active = result.count > 0;
  if (!result.active) result.reason = 'no-organic-results';
  return result;
}

export async function updateOrganicRankings(tabId: number, mode: OrganicRankingMode): Promise<OrganicRankingResult> {
  const items = await chrome.scripting.executeScript({ target: { tabId }, func: rankOrganicResultsInPage, args: [mode] });
  const data = items[0]?.result;
  if (!data) throw new Error('Google Search did not return an organic ranking result.');
  return data;
}
