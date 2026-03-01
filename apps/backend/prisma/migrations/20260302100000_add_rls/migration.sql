-- ============================================================================
-- US-011: Row-Level Security (RLS) — Multitenancy e Isolamento de Dados
-- ============================================================================
-- Adiciona RLS no PostgreSQL como defesa em profundidade.
-- Mesmo que a camada de aplicação falhe no filtro por organizationId,
-- o banco impede acesso cross-tenant.
-- ============================================================================

-- ─── Funções Helper ─────────────────────────────────────────────────────────

-- Retorna o organizationId setado pela aplicação via SET LOCAL
CREATE OR REPLACE FUNCTION current_org_id() RETURNS TEXT AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_org_id', true), '');
EXCEPTION
  WHEN OTHERS THEN RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Retorna true se a aplicação setou bypass (auth, admin, audit, seed)
CREATE OR REPLACE FUNCTION is_rls_bypassed() RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(current_setting('app.bypass_rls', true), 'false') = 'true';
EXCEPTION
  WHEN OTHERS THEN RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE;

-- ─── Enable + Force RLS em todas as tabelas multi-tenant ────────────────────

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

ALTER TABLE farms ENABLE ROW LEVEL SECURITY;
ALTER TABLE farms FORCE ROW LEVEL SECURITY;

ALTER TABLE user_farm_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_farm_access FORCE ROW LEVEL SECURITY;

ALTER TABLE custom_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_roles FORCE ROW LEVEL SECURITY;

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions FORCE ROW LEVEL SECURITY;

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

-- ─── Policies ───────────────────────────────────────────────────────────────

-- organizations: id = current_org_id OR bypass
CREATE POLICY tenant_isolation_policy ON organizations
  USING (
    is_rls_bypassed()
    OR id = current_org_id()
  );

-- users: organizationId = current_org_id OR bypass
CREATE POLICY tenant_isolation_policy ON users
  USING (
    is_rls_bypassed()
    OR "organizationId" = current_org_id()
  );

-- farms: organizationId = current_org_id OR bypass
CREATE POLICY tenant_isolation_policy ON farms
  USING (
    is_rls_bypassed()
    OR "organizationId" = current_org_id()
  );

-- user_farm_access: userId pertence à org corrente OR bypass
CREATE POLICY tenant_isolation_policy ON user_farm_access
  USING (
    is_rls_bypassed()
    OR "userId" IN (
      SELECT id FROM users WHERE "organizationId" = current_org_id()
    )
  );

-- custom_roles: organizationId = current_org_id OR bypass
CREATE POLICY tenant_isolation_policy ON custom_roles
  USING (
    is_rls_bypassed()
    OR "organizationId" = current_org_id()
  );

-- role_permissions: customRoleId pertence à org corrente OR bypass
CREATE POLICY tenant_isolation_policy ON role_permissions
  USING (
    is_rls_bypassed()
    OR "customRoleId" IN (
      SELECT id FROM custom_roles WHERE "organizationId" = current_org_id()
    )
  );

-- audit_logs: organizationId = current_org_id OR bypass
CREATE POLICY tenant_isolation_policy ON audit_logs
  USING (
    is_rls_bypassed()
    OR "organizationId" = current_org_id()
  );
