import type { BestCondition } from './presets';

export type CharacterProfile = {
  nickname: string;
  characterClass: string;
  level: number;
  arcaneForce: number;
  authenticForce: number;
  ignoreDefense: number;
  damage: number;
  bossDamage: number;
  criticalRate: number;
  criticalDamage: number;
  image?: string;
  hexaCoreCount?: number;
  hexaCoreLevelTotal?: number;
  hexaStatCoreCount?: number;
  dataDate?: string;
  bestCondition?: BestCondition;
  calculationProfile?: CharacterCalculationProfile;
  source: 'reference' | 'nexon';
};

export type AuthenticRegion = 'seren' | 'kalos' | 'adversary' | 'kaling' | 'malefic' | 'limbo' | 'bardrix' | 'jupiter';

export type CharacterCalculationProfile = {
  mainStat: number;
  magicAttack: number;
  finalDamage: number;
  statusDamage: number;
  buffDuration: number;
  cooldownReductionSeconds: number;
  cooldownReductionPercent: number;
  ringLevel: number;
  symbolLevels: Partial<Record<AuthenticRegion, number>>;
  hexa: {
    skillAverage: number;
    masteryAverage: number;
    enhancementAverage: number;
    commonAverage: number;
    originLevel: number;
    statLevelTotal: number;
  };
};

export type BossStatus = {
  key: 'impossible' | 'party-min' | 'party' | 'solo-min' | 'solo' | 'solo-easy';
  label: string;
};

type Spline = { x: number[]; y: number[]; m: number[] };

type BossDefinition = {
  id: string;
  name: string;
  difficulty: string;
  image?: string;
  level: number;
  arcaneForce?: number;
  authenticForce?: number;
  partyLimit: 1 | 2 | 3 | 6;
  bossCut?: number;
  partyBossCut?: number;
  easyRate: number;
  guard: 300 | 380;
  partyBoss?: boolean;
};

export type BossResult = BossDefinition & {
  rate: number;
  cardStat: number;
  status: BossStatus;
  levelMultiplier: number;
  forceMultiplier: number;
  symbolMultiplier: number;
};

export type EngineBreakdown = {
  version: string;
  rawCurveDamage300: number;
  rawCurveDamage380: number;
  hexaCorrection300: number;
  hexaCorrection380: number;
  presetOffenseMultiplier: number;
  presetDefenseMultiplier300: number;
  presetDefenseMultiplier380: number;
  defenseConstant300: number;
  defenseConstant380: number;
  kalingMultiplier: number;
  weaponConstant: number;
  proficiency: number;
  classFinalDamage: number;
  ignoreElementalResistance: number;
  curveExponent300: number;
  curveExponent380: number;
  maxAuthenticSymbols: number;
};

export type EngineSummary = {
  calculatedHexaDamage300: number;
  calculatedHexaDamage380: number;
  calculatedHexaDamageKaling: number;
  boss300HexaStat: number;
  boss380HexaStat: number;
  breakdown: EngineBreakdown;
};

export const REFERENCE_HEXA = 83_583;
export const ENGINE_VERSION = 'Bishop Character Curve 2026.08 v4';
export const BOSS_TABLE_VERSION = 'MapleScouter KMS 2026-08-15';

export const REFERENCE_PROFILE: CharacterProfile = {
  nickname: '팸귄',
  characterClass: '비숍',
  level: 290,
  arcaneForce: 1360,
  authenticForce: 620,
  ignoreDefense: 96.3304,
  damage: 71,
  bossDamage: 465,
  criticalRate: 100,
  criticalDamage: 102.35,
  dataDate: '2026-08-29',
  source: 'reference',
};

const BISHOP_ADDITIONAL_IGNORE_DEFENSE = 0.693727598412758;
const BISHOP_KALING_DAMAGE_RATIO = 0.9739554098846646;
const BISHOP_HEXA_CORRECTION_300 = 0.920501595616958;
const BISHOP_HEXA_CORRECTION_380 = 0.934129464251163;
const BISHOP_ASCENT_CONSTANT = 0.01079042910864958;

export const BISHOP_CLASS_MODEL = {
  weaponConstant: 1.2,
  proficiency: 0.95,
  finalDamage: 203.1743,
  ignoreElementalResistance: 15,
} as const;

