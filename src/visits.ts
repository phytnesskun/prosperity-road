import './visits.css';
import type { GameState } from './campaign.ts';
import { TOWNSPEOPLE, visitStory } from './townspeople.ts';
import type { TownPlace } from './townspeople.ts';

const places = { farm: '田边', mill: '面包工坊', market: '市集', homes: '居民区' };
const landscapes: Record<TownPlace, string> = {
  farm: '<path d="M0 190Q110 100 320 180V300H0Z" fill="#b0b079"/><path d="m-30 240 280-65m-230 100 280-80m-210 105 240-80" stroke="#e7d09a" stroke-width="14"/><path d="M45 110V60m0 20-14-12m14 27 13-14m205 42V66m0 18-12-11m12 29 13-14" fill="none" stroke="#ae9555" stroke-width="5"/>',
  mill: '<path d="M25 205V80h270v125" fill="#d7bc92"/><path d="M45 205v-55a45 45 0 0 1 90 0v55" fill="#78644c"/><path d="M53 205v-48a37 37 0 0 1 74 0v48" fill="#c78f51"/><path d="M175 105h90m-90 45h90" stroke="#a38460" stroke-width="9"/><path d="M198 95V65h34v30" fill="#dfd6b9"/>',
  market: '<path d="M10 205V72h300v133" fill="#dbcaa9"/><path d="M0 45h320v45H0Z" fill="#b97c50"/><path d="M30 45h32v45H30Zm64 0h32v45H94Zm64 0h32v45h-32Zm64 0h32v45h-32Z" fill="#f2e1bc"/><path d="M0 215h320v85H0Z" fill="#a88460"/>',
  homes: '<path d="M15 235V72h290v163" fill="#d8cfb6"/><path d="M45 115V75h70v65H45Z" fill="#718c82"/><path d="M80 75v65m-35-32h70" stroke="#efe3c7" stroke-width="7"/><path d="M200 235V126a37 37 0 0 1 74 0v109" fill="#948568"/><path d="M0 240h320v60H0Z" fill="#bbb395"/>',
};

function propArt(visual: string, inspected: boolean): string {
  const contents = '<g class="visit-prop-contents" fill="#d2a04e" stroke="#896339" stroke-width="1.5"><ellipse cx="44" cy="53" rx="18" ry="9" transform="rotate(-20 44 53)"/><ellipse cx="77" cy="52" rx="19" ry="10" transform="rotate(15 77 52)"/><path d="m39 47 4 7m30-9 5 9" stroke="#f8dc9b" stroke-width="3"/></g>';
  const art = visual === 'grain'
    ? `<path d="M37 33q-14 24-15 47 38 17 77-2-1-24-17-45Z" fill="#b79b65" stroke="#705d3c" stroke-width="3"/><ellipse class="visit-sack-mouth" cx="60" cy="33" rx="23" ry="${inspected ? 13 : 4}" fill="#6a5839" stroke="#d9c28b" stroke-width="3"/><g class="visit-prop-contents" fill="#e4c575"><ellipse cx="49" cy="32" rx="6" ry="3"/><ellipse cx="62" cy="29" rx="6" ry="3"/><ellipse cx="72" cy="35" rx="6" ry="3"/></g><path d="M41 56q18 11 40-1" fill="none" stroke="#887041" stroke-width="3"/>`
    : visual === 'price'
      ? '<path d="M30 14h64v77H30Z" fill="#9b7650" stroke="#6d5135" stroke-width="3"/><path d="M37 24h50v59H37Z" fill="#f4e9cb"/><path d="M50 14h25v10H50Z" fill="#b7a477"/><g class="visit-prop-contents" stroke="#947543" stroke-width="3"><path d="M47 42h30m-30 12h21m-21 12h30"/></g><path d="m20 89 14-29 5 2-13 29Z" fill="#596c55"/>'
      : `${contents}<path d="M22 58h78l-8 30H30Z" fill="#ad8252" stroke="#745638" stroke-width="3"/><path d="M31 69h60m-57 11h54M42 59l3 27m15-27v27m18-27-3 27" stroke="#d1ab75" stroke-width="2"/>${visual === 'basket' ? '<path d="M29 60c0-50 64-50 64 0" fill="none" stroke="#8b6944" stroke-width="6"/>' : '<path d="M51 57V26h38v40H51Z" fill="#f4e9cb" stroke="#ac9970"/><path d="M58 37h23m-23 9h18m-18 9h23" stroke="#9c8b65" stroke-width="2"/>'}`;
  return `<svg viewBox="0 0 120 100" aria-hidden="true">${art}</svg>`;
}

export function visitMarkup(state: GameState, place: TownPlace, inspected: boolean): string {
  const person = TOWNSPEOPLE[place];
  const story = visitStory(state, place);
  const canPlan = state.phase === 'decision' || (state.records.length >= 2 && ['result', 'complete'].includes(state.phase));
  return `<dialog class="dialog visit-dialog" id="game-dialog" data-place="${place}" data-inspected="${inspected}" data-mood="${story.mood}" aria-labelledby="dialog-title">
    <header class="visit-header"><div><span class="eyebrow">第 ${state.seasonIndex + 1} 季 · ${places[place]}</span><h2 id="dialog-title">${person.name}<small>${person.role}</small></h2></div><button class="button ghost" type="button" data-action="close-dialog" aria-label="关闭走访">返回 ×</button></header>
    <div class="visit-body"><div class="visit-stage">
      <svg class="visit-landscape" viewBox="0 0 320 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${landscapes[place]}</svg>
      <div class="visit-portrait"><img src="${person.image}" alt="${person.role}${person.name}" width="300" height="400" decoding="async" /></div>
      <span class="visit-status">${story.status}</span>
      <button id="visit-inspect" class="visit-prop" type="button" data-action="visit-inspect" aria-expanded="${inspected}" aria-controls="visit-evidence">${propArt(story.visual, inspected)}<span>${inspected ? '收起细节' : story.propLabel} <b aria-hidden="true">${inspected ? '−' : '+'}</b></span></button>
    </div><div class="visit-talk">
      <p id="visit-line" class="visit-speech" tabindex="-1">“${story.line}”</p>
      ${inspected ? `<div id="visit-evidence" class="visit-evidence" role="status"><div class="visit-metric"><span>${story.metricLabel}</span><strong>${story.metricValue}</strong></div>${story.visual === 'price' ? '' : `<div class="visit-fill" aria-hidden="true"><span style="width:${story.fill * 100}%"></span></div>`}<p>${story.inspectLine}</p></div>` : '<p class="visit-hint">点点旁边的物件，看看眼前的情况。</p>'}
      <div class="visit-actions"><button class="button primary" id="visit-next" type="button" data-action="visit-next">${person.nextLabel} →</button>${canPlan ? `<button class="button secondary" id="visit-plan" type="button" data-action="visit-plan">${state.phase === 'decision' ? '回政策桌想办法' : '试试另一种办法'}</button>` : ''}</div>
      <button class="visit-advisor" id="visit-advisor" type="button" data-action="visit-advisor">请林岚解释原因 ↗</button>
    </div></div>
  </dialog>`;
}
