# Unit of Work 依存関係

**作成日**: 2026-04-10

---

## 依存関係マトリクス

| Unit | 依存先 | 依存の内容 |
|------|--------|-----------|
| Unit-01: サウンドシステム | Core（既存） | 各Systemからの音声イベントトリガー |
| Unit-02: 設定画面 & ヘルプ | Core（既存） | TitleScreen、InputHandler、GameService |
| Unit-02: 設定画面 & ヘルプ | Unit-01 | BGM/SE音量の設定値をAudioManagerに反映 |

---

## 依存関係図

```
+------------------+
|   Core（既存）    |
|  GameService     |
|  Systems         |
|  TitleScreen     |
|  InputHandler    |
+--------+---------+
         |
    +----+----+
    |         |
    v         v
+--------+ +------------------+
|Unit-01 | |    Unit-02       |
| Sound  | | Settings & Help  |
+--------+ +------------------+
    ^              |
    |              |
    +--------------+
    音量設定の反映
```

---

## 実装順序

| 順番 | Unit | 理由 |
|------|------|------|
| 1 | Unit-01: サウンドシステム | Core以外への依存なし。AudioManagerのAPIが確定すればUnit-02が音量制御を接続できる |
| 2 | Unit-02: 設定画面 & ヘルプ | Unit-01のAudioManager APIに依存（音量設定の適用先） |

**並行開発の可能性**: Unit-01のAudioManagerインターフェース（`setMasterVolume(v)`, `setBGMVolume(v)`, `setSEVolume(v)`）を先に定義すれば、実装自体は並行可能。

---

## インターフェース定義（Unit間契約）

### Unit-01 → Core: サウンドイベントインターフェース
```typescript
// AudioManagerが提供するメソッド（各Systemから呼び出し）
interface IAudioManager {
  // BGM制御
  playBGM(scene: 'title' | 'playing' | 'gameover'): void;
  stopBGM(): void;

  // SE再生
  playSE(type: 'shoot' | 'enemy_destroy' | 'item_collect' | 'buff_activate' | 'ally_convert' | 'boss_spawn' | 'defense_breach'): void;

  // 音量制御（Unit-02から呼び出し）
  setBGMVolume(volume: number): void;   // 0.0〜1.0
  setSEVolume(volume: number): void;    // 0.0〜1.0

  // モバイル初期化
  resumeContext(): Promise<void>;        // ユーザーインタラクション後に呼び出し
}
```

### Unit-02 → Core: 設定適用インターフェース
```typescript
// 設定画面が保存・復元する設定データ
interface GameSettings {
  bgmVolume: number;      // 0〜100
  seVolume: number;        // 0〜100
  controlType: 'button' | 'swipe' | 'both';
}

// SettingsManagerが提供するメソッド
interface ISettingsManager {
  load(): GameSettings;          // localStorage読み込み
  save(settings: GameSettings): void;  // localStorage保存
  getDefaults(): GameSettings;   // デフォルト値
}
```
