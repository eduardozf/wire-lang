/**
 * Connectivity over the component/net graph, used to warn about schematics that
 * fall into several disconnected pieces. This is a pure graph utility with no
 * dependency on compiler state, so it can be unit-tested directly.
 */

/**
 * Partition an undirected graph into its connected groups. `nodeIds` are the
 * components; each entry of `edges` is a net whose members are all mutually
 * connected (a hyper-edge). Returns the disjoint groups among `nodeIds`, each
 * group in `nodeIds` order and the groups ordered by their first member. Edge
 * endpoints outside `nodeIds` are tolerated (they join groups but are not
 * reported).
 */
export function connectedGroups(
  nodeIds: readonly string[],
  edges: readonly (readonly string[])[],
): string[][] {
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

  const byRoot = new Map<string, string[]>();
  for (const id of nodeIds) {
    const root = find(id);
    const group = byRoot.get(root);
    if (group) group.push(id);
    else byRoot.set(root, [id]);
  }
  return [...byRoot.values()];
}

/** Count the connected subschematics among `nodeIds`. See {@link connectedGroups}. */
export function countConnectedSubschematics(
  nodeIds: readonly string[],
  edges: readonly (readonly string[])[],
): number {
  return connectedGroups(nodeIds, edges).length;
}
