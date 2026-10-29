-- Independent Supabase target only. Source export 2026-10-28; no user data.
-- KI LEGENDS — struktura schematu public odtworzona z katalogu bazy (tylko odczyt).
-- Wygenerowano: 2026-10-28 21:36:00 UTC
-- Wymaga docelowego Postgresa w układzie Supabase (schemat auth, role anon/authenticated/service_role).
-- Uruchamiać jako rola postgres na PUSTEJ bazie. Nie zawiera danych — dane: katalog database/data.
SET search_path TO public, extensions;

CREATE TYPE public.app_role AS ENUM ('admin', 'gm');

CREATE SEQUENCE public.admin_audit_id_seq AS bigint START WITH 1 INCREMENT BY 1;

CREATE TABLE public.admin_audit (
  id bigint DEFAULT nextval('admin_audit_id_seq'::regclass) NOT NULL,
  actor uuid,
  action text NOT NULL,
  target_user uuid,
  target_key text,
  before jsonb,
  after jsonb,
  at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.characters (
  user_id uuid NOT NULL,
  save_key text NOT NULL,
  data jsonb NOT NULL,
  revision integer DEFAULT 1 NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_by uuid
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  nick text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  last_seen timestamp with time zone
);
CREATE TABLE public.sketch_api_log (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  token_id uuid,
  operation text NOT NULL,
  status integer NOT NULL,
  path text,
  size bigint,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.sketch_api_tokens (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  token_hash text NOT NULL,
  directory text DEFAULT 'game-assets'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  revoked_at timestamp with time zone,
  window_start timestamp with time zone DEFAULT now() NOT NULL,
  request_count integer DEFAULT 0 NOT NULL
);
CREATE TABLE public.user_roles (
  user_id uuid NOT NULL,
  role app_role NOT NULL,
  granted_by uuid,
  granted_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER SEQUENCE public.admin_audit_id_seq OWNED BY public.admin_audit.id;

ALTER TABLE public.admin_audit ADD CONSTRAINT admin_audit_pkey PRIMARY KEY (id);
ALTER TABLE public.characters ADD CONSTRAINT characters_pkey PRIMARY KEY (user_id, save_key);
ALTER TABLE public.characters ADD CONSTRAINT characters_save_key_check CHECK (((char_length(save_key) >= 1) AND (char_length(save_key) <= 200)));
ALTER TABLE public.profiles ADD CONSTRAINT profiles_nick_check CHECK (((char_length(nick) >= 3) AND (char_length(nick) <= 20)));
ALTER TABLE public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
ALTER TABLE public.sketch_api_log ADD CONSTRAINT sketch_api_log_pkey PRIMARY KEY (id);
ALTER TABLE public.sketch_api_tokens ADD CONSTRAINT sketch_api_tokens_pkey PRIMARY KEY (id);
ALTER TABLE public.sketch_api_tokens ADD CONSTRAINT sketch_api_tokens_token_hash_key UNIQUE (token_hash);
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role);
ALTER TABLE public.admin_audit ADD CONSTRAINT admin_audit_actor_fkey FOREIGN KEY (actor) REFERENCES auth.users(id);
ALTER TABLE public.characters ADD CONSTRAINT characters_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);
ALTER TABLE public.characters ADD CONSTRAINT characters_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.sketch_api_log ADD CONSTRAINT sketch_api_log_token_id_fkey FOREIGN KEY (token_id) REFERENCES sketch_api_tokens(id);
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES auth.users(id);
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX sketch_api_log_created ON public.sketch_api_log USING btree (created_at DESC);
CREATE UNIQUE INDEX profiles_nick_key ON public.profiles USING btree (lower(nick));

CREATE OR REPLACE FUNCTION public.characters_deleted()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is distinct from old.user_id then
    insert into public.admin_audit (actor, action, target_user, target_key, before)
    values (auth.uid(), 'delete', old.user_id, old.save_key, old.data);
  end if;
  return old;
end $function$;

CREATE OR REPLACE FUNCTION public.characters_touch()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'UPDATE' then
    new.revision := old.revision + 1;
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  if auth.uid() is distinct from new.user_id then
    insert into public.admin_audit (actor, action, target_user, target_key, before, after)
    values (auth.uid(), lower(tg_op), new.user_id, new.save_key,
            case when tg_op = 'UPDATE' then old.data end, new.data);
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.consume_sketch_api_token(p_hash text)
 RETURNS TABLE(id uuid, directory text, allowed boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
 RETURN QUERY
 UPDATE public.sketch_api_tokens t SET
 request_count = CASE WHEN t.window_start <= now() - interval '1 minute' THEN 1 ELSE t.request_count + 1 END,
 window_start = CASE WHEN t.window_start <= now() - interval '1 minute' THEN now() ELSE t.window_start END
 WHERE t.token_hash = p_hash AND t.revoked_at IS NULL
 RETURNING t.id, t.directory, t.request_count <= 20;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare _nick text := coalesce(nullif(trim(new.raw_user_meta_data ->> 'nick'), ''), '');
begin
  if char_length(_nick) not between 3 and 20
     or exists (select 1 from public.profiles where lower(nick) = lower(_nick)) then
    _nick := 'Gracz-' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  insert into public.profiles (id, nick) values (new.id, _nick) on conflict (id) do nothing;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.has_role(_user uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.user_roles where user_id = _user and role = _role)
$function$;

CREATE OR REPLACE FUNCTION public.is_staff(_user uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.user_roles where user_id = _user)
$function$;

CREATE OR REPLACE FUNCTION public.roles_audit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.admin_audit (actor, action, target_user, after)
  values (auth.uid(), 'role-' || lower(tg_op), coalesce(new.user_id, old.user_id),
          to_jsonb(coalesce(new.role, old.role)));
  return coalesce(new, old);
end $function$;

CREATE OR REPLACE FUNCTION public.rotate_sketch_api_token(p_hash text, p_directory text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE new_id uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(718291);
 UPDATE public.sketch_api_tokens SET revoked_at = now() WHERE revoked_at IS NULL;
 INSERT INTO public.sketch_api_tokens(token_hash, directory) VALUES(p_hash, p_directory) RETURNING id INTO new_id;
 RETURN new_id;
END;
$function$;

-- ACL characters_deleted(): {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
REVOKE ALL ON FUNCTION public.characters_deleted() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.characters_deleted() TO postgres;
GRANT EXECUTE ON FUNCTION public.characters_deleted() TO authenticated;
GRANT EXECUTE ON FUNCTION public.characters_deleted() TO service_role;
-- ACL characters_touch(): {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
REVOKE ALL ON FUNCTION public.characters_touch() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.characters_touch() TO postgres;
GRANT EXECUTE ON FUNCTION public.characters_touch() TO authenticated;
GRANT EXECUTE ON FUNCTION public.characters_touch() TO service_role;
-- ACL consume_sketch_api_token(text): {postgres=X/postgres,service_role=X/postgres}
REVOKE ALL ON FUNCTION public.consume_sketch_api_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_sketch_api_token(text) TO postgres;
GRANT EXECUTE ON FUNCTION public.consume_sketch_api_token(text) TO service_role;
-- ACL handle_new_user(): {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
-- ACL has_role(uuid,app_role): {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
REVOKE ALL ON FUNCTION public.has_role(uuid,app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid,app_role) TO postgres;
GRANT EXECUTE ON FUNCTION public.has_role(uuid,app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid,app_role) TO service_role;
-- ACL is_staff(uuid): {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO postgres;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO service_role;
-- ACL roles_audit(): {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
REVOKE ALL ON FUNCTION public.roles_audit() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.roles_audit() TO postgres;
GRANT EXECUTE ON FUNCTION public.roles_audit() TO authenticated;
GRANT EXECUTE ON FUNCTION public.roles_audit() TO service_role;
-- ACL rotate_sketch_api_token(text,text): {postgres=X/postgres,service_role=X/postgres}
REVOKE ALL ON FUNCTION public.rotate_sketch_api_token(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rotate_sketch_api_token(text,text) TO postgres;
GRANT EXECUTE ON FUNCTION public.rotate_sketch_api_token(text,text) TO service_role;

ALTER TABLE public.admin_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sketch_api_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sketch_api_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit read" ON public.admin_audit AS PERMISSIVE FOR SELECT TO authenticated USING (is_staff(auth.uid()));
CREATE POLICY "characters delete" ON public.characters AS PERMISSIVE FOR DELETE TO authenticated USING (((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "characters insert own" ON public.characters AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "characters read" ON public.characters AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR is_staff(auth.uid())));
CREATE POLICY "characters update" ON public.characters AS PERMISSIVE FOR UPDATE TO authenticated USING (((user_id = auth.uid()) OR is_staff(auth.uid()))) WITH CHECK (((user_id = auth.uid()) OR is_staff(auth.uid())));
CREATE POLICY "profiles read" ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated USING (((id = auth.uid()) OR is_staff(auth.uid())));
CREATE POLICY "profiles update own" ON public.profiles AS PERMISSIVE FOR UPDATE TO authenticated USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()));
CREATE POLICY "roles grant" ON public.user_roles AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) AND (granted_by = auth.uid())));
CREATE POLICY "roles read" ON public.user_roles AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR is_staff(auth.uid())));
CREATE POLICY "roles revoke" ON public.user_roles AS PERMISSIVE FOR DELETE TO authenticated USING ((has_role(auth.uid(), 'admin'::app_role) AND (user_id <> auth.uid())));

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.admin_audit TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.characters TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.profiles TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.sketch_api_log TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.sketch_api_tokens TO service_role;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.user_roles TO service_role;
-- (Produkcja ma też PG17 'MAINTAIN' dla tych ról — pominięte dla zgodności z Postgresem 15 w self-hosted Supabase.)
GRANT USAGE, SELECT ON SEQUENCE public.admin_audit_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.admin_audit_id_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE public.admin_audit_id_seq TO service_role;

CREATE TRIGGER characters_deleted AFTER DELETE ON public.characters FOR EACH ROW EXECUTE FUNCTION characters_deleted();
CREATE TRIGGER characters_touch BEFORE INSERT OR UPDATE ON public.characters FOR EACH ROW EXECUTE FUNCTION characters_touch();
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();
CREATE TRIGGER roles_audit AFTER INSERT OR DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION roles_audit();

-- Prywatny bucket plików szkiców (/test). Konfiguracja z produkcji:
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('project-sketches', 'project-sketches', false, 52428800, NULL) ON CONFLICT (id) DO NOTHING;
-- Polityki storage.objects w produkcji: 0 (dostęp wyłącznie przez serwer z kluczem service_role).


-- Least-privilege grants for the independent project; preserve row policies.
REVOKE ALL ON public.admin_audit,public.characters,public.profiles,public.sketch_api_log,public.sketch_api_tokens,public.user_roles FROM anon,authenticated;
GRANT SELECT ON public.admin_audit,public.characters,public.profiles,public.user_roles TO authenticated;
GRANT INSERT,UPDATE,DELETE ON public.characters TO authenticated;
GRANT UPDATE(nick) ON public.profiles TO authenticated;
GRANT INSERT,DELETE ON public.user_roles TO authenticated;
REVOKE ALL ON SEQUENCE public.admin_audit_id_seq FROM anon,authenticated;
REVOKE ALL ON FUNCTION public.characters_deleted(),public.characters_touch(),public.handle_new_user(),public.roles_audit() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid,public.app_role),public.is_staff(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid,public.app_role),public.is_staff(uuid) TO authenticated;
