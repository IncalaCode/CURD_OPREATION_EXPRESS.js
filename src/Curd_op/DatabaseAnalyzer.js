class DatabaseAnalyzer {
  constructor() {
    this.dbStructure = new Map();
    this.relationCache = new Map();
  }

  /**
   * Analyze database structure and relationships
   * @param {Object} model - Prisma model
   * @returns {Object} Database structure information
   */
  async analyzeDatabaseStructure(model) {
    const modelName = this.getModelName(model);
    
    if (this.dbStructure.has(modelName)) {
      return this.dbStructure.get(modelName);
    }

    try {
      const modelMeta = this.getModelMetadata(model);
      
      const structure = {
        modelName,
        tableName: modelMeta?.tableName || modelName.toLowerCase(),
        fields: modelMeta?.fields || [],
        relations: modelMeta?.relations || [],
        constraints: modelMeta?.constraints || [],
        indexes: modelMeta?.indexes || [],
        hasRelations: false,
        foreignKeys: [],
        uniqueConstraints: [],
        requiredFields: [],
        optionalFields: [],
        computedFields: [],
        cascadeDelete: [],
        cascadeUpdate: []
      };

      if (modelMeta?.fields) {
        for (const field of modelMeta.fields) {
          if (field.isRequired && !field.isId && !field.hasDefaultValue) {
            structure.requiredFields.push(field.name);
          } else if (!field.isRequired && !field.isId) {
            structure.optionalFields.push(field.name);
          }

          if (field.isUnique) {
            structure.uniqueConstraints.push(field.name);
          }

          if (field.isId) {
            structure.primaryKey = field.name;
          }

          if (field.relationName) {
            structure.hasRelations = true;
            structure.foreignKeys.push({
              field: field.name,
              referencedModel: field.type,
              relationName: field.relationName,
              onDelete: field.onDelete || 'Restrict',
              onUpdate: field.onUpdate || 'Cascade'
            });

            if (field.onDelete === 'Cascade') {
              structure.cascadeDelete.push(field.name);
            }
            if (field.onUpdate === 'Cascade') {
              structure.cascadeUpdate.push(field.name);
            }
          }
        }
      }

      this.dbStructure.set(modelName, structure);
      
      if (this.isDev) {
        console.log(`📊 Database structure analyzed for ${modelName}:`, structure);
      }

      return structure;
    } catch (error) {
      console.error(`Error analyzing database structure for ${modelName}:`, error);
      return null;
    }
  }

  /**
   * Get model metadata from Prisma
   * @param {Object} model - Prisma model
   * @returns {Object} Model metadata
   */
  getModelMetadata(model) {
    try {
      const modelName = this.getModelName(model);
      // Try to get a sample record to infer fields
      let fields = [];
      if (model && typeof model.findFirst === 'function') {
        // Synchronously get fields from a sample record if possible
        // (This is a hack: in practice, this should be async, but for metadata, one call is fine)
        // We'll use a cached sample if available
        if (!this._sampleCache) this._sampleCache = {};
        if (!this._sampleCache[modelName]) {
          // This is a sync function, so we can't await. We'll just leave fields empty if not cached.
        } else {
          fields = Object.keys(this._sampleCache[modelName]);
        }
      }
      return {
        tableName: modelName.toLowerCase(),
        fields,
        relations: [],
        constraints: []
      };
    } catch (error) {
      console.error('Error getting model metadata:', error);
      return null;
    }
  }

  /**
   * Dynamically cache a sample record for field introspection
   * @param {Object} model - Prisma model
   */
  async cacheSampleRecord(model) {
    try {
      const modelName = this.getModelName(model);
      if (!this._sampleCache) this._sampleCache = {};
      if (!this._sampleCache[modelName]) {
        const sample = await model.findFirst();
        if (sample) this._sampleCache[modelName] = sample;
      }
    } catch (e) {}
  }

  /**
   * Get model name from Prisma model
   * @param {Object} model - Prisma model
   * @returns {string} Model name
   */
  getModelName(model) {
    return model.constructor.name || 'Unknown';
  }

  /**
   * Check if operation would violate constraints
   * @param {string} operation - Operation type (create, update, delete)
   * @param {Object} data - Data for the operation
   * @param {Object} model - Prisma model
   * @returns {Object} Constraint check result
   */
  async checkConstraints(operation, data, model) {
    const structure = await this.analyzeDatabaseStructure(model);
    
    if (!structure) {
      return { isValid: true };
    }

    const violations = [];

    if (operation === 'create') {
      for (const field of structure.requiredFields) {
        if (data[field] === undefined || data[field] === null || data[field] === '') {
          violations.push(`Required field '${field}' is missing or empty`);
        }
      }
    }

    for (const uniqueField of structure.uniqueConstraints) {
      if (data[uniqueField] !== undefined) {
        try {
          const existing = await model.findFirst({
            where: { [uniqueField]: data[uniqueField] }
          });
          
          if (existing) {
            violations.push(`Unique constraint violation on field '${uniqueField}'`);
          }
        } catch (error) {
         console.error(error)
        }
      }
    }

    for (const fk of structure.foreignKeys) {
      if (data[fk.field] !== undefined) {
        try {
          const referencedModel = this.getReferencedModel(fk.referencedModel);
          if (referencedModel) {
            const exists = await referencedModel.findUnique({
              where: { id: data[fk.field] }
            });
            
            if (!exists) {
              violations.push(`Foreign key constraint violation: ${fk.field} references non-existent ${fk.referencedModel}`);
            }
          }
        } catch (error) {
          violations.push(`Error checking foreign key constraint for ${fk.field}`);
        }
      }
    }

    return {
      isValid: violations.length === 0,
      violations,
      structure
    };
  }

  /**
   * Get referenced model from Prisma client
   * @param {string} modelName - Model name
   * @returns {Object|null} Prisma model
   */
  getReferencedModel(modelName) {
    try {
      if (this.models) {
        const found = Object.entries(this.models).find(
          ([key]) => key.toLowerCase() === modelName.toLowerCase()
        );
        if (found) return found[1];
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Handle cascade operations
   * @param {string} operation - Operation type
   * @param {Object} data - Data for the operation
   * @param {Object} model - Prisma model
   * @param {number} id - Record ID (for update/delete)
   * @returns {Object} Cascade operation result
   */
  async handleCascadeOperations(operation, data, model, id = null) {
    const structure = await this.analyzeDatabaseStructure(model);
    
    if (!structure || !structure.hasRelations) {
      return { success: true };
    }

    const cascadeResults = [];


    if (operation === 'delete' && structure.cascadeDelete.length > 0) {
      for (const cascadeField of structure.cascadeDelete) {
        try {
          const relatedRecords = await model.findMany({
            where: { [cascadeField]: id }
          });

          for (const record of relatedRecords) {
            await model.delete({ where: { id: record.id } });
            cascadeResults.push(`Deleted related record ${record.id} due to cascade`);
          }
        } catch (error) {
          cascadeResults.push(`Error in cascade delete for ${cascadeField}: ${error.message}`);
        }
      }
    }

    if (operation === 'update' && structure.cascadeUpdate.length > 0) {
      for (const cascadeField of structure.cascadeUpdate) {
        if (data[cascadeField] !== undefined) {
          try {
            await model.updateMany({
              where: { [cascadeField]: id },
              data: { [cascadeField]: data[cascadeField] }
            });
            cascadeResults.push(`Updated related records for ${cascadeField}`);
          } catch (error) {
            cascadeResults.push(`Error in cascade update for ${cascadeField}: ${error.message}`);
          }
        }
      }
    }

    return {
      success: cascadeResults.length === 0 || cascadeResults.every(r => !r.includes('Error')),
      results: cascadeResults
    };
  }
}

module.exports = { DatabaseAnalyzer };
