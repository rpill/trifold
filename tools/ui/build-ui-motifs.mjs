import { mkdirSync, writeFileSync } from 'node:fs';
const root = new URL('../../public/assets/ui/art/', import.meta.url);
mkdirSync(root, { recursive: true });
const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><defs><linearGradient id="gold" x2="0.7" y2="1"><stop stop-color="#f3d994"/><stop offset=".5" stop-color="#b28a40"/><stop offset="1" stop-color="#e6c681"/></linearGradient><radialGradient id="jade"><stop stop-color="#225746"/><stop offset="1" stop-color="#072b23"/></radialGradient></defs>${body}</svg>`;
const leaf = '<path d="M129 181V122C126 101 111 91 92 92C90 114 103 132 128 132M129 154C130 112 155 99 174 99C177 128 158 143 131 143M113 184H148" fill="url(#gold)" stroke="#efda9d" stroke-width="2.5" stroke-linecap="round"/>';
const motifs = {
  novice: leaf,
  player: '<path d="M129 176V83M123 116L94 105L78 88Q109 82 125 99M134 136L164 123L178 101Q147 99 132 119M124 153L92 143L76 121Q111 119 125 137M112 178H148" fill="url(#gold)" stroke="#e5c986" stroke-width="3"/>',
  tactician: '<path d="M128 78L166 105L153 161L128 180L103 161L90 105Z" fill="none" stroke="url(#gold)" stroke-width="4"/><path d="M103 134L122 150L153 108M128 71V57M187 128H200M69 128H56" fill="none" stroke="url(#gold)" stroke-width="6"/>',
  expert: '<path d="M128 70L141 109L183 112L150 138L160 179L128 155L96 179L105 138L73 112L115 109Z" fill="url(#gold)"/><circle cx="128" cy="128" r="16" fill="url(#jade)"/>',
  master: '<path d="M81 104L104 124L128 82L152 124L176 104L163 165H93Z" fill="url(#gold)"/><path d="M96 174H160" stroke="#f2d99a" stroke-width="5"/><circle cx="128" cy="81" r="6" fill="#efd396"/>',
  grandmaster: '<path d="M157 85C112 57 76 91 99 117C115 134 155 112 163 144C171 181 119 195 100 169C81 141 106 129 125 141C140 151 126 169 116 160M156 86L176 78L170 98L184 110L161 108L151 125M157 81L145 64M164 85L166 64M99 107L82 98M100 166L82 180" fill="none" stroke="url(#gold)" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><circle cx="168" cy="94" r="3" fill="#fff4ca"/>',
};
for (const [rank, motif] of Object.entries(motifs)) {
  let dots='';
  for(let i=0;i<40;i++){const a=i*Math.PI/20;dots+=`<circle cx="${128+107*Math.cos(a)}" cy="${128+107*Math.sin(a)}" r="1.5" fill="#b69755"/>`;}
  writeFileSync(new URL(`rank-${rank}.svg`,root),svg(`<circle cx="128" cy="132" r="116" fill="#382b15" opacity=".15"/><circle cx="128" cy="128" r="114" fill="url(#gold)"/><circle cx="128" cy="128" r="110" fill="url(#jade)"/><circle cx="128" cy="128" r="101" fill="none" stroke="url(#gold)" stroke-width="2"/><circle cx="128" cy="128" r="93" fill="none" stroke="#c2a367" stroke-width=".8"/>${dots}${motif}<path d="M128 20L133 26L128 32L123 26ZM128 224L133 230L128 236L123 230Z" fill="#ebcd86"/>`));
}
writeFileSync(new URL('daily-calendar.svg',root),svg('<path d="M65 67L201 78L184 223L49 210Z" fill="#563e21" opacity=".15"/><path d="M63 53L195 67L180 214L47 199Z" fill="#fff4da" stroke="#a5884d" stroke-width="3"/><path d="M63 53L195 67L191 105L59 91Z" fill="#6e3028" stroke="#a5884d" stroke-width="3"/><path d="M90 45L87 74M168 53L166 82" stroke="#e3bc70" stroke-width="8" stroke-linecap="round"/><path d="M65 179L171 190" stroke="#cbb786" stroke-width="1"/><path d="M24 216Q24 154 54 120M29 184L9 168M38 157L59 151" fill="none" stroke="#796a40" stroke-width="3"/><g fill="#b36454"><circle cx="13" cy="166" r="7"/><circle cx="25" cy="187" r="6"/><circle cx="49" cy="136" r="6"/><circle cx="57" cy="151" r="7"/></g>'));
