import { connectedGroups } from "../compiler/connectivity.js";
import type { ComponentInstance, Net, SchematicModel } from "../model/types.js";
import { isTwoTerminalSymbol } from "./geometry.js";

/**
 * Peripheral detection for the bus-rail layout: two-terminal parts that hang
 * off a single row component (an LED chain on a GPIO, a button, a speaker on an
 * amp's outputs) are pulled out of the main row and placed next to the pin that
 * feeds them. Detection is pure graph analysis over the schematic model; the
 * bus-rail engine decides where each detected group physically goes.
 */

/** Net family as classified by the bus-rail engine (buses already re-tagged). */
export type NetFamily = "supply" | "ground" | "control" | "bus" | "signal";

/** One part in a chain, wired anchor -> ... -> tail through its two terminals. */
export interface ChainElement {
  readonly instance: ComponentInstance;
  /** Terminal facing the anchor (or the previous element). */
  readonly upstreamTerminal: string;
  /** Terminal facing the next element (or the tail rail). */
  readonly downstreamTerminal: string;
  /** Net connecting `upstreamTerminal` to the previous node. */
  readonly upstreamNet: Net;
}

/** A series chain fed from one anchor pin: anchor -> R1 -> D1 -> (ground | open). */
export interface ChainGroup {
  readonly kind: "chain";
  readonly anchorId: string;
  readonly anchorTerminal: string;
  readonly elements: readonly ChainElement[];
  readonly tail: "ground" | "none";
}

/** One anchor-pin-to-element link of a bridge. */
export interface BridgeLink {
  readonly net: Net;
  readonly anchorTerminal: string;
  readonly elementTerminal: string;
}

/** A single part fed from two pins of the same anchor (a speaker on OUTP/OUTN). */
export interface BridgeGroup {
  readonly kind: "bridge";
  readonly anchorId: string;
  readonly element: ComponentInstance;
  readonly links: readonly [BridgeLink, BridgeLink];
}

export type PeripheralGroup = ChainGroup | BridgeGroup;

export function memberIds(group: PeripheralGroup): string[] {
  return group.kind === "chain"
    ? group.elements.map((element) => element.instance.id)
    : [group.element.id];
}

/**
 * Detect peripheral groups. Anything that does not match a supported shape
 * stays out of the result and keeps its main-row placement, so detection can
 * only improve a drawing, never break one. Bail conditions per candidate
 * group: more than one distinct anchor component, a branching net (>2 member
 * entries), branching inside the group, or a supply-family tail (pull-ups stay
 * in the row for now). Candidates with only rail nets (a battery, a decoupling
 * cap) have no anchor and stay in the row too.
 */
