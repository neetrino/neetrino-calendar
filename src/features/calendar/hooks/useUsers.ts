"use client";

import { useQuery } from "@tanstack/react-query";
import type { User } from "@prisma/client";
import type { Role } from "../types";

export type UserBasic = Pick<User, "id" | "name" | "email" | "role">;

async function fetchUsers(): Promise<UserBasic[]> {
  const response = await fetch("/api/users");

  if (!response.ok) {
    throw new Error("Failed to fetch users");
  }

  const data = await response.json();
  return data.users;
}

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export type { Role };
