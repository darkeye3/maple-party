export type AuthUser = {
  id: string;
  loginName: string;
  displayName: string;
  createdAt: string;
};

export type AuthResponse = {
  user?: AuthUser | null;
  error?: string;
};
