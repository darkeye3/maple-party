export type CombatRole = 'main_dealer' | 'secondary_dealer';

export type RewardPreset = 'equal_all' | 'main_loot_equal_crystal' | 'main_loot_adjusted_crystal';

export type PartyMember = {
  id: string;
  nickname: string;
  characterClass: string;
  characterLevel: number;
  characterImage?: string;
  hexaStat: number;
  verifiedRate: number;
  role: 'leader' | 'member';
  combatRole?: CombatRole;
  isCurrentUser?: boolean;
  termsVersionAgreed?: number;
  termsAgreedAt?: string;
  joinedAt: string;
};

export type PartyPost = {
  id: string;
  shareCode: string;
  bossId: string;
  bossName: string;
  difficulty: string;
  capacity: number;
  minimumRate: number;
  departureAt: string;
  leaderNickname: string;
  leaderHexa: number;
  leaderRate: number;
  formatVersion: 'legacy' | 'role_contract_v2';
  requiredPartyRate?: number;
  mainCapacity?: number;
  mainMinimumRate?: number;
  secondaryCapacity?: number;
  secondaryMinimumRate?: number;
  rewardPreset?: RewardPreset;
  secondaryCrystalShare?: number;
  termsVersion: number;
  termsLockedAt?: string;
  status: 'open' | 'full' | 'cancelled';
  createdAt: string;
  totalRate: number;
  members: PartyMember[];
};

export type PartyActionResponse = {
  party?: PartyPost;
  parties?: PartyPost[];
  error?: string;
};
