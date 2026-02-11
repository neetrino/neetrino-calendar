"use client";

import { useQuery } from "@tanstack/react-query";

interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "USER";
}

async function fetchCurrentUser(): Promise<CurrentUser | null> {
  const response = await fetch("/api/auth/me", { cache: "no-store" });

  if (!response.ok) {
    return null;
  }

  const text = await response.text();
  if (!text || text.trim().startsWith("<")) {
    // Server returned HTML (e.g. 500 error page) — don't parse as JSON
    return null;
  }
  try {
    const data = JSON.parse(text) as { user?: CurrentUser | null };
    return data.user ?? null;
  } catch {
    return null;
  }
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ["currentUser"],
    queryFn: fetchCurrentUser,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
