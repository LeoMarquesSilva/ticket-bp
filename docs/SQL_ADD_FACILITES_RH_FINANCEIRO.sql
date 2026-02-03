-- =====================================================
-- Frentes de Atuação: Facilites, Recursos Humanos, Financeiro
-- Sistema de Tickets - Bismarchi Pires
-- =====================================================
-- Insere frentes, categorias e subcategorias com SLA padrão de 24h.
-- Idempotente: ON CONFLICT evita duplicatas.
-- Execute no Supabase SQL Editor.
-- =====================================================

-- 1. FRENTES DE ATUAÇÃO (Tags)
INSERT INTO app_c009c0e4f1_tags (key, label, color, icon, description, "order", is_active) VALUES
  ('facilites', 'Facilites', '#10B981', 'building-2', 'Facilites - Suprimentos, Copa, Limpeza, Manutenção, TI, Mobiliário', 10, true),
  ('recursos_humanos', 'Recursos Humanos', '#8B5CF6', 'users', 'Recursos Humanos - Registro, Férias, Formulários, Dúvidas', 11, true),
  ('financeiro', 'Financeiro', '#F59E0B', 'dollar-sign', 'Financeiro - Pagamentos, Adiantamento, Relatórios', 12, true)
ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, color = EXCLUDED.color, description = EXCLUDED.description, "order" = EXCLUDED."order", is_active = EXCLUDED.is_active, updated_at = NOW();

-- 2. FRENTE FACILITES - Categorias e Subcategorias
INSERT INTO app_c009c0e4f1_categories (key, label, sla_hours, tag_id, is_active, "order")
SELECT 'suprimentos', 'Suprimentos', 24, t.id, true, 1
FROM app_c009c0e4f1_tags t WHERE t.key = 'facilites'
ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, sla_hours = 24, tag_id = EXCLUDED.tag_id, updated_at = NOW();

INSERT INTO app_c009c0e4f1_subcategories (category_id, key, label, sla_hours, is_active, "order")
SELECT c.id, s.key, s.label, 24, true, s.ord
FROM app_c009c0e4f1_categories c,
     (VALUES ('caneta', 'Caneta', 1), ('marca_texto', 'Marca-texto', 2), ('papel_a4', 'Papel A4', 3), ('envelopes', 'Envelopes', 4), ('pastas', 'Pastas', 5), ('etiquetas', 'Etiquetas', 6), ('toner', 'Toner', 7)) AS s(key, label, ord)
WHERE c.key = 'suprimentos'
ON CONFLICT (category_id, key) DO UPDATE SET label = EXCLUDED.label, sla_hours = 24, updated_at = NOW();

INSERT INTO app_c009c0e4f1_categories (key, label, sla_hours, tag_id, is_active, "order")
SELECT 'copa', 'Copa', 24, t.id, true, 2
FROM app_c009c0e4f1_tags t WHERE t.key = 'facilites'
ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, sla_hours = 24, tag_id = EXCLUDED.tag_id, updated_at = NOW();

INSERT INTO app_c009c0e4f1_subcategories (category_id, key, label, sla_hours, is_active, "order")
SELECT c.id, s.key, s.label, 24, true, s.ord
FROM app_c009c0e4f1_categories c,
     (VALUES ('reposicao_cafe', 'Reposição Café', 1), ('reposicao_acucar', 'Reposição Açúcar', 2), ('reposicao_adocante', 'Reposição Adoçante', 3), ('reposicao_cha', 'Reposição Chá', 4)) AS s(key, label, ord)
WHERE c.key = 'copa'
ON CONFLICT (category_id, key) DO UPDATE SET label = EXCLUDED.label, sla_hours = 24, updated_at = NOW();

INSERT INTO app_c009c0e4f1_categories (key, label, sla_hours, tag_id, is_active, "order")
SELECT 'limpeza_conservacao', 'Limpeza e Conservação', 24, t.id, true, 3
FROM app_c009c0e4f1_tags t WHERE t.key = 'facilites'
ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, sla_hours = 24, tag_id = EXCLUDED.tag_id, updated_at = NOW();

