export type PartyMember = {
  id: string;
  nickname: string;
  characterClass: string;
  characterLevel: number;
  characterImage?: string;
  hexaStat: number;
  verifiedRate: number;
  role: 'leader' | 'member';
  joinedAt: string;
};

export type PartyPost = {
  id: string;
  bossId: string;
  bossName: string;
  difficulty: string;
  capacity: number;
  minimumRate: number;
  departureAt: string;
  leaderNickname: string;
  leaderHexa: number;
  leaderRate: number;
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
