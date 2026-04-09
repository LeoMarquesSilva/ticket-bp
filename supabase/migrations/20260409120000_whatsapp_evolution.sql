-- WhatsApp (Evolution API): configuração global e campos por subcategoria
-- Execute no SQL Editor do Supabase ou via CLI: supabase db push

CREATE TABLE IF NOT EXISTS app_c009c0e4f1_integration_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_c009c0e4f1_integration_settings ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.helpdesk_has_manage_categories()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM app_c009c0e4f1_users u
    WHERE u.auth_user_id = auth.uid()
      AND (
        lower(trim(u.role::text)) = 'admin'
        OR EXISTS (
          SELECT 1
          FROM app_c009c0e4f1_roles r
          INNER JOIN app_c009c0e4f1_role_permissions rp
            ON rp.role_id = r.id AND rp.permission_key = 'manage_categories'
          WHERE lower(r.key) = lower(trim(u.role::text))
        )
      )
  );
$$;

DROP POLICY IF EXISTS integration_settings_all ON app_c009c0e4f1_integration_settings;
CREATE POLICY integration_settings_all
ON app_c009c0e4f1_integration_settings
FOR ALL TO authenticated
USING (helpdesk_has_manage_categories())
WITH CHECK (helpdesk_has_manage_categories());

ALTER TABLE app_c009c0e4f1_subcategories
  ADD COLUMN IF NOT EXISTS whatsapp_notify_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_message_template text,
  ADD COLUMN IF NOT EXISTS whatsapp_recipient text;

COMMENT ON COLUMN app_c009c0e4f1_subcategories.whatsapp_notify_enabled IS 'Enviar WhatsApp ao abrir ticket com esta subcategoria';
COMMENT ON COLUMN app_c009c0e4f1_subcategories.whatsapp_message_template IS 'Modelo com placeholders: {id} {title} {description} {category} {subcategory} {categoryLabel} {subcategoryLabel} {createdByName} {priority} {createdAt}';
COMMENT ON COLUMN app_c009c0e4f1_subcategories.whatsapp_recipient IS 'JID ou número: 5511999999999 ou ...@g.us';
