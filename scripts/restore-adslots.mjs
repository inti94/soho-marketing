// 애드센스 승인 후 광고 유닛 복구용.
//
// 사용법:
//   1) 애드센스 콘솔에서 광고 단위를 만들고 슬롯ID를 발급받는다.
//   2) 아래 SLOT_IDS 에 실제 숫자 ID를 채운다.
//   3) node scripts/restore-adslots.mjs        (미리보기)
//      node scripts/restore-adslots.mjs --write (실제 반영)
//
// 마커 <!-- ADSLOT:이름 --> 를 adslot-manifest.json 의 원본 블록으로 되돌린다.
// SLOT_IDS 를 비워두면 원본(플레이스홀더 포함) 그대로 복원된다 — 왕복 검증용.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WRITE = process.argv.includes('--write');

// 플레이스홀더 → 실제 슬롯ID. 비워두면 치환하지 않는다.
const SLOT_IDS = {
  '여기에_광고슬롯ID': '',
  '여기에_광고슬롯ID_2': '',
  '여기에_광고슬롯ID_3': '',
  '여기에_광고슬롯ID2': '',
  '여기에_광고슬롯ID3': '',
};

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/adslot-manifest.json'), 'utf8'));

function indent(block, pad) {
  if (!pad) return block;
  return block.split('\n').map((l, i) => (i === 0 || !l.trim() ? l : pad + l)).join('\n');
}

function applyIds(block) {
  let out = block;
  for (const [ph, id] of Object.entries(SLOT_IDS)) {
    if (id) out = out.split(`data-ad-slot="${ph}"`).join(`data-ad-slot="${id}"`);
  }
  return out;
}

const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));
let restored = 0, touched = 0, missing = new Set();

for (const f of files) {
  const p = path.join(ROOT, f);
  const src = fs.readFileSync(p, 'utf8');
  let n = 0;
  const out = src.replace(/([ \t]*)<!-- ADSLOT:([a-z0-9-]+) -->/g, (m, pad, name) => {
    if (!manifest[name]) { missing.add(name); return m; }
    n++;
    return pad + indent(applyIds(manifest[name]), pad);
  });
  if (n) {
    restored += n;
    touched++;
    if (WRITE) fs.writeFileSync(p, out);
  }
}

console.log(`${WRITE ? '복구 완료' : '미리보기(--write 없음)'}: 마커 ${restored}건 / 파일 ${touched}개`);
if (missing.size) console.log('매니페스트에 없는 마커:', [...missing].join(', '));
const ids = Object.values(SLOT_IDS).filter(Boolean).length;
console.log(ids ? `실제 슬롯ID ${ids}종 적용` : '※ SLOT_IDS 비어 있음 — 플레이스홀더 그대로 복원됨');
