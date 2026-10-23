import {
  GraphQLError,
  Kind,
  type ASTVisitor,
  type FragmentDefinitionNode,
  type SelectionSetNode,
  type ValidationContext,
} from 'graphql';

/**
 * A GraphQL validation rule that rejects queries nested deeper than `maxDepth`.
 *
 * Types point at each other (Tutor → reviews → booking → tutor → …), so
 * without a limit one small request can ask for an exponentially large
 * response. The rule runs while the query is validated, before any resolver
 * or database call. Fields starting with `__` (introspection, e.g. GraphiQL's
 * schema query) aren't counted, since they don't touch our data.
 *
 * Depth = fields along the longest path: `{ me { bookings { tutor { name } } } }` is 4.
 */
export function depthLimit(maxDepth: number) {
  return (context: ValidationContext): ASTVisitor => {
    const fragments = new Map<string, FragmentDefinitionNode>();
    for (const definition of context.getDocument().definitions) {
      if (definition.kind === Kind.FRAGMENT_DEFINITION) {
        fragments.set(definition.name.value, definition);
      }
    }

    const depthOf = (selectionSet: SelectionSetNode, seen: Set<string>): number => {
      let deepest = 0;
      for (const selection of selectionSet.selections) {
        let depth: number;
        if (selection.kind === Kind.FIELD) {
          if (selection.name.value.startsWith('__')) continue;
          depth = 1 + (selection.selectionSet ? depthOf(selection.selectionSet, seen) : 0);
        } else if (selection.kind === Kind.INLINE_FRAGMENT) {
          depth = depthOf(selection.selectionSet, seen);
        } else {
          // A named fragment: follow it once (a cycle is reported by graphql-js itself).
          const name = selection.name.value;
          const fragment = fragments.get(name);
          if (fragment === undefined || seen.has(name)) continue;
          depth = depthOf(fragment.selectionSet, new Set([...seen, name]));
        }
        deepest = Math.max(deepest, depth);
      }
      return deepest;
    };

    return {
      OperationDefinition(operation) {
        const depth = depthOf(operation.selectionSet, new Set());
        if (depth > maxDepth) {
          context.reportError(
            new GraphQLError(`Query is too deep: depth ${depth}, maximum ${maxDepth}.`, {
              nodes: [operation],
              extensions: { code: 'QUERY_TOO_DEEP' },
            }),
          );
        }
      },
    };
  };
}
