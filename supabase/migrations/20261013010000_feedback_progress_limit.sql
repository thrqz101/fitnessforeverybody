-- Feedback milestones keep every completed recognition id; 8 KB only fits ~200 flows.
alter table public.profiles drop constraint if exists profiles_feedback_progress_check;
alter table public.profiles add constraint profiles_feedback_progress_check
  check (octet_length(feedback_progress::text) < 65536);
