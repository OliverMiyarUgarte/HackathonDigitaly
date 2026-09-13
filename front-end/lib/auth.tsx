"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  ApiError,
  clearTokens,
  get as apiGet,
  getAccessToken,
  getRefreshToken,
  onSessionExpired,
  post,
  refreshAccessToken,
  setTokens,
} from "./api";
import {
  authResponseSchema,
  userDtoSchema,
  type AuthResponseDto,
  type LoginRequestDto,
  type RegisterRequestDto,
  type UserDto,
  type UserRole,
} from "./contracts";

export type SessionStatus = "loading" | "authenticated" | "unauthenticated";

export interface SessionContextValue {
  user: UserDto | null;
  status: SessionStatus;
  isDoctor: boolean;
  isPatient: boolean;
  homePath: string;
  login: (input: LoginRequestDto) => Promise<UserDto>;
  register: (input: RegisterRequestDto) => Promise<UserDto>;
  logout: () => Promise<void>;
  refresh: () => Promise<boolean>;
  me: () => Promise<UserDto | null>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

const CACHED_USER_KEY = "digitaly.user";

function readCachedUser(): UserDto | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(CACHED_USER_KEY);
    if (!raw) {
      return null;
    }
    const parsed = userDtoSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function writeCachedUser(user: UserDto | null): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (user) {
      window.localStorage.setItem(CACHED_USER_KEY, JSON.stringify(user));
    } else {
      window.localStorage.removeItem(CACHED_USER_KEY);
    }
  } catch {
    return;
  }
}

function homePathFor(user: UserDto | null): string {
  return user?.role === "doctor" ? "/medico" : "/paciente";
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null);
  const [status, setStatus] = useState<SessionStatus>("loading");

  const clearSession = useCallback((): void => {
    clearTokens();
    writeCachedUser(null);
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  const loadProfile = useCallback(async (): Promise<UserDto> => {
    const profile = await apiGet("/auth/me", userDtoSchema);
    writeCachedUser(profile);
    setUser(profile);
    setStatus("authenticated");
    return profile;
  }, []);

  useEffect(() => {
    return onSessionExpired(() => {
      clearSession();
    });
  }, [clearSession]);

  useEffect(() => {
    let active = true;

    const applyProfile = (profile: UserDto): void => {
      if (!active) {
        return;
      }
      writeCachedUser(profile);
      setUser(profile);
      setStatus("authenticated");
    };

    const bootstrap = async (): Promise<void> => {
      const accessToken = getAccessToken();
      const refreshToken = getRefreshToken();
      if (!accessToken && !refreshToken) {
        if (active) {
          setUser(null);
          setStatus("unauthenticated");
        }
        return;
      }

      const cached = readCachedUser();
      if (cached) {
        applyProfile(cached);
      }

      if (!accessToken && refreshToken) {
        const refreshed = await refreshAccessToken();
        if (!active) {
          return;
        }
        if (!refreshed) {
          if (!getRefreshToken()) {
            clearSession();
            return;
          }
          if (!cached) {
            setUser(null);
            setStatus("unauthenticated");
          }
          return;
        }
      }

      try {
        const profile = await apiGet("/auth/me", userDtoSchema);
        applyProfile(profile);
      } catch (error) {
        if (!active) {
          return;
        }
        if (error instanceof ApiError && error.status === 401) {
          clearSession();
          return;
        }
        if (cached) {
          return;
        }
        setUser(null);
        setStatus("unauthenticated");
      }
    };

    void bootstrap();

    return () => {
      active = false;
    };
  }, [clearSession]);

  const applySession = useCallback((response: AuthResponseDto): UserDto => {
    setTokens(response.tokens);
    writeCachedUser(response.user);
    setUser(response.user);
    setStatus("authenticated");
    return response.user;
  }, []);

  const login = useCallback(
    async (input: LoginRequestDto): Promise<UserDto> => {
      const response = await post("/auth/login", input, authResponseSchema);
      return applySession(response);
    },
    [applySession],
  );

  const register = useCallback(
    async (input: RegisterRequestDto): Promise<UserDto> => {
      const response = await post("/auth/register", input, authResponseSchema);
      return applySession(response);
    },
    [applySession],
  );

  const logout = useCallback(async (): Promise<void> => {
    const refreshToken = getRefreshToken();
    try {
      await post(
        "/auth/logout",
        refreshToken ? { refreshToken } : {},
        undefined,
        { auth: false },
      );
    } catch {
      clearSession();
      return;
    }
    clearSession();
  }, [clearSession]);

  const refresh = useCallback(async (): Promise<boolean> => {
    return refreshAccessToken();
  }, []);

  const me = useCallback(async (): Promise<UserDto | null> => {
    try {
      return await loadProfile();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        clearSession();
      }
      return null;
    }
  }, [loadProfile, clearSession]);

  const value = useMemo<SessionContextValue>(
    () => ({
      user,
      status,
      isDoctor: user?.role === "doctor",
      isPatient: user?.role === "patient",
      homePath: homePathFor(user),
      login,
      register,
      logout,
      refresh,
      me,
    }),
    [user, status, login, register, logout, refresh, me],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession deve ser usado dentro de SessionProvider");
  }
  return context;
}

export function SessionLoading({ label = "Carregando sessão" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-screen items-center justify-center gap-3 bg-bg text-texto-2"
    >
      <Loader2 aria-hidden="true" className="size-5 animate-spin text-celeste-500" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function RequireRole({
  roles,
  children,
}: {
  roles: readonly UserRole[];
  children: ReactNode;
}) {
  const { user, status, homePath } = useSession();
  const router = useRouter();
  const allowed = user ? roles.includes(user.role) : false;

  useEffect(() => {
    if (status === "loading") {
      return;
    }
    if (!user) {
      router.replace("/entrar");
      return;
    }
    if (!allowed) {
      router.replace(homePath);
    }
  }, [status, user, allowed, homePath, router]);

  if (status === "loading" || !user || !allowed) {
    return <SessionLoading />;
  }

  return <>{children}</>;
}
