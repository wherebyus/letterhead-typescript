import type { operations } from './generated/schema';

type Parameters<Operation extends keyof operations> = operations[Operation] extends infer Details
  ? Details extends { parameters: infer Found }
    ? Found
    : never
  : never;

type PathArgs<Operation extends keyof operations> = Parameters<Operation> extends { path: infer Path }
  ? { path: Path }
  : unknown;

type QueryArgs<Operation extends keyof operations> = Parameters<Operation> extends { query?: infer Query }
  ? [NonNullable<Query>] extends [never]
    ? unknown
    : {} extends Query
      ? { query?: Query }
      : { query: Query }
  : unknown;

type BodyContent<Operation extends keyof operations> = operations[Operation] extends {
  requestBody?: { content: infer Content };
}
  ? Content[keyof Content]
  : never;

// A form upload can also be handed over as a ready-made FormData.
type BodyValue<Operation extends keyof operations> = BodyContent<Operation> | FormData;

// A body the operation requires is still optional for the caller when an empty object satisfies it.
type BodyArgs<Operation extends keyof operations> = [BodyContent<Operation>] extends [never]
  ? unknown
  : operations[Operation] extends { requestBody: unknown }
    ? {} extends BodyContent<Operation>
      ? { body?: BodyValue<Operation> }
      : { body: BodyValue<Operation> }
    : { body?: BodyValue<Operation> };

type AllArgs<Operation extends keyof operations> = PathArgs<Operation> &
  QueryArgs<Operation> &
  BodyArgs<Operation>;

/**
 * What a method takes: `path` for the URL's parameters, `query` for the query string, `body` for the request body,
 * each only where the operation has one. The argument is optional when the operation needs none of them.
 */
export type OperationArgs<Operation extends keyof operations> = AllArgs<Operation>;

/** The parameter list of a method: the argument may be left out when the operation needs none. */
export type OperationArgList<Operation extends keyof operations> = {} extends AllArgs<Operation>
  ? [args?: AllArgs<Operation>]
  : [args: AllArgs<Operation>];

type SuccessResponse<Operation extends keyof operations> = operations[Operation] extends { responses: infer Responses }
  ? Responses[Extract<keyof Responses, 200 | 201 | 202>]
  : never;

/** What the API answers with on success: its JSON, a string for text (CSV, HTML), or a Blob for a file download. */
export type OperationResult<Operation extends keyof operations> = SuccessResponse<Operation> extends {
  content: infer Content;
}
  ? Content extends { 'application/json': infer Data }
    ? Data
    : [Extract<keyof Content, `text/${string}`>] extends [never]
      ? Blob
      : string
  : unknown;

export type RequestCaller = (
  method: 'GET' | 'PUT' | 'POST' | 'DELETE' | 'PATCH',
  path: string,
  args: unknown,
  options: RequestOptions,
) => Promise<unknown>;

/** What the generator knows about an operation beyond its URL: how to send its body and read its answer. */
export interface RequestOptions {
  sendsBody: boolean;
  multipart: boolean;
  parseAs: 'json' | 'text' | 'blob';
}
