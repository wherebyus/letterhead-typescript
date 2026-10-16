/** One flag a CLI command takes: a path or query parameter, or a top-level field of the request body. */
export interface CommandFlag {
  /** The parameter or field name the API uses. */
  name: string;
  /** The flag on the command line, without the leading dashes. */
  flag: string;
  in: 'path' | 'query' | 'body';
  required: boolean;
  type: 'string' | 'integer' | 'number' | 'boolean' | 'array';
  itemType?: 'string' | 'integer' | 'number' | 'boolean';
  description: string;
}

/** One API operation as a CLI command (see scripts/generate.mjs, which writes the catalog). */
export interface CommandEntry {
  group: string;
  /** The SDK method group the operation lives in. */
  sdkGroup: string;
  command: string;
  operationId: string;
  method: string;
  path: string;
  summary: string;
  description: string;
  takesBody: boolean;
  bodyRequired: boolean;
  multipart: boolean;
  flags: CommandFlag[];
}
