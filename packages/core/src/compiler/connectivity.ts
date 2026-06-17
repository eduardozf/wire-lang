/**
 * Connectivity over the component/net graph, used to warn about schematics that
 * fall into several disconnected pieces. This is a pure graph utility with no
 * dependency on compiler state, so it can be unit-tested directly.
 */

/**
 * Count the connected subschematics in an undirected graph. `nodeIds` are the
 * components; each entry of `edges` is a net whose members are all mutually
 * connected (a hyper-edge). Returns the number of disjoint groups among
 * `nodeIds`. Edge endpoints outside `nodeIds` are tolerated.
 */
export function countConnectedSubschematics(
  nodeIds: readonly string[],
  edges: readonly (readonly string[])[],
): number {
  const parent = new Map<string, string>();
  const ensure = (id: string): void => {
    if (!parent.has(id)) parent.set(id, id);
  };
  const find = (x: string): string => {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root)!;
    // Path compression keeps repeated lookups near-constant.
    let cur = x;
    while (parent.get(cur) !== root) {
      const next = parent.get(cur)!;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };
  const union = (a: string, b: string): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  for (const id of nodeIds) ensure(id);
  for (const edge of edges) {
    for (let i = 1; i < edge.length; i += 1) {
      ensure(edge[0]!);
      ensure(edge[i]!);
      union(edge[0]!, edge[i]!);
    }
  }

  return new Set(nodeIds.map(find)).size;
}
