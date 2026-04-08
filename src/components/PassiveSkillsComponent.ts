import { Component } from '../ecs/Component';

/** C-12: パッシブスキルレベル群コンポーネント */
export class PassiveSkillsComponent extends Component {
  static readonly componentName = 'PassiveSkillsComponent';

  public speedLevel: number = 0;
  public maxHpLevel: number = 0;
  public attackLevel: number = 0;
  public xpGainLevel: number = 0;

  constructor() {
    super();
  }
}
