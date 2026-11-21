-- 016: Adds the Manager role. Run and COMMIT this migration separately before 017.
-- PostgreSQL enum values cannot safely be referenced before their transaction commits.
alter type public.app_role add value if not exists 'manager';
