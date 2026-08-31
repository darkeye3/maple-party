export type CombatBonuses = {
  mainFlat: number;
  mainPercent: number;
  allStatPercent: number;
  attackFlat: number;
  attackPercent: number;
  damage: number;
  bossDamage: number;
  criticalRate: number;
  criticalDamage: number;
  statusDamage: number;
  finalDamage: number;
  ignoreDefense: number[];
};

export type PresetSelection = {
  item?: number;
  ability?: number;
  hyperStat?: number;
  linkSkill?: number;
  union?: number;
};

export type BestCondition = {
  applied: boolean;
  selection: PresetSelection;
  multiplier: number;
  defenseMultiplier300: number;
  defenseMultiplier380: number;
  improvementPercent: number;
  sourceCount: number;
  baseIgnoreDefense: number;
};

type Candidate = { id: number; bonuses: CombatBonuses };
type Category = { key: keyof PresetSelection; active: Candidate; candidates: Candidate[] };
type JsonRecord = Record<string, unknown>;

// Marginal Bishop efficiencies recovered from the reference Maplescouter response.
const weights = {
  mainFlat: 0.00008079755,
  mainPercent: 0.00086614105,
  allStatPercent: 0.0009654547,
  attackFlat: 0.00023764259,
  attackPercent: 0.00390653078,
  damage: 0.00099855993,
  criticalDamage: 0.00356696986,
};

function emptyBonuses(): CombatBonuses {
  return {
    mainFlat: 0,
    mainPercent: 0,
    allStatPercent: 0,
    attackFlat: 0,
    attackPercent: 0,
    damage: 0,
    bossDamage: 0,
    criticalRate: 0,
    criticalDamage: 0,
    statusDamage: 0,
    finalDamage: 0,
    ignoreDefense: [],
  };
}

function numeric(value: unknown) {
  if (typeof value !== 'string' && typeof value !== 'number') return 0;
  return Number(String(value).replace(/[^0-9.-]/g, '')) || 0;
}

function mergeBonuses(target: CombatBonuses, source: CombatBonuses) {
  target.mainFlat += source.mainFlat;
  target.mainPercent += source.mainPercent;
  target.allStatPercent += source.allStatPercent;
  target.attackFlat += source.attackFlat;
  target.attackPercent += source.attackPercent;
  target.damage += source.damage;
  target.bossDamage += source.bossDamage;
  target.criticalRate += source.criticalRate;
  target.criticalDamage += source.criticalDamage;
  target.statusDamage += source.statusDamage;
  target.finalDamage += source.finalDamage;
  target.ignoreDefense.push(...source.ignoreDefense);
  return target;
}

function cloneBonuses(source: CombatBonuses) {
  return mergeBonuses(emptyBonuses(), source);
}

function amountAfter(line: string, pattern: RegExp) {
  const match = pattern.exec(line);
  if (!match || match.index == null) return 0;
  const tail = line.slice(match.index + match[0].length);
  return Number(tail.match(/[-+]?\d+(?:\.\d+)?/)?.[0] ?? 0);
}

function parseOptionText(value: unknown, bonuses = emptyBonuses()) {
  if (typeof value !== 'string') return bonuses;
  for (const rawLine of value.split(/[\r\n,]+/)) {
    const line = rawLine.trim();
    if (!line || line.includes('캐릭터 기준')) continue;

    const ignoreDefense = amountAfter(line, /(?:몬스터\s*)?방어율\s*무시/);
    const bossDamage = amountAfter(line, /보스 몬스터(?:\s*공격 시)?\s*데미지/);
    const criticalRate = amountAfter(line, /크리티컬\s*확률/);
    const criticalDamage = amountAfter(line, /크리티컬\s*데미지/);
    const statusDamage = amountAfter(line, /상태 이상[^\d]*데미지/);
    const finalDamage = amountAfter(line, /최종\s*데미지/);
    const attack = amountAfter(line, /공격력과 마력|마력/);
    const allStat = amountAfter(line, /올스탯/);
    const mainStat = amountAfter(line, /(?:INT|지력)/i);
    const damage = amountAfter(line, /데미지/);

    if (ignoreDefense) bonuses.ignoreDefense.push(ignoreDefense);
    else if (bossDamage) bonuses.bossDamage += bossDamage;
    else if (criticalRate) bonuses.criticalRate += criticalRate;
    else if (criticalDamage) bonuses.criticalDamage += criticalDamage;
    else if (statusDamage) bonuses.statusDamage += statusDamage;
    else if (finalDamage) bonuses.finalDamage += finalDamage;
    else if (attack) {
      if (line.includes('%')) bonuses.attackPercent += attack;
      else bonuses.attackFlat += attack;
    } else if (allStat) {
      if (line.includes('%')) bonuses.allStatPercent += allStat;
      else bonuses.mainFlat += allStat;
    } else if (mainStat) {
      if (line.includes('%')) bonuses.mainPercent += mainStat;
      else bonuses.mainFlat += mainStat;
    } else if (damage) bonuses.damage += damage;
  }
  return bonuses;
}

