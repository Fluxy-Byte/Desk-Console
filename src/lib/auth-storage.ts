/// sessionStorage (não localStorage) de propósito — sessão não deve sobreviver
/// ao fechar a aba nem vazar pro próximo turno de um posto de trabalho
/// compartilhado (mesma decisão do fluxy-desk deprecado).
const TOKEN_KEY = "desk-console:token";
const USER_KEY = "desk-console:user";
const COMPANY_KEY = "desk-console:companyId";

export interface StoredUser {
  id: string;
  name: string;
  email: string;
}

export const authStorage = {
  getToken(): string | null {
    return sessionStorage.getItem(TOKEN_KEY);
  },
  setToken(token: string): void {
    sessionStorage.setItem(TOKEN_KEY, token);
  },
  getUser(): StoredUser | null {
    const raw = sessionStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as StoredUser) : null;
  },
  setUser(user: StoredUser): void {
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  getCompanyId(): string | null {
    return sessionStorage.getItem(COMPANY_KEY);
  },
  setCompanyId(companyId: string): void {
    sessionStorage.setItem(COMPANY_KEY, companyId);
  },
  clear(): void {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(COMPANY_KEY);
  },
};
