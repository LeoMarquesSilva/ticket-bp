import { supabase, TABLES } from '@/lib/supabase';

// Interfaces para categorias e subcategorias
export interface Subcategory {
  id: string;
  categoryId: string;
  key: string;
  label: string;
  slaHours: number;
  defaultAssignedTo?: string; // ID do usuário que receberá automaticamente
  defaultAssignedToName?: string;
  isActive: boolean;
  order: number; // Ordem de exibição
  createdAt: string;
  updatedAt: string;
}

export interface Tag {
  id: string;
  key: string; // Chave única (ex: 'juridico', 'ti')
  label: string; // Nome exibido (ex: 'Jurídico', 'T.I')
  color: string; // Cor hexadecimal (ex: '#3B82F6')
  icon?: string; // Ícone opcional (ex: 'briefcase', 'monitor')
  description?: string;
  isActive: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  key: string; // Chave única (ex: 'protocolo')
  label: string; // Nome exibido (ex: 'Protocolo')
  slaHours?: number; // SLA padrão para a categoria (opcional)
  defaultAssignedTo?: string; // ID do usuário que receberá automaticamente
  defaultAssignedToName?: string;
  tagId?: string; // ID da tag (área de negócio)
  tag?: Tag; // Dados da tag (carregado separadamente)
  isActive: boolean;
  order: number; // Ordem de exibição
  subcategories?: Subcategory[]; // Subcategorias (carregadas separadamente)
  createdAt: string;
  updatedAt: string;
}

export interface CreateCategoryData {
  key: string;
  label: string;
  slaHours?: number;
  defaultAssignedTo?: string;
  tagId?: string; // ID da tag
  order?: number;
}

export interface CreateTagData {
  key: string;
  label: string;
  color: string;
  icon?: string;
  description?: string;
  order?: number;
}

export interface CreateSubcategoryData {
  categoryId: string;
  key: string;
  label: string;
  slaHours: number;
  defaultAssignedTo?: string;
  order?: number;
}

