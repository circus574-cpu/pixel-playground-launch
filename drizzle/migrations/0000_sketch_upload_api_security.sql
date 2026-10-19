CREATE TABLE public.sketch_api_tokens (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 token_hash text NOT NULL UNIQUE,
 directory text NOT NULL DEFAULT 'game-assets',
 created_at timestamptz NOT NULL DEFAULT now(),
 revoked_at timestamptz,
 window_start timestamptz NOT NULL DEFAULT now(),
 request_count integer NOT NULL DEFAULT 0
);
GRANT ALL ON public.sketch_api_tokens TO service_role;
REVOKE ALL ON public.sketch_api_tokens FROM anon, authenticated;
ALTER TABLE public.sketch_api_tokens ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.sketch_api_log (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 token_id uuid REFERENCES public.sketch_api_tokens(id),
 operation text NOT NULL,
 status integer NOT NULL,
 path text,
 size bigint,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.sketch_api_log TO service_role;
REVOKE ALL ON public.sketch_api_log FROM anon, authenticated;
ALTER TABLE public.sketch_api_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX sketch_api_log_created ON public.sketch_api_log(created_at DESC);
CREATE OR REPLACE FUNCTION public.consume_sketch_api_token(p_hash text)
RETURNS TABLE(id uuid, directory text, allowed boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 RETURN QUERY
 UPDATE public.sketch_api_tokens t SET
 request_count = CASE WHEN t.window_start <= now() - interval '1 minute' THEN 1 ELSE t.request_count + 1 END,
 window_start = CASE WHEN t.window_start <= now() - interval '1 minute' THEN now() ELSE t.window_start END
 WHERE t.token_hash = p_hash AND t.revoked_at IS NULL
 RETURNING t.id, t.directory, t.request_count <= 20;
END;
$$;
REVOKE ALL ON FUNCTION public.consume_sketch_api_token(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_sketch_api_token(text) TO service_role;
CREATE OR REPLACE FUNCTION public.rotate_sketch_api_token(p_hash text, p_directory text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(718291);
 UPDATE public.sketch_api_tokens SET revoked_at = now() WHERE revoked_at IS NULL;
 INSERT INTO public.sketch_api_tokens(token_hash, directory) VALUES(p_hash, p_directory) RETURNING id INTO new_id;
 RETURN new_id;
END;
$$;
REVOKE ALL ON FUNCTION public.rotate_sketch_api_token(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rotate_sketch_api_token(text,text) TO service_role;