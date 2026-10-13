-- One round trip for /api/sync: profile, Beijing today, the recent day rows and the entries the client needs
-- (confirmed entries in the window plus today's drafts). The goal snapshot for a brand-new day is still written
-- by the server afterwards, because targets come from lib/nutrition.ts.
create or replace function public.get_cloud_state(p_user uuid, p_window_days integer default 400, p_entry_limit integer default 5000)
returns jsonb
language plpgsql set search_path = public, pg_temp
as $$
declare prof public.profiles; today date := public.app_today();
begin
  prof := public.ensure_profile(p_user);
  return jsonb_build_object(
    'profile', to_jsonb(prof),
    'today', today,
    'days', coalesce((
      select jsonb_agg(to_jsonb(d) order by d.activity_date desc)
      from public.daily_activity d
      where d.user_id = p_user and d.activity_date >= today - p_window_days), '[]'::jsonb),
    'entries', coalesce((
      select jsonb_agg(to_jsonb(e))
      from (select * from public.food_entries x
            where x.user_id = p_user and x.entry_date >= today - p_window_days
              and (x.status = 'confirmed' or (x.status = 'draft' and x.entry_date = today))
            order by x.created_at desc limit p_entry_limit) e), '[]'::jsonb));
end $$;

revoke execute on function public.get_cloud_state(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.get_cloud_state(uuid, integer, integer) to service_role;