function practicalRingDamage(item: JsonRecord) {
  const name = typeof item.item_name === 'string' ? item.item_name : '';
  const description = typeof item.item_description === 'string' ? item.item_description : '';
  const level = Math.min(5, Math.max(0, numeric(item.special_ring_level) || numeric(description.match(/Lv\.?\s*(\d+)/i)?.[1])));
  if (!level) return 0;
  if (/리스트레인트/.test(name)) return [0, 12, 16, 20, 24, 28][level];
  if (/컨티뉴어스/.test(name)) return [0, 8, 12, 16, 20, 24][level];
  if (/웨폰퍼프/.test(name)) return [0, 8, 12, 16, 20, 24][level];
  if (/리스크테이커/.test(name)) return [0, 7, 11, 15, 19, 23][level];
  if (/링 오브 썸/.test(name)) return [0, 6, 9, 12, 15, 18][level];
  return 0;
}

function parseItemList(value: unknown) {
  const bonuses = emptyBonuses();
  if (!Array.isArray(value)) return bonuses;
  for (const rawItem of value) {
    const item = rawItem as JsonRecord;
    const total = (item.item_total_option ?? {}) as JsonRecord;
    bonuses.mainFlat += numeric(total.int);
    bonuses.allStatPercent += numeric(total.all_stat);
    bonuses.attackFlat += numeric(total.magic_power);
    bonuses.damage += numeric(total.damage);
    bonuses.bossDamage += numeric(total.boss_damage);
    bonuses.finalDamage += practicalRingDamage(item);
    const itemIgnore = numeric(total.ignore_monster_armor);
    if (itemIgnore) bonuses.ignoreDefense.push(itemIgnore);

    const textFields = [
      'potential_option_1', 'potential_option_2', 'potential_option_3',
      'additional_potential_option_1', 'additional_potential_option_2', 'additional_potential_option_3',
      'soul_option',
    ];
    for (const field of textFields) parseOptionText(item[field], bonuses);
  }
  return bonuses;
}

function parseAbility(value: unknown) {
  const bonuses = emptyBonuses();
  const record = (value ?? {}) as JsonRecord;
  const options = Array.isArray(value) ? value : record.ability_info;
  if (!Array.isArray(options)) return bonuses;
  for (const rawOption of options) {
    const option = rawOption as JsonRecord;
    parseOptionText(option.ability_value ?? option.option, bonuses);
  }
  return bonuses;
}

function parseHyper(value: unknown) {
  const bonuses = emptyBonuses();
  if (!Array.isArray(value)) return bonuses;
  for (const rawStat of value) {
    const stat = rawStat as JsonRecord;
    parseOptionText(stat.stat_increase ?? stat.stat_type, bonuses);
  }
  return bonuses;
}

function parseLinks(value: unknown) {
  const bonuses = emptyBonuses();
  if (!Array.isArray(value)) return bonuses;
  for (const rawSkill of value) {
    const skill = rawSkill as JsonRecord;
    parseOptionText(skill.skill_effect ?? skill.skill_description, bonuses);
  }
  return bonuses;
}

function parseUnion(value: unknown) {
  const bonuses = emptyBonuses();
  const record = (value ?? {}) as JsonRecord;
  const values = Array.isArray(value)
    ? value
    : [record.union_raider_stat, record.union_occupied_stat].flatMap((item) => Array.isArray(item) ? item : []);
  for (const option of values) parseOptionText(option, bonuses);
  return bonuses;
}

