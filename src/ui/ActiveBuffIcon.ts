/**
 * C6-09 / Iter6 Phase 5: アクティブバフ列（最大 3 スロット、ラベル + 残り秒数）
 *
 * BuffComponent.activeBuffs を直接観測して再配置する。30Hz ドレインで setBuffs が呼ばれる想定。
 */

import { BuffType, BUFF_COLORS } from '../types';
import { GAME_CONFIG } from '../config/gameConfig';

const BUFF_LABELS: Record<BuffType, string> = {
  [BuffType.ATTACK_UP]: 'ATK',
  [BuffType.FIRE_RATE_UP]: 'SPD',
  [BuffType.SPEED_UP]: 'MOV',
  [BuffType.BARRAGE]: 'BRG',
};

const MAX_SLOTS = 3;

export interface ActiveBuffView {
  type: BuffType;
  remaining: number;
}

export class ActiveBuffIcon {
  private readonly root: HTMLDivElement;
  private readonly slots: HTMLDivElement[] = [];

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'hud-buff-container';
    for (let i = 0; i < MAX_SLOTS; i++) {
      const slot = this.buildSlot();
      slot.style.display = 'none';
      this.slots.push(slot);
      this.root.appendChild(slot);
    }
    parent.appendChild(this.root);
  }

  setBuffs(buffs: ActiveBuffView[]): void {
    for (let i = 0; i < MAX_SLOTS; i++) {
      const slot = this.slots[i];
      const buff = buffs[i];
      if (!buff) {
        slot.style.display = 'none';
        continue;
      }
      slot.style.display = '';
      const label = BUFF_LABELS[buff.type] ?? '?';
      const color = BUFF_COLORS[buff.type] ?? '#FFFFFF';
      const ratio = Math.max(0, Math.min(1, buff.remaining / GAME_CONFIG.buff.duration));

      const labelEl = slot.children[0] as HTMLSpanElement;
      const fill = (slot.children[1] as HTMLDivElement).children[0] as HTMLDivElement;
      labelEl.textContent = label;
      labelEl.style.color = color;
      fill.style.width = `${(ratio * 100).toFixed(2)}%`;
      fill.style.backgroundColor = color;
    }
  }

  reset(): void {
    for (const slot of this.slots) slot.style.display = 'none';
  }

  dispose(): void {
    this.root.remove();
    this.slots.length = 0;
  }

  private buildSlot(): HTMLDivElement {
    const item = document.createElement('div');
    item.className = 'hud-buff-item';

    const labelEl = document.createElement('span');
    labelEl.className = 'buff-label';
    item.appendChild(labelEl);

    const barBg = document.createElement('div');
    barBg.className = 'buff-bar-bg';
    const barFill = document.createElement('div');
    barFill.className = 'buff-bar-fill';
    barBg.appendChild(barFill);
    item.appendChild(barBg);

    return item;
  }
}