const spline300: Spline = {
  x: [0, 23716, 31615, 44999, 55216, 67090, 83643, 96746, 108468, 117023, 127726, 140485, 151698],
  y: [0, 220046494, 381210342, 842300878, 1368101108, 2200392046, 3799017401, 5420726955, 7805755105, 10431546554, 14809200696, 22097002480, 28725573204],
  m: [9278.398296508685, 13606.422932462516, 25076.504817645244, 41641.53669987673, 59124.17436603067, 80528.88706403958, 109015.26183529175, 154608.67928863762, 247321.59295263223, 348844.44582141953, 474391.4287785741, 581212.9804908385, 591150.5149380184],
};

const spline380: Spline = {
  x: [0, 23716, 31615, 44999, 55216, 67090, 83643, 96746, 108468, 117023, 127726, 140485, 151698],
  y: [0, 217217540, 374420689, 834275412, 1358092600, 2185105560, 3784359228, 5403015299, 7778774518, 10397906762, 14765020911, 22045216706, 28665563118],
  m: [9159.113678529264, 13369.005889399647, 24640.20057725847, 41510.70981268969, 58838.61070847873, 80231.03874951106, 108944.46174454503, 154197.55583388035, 246501.86404207704, 347978.13898796146, 473509.89437417005, 580548.866492415, 590417.0527066798],
};