function presetCandidates(data: JsonRecord, prefix: string, parser: (value: unknown) => CombatBonuses, count: number) {
  const candidates: Candidate[] = [];
  for (let id = 1; id <= count; id += 1) {
    const value = data[`${prefix}_${id}`];
    if (value != null) candidates.push({ id, bonuses: parser(value) });
  }
  return candidates;
}

function score(bonuses: CombatBonuses) {
  return bonuses.mainFlat * weights.mainFlat
    + bonuses.mainPercent * weights.mainPercent
    + bonuses.allStatPercent * weights.allStatPercent
    + bonuses.attackFlat * weights.attackFlat
    + bonuses.attackPercent * weights.attackPercent
    + (bonuses.damage + bonuses.bossDamage + bonuses.statusDamage) * weights.damage
    + bonuses.criticalDamage * weights.criticalDamage
    + Math.log1p(Math.max(-99, bonuses.finalDamage) / 100);
}

function remainingDefense(lines: number[]) {
  return lines.reduce((remaining, value) => remaining * (1 - Math.min(100, Math.max(0, value)) / 100), 1);
}

function adjustedIgnoreDefense(current: number, active: CombatBonuses, candidate: CombatBonuses) {
  const activeRemaining = remainingDefense(active.ignoreDefense);
  const candidateRemaining = remainingDefense(candidate.ignoreDefense);
  if (activeRemaining <= 0) return current;
  const baselineRemaining = (1 - current / 100) / activeRemaining;
  return Math.min(99.99, Math.max(0, 100 * (1 - baselineRemaining * candidateRemaining)));
}

function bishopDefenseConstant(ignoreDefense: number, guard: 300 | 380) {
  const bishopAdditionalIgnore = 0.693727598412758;
  const effectiveIgnore = 1 - (1 - ignoreDefense / 100) * (1 - bishopAdditionalIgnore);
  return Math.max(0.01, 1 - (guard / 100) * (1 - effectiveIgnore));
}

function bonusesDistance(left: CombatBonuses, right: CombatBonuses) {
  const scalarKeys: Array<Exclude<keyof CombatBonuses, 'ignoreDefense'>> = [
    'mainFlat', 'mainPercent', 'allStatPercent', 'attackFlat', 'attackPercent', 'damage',
    'bossDamage', 'criticalRate', 'criticalDamage', 'statusDamage', 'finalDamage',
  ];
  const scalarDistance = scalarKeys.reduce((total, key) => total + Math.abs(left[key] - right[key]), 0);
  return scalarDistance + 100 * Math.abs(remainingDefense(left.ignoreDefense) - remainingDefense(right.ignoreDefense));
}

function buildCategory(
  key: keyof PresetSelection,
  dataValue: unknown,
  prefix: string,
  parser: (value: unknown) => CombatBonuses,
  activeFields: string[],
  fallbackField: string,
  count: number,
) {
  if (!dataValue || typeof dataValue !== 'object') return undefined;
  const data = dataValue as JsonRecord;
  const candidates = presetCandidates(data, prefix, parser, count);
  if (!candidates.length) return undefined;
  const fallback = parser(data[fallbackField]);
  const explicitId = activeFields.map((field) => numeric(data[field])).find(Boolean);
  const active = candidates.find((candidate) => candidate.id === explicitId)
    ?? candidates.reduce((closest, candidate) => bonusesDistance(candidate.bonuses, fallback) < bonusesDistance(closest.bonuses, fallback) ? candidate : closest);
  return { key, active, candidates } satisfies Category;
}

function criticalRateMultiplier(currentRate: number, candidateRate: number, criticalDamage: number) {
  const expected = (rate: number) => 1 + Math.min(100, Math.max(0, rate)) / 100 * (0.35 + criticalDamage / 100);
  return expected(candidateRate) / expected(currentRate);
}