INSERT INTO app_c009c0e4f1_subcategories (category_id, key, label, sla_hours, is_active, "order")
SELECT c.id, s.key, s.label, 24, true, s.ord
FROM app_c009c0e4f1_categories c,
     (VALUES ('limpeza_extra', 'Limpeza extra', 1), ('reposicao_papel_higienico', 'Reposição de papel higiênico', 2), ('reposicao_papel_toalha', 'Reposição Papel toalha', 3), ('reposicao_sabonete_liquido', 'Reposição Sabonete Líquido', 4), ('coleta_lixo', 'Coleta de lixo', 5)) AS s(key, label, ord)
WHERE c.key = 'limpeza_conservacao'
ON CONFLICT (category_id, key) DO UPDATE SET label = EXCLUDED.label, sla_hours = 24, updated_at = NOW();

INSERT INTO app_c009c0e4f1_categories (key, label, sla_hours, tag_id, is_active, "order")
SELECT 'manutencao', 'Manutenção', 24, t.id, true, 4
FROM app_c009c0e4f1_tags t WHERE t.key = 'facilites'
ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, sla_hours = 24, tag_id = EXCLUDED.tag_id, updated_at = NOW();

INSERT INTO app_c009c0e4f1_subcategories (category_id, key, label, sla_hours, is_active, "order")
SELECT c.id, s.key, s.label, 24, true, s.ord
FROM app_c009c0e4f1_categories c,
     (VALUES ('lampada', 'Lâmpada', 1), ('tomada', 'Tomada', 2), ('interruptor', 'Interruptor', 3), ('vazamento', 'Vazamento', 4), ('entupimento', 'Entupimento', 5), ('porta', 'Porta', 6), ('fechadura', 'Fechadura', 7), ('ar_condicionado', 'Ar-condicionado', 8)) AS s(key, label, ord)
WHERE c.key = 'manutencao'
ON CONFLICT (category_id, key) DO UPDATE SET label = EXCLUDED.label, sla_hours = 24, updated_at = NOW();

INSERT INTO app_c009c0e4f1_categories (key, label, sla_hours, tag_id, is_active, "order")
SELECT 'tecnologia_infraestrutura', 'Tecnologia e Infraestrutura', 24, t.id, true, 5
FROM app_c009c0e4f1_tags t WHERE t.key = 'facilites'
ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, sla_hours = 24, tag_id = EXCLUDED.tag_id, updated_at = NOW();

INSERT INTO app_c009c0e4f1_subcategories (category_id, key, label, sla_hours, is_active, "order")
SELECT c.id, s.key, s.label, 24, true, s.ord
FROM app_c009c0e4f1_categories c,
     (VALUES ('equipamentos_sala_reuniao', 'Equipamentos de sala de reunião', 1), ('kit_teclado_mouse', 'Itens de informática Kit teclado e mouse', 2), ('mouse_pad', 'Itens de informática mouse pad', 3), ('suporte_notebook', 'Itens de informática suporte p/ notebook', 4), ('adaptador_cabo_rede', 'Itens de informática adaptador de cabo de rede', 5), ('pilha', 'Pilha', 6)) AS s(key, label, ord)
WHERE c.key = 'tecnologia_infraestrutura'
ON CONFLICT (category_id, key) DO UPDATE SET label = EXCLUDED.label, sla_hours = 24, updated_at = NOW();

INSERT INTO app_c009c0e4f1_categories (key, label, sla_hours, tag_id, is_active, "order")
SELECT 'mobiliario', 'Mobiliário', 24, t.id, true, 6
FROM app_c009c0e4f1_tags t WHERE t.key = 'facilites'
ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, sla_hours = 24, tag_id = EXCLUDED.tag_id, updated_at = NOW();

INSERT INTO app_c009c0e4f1_subcategories (category_id, key, label, sla_hours, is_active, "order")
SELECT c.id, s.key, s.label, 24, true, s.ord
FROM app_c009c0e4f1_categories c,
     (VALUES ('manutencao_cadeira', 'Manutenção cadeira', 1), ('manutencao_mesa', 'Manutenção mesa', 2), ('manutencao_armario', 'Manutenção armário', 3)) AS s(key, label, ord)
