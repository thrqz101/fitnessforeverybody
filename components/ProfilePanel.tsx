"use client";

import { Onboarding } from "@/components/Onboarding";
import type { DayState, UserProfile } from "@/lib/types";

type ProfilePanelProps = {
  profile: UserProfile;
  day: DayState;
  onSave: (profile: UserProfile, day: DayState) => void;
};

export function ProfilePanel({ profile, day, onSave }: ProfilePanelProps) {
  return <Onboarding initialProfile={profile} initialDay={day} onComplete={onSave} submitLabel="保存系统设置" />;
}
