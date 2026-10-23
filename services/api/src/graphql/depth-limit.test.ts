import { describe, expect, it } from '@jest/globals';
import { buildSchema, parse, validate } from 'graphql';
import { depthLimit } from './depth-limit.js';

const schema = buildSchema(`
  type Tutor { name: String, reviews: [Review] }
  type Review { booking: Booking }
  type Booking { tutor: Tutor }
  type Query { tutor: Tutor }
`);

function errors(query: string, max: number): string[] {
  return validate(schema, parse(query), [depthLimit(max)]).map((e) => e.message);
}

describe('depthLimit', () => {
  it('allows a query at the limit', () => {
    expect(errors('{ tutor { reviews { booking { tutor { name } } } } }', 5)).toEqual([]);
  });

  it('rejects a query one level deeper', () => {
    expect(errors('{ tutor { reviews { booking { tutor { name } } } } }', 4)).toEqual([
      'Query is too deep: depth 5, maximum 4.',
    ]);
  });

  it('counts depth through named and inline fragments', () => {
    const query = `
      { tutor { ...R } }
      fragment R on Tutor { reviews { ... on Review { booking { tutor { name } } } } }`;
    expect(errors(query, 4)).toHaveLength(1);
  });

  it('ignores introspection fields', () => {
    const query = '{ __schema { types { fields { type { ofType { ofType { name } } } } } } }';
    expect(errors(query, 2)).toEqual([]);
  });
});