export class CategoryService {
  // Verificar se uma chave de categoria já existe
  static async categoryKeyExists(key: string, excludeId?: string): Promise<boolean> {
    try {
      let query = supabase
        .from('app_c009c0e4f1_categories')
        .select('id')
        .eq('key', key)
        .limit(1);

      if (excludeId) {
        query = query.neq('id', excludeId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error checking category key:', error);
        throw error;
      }

      return data && data.length > 0;
    } catch (error) {
      console.error('Error in categoryKeyExists:', error);
      throw error;
    }
  }

  // Verificar se uma chave de subcategoria já existe na mesma categoria
  static async subcategoryKeyExists(categoryId: string, key: string, excludeId?: string): Promise<boolean> {
    try {
      let query = supabase
        .from('app_c009c0e4f1_subcategories')
        .select('id')
        .eq('category_id', categoryId)
        .eq('key', key)
        .limit(1);

      if (excludeId) {
        query = query.neq('id', excludeId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error checking subcategory key:', error);
        throw error;
      }

      return data && data.length > 0;
    } catch (error) {
      console.error('Error in subcategoryKeyExists:', error);
      throw error;
    }
  }

  // Validar formato de chave
  static validateKeyFormat(key: string): { valid: boolean; error?: string } {
    if (!key || key.trim() === '') {
      return { valid: false, error: 'A chave não pode estar vazia.' };
    }

    // Verificar se contém apenas letras minúsculas, números e underscores
    const keyRegex = /^[a-z0-9_]+$/;
    if (!keyRegex.test(key)) {
      return { 
        valid: false, 
        error: 'A chave deve conter apenas letras minúsculas, números e underscores (_). Sem espaços ou caracteres especiais.' 
      };
    }

    // Verificar se não começa ou termina com underscore
    if (key.startsWith('_') || key.endsWith('_')) {
      return { 
        valid: false, 
        error: 'A chave não pode começar ou terminar com underscore (_).' 
      };
    }

    // Verificar se não tem underscores consecutivos
    if (key.includes('__')) {
      return { 
        valid: false, 
        error: 'A chave não pode conter underscores consecutivos (__).' 
      };
    }

    // Verificar tamanho mínimo
    if (key.length < 2) {
      return { 
        valid: false, 
        error: 'A chave deve ter pelo menos 2 caracteres.' 
      };
    }

    // Verificar tamanho máximo
    if (key.length > 50) {
      return { 
        valid: false, 
        error: 'A chave não pode ter mais de 50 caracteres.' 
      };
    }

    return { valid: true };
  }

  // Obter todas as categorias ativas com suas subcategorias
  static async getAllCategories(includeInactive: boolean = false): Promise<Category[]> {
    try {
      let query = supabase
        .from('app_c009c0e4f1_categories')
        .select('*')
        .order('order', { ascending: true });

      if (!includeInactive) {
        query = query.eq('is_active', true);
      }

      const { data: categories, error } = await query;

      if (error) {
        console.error('Error fetching categories:', error);
        throw error;
      }

      if (!categories || categories.length === 0) {
        return [];
      }

      // Buscar subcategorias e tags para cada categoria
      const categoriesWithSubcategories = await Promise.all(
        categories.map(async (cat) => {
          const subcategories = await this.getSubcategoriesByCategory(cat.id, includeInactive);
          let tag: Tag | undefined;
          
          // Carregar tag se existir
          if (cat.tag_id) {
            try {
              const tagData = await this.getTagById(cat.tag_id);
              if (tagData) tag = tagData;
            } catch (error) {
              console.warn('Error loading tag for category:', error);
            }
          }
          
          return {
            ...this.mapCategoryFromDatabase(cat),
            subcategories,
            tag
          };
        })
      );

      return categoriesWithSubcategories;
    } catch (error) {
      console.error('Error in getAllCategories:', error);
      throw error;
    }
  }

  // Obter uma categoria específica
  static async getCategoryById(categoryId: string): Promise<Category | null> {
    try {
      const { data, error } = await supabase
        .from('app_c009c0e4f1_categories')
        .select('*')
        .eq('id', categoryId)
        .single();

      if (error) {
        console.error('Error fetching category:', error);
        throw error;
      }

      if (!data) return null;

      const subcategories = await this.getSubcategoriesByCategory(categoryId, true);
      let tag: Tag | undefined;
      
      // Carregar tag se existir
      if (data.tag_id) {
        try {
          const tagData = await this.getTagById(data.tag_id);
          if (tagData) tag = tagData;
        } catch (error) {
          console.warn('Error loading tag for category:', error);
        }
      }
      
      return {
        ...this.mapCategoryFromDatabase(data),
        subcategories,
        tag
      };
    } catch (error) {
      console.error('Error in getCategoryById:', error);
      throw error;
    }
  }

  // Obter subcategorias de uma categoria
  static async getSubcategoriesByCategory(categoryId: string, includeInactive: boolean = false): Promise<Subcategory[]> {
    try {
      let query = supabase
        .from('app_c009c0e4f1_subcategories')
        .select('*')
        .eq('category_id', categoryId)
        .order('order', { ascending: true });

      if (!includeInactive) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching subcategories:', error);
        throw error;
      }

      return data ? data.map(this.mapSubcategoryFromDatabase) : [];
    } catch (error) {
      console.error('Error in getSubcategoriesByCategory:', error);
      throw error;
    }
  }

  // Criar uma nova categoria
  static async createCategory(data: CreateCategoryData): Promise<Category> {
    try {
      // Validar formato da chave
      const keyValidation = this.validateKeyFormat(data.key);
      if (!keyValidation.valid) {
        throw new Error(keyValidation.error || 'Formato de chave inválido.');
      }

      // Verificar se a chave já existe
      const keyExists = await this.categoryKeyExists(data.key);
      if (keyExists) {
        throw new Error(`A chave "${data.key}" já está em uso por outra categoria. Por favor, escolha uma chave diferente.`);
      }

      // Obter o próximo order se não fornecido
      const { data: lastCategory } = await supabase
        .from('app_c009c0e4f1_categories')
        .select('order')
        .order('order', { ascending: false })
        .limit(1)
        .single();

      const order = data.order ?? ((lastCategory?.order || 0) + 1);

      // Buscar nome do usuário se defaultAssignedTo foi fornecido
      let assignedToName: string | undefined;
      if (data.defaultAssignedTo) {
        const { data: user } = await supabase
          .from('app_c009c0e4f1_users')
          .select('name')
          .eq('id', data.defaultAssignedTo)
          .single();
        assignedToName = user?.name;
      }

      const { data: category, error } = await supabase
        .from('app_c009c0e4f1_categories')
        .insert([{
          key: data.key,
          label: data.label,
          sla_hours: data.slaHours || null,
          default_assigned_to: data.defaultAssignedTo || null,
          default_assigned_to_name: assignedToName || null,
          tag_id: data.tagId || null,
          is_active: true,
          order: order,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) {
        console.error('Error creating category:', error);
        throw error;
      }

      return this.mapCategoryFromDatabase(category);
    } catch (error) {
      console.error('Error in createCategory:', error);
      throw error;
    }
  }

  // Atualizar uma categoria
  static async updateCategory(categoryId: string, data: Partial<CreateCategoryData>): Promise<Category> {
    try {
      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (data.key !== undefined) updateData.key = data.key;
      if (data.label !== undefined) updateData.label = data.label;
      if (data.slaHours !== undefined) updateData.sla_hours = data.slaHours || null;
      if (data.order !== undefined) updateData.order = data.order;
      if (data.tagId !== undefined) updateData.tag_id = data.tagId || null;

      // Buscar nome do usuário se defaultAssignedTo foi alterado
      if (data.defaultAssignedTo !== undefined) {
        if (data.defaultAssignedTo) {
          const { data: user, error: userError } = await supabase
            .from('app_c009c0e4f1_users')
            .select('name')
            .eq('id', data.defaultAssignedTo)
            .single();
          
          if (userError && userError.code !== 'PGRST116') {
            console.warn('Erro ao buscar nome do usuário:', userError);
          }
          
          updateData.default_assigned_to = data.defaultAssignedTo;
          updateData.default_assigned_to_name = user?.name || null;
        } else {
          updateData.default_assigned_to = null;
          updateData.default_assigned_to_name = null;
        }
      }

      // Fazer o update
      const { error: updateError } = await supabase
        .from('app_c009c0e4f1_categories')
        .update(updateData)
        .eq('id', categoryId);

      if (updateError) {
        console.error('Error updating category:', updateError);
        throw updateError;
      }

      // Buscar a categoria atualizada separadamente (evita problemas com RLS)
      const { data: category, error: fetchError } = await supabase
        .from('app_c009c0e4f1_categories')
        .select('*')
        .eq('id', categoryId)
        .single();

      if (fetchError) {
        console.error('Error fetching updated category:', fetchError);
        throw fetchError;
      }

      if (!category) {
        throw new Error('Categoria não encontrada após atualização');
      }

      return this.mapCategoryFromDatabase(category);
    } catch (error) {
      console.error('Error in updateCategory:', error);
      throw error;
    }
  }

  // Ativar/Desativar categoria
  static async toggleCategoryStatus(categoryId: string, isActive: boolean): Promise<Category> {
    try {
      // Fazer o update
      const { error: updateError } = await supabase
        .from('app_c009c0e4f1_categories')
        .update({
          is_active: isActive,
          updated_at: new Date().toISOString()
        })
        .eq('id', categoryId);

      if (updateError) {
        console.error('Error toggling category status:', updateError);
        throw updateError;
      }

      // Buscar a categoria atualizada separadamente (evita problemas com RLS)
      // IMPORTANTE: Não filtrar por is_active, pois pode estar desativada agora
      const { data, error: fetchError } = await supabase
        .from('app_c009c0e4f1_categories')
        .select('*')
        .eq('id', categoryId)
        .maybeSingle(); // Usar maybeSingle para não dar erro se não encontrar

      if (fetchError) {
        console.error('Error fetching toggled category:', fetchError);
        throw fetchError;
      }

      if (!data) {
        throw new Error('Categoria não encontrada após alteração de status');
      }

      return this.mapCategoryFromDatabase(data);
    } catch (error) {
      console.error('Error in toggleCategoryStatus:', error);
      throw error;
    }
  }

  // Excluir uma categoria (soft delete)
  static async deleteCategory(categoryId: string): Promise<boolean> {
    try {
      // Verificar se há tickets usando esta categoria
      const { data: tickets, error: ticketsError } = await supabase
        .from('app_c009c0e4f1_tickets')
        .select('id')
        .eq('category', (await this.getCategoryById(categoryId))?.key)
        .limit(1);

      if (ticketsError) {
        console.error('Error checking tickets:', ticketsError);
        throw ticketsError;
      }

      if (tickets && tickets.length > 0) {
        // Não pode excluir se houver tickets usando
        // Apenas desativar
        await this.toggleCategoryStatus(categoryId, false);
        return true;
      }

      // Excluir subcategorias primeiro
      await supabase
        .from('app_c009c0e4f1_subcategories')
        .delete()
        .eq('category_id', categoryId);

      // Excluir categoria
      const { error } = await supabase
        .from('app_c009c0e4f1_categories')
        .delete()
        .eq('id', categoryId);

      if (error) {
        console.error('Error deleting category:', error);
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error in deleteCategory:', error);
      throw error;
    }
  }

  // Criar uma nova subcategoria
  static async createSubcategory(data: CreateSubcategoryData): Promise<Subcategory> {
    try {
      // Validar formato da chave
      const keyValidation = this.validateKeyFormat(data.key);
      if (!keyValidation.valid) {
        throw new Error(keyValidation.error || 'Formato de chave inválido.');
      }

      // Verificar se a chave já existe na mesma categoria
      const keyExists = await this.subcategoryKeyExists(data.categoryId, data.key);
      if (keyExists) {
        throw new Error(`A chave "${data.key}" já está em uso por outra subcategoria nesta categoria. Por favor, escolha uma chave diferente.`);
      }

      // Obter o próximo order se não fornecido
      const { data: lastSubcategory } = await supabase
        .from('app_c009c0e4f1_subcategories')
        .select('order')
        .eq('category_id', data.categoryId)
        .order('order', { ascending: false })
        .limit(1)
        .single();

      const order = data.order ?? ((lastSubcategory?.order || 0) + 1);

      // Buscar nome do usuário se defaultAssignedTo foi fornecido
      let assignedToName: string | undefined;
      if (data.defaultAssignedTo) {
        const { data: user } = await supabase
          .from('app_c009c0e4f1_users')
          .select('name')
          .eq('id', data.defaultAssignedTo)
          .single();
        assignedToName = user?.name;
      }

      const { data: subcategory, error } = await supabase
        .from('app_c009c0e4f1_subcategories')
        .insert([{
          category_id: data.categoryId,
          key: data.key,
          label: data.label,
          sla_hours: data.slaHours,
          default_assigned_to: data.defaultAssignedTo || null,
          default_assigned_to_name: assignedToName || null,
          is_active: true,
          order: order,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) {
        console.error('Error creating subcategory:', error);
        throw error;
      }

      return this.mapSubcategoryFromDatabase(subcategory);
    } catch (error) {
      console.error('Error in createSubcategory:', error);
      throw error;
    }
  }

  // Atualizar uma subcategoria
  static async updateSubcategory(subcategoryId: string, data: Partial<CreateSubcategoryData>): Promise<Subcategory> {
    try {
      console.log('updateSubcategory chamado com:', { subcategoryId, data });
      
      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (data.key !== undefined) updateData.key = data.key;
      if (data.label !== undefined) updateData.label = data.label;
      if (data.slaHours !== undefined) updateData.sla_hours = data.slaHours;
      if (data.order !== undefined) updateData.order = data.order;
      if (data.categoryId !== undefined) updateData.category_id = data.categoryId;

      // Buscar nome do usuário se defaultAssignedTo foi alterado
      // IMPORTANTE: data.defaultAssignedTo pode ser null (para remover) ou userId (para atribuir)
      if (data.defaultAssignedTo !== undefined) {
        if (data.defaultAssignedTo && data.defaultAssignedTo !== '' && data.defaultAssignedTo !== 'none') {
          // Atribuir a um usuário específico
          console.log('Buscando nome do usuário para atribuição:', data.defaultAssignedTo);
          const { data: user, error: userError } = await supabase
            .from('app_c009c0e4f1_users')
            .select('name')
            .eq('id', data.defaultAssignedTo)
            .single();
          
          if (userError && userError.code !== 'PGRST116') {
            console.warn('Erro ao buscar nome do usuário:', userError);
          }
          
          console.log('Usuário encontrado:', user);
          updateData.default_assigned_to = data.defaultAssignedTo;
          updateData.default_assigned_to_name = user?.name || null;
        } else {
          // Remover atribuição automática - null foi enviado explicitamente
          console.log('Removendo atribuição automática (valor null/vazio/none)');
          updateData.default_assigned_to = null;
          updateData.default_assigned_to_name = null;
        }
      }
      
      console.log('Dados finais para atualizar:', updateData);

      // Fazer o update
      console.log('🔄 Executando UPDATE na subcategoria:', subcategoryId);
      console.log('📝 Dados do update:', JSON.stringify(updateData, null, 2));
      
      // Verificar estado antes
      const { data: checkBefore } = await supabase
        .from('app_c009c0e4f1_subcategories')
        .select('id, default_assigned_to, default_assigned_to_name')
        .eq('id', subcategoryId)
        .single();
      
      console.log('📋 Estado ANTES do update:', checkBefore);
      
      // Fazer o update
      const { error: updateError, data: updateResult } = await supabase
        .from('app_c009c0e4f1_subcategories')
        .update(updateData)
        .eq('id', subcategoryId)
        .select('id'); // Tentar selecionar para verificar se atualizou

      console.log('📊 Resultado do UPDATE:', { 
        updateError, 
        updateResult,
        rowsAffected: updateResult?.length || 0 
      });

      if (updateError) {
        console.error('❌ Error updating subcategory:', updateError);
        console.error('Código do erro:', updateError.code);
        console.error('Detalhes:', updateError.details);
        console.error('Hint:', updateError.hint);
        console.error('Mensagem:', updateError.message);
        throw updateError;
      }

      // Se não retornou resultado mas também não teve erro, pode ser RLS bloqueando silenciosamente
      if (!updateResult || updateResult.length === 0) {
        console.warn('⚠️ UPDATE executado mas nenhuma linha retornada. Pode ser RLS bloqueando.');
        console.warn('⚠️ Verificando se o update realmente aconteceu...');
      }

      // Aguardar um pouco para garantir que o update foi commitado
      console.log('⏳ Aguardando commit do banco...');
      await new Promise(resolve => setTimeout(resolve, 500));

      // Buscar a subcategoria atualizada separadamente (evita problemas com RLS)
      console.log('🔍 Buscando subcategoria atualizada:', subcategoryId);
      
      // IMPORTANTE: Não filtrar por is_active aqui, pois pode estar desativada
      const { data: subcategory, error: fetchError } = await supabase
        .from('app_c009c0e4f1_subcategories')
        .select('*')
        .eq('id', subcategoryId)
        .maybeSingle(); // Usar maybeSingle para não dar erro se não encontrar

      console.log('📥 Resultado do FETCH:', { 
        subcategory, 
        fetchError,
        defaultAssignedTo: subcategory?.default_assigned_to,
        defaultAssignedToName: subcategory?.default_assigned_to_name,
        isActive: subcategory?.is_active
      });

      if (fetchError) {
        console.error('❌ Error fetching updated subcategory:', fetchError);
        throw fetchError;
      }

      if (!subcategory) {
        throw new Error('Subcategoria não encontrada após atualização');
      }

      const mapped = this.mapSubcategoryFromDatabase(subcategory);
      console.log('✅ Subcategoria mapeada retornada:', mapped);
      console.log('✅ defaultAssignedTo final:', mapped.defaultAssignedTo);
      console.log('✅ defaultAssignedToName final:', mapped.defaultAssignedToName);
      return mapped;
    } catch (error) {
      console.error('Error in updateSubcategory:', error);
      throw error;
    }
  }

  // Ativar/Desativar subcategoria
  static async toggleSubcategoryStatus(subcategoryId: string, isActive: boolean): Promise<Subcategory> {
    try {
      // Fazer o update
      const { error: updateError } = await supabase
        .from('app_c009c0e4f1_subcategories')
        .update({
          is_active: isActive,
          updated_at: new Date().toISOString()
        })
        .eq('id', subcategoryId);

      if (updateError) {
        console.error('Error toggling subcategory status:', updateError);
        throw updateError;
      }

      // Buscar a subcategoria atualizada separadamente (evita problemas com RLS)
      const { data, error: fetchError } = await supabase
        .from('app_c009c0e4f1_subcategories')
        .select('*')
        .eq('id', subcategoryId)
        .single();

      if (fetchError) {
        console.error('Error fetching toggled subcategory:', fetchError);
        throw fetchError;
      }

      if (!data) {
        throw new Error('Subcategoria não encontrada após alteração de status');
      }

      return this.mapSubcategoryFromDatabase(data);
    } catch (error) {
      console.error('Error in toggleSubcategoryStatus:', error);
      throw error;
    }
  }

  // Excluir uma subcategoria
  static async deleteSubcategory(subcategoryId: string): Promise<boolean> {
    try {
      // Verificar se há tickets usando esta subcategoria
      const subcategory = await supabase
        .from('app_c009c0e4f1_subcategories')
        .select('key, category_id')
        .eq('id', subcategoryId)
        .single();

      if (subcategory.data) {
        const category = await this.getCategoryById(subcategory.data.category_id);
        const { data: tickets } = await supabase
          .from('app_c009c0e4f1_tickets')
          .select('id')
          .eq('category', category?.key)
          .eq('subcategory', subcategory.data.key)
          .limit(1);

        if (tickets && tickets.length > 0) {
          // Não pode excluir se houver tickets usando
          // Apenas desativar
          await this.toggleSubcategoryStatus(subcategoryId, false);
          return true;
        }
      }

      const { error } = await supabase
        .from('app_c009c0e4f1_subcategories')
        .delete()
        .eq('id', subcategoryId);

      if (error) {
        console.error('Error deleting subcategory:', error);
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error in deleteSubcategory:', error);
      throw error;
    }
  }

  // Mapear categoria do banco para o formato do frontend
  private static mapCategoryFromDatabase(data: any): Category {
    return {
      id: data.id,
      key: data.key,
      label: data.label,
      slaHours: data.sla_hours,
      defaultAssignedTo: data.default_assigned_to,
      defaultAssignedToName: data.default_assigned_to_name,
      tagId: data.tag_id,
      isActive: data.is_active,
      order: data.order,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }
  
  // Mapear tag do banco para o formato do frontend
  private static mapTagFromDatabase(data: any): Tag {
    return {
      id: data.id,
      key: data.key,
      label: data.label,
      color: data.color,
      icon: data.icon,
      description: data.description,
      isActive: data.is_active,
      order: data.order,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  // Mapear subcategoria do banco para o formato do frontend
  private static mapSubcategoryFromDatabase(data: any): Subcategory {
    return {
      id: data.id,
      categoryId: data.category_id,
      key: data.key,
      label: data.label,
      slaHours: data.sla_hours,
      defaultAssignedTo: data.default_assigned_to,
      defaultAssignedToName: data.default_assigned_to_name,
      isActive: data.is_active,
      order: data.order,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  // Obter configuração de categoria no formato antigo (para compatibilidade)
  static async getCategoriesConfig(): Promise<Record<string, { label: string; subcategories: { value: string; label: string; slaHours: number }[] }>> {
    try {
      const categories = await this.getAllCategories(false);
      const config: Record<string, any> = {};

      for (const category of categories) {
        config[category.key] = {
          label: category.label,
          subcategories: (category.subcategories || []).map(sub => ({
            value: sub.key,
            label: sub.label,
            slaHours: sub.slaHours
          }))
        };
      }

      return config;
    } catch (error) {
      console.error('Error getting categories config:', error);
      throw error;
    }
  }

  // Obter usuário padrão para atribuição baseado em categoria/subcategoria
  static async getDefaultAssignedUser(categoryKey: string, subcategoryKey?: string): Promise<string | null> {
    try {
      // Primeiro tenta pela subcategoria
      if (subcategoryKey) {
        const category = await supabase
          .from('app_c009c0e4f1_categories')
          .select('id')
          .eq('key', categoryKey)
          .single();

        if (category.data) {
          const subcategory = await supabase
            .from('app_c009c0e4f1_subcategories')
            .select('default_assigned_to')
            .eq('category_id', category.data.id)
            .eq('key', subcategoryKey)
            .eq('is_active', true)
            .single();

          if (subcategory.data?.default_assigned_to) {
            return subcategory.data.default_assigned_to;
          }
        }
      }

      // Se não encontrou na subcategoria, tenta na categoria
      const category = await supabase
        .from('app_c009c0e4f1_categories')
        .select('default_assigned_to')
        .eq('key', categoryKey)
        .eq('is_active', true)
        .single();

      return category.data?.default_assigned_to || null;
    } catch (error) {
      console.error('Error getting default assigned user:', error);
      return null;
    }
  }

  // ========== MÉTODOS PARA TAGS ==========
  
  // Obter todas as tags
  static async getAllTags(includeInactive: boolean = false): Promise<Tag[]> {
    try {
      let query = supabase
        .from('app_c009c0e4f1_tags')
        .select('*')
        .order('order', { ascending: true });

      if (!includeInactive) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching tags:', error);
        throw error;
      }

      return data ? data.map(this.mapTagFromDatabase) : [];
    } catch (error) {
      console.error('Error in getAllTags:', error);
      throw error;
    }
  }

  // Obter uma tag específica
  static async getTagById(tagId: string): Promise<Tag | null> {
    try {
      const { data, error } = await supabase
        .from('app_c009c0e4f1_tags')
        .select('*')
        .eq('id', tagId)
        .single();

      if (error) {
        console.error('Error fetching tag:', error);
        throw error;
      }

      return data ? this.mapTagFromDatabase(data) : null;
    } catch (error) {
      console.error('Error in getTagById:', error);
      throw error;
    }
  }

  // Criar uma nova tag
  static async createTag(data: CreateTagData): Promise<Tag> {
    try {
      // Obter o próximo order se não fornecido
      const { data: lastTag } = await supabase
        .from('app_c009c0e4f1_tags')
        .select('order')
        .order('order', { ascending: false })
        .limit(1)
        .single();

      const order = data.order ?? ((lastTag?.order || 0) + 1);

      const { data: tag, error } = await supabase
        .from('app_c009c0e4f1_tags')
        .insert([{
          key: data.key,
          label: data.label,
          color: data.color,
          icon: data.icon || null,
          description: data.description || null,
          is_active: true,
          order: order,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) {
        console.error('Error creating tag:', error);
        throw error;
      }

      return this.mapTagFromDatabase(tag);
    } catch (error) {
      console.error('Error in createTag:', error);
      throw error;
    }
  }

  // Atualizar uma tag
  static async updateTag(tagId: string, data: Partial<CreateTagData>): Promise<Tag> {
    try {
      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (data.key !== undefined) updateData.key = data.key;
      if (data.label !== undefined) updateData.label = data.label;
      if (data.color !== undefined) updateData.color = data.color;
      if (data.icon !== undefined) updateData.icon = data.icon || null;
      if (data.description !== undefined) updateData.description = data.description || null;
      if (data.order !== undefined) updateData.order = data.order;

      const { error: updateError } = await supabase
        .from('app_c009c0e4f1_tags')
        .update(updateData)
        .eq('id', tagId);

      if (updateError) {
        console.error('Error updating tag:', updateError);
        throw updateError;
      }

      // Buscar a tag atualizada
      const { data: tag, error: fetchError } = await supabase
        .from('app_c009c0e4f1_tags')
        .select('*')
        .eq('id', tagId)
        .single();

      if (fetchError) {
        console.error('Error fetching updated tag:', fetchError);
        throw fetchError;
      }

      if (!tag) {
        throw new Error('Tag não encontrada após atualização');
      }

      return this.mapTagFromDatabase(tag);
    } catch (error) {
      console.error('Error in updateTag:', error);
      throw error;
    }
  }

  // Excluir uma tag
  static async deleteTag(tagId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('app_c009c0e4f1_tags')
        .delete()
        .eq('id', tagId);

      if (error) {
        console.error('Error deleting tag:', error);
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error in deleteTag:', error);
      throw error;
    }
  }

  // Ativar/Desativar tag
  static async toggleTagStatus(tagId: string, isActive: boolean): Promise<Tag> {
    try {
      const { error: updateError } = await supabase
        .from('app_c009c0e4f1_tags')
        .update({
          is_active: isActive,
          updated_at: new Date().toISOString()
        })
        .eq('id', tagId);

      if (updateError) {
        console.error('Error toggling tag status:', updateError);
        throw updateError;
      }

      // Buscar a tag atualizada
      const { data, error: fetchError } = await supabase
        .from('app_c009c0e4f1_tags')
        .select('*')
        .eq('id', tagId)
        .single();

      if (fetchError) {
        console.error('Error fetching toggled tag:', fetchError);
        throw fetchError;
      }

      if (!data) {
        throw new Error('Tag não encontrada após alteração de status');
      }

      return this.mapTagFromDatabase(data);
    } catch (error) {
      console.error('Error in toggleTagStatus:', error);
      throw error;
    }
  }
}
