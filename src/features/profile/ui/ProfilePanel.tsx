"use client";

import { Onboarding } from "@/features/profile/ui/Onboarding";
import type { DayState, UserProfile } from "@/shared/domain/types";

type ProfilePanelProps = {
  profile: UserProfile;
  day: DayState;
  onSave: (profile: UserProfile, day: DayState) => void | Promise<void>;
  onBack?: () => void;
};

export function ProfilePanel({ profile, day, onSave, onBack }: ProfilePanelProps) {
  return <Onboarding initialProfile={profile} initialDay={day} onComplete={onSave} onBack={onBack} submitLabel="保存系统设置" />;
}
