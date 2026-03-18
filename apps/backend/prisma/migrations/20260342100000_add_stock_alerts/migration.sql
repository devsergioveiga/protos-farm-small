-- US-092 CA1/CA2: Alertas de estoque e validade
-- Adiciona campos de ponto de reposição, estoque de segurança e alerta de validade ao produto

ALTER TABLE "products"
  ADD COLUMN "reorder_point" DECIMAL(14,4),
  ADD COLUMN "safety_stock" DECIMAL(14,4),
  ADD COLUMN "expiry_alert_days" INTEGER;