const bosses: BossDefinition[] = [
  { id: 'extreme-kaling', name: '카링', difficulty: '익스트림', image: '/bosses/extreme_kaling.png', level: 285, authenticForce: 480, partyLimit: 6, partyBossCut: 108350, easyRate: 0.997841787071066, guard: 380, partyBoss: true },
  { id: 'extreme-kalos', name: '감시자 칼로스', difficulty: '익스트림', image: '/bosses/extreme_kalos.png', level: 285, authenticForce: 440, partyLimit: 6, bossCut: 90900, easyRate: 0.22694444444444445, guard: 380 },
  { id: 'hard-bellona', name: '벨로나', difficulty: '하드', level: 280, authenticForce: 550, partyLimit: 3, bossCut: 128200, easyRate: 1.05, guard: 380 },
  { id: 'destiny-limbo', name: '림보', difficulty: '데스티니', image: '/bosses/destiny_limbo.png', level: 285, authenticForce: 500, partyLimit: 1, bossCut: 118900, easyRate: 0.95, guard: 380 },
  { id: 'hard-limbo', name: '림보', difficulty: '하드', image: '/bosses/hard_limbo.png', level: 285, authenticForce: 500, partyLimit: 3, bossCut: 118900, easyRate: 0.95, guard: 380 },
  { id: 'hard-malefic', name: '흉성', difficulty: '하드', image: '/bosses/hard_maleficStar.png', level: 280, authenticForce: 550, partyLimit: 3, bossCut: 117500, easyRate: 0.95, guard: 380 },
  { id: 'destiny-adversary', name: '대적자', difficulty: '데스티니', image: '/bosses/destiny_adversary.png', level: 285, authenticForce: 340, partyLimit: 1, bossCut: 108100, easyRate: 0.76, guard: 380 },
  { id: 'hard-adversary', name: '대적자', difficulty: '하드', image: '/bosses/hard_adversary.png', level: 285, authenticForce: 340, partyLimit: 3, bossCut: 108100, easyRate: 0.95, guard: 380 },
  { id: 'hard-kaling', name: '카링', difficulty: '하드', image: '/bosses/hard_kaling.png', level: 285, authenticForce: 350, partyLimit: 6, bossCut: 105800, easyRate: 0.95, guard: 380 },
  { id: 'extreme-seren', name: '선택받은 세렌', difficulty: '익스트림', image: '/bosses/extreme_seren.png', level: 280, authenticForce: 200, partyLimit: 6, bossCut: 105700, easyRate: 0.95, guard: 380 },
  { id: 'extreme-black-mage', name: '검은 마법사', difficulty: '익스트림', image: '/bosses/extreme_blackMage.png', level: 280, arcaneForce: 1320, partyLimit: 6, bossCut: 94500, easyRate: 0.95, guard: 300 },
  { id: 'destiny-kaling', name: '카링', difficulty: '데스티니', image: '/bosses/destiny_kaling.png', level: 285, authenticForce: 350, partyLimit: 1, bossCut: 105800, easyRate: 1.14, guard: 380 },
  { id: 'normal-limbo', name: '림보', difficulty: '노멀', image: '/bosses/normal_limbo.png', level: 285, authenticForce: 500, partyLimit: 3, bossCut: 118900, easyRate: 1.8890409456118664, guard: 380 },
  { id: 'destiny-kalos', name: '감시자 칼로스', difficulty: '데스티니', image: '/bosses/destiny_kalos.png', level: 285, authenticForce: 330, partyLimit: 1, bossCut: 90900, easyRate: 0.95, guard: 380 },
  { id: 'chaos-kalos', name: '감시자 칼로스', difficulty: '카오스', image: '/bosses/chaos_kalos.png', level: 285, authenticForce: 330, partyLimit: 6, bossCut: 90900, easyRate: 0.95, guard: 380 },
  { id: 'normal-bellona', name: '벨로나', difficulty: '노멀', level: 280, authenticForce: 450, partyLimit: 3, bossCut: 128200, easyRate: 3.5570596797671037, guard: 380 },
  { id: 'destiny-seren', name: '선택받은 세렌', difficulty: '데스티니', image: '/bosses/destiny_seren.png', level: 275, authenticForce: 200, partyLimit: 1, bossCut: 105700, easyRate: 2.4048764911816405, guard: 380 },
  { id: 'normal-kaling', name: '카링', difficulty: '노멀', image: '/bosses/normal_kaling.png', level: 285, authenticForce: 330, partyLimit: 6, bossCut: 105800, easyRate: 2.7877201738381996, guard: 380 },
  { id: 'normal-malefic', name: '흉성', difficulty: '노멀', image: '/bosses/normal_maleficStar.png', level: 280, authenticForce: 400, partyLimit: 3, bossCut: 117500, easyRate: 4.297226209857768, guard: 380 },
  { id: 'extreme-lotus', name: '스우', difficulty: '익스트림', image: '/bosses/extreme_lotus.png', level: 285, partyLimit: 2, bossCut: 64500, easyRate: 0.9704301075268816, guard: 380 },
  { id: 'champion-kalos', name: '감시자 칼로스', difficulty: '챔피언', image: '/bosses/champion_kalos.png', level: 280, authenticForce: 300, partyLimit: 1, bossCut: 90900, easyRate: 3.1766295474321242, guard: 380 },
  { id: 'normal-adversary', name: '대적자', difficulty: '노멀', image: '/bosses/normal_adversary.png', level: 280, authenticForce: 320, partyLimit: 3, bossCut: 108100, easyRate: 6.114009582055534, guard: 380 },
  { id: 'normal-kalos', name: '감시자 칼로스', difficulty: '노멀', image: '/bosses/normal_kalos.png', level: 280, authenticForce: 300, partyLimit: 6, bossCut: 90900, easyRate: 4.538042210617321, guard: 380 },
  { id: 'easy-bellona', name: '벨로나', difficulty: '이지', level: 280, authenticForce: 400, partyLimit: 3, bossCut: 128200, easyRate: 18.821822849807447, guard: 380 },
  { id: 'champion-seren', name: '선택받은 세렌', difficulty: '챔피언', image: '/bosses/champion_seren.png', level: 275, authenticForce: 200, partyLimit: 1, bossCut: 105700, easyRate: 8.41706771913574, guard: 380 },
  { id: 'easy-kaling', name: '카링', difficulty: '이지', image: '/bosses/easy_kaling.png', level: 275, authenticForce: 230, partyLimit: 6, bossCut: 105800, easyRate: 10.810543864615774, guard: 380 },
  { id: 'hard-seren', name: '선택받은 세렌', difficulty: '하드', image: '/bosses/hard_seren.png', level: 275, authenticForce: 200, partyLimit: 6, bossCut: 105700, easyRate: 12.024382455908201, guard: 380 },
  { id: 'easy-adversary', name: '대적자', difficulty: '이지', image: '/bosses/easy_adversary.png', level: 270, authenticForce: 220, partyLimit: 3, bossCut: 108100, easyRate: 17.611309480434308, guard: 380 },
  { id: 'champion-black-mage', name: '검은 마법사', difficulty: '챔피언', image: '/bosses/champion_blackMage.png', level: 275, arcaneForce: 1320, partyLimit: 1, bossCut: 40600, easyRate: 1.90887340112972, guard: 300 },
];

