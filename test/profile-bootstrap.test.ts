import { describe, it, expect } from "vitest";
import type { User } from "@supabase/supabase-js";
import { ensureProfile, profileInputFromUser } from "@/lib/auth/profile";
import type { Db } from "@/lib/repositories";
import { createSupabaseFake, type SupabaseFake } from "./supabase-fake";

const asDb = (fake: SupabaseFake) => fake as unknown as Db;

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    aud: "authenticated",
    app_metadata: {},
    user_metadata: {
      full_name: "Ada Lovelace",
      avatar_url: "https://img.example/ada.png",
    },
    email: "ada@example.com",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  } as User;
}

describe("profileInputFromUser", () => {
  it("maps Google metadata to profile fields", () => {
    expect(profileInputFromUser(makeUser())).toEqual({
      id: "user-1",
      display_name: "Ada Lovelace",
      avatar_url: "https://img.example/ada.png",
      email: "ada@example.com",
    });
  });

  it("falls back to `name`/`picture` and tolerates missing metadata", () => {
    const user = makeUser({
      user_metadata: { name: "Grace", picture: "https://img.example/g.png" },
      email: undefined,
    });
    expect(profileInputFromUser(user)).toEqual({
      id: "user-1",
      display_name: "Grace",
      avatar_url: "https://img.example/g.png",
      email: null,
    });
  });
});

describe("ensureProfile", () => {
  it("creates the profile row on first sign-in", async () => {
    const fake = createSupabaseFake();
    const profile = await ensureProfile(asDb(fake), makeUser());

    expect(profile.display_name).toBe("Ada Lovelace");
    expect(fake.tables.profiles).toHaveLength(1);
  });

  it("refreshes name/avatar on a subsequent sign-in without duplicating", async () => {
    const fake = createSupabaseFake({
      profiles: [
        {
          id: "user-1",
          display_name: "Old Name",
          avatar_url: null,
          email: "ada@example.com",
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
    });

    await ensureProfile(
      asDb(fake),
      makeUser({
        user_metadata: {
          full_name: "Ada L.",
          avatar_url: "https://img.example/new.png",
        },
      }),
    );

    expect(fake.tables.profiles).toHaveLength(1);
    expect(fake.tables.profiles[0]).toMatchObject({
      display_name: "Ada L.",
      avatar_url: "https://img.example/new.png",
    });
  });
});