export function detectPeripherals(
  model: SchematicModel,
  familyOf: (netName: string) => NetFamily,
): PeripheralGroup[] {
  const instances = new Map(model.components.map((instance) => [instance.id, instance]));

  const isCandidate = (instance: ComponentInstance): boolean =>
    isTwoTerminalSymbol(instance.symbol) &&
    instance.terminals.length === 2 &&
    !model.nets.some(
      (net) =>
        familyOf(net.name) === "bus" &&
        net.members.some((member) => member.component === instance.id),
    );
  const candidateIds = model.components
    .filter(isCandidate)
    .sort((a, b) => a.sourceIndex - b.sourceIndex)
    .map((instance) => instance.id);
  const candidates = new Set(candidateIds);

  // Nets incident to each candidate terminal, for walking chains.
  const netsAt = new Map<string, Net[]>();
  for (const net of model.nets) {
    for (const member of net.members) {
      if (!candidates.has(member.component)) continue;
      const key = `${member.component}.${member.terminal}`;
      const list = netsAt.get(key);
      if (list) list.push(net);
      else netsAt.set(key, [net]);
    }
  }
  const netsOn = (component: string, terminal: string): Net[] =>
    netsAt.get(`${component}.${terminal}`) ?? [];

  const isRail = (net: Net): boolean => {
    const family = familyOf(net.name);
    return family === "supply" || family === "ground";
  };

  // Candidate-to-candidate 2-member non-rail nets are the edges that keep a
  // chain's parts in one group.
  const edges = model.nets
    .filter(
      (net) =>
        !isRail(net) &&
        familyOf(net.name) !== "bus" &&
        net.members.length === 2 &&
        net.members.every((member) => candidates.has(member.component)) &&
        net.members[0]!.component !== net.members[1]!.component,
    )
    .map((net) => net.members.map((member) => member.component));

  const groups: PeripheralGroup[] = [];

  for (const groupIds of connectedGroups(candidateIds, edges)) {
    const inGroup = new Set(groupIds);

    // Anchor links: non-rail nets joining the group to the rest of the drawing.
    let bail = false;
    const anchorLinks: {
      net: Net;
      insideComponent: string;
      insideTerminal: string;
      anchorComponent: string;
      anchorTerminal: string;
    }[] = [];
    for (const net of model.nets) {
      if (isRail(net)) continue;
      const inside = net.members.filter((member) => inGroup.has(member.component));
      if (inside.length === 0) continue;
      if (net.members.length > 2) {
        bail = true; // branching net; unsupported shape
        break;
      }
      const outside = net.members.find((member) => !inGroup.has(member.component));
      if (!outside) continue; // internal chain edge
      anchorLinks.push({
        net,
        insideComponent: inside[0]!.component,
        insideTerminal: inside[0]!.terminal,
        anchorComponent: outside.component,
        anchorTerminal: outside.terminal,
      });
    }
    if (bail || anchorLinks.length === 0) continue;
    const anchorId = anchorLinks[0]!.anchorComponent;
    if (anchorLinks.some((link) => link.anchorComponent !== anchorId)) continue;
    if (candidates.has(anchorId)) continue; // anchor must be a row component

    if (anchorLinks.length === 2 && groupIds.length === 1) {
      // Bridge: one part, both terminals fed by the same anchor.
      const element = instances.get(groupIds[0]!)!;
      const [a, b] = anchorLinks;
      if (a!.insideTerminal === b!.insideTerminal) continue;
      groups.push({
        kind: "bridge",
        anchorId,
        element,
        links: [
          { net: a!.net, anchorTerminal: a!.anchorTerminal, elementTerminal: a!.insideTerminal },
          { net: b!.net, anchorTerminal: b!.anchorTerminal, elementTerminal: b!.insideTerminal },
        ],
      });
      continue;
    }
    if (anchorLinks.length !== 1) continue;

    // Chain: walk from the anchor net through each part's other terminal.
    const link = anchorLinks[0]!;
    const elements: ChainElement[] = [];
    const visited = new Set<string>();
    let currentId: string | null = link.insideComponent;
    let upstreamTerminal = link.insideTerminal;
    let upstreamNet = link.net;
    let tail: "ground" | "none" | null = null;
    while (currentId) {
      const instance = instances.get(currentId)!;
      visited.add(currentId);
      const [t0, t1] = instance.terminals as [string, string];
      if (upstreamTerminal !== t0 && upstreamTerminal !== t1) break;
      const downstreamTerminal = upstreamTerminal === t0 ? t1 : t0;
      // The upstream terminal must carry only the net we arrived on.
      if (netsOn(currentId, upstreamTerminal).length !== 1) break;
      elements.push({ instance, upstreamTerminal, downstreamTerminal, upstreamNet });

      const nextNets = netsOn(currentId, downstreamTerminal);
      if (nextNets.length === 0) {
        tail = "none";
        break;
      }
      if (nextNets.length > 1) break;
      const next: Net = nextNets[0]!;
      const family = familyOf(next.name);
      if (family === "ground") {
        tail = "ground";
        break;
      }
      const onward = next.members.find((member) => member.component !== currentId);
      if (
        family === "supply" ||
        next.members.length !== 2 ||
        !onward ||
        !inGroup.has(onward.component) ||
        visited.has(onward.component)
      ) {
        break;
      }
      currentId = onward.component;
      upstreamTerminal = onward.terminal;
      upstreamNet = next;
    }
    if (tail === null || visited.size !== groupIds.length) continue;
    groups.push({
      kind: "chain",
      anchorId,
      anchorTerminal: link.anchorTerminal,
      elements,
      tail,
    });
  }

  return groups;
}
