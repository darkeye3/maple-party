export type RegisteredCharacter = {
  id: string;
  nickname: string;
  hexaStat: number;
  characterClass: string;
  characterLevel: number;
  characterImage?: string | null;
  arcaneForce: number;
  authenticForce: number;
  registeredAt: string;
  updatedAt: string;
};

export type RegisteredCharactersResponse = {
  characters?: RegisteredCharacter[];
  character?: RegisteredCharacter;
  error?: string;
};