export function splineValue(spline: Spline, value: number) {
  const last = spline.x.length - 1;
  if (value <= spline.x[0]) return spline.y[0] + spline.m[0] * (value - spline.x[0]);
  if (value >= spline.x[last]) return spline.y[last] + spline.m[last] * (value - spline.x[last]);
  let index = 0;
  while (index < last && value > spline.x[index + 1]) index += 1;
  const width = spline.x[index + 1] - spline.x[index];
  const t = (value - spline.x[index]) / width;
  const t2 = t * t;
  const t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * spline.y[index]
    + (t3 - 2 * t2 + t) * width * spline.m[index]
    + (-2 * t3 + 3 * t2) * spline.y[index + 1]
    + (t3 - t2) * width * spline.m[index + 1];
}

export function inverseSpline(spline: Spline, target: number) {
  let low = 0;
  let high = 250_000;
  for (let iteration = 0; iteration < 40; iteration += 1) {
    const middle = (low + high) / 2;
    if (splineValue(spline, middle) < target) low = middle;
    else high = middle;
  }
  return Math.round((low + high) / 2);
}

function levelMultiplier(difference: number) {
  if (difference >= 5) return 1.2;
  if (difference >= 0) return 1.1 + difference * 0.02;
  if (difference >= -4) return 1.1 + difference * 0.05;
  if (difference >= -40) return Math.max(0, 0.875 - (Math.abs(difference) - 5) * 0.025);
  return 0;
}

function authenticMultiplier(force: number, requirement: number) {
  const difference = force - requirement;
  if (difference < -90) return 0.05;
  if (difference < -80) return 0.1;
  if (difference < -70) return 0.2;
  if (difference < -60) return 0.3;
  if (difference < -50) return 0.4;
  if (difference < -40) return 0.5;
  if (difference < -30) return 0.6;
  if (difference < -20) return 0.7;
  if (difference < -10) return 0.8;
  if (difference < 0) return 0.9;
  if (difference < 10) return 1;
  if (difference < 20) return 1.05;
  if (difference < 30) return 1.1;
  if (difference < 40) return 1.15;
  if (difference < 50) return 1.2;
  return 1.25;
}

function arcaneMultiplier(force: number, requirement: number) {
  const ratio = force / requirement;
  if (ratio < 0.01) return 0.1;
  if (ratio < 0.3) return 0.3;
  if (ratio < 0.5) return 0.6;
  if (ratio < 0.7) return 0.7;
  if (ratio < 1) return 0.8;
  if (ratio < 1.1) return 1;
  if (ratio < 1.3) return 1.1;
  if (ratio < 1.5) return 1.3;
  return 1.5;
}

function combatContext(profile: CharacterProfile, boss: BossDefinition) {
  const level = levelMultiplier(profile.level - boss.level);
  const force = boss.authenticForce
    ? authenticMultiplier(profile.authenticForce, boss.authenticForce)
    : boss.arcaneForce
      ? arcaneMultiplier(profile.arcaneForce, boss.arcaneForce)
      : 1;
  return { level, force, total: level * force };
}

