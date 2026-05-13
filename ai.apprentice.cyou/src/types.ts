export type AuthUser = {
  id: string;
  email: string;
  displayName: string | null;
};

export type AppEnv = {
  Variables: {
    user: AuthUser;
  };
};

