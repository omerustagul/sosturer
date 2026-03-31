import { Prisma } from '@prisma/client';

export interface FieldMetadata {
  name: string;
  type: string;
  isRequired: boolean;
  isList: boolean;
  isId: boolean;
  isUnique: boolean;
  isUpdatedAt: boolean;
  hasDefaultValue: boolean;
  default?: any;
  documentation?: string;
  relationName?: string;
  isRelation: boolean;
}

export interface ModelMetadata {
  name: string;
  dbName: string | null;
  fields: FieldMetadata[];
  documentation?: string;
}

export class SchemaAnalyzer {
  /**
   * Get all models from Prisma DMMF
   */
  static getAllModels(): ModelMetadata[] {
    const dmmf = (Prisma as any).dmmf;
    if (!dmmf || !dmmf.datamodel || !dmmf.datamodel.models) {
      throw new Error('Prisma DMMF not found. Ensure Prisma Client is generated.');
    }

    return dmmf.datamodel.models.map((model: any) => ({
      name: model.name,
      dbName: model.dbName,
      documentation: model.documentation,
      fields: model.fields.map((field: any) => ({
        name: field.name,
        type: field.type,
        isRequired: field.isRequired,
        isList: field.isList,
        isId: field.isId,
        isUnique: field.isUnique,
        isUpdatedAt: field.isUpdatedAt,
        hasDefaultValue: field.hasDefaultValue,
        default: field.default,
        documentation: field.documentation,
        relationName: field.relationName,
        isRelation: !!field.relationName
      }))
    }));
  }

  /**
   * Get specific model metadata
   */
  static getModelMetadata(modelName: string): ModelMetadata | undefined {
    return this.getAllModels().find(m => m.name === modelName);
  }

  /**
   * Calculate a hash of the model metadata to detect changes
   */
  static calculateHash(metadata: ModelMetadata): string {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256');
    // Sanitize metadata to avoid hash changes on non-structural differences
    const sanitized = {
      name: metadata.name,
      fields: metadata.fields.map(f => ({
        name: f.name,
        type: f.type,
        isRequired: f.isRequired,
        isUnique: f.isUnique,
        isId: f.isId
      }))
    };
    hash.update(JSON.stringify(sanitized));
    return hash.digest('hex');
  }
}
