declare module 'json-schema-merge-allof' {
  import { JsonSchemaType } from 'ajv';

  type Options = { deep: boolean };
  declare function jsonSchemaMergeAllOf(schema: JsonSchemaType<unknown>, options?: Partial<Options>);
  export = jsonSchemaMergeAllOf;
}
