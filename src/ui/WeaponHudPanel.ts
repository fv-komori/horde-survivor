/**
 * C6-10 / Iter6 Phase 5: 画面左下の現武器ジャンル表示パネル
 *
 * - setGenre で名前更新 + 0.3 秒フラッシュ開始
 * - updateFlash で flashRemaining を減算し、CSS クラスを切り替える
 */

import { WeaponGenre } from '../types';
import { I18N_WEAPON_LABEL } from '../config/i18nStrings';

const FLASH_DURATION = 0.3;

export class WeaponHudPanel {
  private readonly root: HTMLDivElement;
  private readonly nameEl: HTMLSpanElement;
  private currentGenre: WeaponGenre = WeaponGenre.RIFLE;
  private flashRemaining: number = 0;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'hud-weapon';

    this.nameEl = document.createElement('span');
    this.nameEl.className = 'hud-weapon-name';
    this.root.appendChild(this.nameEl);

    parent.appendChild(this.root);
    this.nameEl.textContent = I18N_WEAPON_LABEL[this.currentGenre];
  }

  setGenre(genre: WeaponGenre): void {
    const changed = genre !== this.currentGenre;
    this.currentGenre = genre;
    this.nameEl.textContent = I18N_WEAPON_LABEL[genre] ?? String(genre);
    if (changed) {
      this.flashRemaining = FLASH_DURATION;
      this.root.classList.add('hud-weapon-flash');
    }
  }

  updateFlash(dt: number): void {
    if (this.flashRemaining <= 0) return;
    this.flashRemaining -= dt;
    if (this.flashRemaining <= 0) {
      this.flashRemaining = 0;
      this.root.classList.remove('hud-weapon-flash');
    }
  }

  getCurrentGenre(): WeaponGenre {
    return this.currentGenre;
  }

  getFlashRemaining(): number {
    return this.flashRemaining;
  }

  dispose(): void {
    this.root.remove();
  }
}