WHERE c.key = 'mobiliario'
ON CONFLICT (category_id, key) DO UPDATE SET label = EXCLUDED.label, sla_hours = 24, updated_at = NOW();

-- 3. FRENTE RECURSOS HUMANOS - Categorias e Subcategorias
INSERT INTO app_c009c0e4f1_categories (key, label, sla_hours, tag_id, is_active, "order")
SELECT 'registro_ocorrencia', 'Registro de Ocorrência', 24, t.id, true, 1
FROM app_c009c0e4f1_tags t WHERE t.key = 'recursos_humanos'
ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, sla_hours = 24, tag_id = EXCLUDED.tag_id, updated_at = NOW();

INSERT INTO app_c009c0e4f1_subcategories (category_id, key, label, sla_hours, is_active, "order")
SELECT c.id, s.key, s.label, 24, true, s.ord
FROM app_c009c0e4f1_categories c,
     (VALUES ('organizacao', 'Organização', 1), ('limpeza', 'Limpeza', 2), ('copa', 'Copa', 3), ('estacionamento', 'Estacionamento', 4), ('outros', 'Outros', 5)) AS s(key, label, ord)
WHERE c.key = 'registro_ocorrencia'
ON CONFLICT (category_id, key) DO UPDATE SET label = EXCLUDED.label, sla_hours = 24, updated_at = NOW();

INSERT INTO app_c009c0e4f1_categories (key, label, sla_hours, tag_id, is_active, "order")
SELECT 'ferias', 'Férias', 24, t.id, true, 2
FROM app_c009c0e4f1_tags t WHERE t.key = 'recursos_humanos'
ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, sla_hours = 24, tag_id = EXCLUDED.tag_id, updated_at = NOW();

INSERT INTO app_c009c0e4f1_subcategories (category_id, key, label, sla_hours, is_active, "order")
SELECT c.id, 'saldo_ferias', 'Saldo de Férias', 24, true, 1
FROM app_c009c0e4f1_categories c WHERE c.key = 'ferias'
ON CONFLICT (category_id, key) DO UPDATE SET label = EXCLUDED.label, sla_hours = 24, updated_at = NOW();

INSERT INTO app_c009c0e4f1_categories (key, label, sla_hours, tag_id, is_active, "order")
SELECT 'formularios_requisicao_movimentacao', 'Formulários de Requisição e Movimentação de Pessoas', 24, t.id, true, 3
FROM app_c009c0e4f1_tags t WHERE t.key = 'recursos_humanos'
ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, sla_hours = 24, tag_id = EXCLUDED.tag_id, updated_at = NOW();

INSERT INTO app_c009c0e4f1_subcategories (category_id, key, label, sla_hours, is_active, "order")
SELECT c.id, s.key, s.label, 24, true, s.ord
FROM app_c009c0e4f1_categories c,
     (VALUES ('requisicao', 'Requisição', 1), ('movimentacao', 'Movimentação', 2), ('termo_auxilio_educacional', 'Termo de Concessão de Auxílio Educacional', 3)) AS s(key, label, ord)
WHERE c.key = 'formularios_requisicao_movimentacao'
ON CONFLICT (category_id, key) DO UPDATE SET label = EXCLUDED.label, sla_hours = 24, updated_at = NOW();

INSERT INTO app_c009c0e4f1_categories (key, label, sla_hours, tag_id, is_active, "order")
SELECT 'duvidas_rh', 'Dúvidas', 24, t.id, true, 4
FROM app_c009c0e4f1_tags t WHERE t.key = 'recursos_humanos'
ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, sla_hours = 24, tag_id = EXCLUDED.tag_id, updated_at = NOW();

