/**
 * Iter6 AC-01: 旧アイテムコードの残骸が src/ に存在しないことを保証する grep チェック。
 * components-v6.md の「削除対象の詳細 grep チェックリスト」と 1:1 対応。
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const SRC_ROOT = join(__dirname, '..', '..', 'src');

// Source paths where the pattern is banned. Patterns from components-v6.md.
const BANNED_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /ItemDropManager/,                           label: 'ItemDropManager' },
  { re: /determineDrops/,                            label: 'determineDrops' },
  { re: /POWERUP_DROP_WEIGHTS/,                      label: 'POWERUP_DROP_WEIGHTS' },
  { re: /WEAPON_DROP_TYPES/,                         label: 'WEAPON_DROP_TYPES' },
  { re: /\benum\s+ItemType\b/,                       label: 'enum ItemType' },
  { re: /\bItemType\./,                              label: 'ItemType. (namespace access)' },
  { re: /ITEM_COLORS/,                               label: 'ITEM_COLORS' },
  { re: /itemTypeToBuff/,                            label: 'itemTypeToBuff' },
  { re: /itemTypeToWeapon/,                          label: 'itemTypeToWeapon' },
  { re: /\benum\s+WeaponType\s*\{/,                  label: 'enum WeaponType {' },
  { re: /SphereGeometry\(0\.08/,                     label: 'SphereGeometry(0.08' },
  { re: /itemDropRate/,                              label: 'itemDropRate' },
  { re: /weaponDropRate/,                            label: 'weaponDropRate' },
  { re: /GAME_CONFIG\.itemSpawn/,                    label: 'GAME_CONFIG.itemSpawn' },
  { re: /ItemDropComponent/,                         label: 'ItemDropComponent' },
  { re: /ItemCollectionSystem/,                      label: 'ItemCollectionSystem' },
  { re: /AllyConversionSystem/,                      label: 'AllyConversionSystem' },
];

function collectTsFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) collectTsFiles(full, out);
    else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) out.push(full);
  }
  return out;
}

/** コメント（// 行 / /* ブロック） と文字列リテラルを除いたコードだけを行ごとに返す */
function stripCommentsAndStrings(text: string): string[] {
  // まずブロックコメントを全体から除く（簡易: /* ... */ を空白に）
  const noBlock = text.replace(/\/\*[\s\S]*?\*\//g, ' ');
  // 行コメント // を空白で消す
  const lines = noBlock.split('\n').map((line) => {
    const lcIdx = line.indexOf('//');
    if (lcIdx >= 0) return line.slice(0, lcIdx);
    return line;
  });
  // 文字列リテラル（'...' "..." `...`）を空白に（簡易: 行内で閉じるもののみ対応）
  return lines.map((l) => l
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/`(?:\\.|[^`\\])*`/g, '``'),
  );
}

describe('AC-01: deleted item/weapon symbols must be gone from src/', () => {
  const files = collectTsFiles(SRC_ROOT);

  for (const { re, label } of BANNED_PATTERNS) {
    test(`no references to "${label}"`, () => {
      const hits: string[] = [];
      for (const file of files) {
        const text = readFileSync(file, 'utf8');
        const cleaned = stripCommentsAndStrings(text);
        cleaned.forEach((line, idx) => {
          if (re.test(line)) {
            hits.push(`${relative(SRC_ROOT, file)}:${idx + 1}: ${line.trim()}`);
          }
        });
      }
      if (hits.length > 0) {
        throw new Error(`Found ${hits.length} references to "${label}":\n` + hits.join('\n'));
      }
    });
  }
});
