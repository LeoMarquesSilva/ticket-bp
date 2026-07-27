-- Guarda o nome original do arquivo no metadata do Storage a partir dos anexos do chat
UPDATE storage.objects o
SET user_metadata = COALESCE(o.user_metadata, '{}'::jsonb) || jsonb_build_object(
  'originalName', a.original_name
)
FROM (
  SELECT DISTINCT
    regexp_replace(att->>'url', '^.*\/storage\/v1\/object\/public\/attachments\/', '') AS object_name,
    att->>'name' AS original_name
  FROM app_c009c0e4f1_chat_messages m
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(m.attachments) = 'array' THEN m.attachments
      ELSE '[]'::jsonb
    END
  ) AS att
  WHERE att->>'url' IS NOT NULL
    AND att->>'name' IS NOT NULL
    AND att->>'url' LIKE '%/storage/v1/object/public/attachments/%'
) a
WHERE o.bucket_id = 'attachments'
  AND o.name = a.object_name
  AND COALESCE(o.user_metadata->>'originalName', '') IS DISTINCT FROM a.original_name;
