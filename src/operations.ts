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

type BodyArgs<Operation extends keyof operations> = [BodyContent<Operation>] extends [never]
  ? unknown
  : operations[Operation] extends { requestBody: unknown }
    ? { body: BodyContent<Operation> }
    : { body?: BodyContent<Operation> };

type AllArgs<Operation extends keyof operations> = PathArgs<Operation> &
  QueryArgs<Operation> &
  BodyArgs<Operation>;

/**
 * What a method takes: `path` for the URL's parameters, `query` for the query string, `body` for the request body,
 * each only where the operation has one. The argument is optional when the operation needs none of them.
 */
export type OperationArgs<Operation extends keyof operations> = {} extends AllArgs<Operation>
  ? AllArgs<Operation> | undefined
  : AllArgs<Operation>;

type SuccessResponse<Operation extends keyof operations> = operations[Operation] extends { responses: infer Responses }
  ? Responses[Extract<keyof Responses, 200 | 201 | 202>]
  : never;

/** The JSON the API answers with on success. */
export type OperationResult<Operation extends keyof operations> = SuccessResponse<Operation> extends {
  content: { 'application/json': infer Data };
}
  ? Data
  : unknown;

export type RequestCaller = (
  method: 'GET' | 'PUT' | 'POST' | 'DELETE' | 'PATCH',
  path: string,
  args: unknown,
  sendsBody: boolean,
) => Promise<unknown>;