export function optimizePresets(
  current: { ignoreDefense: number; bossDamage: number; criticalRate: number; criticalDamage: number; damage: number },
  sources: { items?: unknown; ability?: unknown; hyper?: unknown; links?: unknown; union?: unknown },
) {
  const categories = [
    buildCategory('item', sources.items, 'item_equipment_preset', parseItemList, ['preset_no'], 'item_equipment', 3),
    buildCategory('ability', sources.ability, 'ability_preset', parseAbility, ['preset_no'], 'ability_info', 3),
    buildCategory('hyperStat', sources.hyper, 'hyper_stat_preset', parseHyper, ['use_preset_no', 'preset_no'], 'hyper_stat', 3),
    buildCategory('linkSkill', sources.links, 'character_link_skill_preset', parseLinks, ['use_preset_no', 'preset_no'], 'character_link_skill', 3),
    buildCategory('union', sources.union, 'union_raider_preset', parseUnion, ['use_preset_no', 'preset_no'], 'union_raider_stat', 10),
  ].filter((category): category is Category => Boolean(category));

  const activeTotal = categories.reduce((total, category) => mergeBonuses(total, category.active.bonuses), emptyBonuses());
  const currentDefense300 = bishopDefenseConstant(current.ignoreDefense, 300);
  const currentDefense380 = bishopDefenseConstant(current.ignoreDefense, 380);
  let bestTotal = cloneBonuses(activeTotal);
  let bestSelection = Object.fromEntries(categories.map((category) => [category.key, category.active.id])) as PresetSelection;
  let bestOffenseMultiplier = 1;
  let bestDefenseMultiplier300 = 1;
  let bestDefenseMultiplier380 = 1;
  let bestTotalMultiplier380 = 1;

  const inspectCombination = (candidateTotal: CombatBonuses, selection: PresetSelection) => {
    const ignoreDefense = adjustedIgnoreDefense(current.ignoreDefense, activeTotal, candidateTotal);
    const candidateCriticalRate = current.criticalRate + candidateTotal.criticalRate - activeTotal.criticalRate;
    const rateMultiplier = criticalRateMultiplier(current.criticalRate, candidateCriticalRate, current.criticalDamage);
    const offenseMultiplier = Math.exp(score(candidateTotal) - score(activeTotal)) * rateMultiplier;
    const defenseMultiplier300 = bishopDefenseConstant(ignoreDefense, 300) / currentDefense300;
    const defenseMultiplier380 = bishopDefenseConstant(ignoreDefense, 380) / currentDefense380;
    const totalMultiplier380 = offenseMultiplier * defenseMultiplier380;
    if (totalMultiplier380 <= bestTotalMultiplier380) return;
    bestTotal = cloneBonuses(candidateTotal);
    bestSelection = { ...selection };
    bestOffenseMultiplier = offenseMultiplier;
    bestDefenseMultiplier300 = defenseMultiplier300;
    bestDefenseMultiplier380 = defenseMultiplier380;
    bestTotalMultiplier380 = totalMultiplier380;
  };

  const enumerate = (index: number, total: CombatBonuses, selection: PresetSelection) => {
    if (index >= categories.length) return inspectCombination(total, selection);
    const category = categories[index];
    for (const candidate of category.candidates) {
      enumerate(index + 1, mergeBonuses(cloneBonuses(total), candidate.bonuses), { ...selection, [category.key]: candidate.id });
    }
  };
  enumerate(0, emptyBonuses(), {});

  const ignoreDefense = adjustedIgnoreDefense(current.ignoreDefense, activeTotal, bestTotal);
  return {
    profile: {
      ignoreDefense,
      bossDamage: Math.max(0, current.bossDamage + bestTotal.bossDamage - activeTotal.bossDamage),
      criticalRate: Math.max(0, current.criticalRate + bestTotal.criticalRate - activeTotal.criticalRate),
      criticalDamage: Math.max(0, current.criticalDamage + bestTotal.criticalDamage - activeTotal.criticalDamage),
      damage: Math.max(0, current.damage + bestTotal.damage + bestTotal.statusDamage - activeTotal.damage - activeTotal.statusDamage),
    },
    bestCondition: {
      applied: categories.length > 0,
      selection: bestSelection,
      multiplier: bestOffenseMultiplier,
      defenseMultiplier300: bestDefenseMultiplier300,
      defenseMultiplier380: bestDefenseMultiplier380,
      improvementPercent: 100 * (bestTotalMultiplier380 - 1),
      sourceCount: categories.length,
      baseIgnoreDefense: current.ignoreDefense,
    } satisfies BestCondition,
  };
}