function bishopReferenceStat(boss: BossDefinition, profile: CharacterProfile) {
  if (boss.name === '검은 마법사') return 79_883;
  if (profile.source === 'nexon') return REFERENCE_HEXA;
  if (boss.name === '카링') return 82_675;
  if (['벨로나', '림보', '흉성', '스우'].includes(boss.name)) return 82_888;
  return REFERENCE_HEXA;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function profileCurveExponent(profile: CharacterProfile, guard: 300 | 380) {
  const calculation = profile.calculationProfile;
  if (!calculation) return 1;

  const damagePool = Math.max(1, 100 + profile.damage + profile.bossDamage + calculation.statusDamage);
  const referenceDamagePool = 100 + REFERENCE_PROFILE.damage + REFERENCE_PROFILE.bossDamage;
  const criticalExpectation = 1 + clamp(profile.criticalRate, 0, 100) / 100 * (0.35 + profile.criticalDamage / 100);
  const referenceCriticalExpectation = 1 + (0.35 + REFERENCE_PROFILE.criticalDamage / 100);
  const defenseRatio = bishopDefenseConstant(profile.ignoreDefense, guard)
    / bishopDefenseConstant(REFERENCE_PROFILE.ignoreDefense, guard);
  const hexaLevels = [
    calculation.hexa.skillAverage,
    calculation.hexa.masteryAverage,
    calculation.hexa.enhancementAverage,
    calculation.hexa.commonAverage,
  ].filter((level) => level > 0);
  const hexaAverage = hexaLevels.length
    ? hexaLevels.reduce((total, level) => total + level, 0) / hexaLevels.length
    : 20;
  const hexaBalance = clamp((hexaAverage - 20) / 40, -0.5, 0.5);
  const profileShift = Math.log(clamp(damagePool / referenceDamagePool, 0.7, 1.4)) * 0.012
    + Math.log(clamp(criticalExpectation / referenceCriticalExpectation, 0.8, 1.2)) * 0.018
    + Math.log(clamp(defenseRatio, 0.8, 1.2)) * (guard === 380 ? 0.012 : 0.009)
    + hexaBalance * 0.004;
  return clamp(1 + profileShift, 0.985, 1.015);
}

function curveValue(spline: Spline, value: number, profile: CharacterProfile, guard: 300 | 380) {
  const raw = splineValue(spline, value);
  if (raw <= 0 || value <= 0) return raw;
  const exponent = profileCurveExponent(profile, guard);
  return raw * Math.pow(value / REFERENCE_HEXA, exponent - 1);
}

function inverseCurve(spline: Spline, target: number, profile: CharacterProfile, guard: 300 | 380) {
  let low = 0;
  let high = 250_000;
  for (let iteration = 0; iteration < 40; iteration += 1) {
    const middle = (low + high) / 2;
    if (curveValue(spline, middle, profile, guard) < target) low = middle;
    else high = middle;
  }
  return Math.round((low + high) / 2);
}

function bishopKalingMultiplier(profile: CharacterProfile) {
  const calculation = profile.calculationProfile;
  if (!calculation) return BISHOP_KALING_DAMAGE_RATIO;
  const { hexa } = calculation;
  const burst = 0.65 * hexa.skillAverage + 0.35 * hexa.originLevel;
  const sustained = 0.45 * hexa.masteryAverage + 0.35 * hexa.enhancementAverage + 0.2 * hexa.commonAverage;
  const measuredLevels = [burst, sustained].filter((level) => level > 0);
  if (!measuredLevels.length) return BISHOP_KALING_DAMAGE_RATIO;
  const scale = Math.max(10, measuredLevels.reduce((total, level) => total + level, 0) / measuredLevels.length);
  const coreBalance = clamp((sustained - burst) / scale, -1, 1);
  const cooldownBonus = clamp(
    calculation.cooldownReductionSeconds / 12 + calculation.cooldownReductionPercent / 30,
    0,
    1,
  );
  return clamp(BISHOP_KALING_DAMAGE_RATIO * (1 + coreBalance * 0.008 + cooldownBonus * 0.002), 0.96, 0.99);
}

const bossRegions: Partial<Record<string, AuthenticRegion>> = {
  '선택받은 세렌': 'seren',
  '감시자 칼로스': 'kalos',
  '대적자': 'adversary',
  '카링': 'kaling',
  '흉성': 'malefic',
  '벨로나': 'malefic',
  '림보': 'limbo',
  '발드릭스': 'bardrix',
  '유피테르': 'jupiter',
};

function authenticSymbolMultiplier(profile: CharacterProfile, boss: BossDefinition, summary: EngineSummary) {
  const symbolLevels = profile.calculationProfile?.symbolLevels;
  const region = bossRegions[boss.name];
  if (!symbolLevels || !region) return 1;
  const levels = Object.values(symbolLevels);
  if (!levels.some((level) => level === 11) || symbolLevels[region] === 11) return 1;
  return summary.calculatedHexaDamage300
    / summary.breakdown.defenseConstant300
    * summary.breakdown.defenseConstant380
    / Math.max(summary.calculatedHexaDamage380, Number.EPSILON);
}

export function composeIgnoreDefense(lines: number[]) {
  return 1 - lines.reduce((remaining, line) => remaining * (1 - Math.min(100, Math.max(0, line)) / 100), 1);
}

function bishopDefenseConstant(ignoreDefense: number, guard: 300 | 380) {
  const effectiveIgnore = 1 - (1 - ignoreDefense / 100) * (1 - BISHOP_ADDITIONAL_IGNORE_DEFENSE);
  return Math.max(0.01, 1 - (guard / 100) * (1 - effectiveIgnore));
}

function statusFor(ratePercent: number, boss: BossDefinition): BossStatus {
  const rate = ratePercent / 100;
  if (boss.partyBoss) {
    if (boss.partyLimit === 3) {
      if (rate >= 2.7) return { key: 'solo-min', label: '솔플 최소컷' };
      if (rate >= 1.35) return { key: 'party', label: '2인 가능' };
      if (rate >= 0.9) return { key: 'party-min', label: '3인 최소컷' };
      return { key: 'impossible', label: '불가능' };
    }
    if (rate >= 5.1) return { key: 'solo-min', label: '솔플 최소컷' };
    if (rate >= 2.55) return { key: 'party', label: '2인 가능' };
    if (rate >= 1.7) return { key: 'party', label: '3인 가능' };
    if (rate >= 1.275) return { key: 'party', label: '4인 가능' };
    if (rate >= 0.9) return { key: 'party-min', label: '파티 최소컷' };
    return { key: 'impossible', label: '불가능' };
  }
  if (rate >= 2) return { key: 'solo-easy', label: '솔플 여유컷' };
  if (rate >= 1.1) return { key: 'solo', label: '솔플 가능' };
  if (rate >= 0.9) return { key: 'solo-min', label: '솔플 최소컷' };
  if (boss.partyLimit === 6 && rate >= 0.25) return { key: 'party', label: '파티격 가능' };
  if (boss.partyLimit === 6 && rate >= 0.15) return { key: 'party-min', label: '파티 최소컷' };
  if (boss.partyLimit === 3 && rate >= 0.36) return { key: 'party', label: '파티격 가능' };
  if (boss.partyLimit === 3 && rate >= 0.3) return { key: 'party-min', label: '파티 최소컷' };
  if (boss.partyLimit === 2 && rate >= 0.55) return { key: 'party', label: '파티격 가능' };
  if (boss.partyLimit === 2 && rate >= 0.45) return { key: 'party-min', label: '파티 최소컷' };
  return { key: 'impossible', label: '불가능' };
}

export function calculateEngineSummary(hexaStat: number, profile: CharacterProfile): EngineSummary {
  const safeHexa = Math.max(0, Math.min(250_000, hexaStat));
  const condition = profile.bestCondition;
  const baseIgnoreDefense = condition?.baseIgnoreDefense ?? profile.ignoreDefense;
  const offenseMultiplier = condition?.multiplier ?? 1;
  const defenseMultiplier300 = condition?.defenseMultiplier300 ?? 1;
  const defenseMultiplier380 = condition?.defenseMultiplier380 ?? 1;
  const rawCurveDamage300 = curveValue(spline300, safeHexa, profile, 300);
  const rawCurveDamage380 = curveValue(spline380, safeHexa, profile, 380);
  const calculatedHexaDamage300 = rawCurveDamage300
    * BISHOP_HEXA_CORRECTION_300
    * offenseMultiplier
    * defenseMultiplier300;
  const calculatedHexaDamage380 = rawCurveDamage380
    * BISHOP_HEXA_CORRECTION_380
    * offenseMultiplier
    * defenseMultiplier380;
  const kalingMultiplier = bishopKalingMultiplier(profile);
  const symbolLevels = Object.values(profile.calculationProfile?.symbolLevels ?? {});
  return {
    calculatedHexaDamage300,
    calculatedHexaDamage380,
    calculatedHexaDamageKaling: calculatedHexaDamage380 * kalingMultiplier,
    boss300HexaStat: inverseCurve(spline300, calculatedHexaDamage300, profile, 300),
    boss380HexaStat: inverseCurve(spline380, calculatedHexaDamage380, profile, 380),
    breakdown: {
      version: ENGINE_VERSION,
      rawCurveDamage300,
      rawCurveDamage380,
      hexaCorrection300: BISHOP_HEXA_CORRECTION_300,
      hexaCorrection380: BISHOP_HEXA_CORRECTION_380,
      presetOffenseMultiplier: offenseMultiplier,
      presetDefenseMultiplier300: defenseMultiplier300,
      presetDefenseMultiplier380: defenseMultiplier380,
      defenseConstant300: bishopDefenseConstant(baseIgnoreDefense, 300),
      defenseConstant380: bishopDefenseConstant(baseIgnoreDefense, 380),
      kalingMultiplier,
      weaponConstant: BISHOP_CLASS_MODEL.weaponConstant,
      proficiency: BISHOP_CLASS_MODEL.proficiency,
      classFinalDamage: BISHOP_CLASS_MODEL.finalDamage,
      ignoreElementalResistance: BISHOP_CLASS_MODEL.ignoreElementalResistance,
      curveExponent300: profileCurveExponent(profile, 300),
      curveExponent380: profileCurveExponent(profile, 380),
      maxAuthenticSymbols: symbolLevels.filter((level) => level === 11).length,
    },
  };
}

export function calculateBosses(hexaStat: number, profile: CharacterProfile): BossResult[] {
  const profileReference = calculateEngineSummary(REFERENCE_HEXA, { ...profile, bestCondition: undefined });
  const input = calculateEngineSummary(hexaStat, profile);
  return bosses.map((boss) => {
    const guardSpline = boss.guard === 300 ? spline300 : spline380;
    const inputDamage = boss.name === '카링'
      ? input.calculatedHexaDamageKaling
      : boss.guard === 300
        ? input.calculatedHexaDamage300
        : input.calculatedHexaDamage380;
    const referenceDamage = boss.guard === 300
      ? profileReference.calculatedHexaDamage300
      : boss.name === '카링' && profile.source === 'reference'
        ? profileReference.calculatedHexaDamageKaling
        : profileReference.calculatedHexaDamage380;
    const context = combatContext(profile, boss);
    const referenceContext = combatContext(REFERENCE_PROFILE, boss);
    const forceNormalizer = boss.authenticForce
      ? 1.25
      : boss.arcaneForce
        ? boss.name === '검은 마법사' ? 1.1 : 1.5
        : 1;
    const referenceAdjustedDamage = referenceDamage * referenceContext.total / (1.2 * forceNormalizer);
    const specEfficiency = curveValue(guardSpline, bishopReferenceStat(boss, profile), profile, boss.guard)
      / referenceAdjustedDamage;
    const symbolMultiplier = authenticSymbolMultiplier(profile, boss, input);
    const adjustedDamage = inputDamage * context.total / (1.2 * forceNormalizer)
      * specEfficiency
      * symbolMultiplier;
    const cutoff = boss.partyBossCut ?? boss.bossCut ?? 1;
    const cutoffDamage = curveValue(guardSpline, cutoff, profile, boss.guard);
    const baseClearRate = adjustedDamage / cutoffDamage * boss.easyRate;
    const ascentDivisor = Math.min(3, Math.ceil(20 / Math.max(baseClearRate, Number.EPSILON) / 5.667));
    const ascentCorrection = 3 * BISHOP_ASCENT_CONSTANT / ascentDivisor - BISHOP_ASCENT_CONSTANT;
    const rate = baseClearRate * (1 + ascentCorrection) * 100;
    const cardStat = inverseCurve(guardSpline, adjustedDamage, profile, boss.guard);
    return {
      ...boss,
      rate,
      cardStat,
      status: statusFor(rate, boss),
      levelMultiplier: context.level,
      forceMultiplier: context.force,
      symbolMultiplier,
    };
  });
}

export function formatRate(rate: number) {
  return rate >= 100 ? `${rate.toFixed(1)}%` : `${rate.toFixed(2)}%`;
}
