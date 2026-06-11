-- ============================================================
-- Desabilitar RLS para todas as tabelas do projeto
-- Cole isso no SQL Editor e execute DEPOIS do database.sql
-- ============================================================

ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE groups_cup DISABLE ROW LEVEL SECURITY;
ALTER TABLE teams DISABLE ROW LEVEL SECURITY;
ALTER TABLE group_predictions DISABLE ROW LEVEL SECURITY;
ALTER TABLE knockout_predictions DISABLE ROW LEVEL SECURITY;