INSERT INTO app_c009c0e4f1_subcategories (category_id, key, label, sla_hours, is_active, "order")
SELECT c.id, s.key, s.label, 24, true, s.ord
FROM app_c009c0e4f1_categories c,
     (VALUES ('abertura_conta_corrente', 'Abertura de Conta Corrente', 1), ('remuneracao', 'Remuneração', 2), ('afastamento', 'Afastamento', 3), ('licencas', 'Licenças', 4), ('processo_seletivo', 'Processo Seletivo', 5), ('contratacoes', 'Contratações', 6), ('rescisoes', 'Rescisões', 7)) AS s(key, label, ord)
WHERE c.key = 'duvidas_rh'
ON CONFLICT (category_id, key) DO UPDATE SET label = EXCLUDED.label, sla_hours = 24, updated_at = NOW();

-- 4. FRENTE FINANCEIRO - Categorias e Subcategorias
-- Nota: A tag 'financeiro' pode já existir. O script vincula às categorias.
INSERT INTO app_c009c0e4f1_categories (key, label, sla_hours, tag_id, is_active, "order")
SELECT 'pagamentos', 'Pagamentos', 24, t.id, true, 1
FROM app_c009c0e4f1_tags t WHERE t.key = 'financeiro'
ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, sla_hours = 24, tag_id = (SELECT id FROM app_c009c0e4f1_tags WHERE key = 'financeiro'), updated_at = NOW();

INSERT INTO app_c009c0e4f1_subcategories (category_id, key, label, sla_hours, is_active, "order")
SELECT c.id, s.key, s.label, 24, true, s.ord
FROM app_c009c0e4f1_categories c,
     (VALUES ('guias_clientes', 'Guias Clientes', 1), ('guias_bp', 'Guias BP', 2), ('prestador_servicos', 'Prestador de Serviços', 3), ('compras', 'Compras', 4), ('comprovante_pagamento', 'Comprovante de pagamento', 5)) AS s(key, label, ord)
WHERE c.key = 'pagamentos'
ON CONFLICT (category_id, key) DO UPDATE SET label = EXCLUDED.label, sla_hours = 24, updated_at = NOW();

INSERT INTO app_c009c0e4f1_categories (key, label, sla_hours, tag_id, is_active, "order")
SELECT 'adiantamento', 'Adiantamento', 24, t.id, true, 2
FROM app_c009c0e4f1_tags t WHERE t.key = 'financeiro'
ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, sla_hours = 24, tag_id = (SELECT id FROM app_c009c0e4f1_tags WHERE key = 'financeiro'), updated_at = NOW();

INSERT INTO app_c009c0e4f1_subcategories (category_id, key, label, sla_hours, is_active, "order")
SELECT c.id, s.key, s.label, 24, true, s.ord
FROM app_c009c0e4f1_categories c,
     (VALUES ('adiantamento_correios', 'Correios', 1), ('adiantamento_compras', 'Compras', 2), ('diligencias', 'Diligências', 3)) AS s(key, label, ord)
WHERE c.key = 'adiantamento'
ON CONFLICT (category_id, key) DO UPDATE SET label = EXCLUDED.label, sla_hours = 24, updated_at = NOW();

INSERT INTO app_c009c0e4f1_categories (key, label, sla_hours, tag_id, is_active, "order")
SELECT 'relatorios', 'Relatórios', 24, t.id, true, 3
FROM app_c009c0e4f1_tags t WHERE t.key = 'financeiro'
ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, sla_hours = 24, tag_id = (SELECT id FROM app_c009c0e4f1_tags WHERE key = 'financeiro'), updated_at = NOW();

INSERT INTO app_c009c0e4f1_subcategories (category_id, key, label, sla_hours, is_active, "order")
SELECT c.id, s.key, s.label, 24, true, s.ord
FROM app_c009c0e4f1_categories c,
     (VALUES ('quadro_debitos', 'Quadro de débitos', 1), ('comissoes', 'Comissões', 2), ('contas_pagar', 'Contas a pagar', 3), ('contas_receber', 'Contas a receber', 4), ('kpis', 'KPIs', 5)) AS s(key, label, ord)
WHERE c.key = 'relatorios'
ON CONFLICT (category_id, key) DO UPDATE SET label = EXCLUDED.label, sla_hours = 24, updated_at = NOW();
