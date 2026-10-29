-- Target project only: Supabase default function ACLs must also revoke explicit client grants.
REVOKE ALL ON FUNCTION public.consume_sketch_api_token(text),public.rotate_sketch_api_token(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.consume_sketch_api_token(text),public.rotate_sketch_api_token(text,text) TO service_role;
