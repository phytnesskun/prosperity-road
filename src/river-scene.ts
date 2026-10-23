import './river-scene.css';

type RiverSceneOptions = {
  season: number;
  quantity: number | null;
  damage: number | null;
  settled: boolean;
  active: 'factory' | 'river' | 'harbor' | null;
  motion: boolean;
};

export function renderRiverScene({ season, quantity, damage, settled, active, motion }: RiverSceneOptions): string {
  const producing = settled && (quantity ?? 0) > 0;
  const tint = settled ? Math.min(.58, Math.max(0, (damage ?? 0) / 2800)) : 0;
  const dry = season === 3;
  const orders = season === 4;
  const trees = [[46, 194, 1], [73, 175, .8], [95, 212, .85], [40, 263, 1.2], [78, 286, .9], [131, 306, .75], [200, 336, .8], [691, 117, 1.05], [719, 145, .8], [668, 158, .7], [643, 75, .8], [726, 255, 1.15], [699, 281, .85]];
  const treeMarkup = trees.map(([x, y, scale]) => `<g transform="translate(${x} ${y}) scale(${scale})"><path d="M0 3v24" stroke="#6d7953" stroke-width="4"/><path d="M0-35-18 1h8L-23 17h46L10 1h8Z" fill="#657f65"/><path d="M0-35V17H23L10 1h8Z" fill="#486c5b" opacity=".65"/></g>`).join('');
  const places = [
    { id: 'factory', title: '纸厂', detail: '走进车间', number: '01' },
    { id: 'river', title: '河岸', detail: '沿水边走走', number: '02' },
    { id: 'harbor', title: '码头', detail: '看看来往船只', number: '03' },
  ] as const;
  const description = `河港镇：纸厂在左岸，居民小屋沿河而建，货船停在码头。${dry ? '本季水位降低，河滩露出。' : ''}${orders ? '本季有新订单，货船驶入港口。' : ''}${tint > 0 ? '河水颜色反映本季外部成本，不表示累计污染。' : ''}`;

  return `<section class="river-scene${settled && motion ? ' river-scene-animated' : ''}${dry ? ' river-scene-dry' : ''}" data-active="${active ?? ''}" aria-label="河港镇地图">
    <div class="river-scene-art">
      <div class="river-scene-caption"><span>河港镇 · 沿河而生</span>${dry ? '<small>枯水季 · 河滩露出</small>' : orders ? '<small>商船抵港 · 新订单来了</small>' : '<small>纸厂、河流与一座小镇</small>'}</div>
      <svg viewBox="0 0 760 390" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="river-scene-paper" x2="0" y2="1"><stop stop-color="#f8f3df"/><stop offset="1" stop-color="#e8e7cd"/></linearGradient>
          <linearGradient id="river-scene-water" x1="0" y1="0" x2=".6" y2="1"><stop stop-color="#94b8ab"/><stop offset="1" stop-color="#548e88"/></linearGradient>
          <linearGradient id="river-scene-bank" x2="0" y2="1"><stop stop-color="#b2bd91"/><stop offset="1" stop-color="#c7caa3"/></linearGradient>
          <pattern id="river-scene-bricks" width="20" height="12" patternUnits="userSpaceOnUse"><path d="M0 0H20M10 0v6M0 6H20M0 6v6M20 6v6" fill="none" stroke="#e9d6af" stroke-opacity=".35" stroke-width="1"/></pattern>
          <clipPath id="river-scene-water-clip"><path d="M413-8C390 49 406 97 451 129S554 173 535 219 478 278 507 318 579 355 601 398H789V-8Z"/></clipPath>
        </defs>
        <path fill="url(#river-scene-paper)" d="M0 0h760v390H0z"/>
        <path d="M0 103Q84 52 158 66T312 45 443 51 586 44 760 70V236H0Z" fill="#d9ddbd" opacity=".65"/>
        <path d="M0 155Q89 117 186 131T343 97 478 102 760 118V390H0Z" fill="url(#river-scene-bank)"/>
        <path d="M405-8C376 58 397 104 441 140S540 177 522 216 462 278 494 326 561 368 582 398H790V-8Z" fill="#d8c89a"/>
        <path d="M413-8C390 49 406 97 451 129S554 173 535 219 478 278 507 318 579 355 601 398H789V-8Z" fill="url(#river-scene-water)"/>
        <path d="M529-8C505 42 503 65 533 91S650 126 641 171 577 227 591 274 699 327 724 398H789V-8Z" fill="#b7c6a4"/>
        <path d="M536-8C515 43 515 65 543 87S664 120 651 174 589 231 602 270 712 323 735 398H789V-8Z" fill="#c9cda6"/>
        <g clip-path="url(#river-scene-water-clip)">
          <path d="M414 154Q474 171 499 207T509 290 606 391" stroke="#8c7955" stroke-width="92" fill="none" opacity="${tint}"/>
          <g class="river-scene-ripples" fill="none" stroke="#d4e9d5" stroke-width="2" stroke-linecap="round" opacity=".55">
            <path d="M437 47q18 6 34 1M445 66q19 7 42 3M479 124q15 9 32 9M543 169q20 4 35-4M550 196q18 3 29-4M529 256q15-7 27-4M530 305q20 9 37 6M609 346q16 8 40 6M642 368q15 4 27 2"/>
          </g>
        </g>
        ${dry ? '<path d="M414 94q17 41 74 63t43 71q-20 25-25 38l-15 2q5-29 25-52 13-33-39-54T404 96Z" fill="#d4c398"/><path d="m494 245 9-3m-18 29 11-2m-58-130 8 4" fill="none" stroke="#b6a178" stroke-width="3" stroke-linecap="round"/>' : ''}
        <path d="M116 390Q139 322 199 276T330 247 433 232" fill="none" stroke="#e6d8b5" stroke-width="30"/>
        <path d="M191 272q19-44 46-69" fill="none" stroke="#e6d8b5" stroke-width="20"/>
        <path d="M593 100q23 19 57 51t40 86" fill="none" stroke="#e6d8b5" stroke-width="18"/>
        <g opacity=".2" fill="#4f6454"><ellipse cx="201" cy="215" rx="119" ry="18"/><ellipse cx="631" cy="156" rx="64" ry="11"/><ellipse cx="317" cy="313" rx="70" ry="10"/></g>
        ${treeMarkup}
        <!-- Paper mill: warm brick, slate roofs and a working water wheel. -->
        <g>
          <path d="M112 147h174v66H112Z" fill="#c09b70"/>
          <path d="M286 147l31-17v67l-31 16Z" fill="#9e7c58"/>
          <path d="m102 148 45-42h153l-14 42Z" fill="#4c6460"/>
          <path d="m286 148 14-42 28 23-11 1Z" fill="#3c534f"/>
          <path d="M112 151h174v62H112Z" fill="url(#river-scene-bricks)"/>
          <path d="M145 114V66h21v51M255 117V76h16v41" fill="#ad865f"/>
          <path d="M141 65h29v8h-29M252 75h22v7h-22" fill="#80694e"/>
          <path d="M156 79v28M263 86v23" stroke="#c4a278" stroke-width="3"/>
          <path d="M127 161h19v27h-19M157 161h19v27h-19M187 161h19v27h-19M251 161h19v27h-19" fill="#516b60"/>
          <path d="M129 163h15v8h-15M159 163h15v8h-15M189 163h15v8h-15M253 163h15v8h-15" fill="#dcd6ab"/>
          <path d="M218 178q10-10 20 0v35h-20Z" fill="#5d6650"/>
          <path d="m295 157 13-7v23l-13 7Z" fill="#4d5c4c"/>
          <path d="M94 213h231v7H94Z" fill="#a18c67"/>
          <path d="M314 197h34l10 18h-43Z" fill="#8a7856"/>
          <g class="${producing ? 'river-scene-wheel' : ''}">
            <circle cx="323" cy="207" r="19" fill="#665d45" stroke="#b69c6e" stroke-width="5"/>
            <path d="M323 189v36m-18-18h36m-31-13 26 26m0-26-26 26" stroke="#ae9468" stroke-width="4"/>
            <circle cx="323" cy="207" r="5" fill="#6b634b"/>
          </g>
          <path d="M343 214q27 19 67 13" fill="none" stroke="#8ba498" stroke-width="8"/>
          ${producing ? '<g class="river-scene-smoke" fill="#ece9d9" opacity=".75"><ellipse cx="155" cy="53" rx="10" ry="7"/><ellipse cx="164" cy="42" rx="14" ry="9"/><ellipse cx="178" cy="29" rx="20" ry="11"/></g><g class="river-scene-smoke river-scene-smoke-small" fill="#ece9d9" opacity=".65"><ellipse cx="264" cy="65" rx="8" ry="6"/><ellipse cx="273" cy="52" rx="13" ry="8"/></g>' : ''}
          <g fill="#e8dab9" stroke="#b3a07d" stroke-width="1.5"><path d="M116 225h20v12h-20zM138 224h20v13h-20zM125 214h20v11h-20z"/><path d="M277 225h25v13h-25zM290 213h21v12h-21z"/></g>
        </g>
        <!-- Houses and garden plots across the river. -->
        <g>
          <path d="M574 111h40v35h-40M619 126h43v36h-43" fill="#f0dfb7"/>
          <path d="m569 112 24-25 25 25Zm45 15 26-25 28 25Z" fill="#98745d"/>
          <path d="M590 127h10v19h-10M635 142h10v20h-10" fill="#6c7660"/>
          <path d="M578 120h8v10h-8M603 120h7v10h-7M623 136h8v10h-8M650 136h8v10h-8" fill="#7c9b87"/>
          <path d="M575 151h33m14 16h32" stroke="#a0ac7b" stroke-width="5" stroke-linecap="round"/>
          <path d="M289 284h43v30h-43M334 279h38v31h-38" fill="#e9d5a9"/>
          <path d="m283 285 27-23 28 23Zm46-5 25-24 25 24Z" fill="#90715a"/>
          <path d="M306 298h9v16h-9M349 294h10v16h-10" fill="#61735a"/>
          <path d="M294 292h8v9h-8M321 292h7v9h-7M339 288h7v9h-7M363 288h5v9h-5" fill="#91a48a"/>
          <path d="M277 326h91m-83 8h73m-61 8h48" stroke="#849365" stroke-width="4" stroke-linecap="round"/>
          <path d="M268 305v21m-6-13h13M380 295v20m-6-12h13" stroke="#8d805d" stroke-width="3"/>
        </g>
        <!-- Timber quay and river barge. -->
        <g>
          <path d="m407 241 73 29-8 18-73-29Z" fill="#9c805b"/>
          <path d="m407 241 73 29-4 8-73-29Z" fill="#c3a477"/>
          <path d="m416 246-4 8m14-4-4 8m14-4-4 8m14-4-4 8m14-4-4 8m14-4-4 8" stroke="#9d815c" stroke-width="2"/>
          <path d="M406 243v23m67 9v24" stroke="#746b4e" stroke-width="5"/>
          <path d="M388 231h17v16h-17M374 243h19v15h-19" fill="#b19b6c" stroke="#837750" stroke-width="1.5"/>
          <path d="m391 233 11 11m-11 0 11-11m-25 13 13 9m-13 0 13-9" stroke="#d4c297" stroke-width="1.5"/>
        </g>
        <g class="river-scene-boat${orders ? ' river-scene-boat-arriving' : ''}">
          <ellipse cx="535" cy="285" rx="43" ry="9" fill="#355e59" opacity=".18"/>
          <path d="m491 266 87 12-13 15-56-8Z" fill="#6d624b"/>
          <path d="m492 265 43-8 43 20-39 7Z" fill="#bc9c6e"/>
          <path d="m507 265 26-4 28 13-25 5Z" fill="#e7d4a9"/>
          <path d="M535 263v-61" stroke="#665f49" stroke-width="3"/>
          <path d="M538 207q18 25 23 49l-23-8Z" fill="#f6ebcc"/>
          <path d="M532 216q-14 21-17 34l17-5Z" fill="#dfd2ac"/>
          <path d="m534 202 14 4-14 5Z" fill="#a97755"/>
          ${orders ? '<path d="m517 266 11-2 1 10-11-2Zm15-3 10 5-1 9-10-3Z" fill="#aa835c"/>' : ''}
        </g>
        <g fill="#87946b"><ellipse cx="224" cy="335" rx="13" ry="5"/><ellipse cx="248" cy="350" rx="18" ry="7"/><ellipse cx="440" cy="316" rx="12" ry="4"/><ellipse cx="654" cy="294" rx="14" ry="5"/></g>
        <g fill="none" stroke="#637d66" stroke-width="2" stroke-linecap="round"><path d="m458 307 1-12m1 8 5-7m-6 5-5-8m-23 22 1-13m0 9 5-6M656 277v-13m0 7 6-5m-6 8-4-6"/></g>
        <g class="river-scene-pin river-scene-pin-factory" transform="translate(210 133)"><circle r="14"/><text y="5">1</text></g>
        <g class="river-scene-pin river-scene-pin-river" transform="translate(434 293)"><circle r="14"/><text y="5">2</text></g>
        <g class="river-scene-pin river-scene-pin-harbor" transform="translate(404 213)"><circle r="14"/><text y="5">3</text></g>
        <path d="M27 359h38m-19-19v38" stroke="#7e8867" stroke-width="1" opacity=".6"/><path d="m46 340-4 12h8Z" fill="#7e8867"/>
        <text x="46" y="335" text-anchor="middle" fill="#7e8867" font-size="9" font-family="serif">N</text>
      </svg>
    </div>
    <p class="river-scene-description">${description}</p>
    <div class="river-scene-places" aria-label="去镇上看看">${places.map(place => `<button type="button" id="river-place-${place.id}" data-river-place="${place.id}" aria-pressed="${active === place.id}"><span class="river-scene-place-number">${place.number}</span><span><strong>${place.title}</strong><small>${place.detail}</small></span><span class="river-scene-place-arrow" aria-hidden="true">↗</span></button>`).join('')}</div>
  </section>`;
}
