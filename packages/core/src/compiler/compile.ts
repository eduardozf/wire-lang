import type {
  ComponentNode,
  DefineComponentNode,
  DocumentNode,
  NoConnectNode,
  PropertyNode,
  RenderNode,
  TerminalRefNode,
} from "../ast/nodes.js";
import type { Diagnostic, DiagnosticSeverity } from "../diagnostics.js";
import { DiagnosticCodes } from "../diagnostics.js";
import { parseQuantity } from "../library/quantity.js";
import { getStandardComponent } from "../library/standard-library.js";
import { isKnownSymbol, requiredSymbolRoles } from "../library/symbols.js";
import type { ComponentTypeDef, SymbolRoleMapping } from "../library/types.js";
import { resolveTerminal } from "../library/types.js";
import type {
  CompileResult,
  ComponentInstance,
  CrossingStyle,
  Direction,
  Group,
  IcPin,
  LayoutMode,
  LocalComponentDef,
  Net,
  NetStyle,
  NetTerminalRef,
  NoConnect,
  NormalizedProperty,
  Orientation,
  SchematicModel,
  Side,
} from "../model/types.js";
import {
  CROSSING_STYLES,
  DIRECTIONS,
  LANGUAGE_VERSION,
  LAYOUT_MODES,
  NET_STYLES,
  ORIENTATIONS,
  SIDES,
} from "../model/types.js";
import { parseDocument } from "../parser/parser.js";
import type { SourceRange } from "../source.js";
import { countConnectedSubschematics } from "./connectivity.js";

interface NetBuilder {
  name: string;
  anonymous: boolean;
  members: NetTerminalRef[];
  memberKeys: Set<string>;
  style: NetStyle;
  sourceIndex: number;
  range: SourceRange;
}

class Compiler {
  private readonly diagnostics: Diagnostic[] = [];

  private readonly localDefs = new Map<string, LocalComponentDef>();
  private readonly instances: MutableInstance[] = [];
  private readonly instanceById = new Map<string, MutableInstance>();
  private readonly unresolvedComponentIds = new Set<string>();

  private readonly nets: NetBuilder[] = [];
  private readonly netsByName = new Map<string, NetBuilder>();
  private readonly terminalOwner = new Map<string, string>();
  private anonCounter = 0;
  private netOrder = 0;

  private readonly groups: MutableGroup[] = [];
  private readonly groupByName = new Map<string, MutableGroup>();

  private title: string | null = null;
  private description: string | null = null;
  private direction: Direction = "left-to-right";
  private directionSet = false;
  private crossings: CrossingStyle = "gap";
  private crossingsSet = false;
  private layoutMode: LayoutMode = "flow";
  private layoutModeSet = false;

  private readonly noConnects: NoConnect[] = [];
  /** `component.terminal` keys that have been marked `no-connect`. */
  private readonly noConnectKeys = new Set<string>();

  private readonly annotations: {
    text: string;
    targetKind: "component" | "net";
    target: string;
  }[] = [];

  compile(ast: DocumentNode, parseDiagnostics: readonly Diagnostic[]): CompileResult {
    this.diagnostics.push(...parseDiagnostics);

    // Pass 1: titles, descriptions, and local definitions (types before instances).
    for (const statement of ast.statements) {
      if (statement.kind === "Title" && this.title === null) this.title = statement.value;
      else if (statement.kind === "Description" && this.description === null)
        this.description = statement.value;
      else if (statement.kind === "DefineComponent") this.collectLocalDefinition(statement);
    }

    // Pass 2: component instances.
    for (const statement of ast.statements) {
      if (statement.kind === "Component") this.collectComponent(statement);
    }

    // Pass 3: nets and anonymous connections (in source order).
    for (const statement of ast.statements) {
      if (statement.kind === "Net") {
        this.collectNet(statement.name, false, statement.members, statement.range);
      } else if (statement.kind === "Connect") {
        this.collectNet(`$${++this.anonCounter}`, true, statement.members, statement.range);
      }
    }

    // Pass 4: no-connect flags (after nets so conflicts are detectable).
    for (const statement of ast.statements) {
      if (statement.kind === "NoConnect") this.collectNoConnect(statement);
    }

    // Pass 5: groups.
    for (const statement of ast.statements) {
      if (statement.kind === "Group") this.collectGroup(statement.name, statement);
    }

    // Pass 6: annotations.
    for (const statement of ast.statements) {
      if (statement.kind === "Annotation") this.collectAnnotation(statement);
    }

    // Pass 7: render hints (after targets exist).
    for (const statement of ast.statements) {
      if (statement.kind === "Render") this.collectRender(statement);
    }

    this.finalizeFloatingNets();
    this.warnDisconnected();
    if (this.instances.length === 0) {
      this.report(
        "warning",
        DiagnosticCodes.schematicNoComponents,
        "This schematic declares no components.",
        null,
      );
    }

    const model = this.buildModel();
    const ok = !this.diagnostics.some((diagnostic) => diagnostic.severity === "error");
    return { model, diagnostics: this.diagnostics, ok };
  }

  // ---- local definitions ---------------------------------------------------

  private collectLocalDefinition(node: DefineComponentNode): void {
    const seen = new Set<string>();
    const terminals: string[] = [];
    for (const terminal of node.terminals) {
      if (seen.has(terminal.name)) {
        this.report(
          "warning",
          DiagnosticCodes.defineDuplicateTerminal,
          `Duplicate terminal "${terminal.name}" in definition of ${node.name}.`,
          terminal.range,
        );
        continue;
      }
      seen.add(terminal.name);
      terminals.push(terminal.name);
    }

    if (terminals.length === 0) {
      this.report(
        "warning",
        DiagnosticCodes.defineNoTerminals,
        `Local component ${node.name} defines no terminals.`,
        node.nameRange,
      );
    }

    let symbol = "module";
    const roleMappings: SymbolRoleMapping[] = [];
    if (node.symbol) {
      symbol = node.symbol.symbol;
      if (!isKnownSymbol(symbol)) {
        this.report(
          "error",
          DiagnosticCodes.defineUnknownSymbol,
          `Unknown symbol "${symbol}" in definition of ${node.name}.`,
          node.symbol.range,
        );
        symbol = "module";
      }
      const required = requiredSymbolRoles(symbol);
      for (const map of node.symbol.maps) {
        if (!required.includes(map.role)) {
          this.report(
            "warning",
            DiagnosticCodes.defineUnknownRole,
            `Symbol "${symbol}" has no role "${map.role}".`,
            map.range,
          );
          continue;
        }
        if (!terminals.includes(map.terminal)) {
          this.report(
            "error",
            DiagnosticCodes.defineUnknownMappedTerminal,
            `Role "${map.role}" maps to unknown terminal "${map.terminal}".`,
            map.range,
          );
          continue;
        }
        roleMappings.push({ role: map.role, terminal: map.terminal });
      }
      const mappedRoles = new Set(roleMappings.map((entry) => entry.role));
      const missing = required.filter((role) => !mappedRoles.has(role));
      if (missing.length > 0) {
        this.report(
          "error",
          DiagnosticCodes.defineMissingSymbolRoleMap,
          `Definition of ${node.name} must map symbol roles: ${missing.join(", ")}.`,
          node.symbol.range,
        );
      }
    }

    this.localDefs.set(node.name, { name: node.name, terminals, symbol, roleMappings });
  }

  // ---- component instances -------------------------------------------------

  private collectComponent(node: ComponentNode): void {
    if (this.instanceById.has(node.id)) {
      this.report(
        "error",
        DiagnosticCodes.componentDuplicateId,
        `Duplicate component id "${node.id}".`,
        node.idRange,
      );
      return;
    }

    const local = this.localDefs.get(node.componentType);
    const standard = getStandardComponent(node.componentType);
    let type: ComponentTypeDef | null = null;
    let symbol = "module";
    let roleMappings: readonly SymbolRoleMapping[] = [];
    let baseTerminals: readonly string[] = [];
    let isLocal = false;

    if (local) {
      isLocal = true;
      symbol = local.symbol;
      roleMappings = local.roleMappings;
      baseTerminals = local.terminals;
      type = {
        name: local.name,
        terminals: local.terminals,
        properties: [],
        defaultLabels: ["id"],
        symbol: local.symbol,
        roleMappings: local.roleMappings,
      };
    } else if (standard) {
      type = standard;
      symbol = standard.symbol;
      roleMappings = standard.roleMappings ?? [];
      baseTerminals = standard.terminals;
    } else {
      this.report(
        "error",
        DiagnosticCodes.componentUnknownType,
        `Unknown component type "${node.componentType}".`,
        node.componentTypeRange,
      );
      this.unresolvedComponentIds.add(node.id);
    }

    // Designator-prefix sanity check (warning only).
    if (type && !isLocal && standard?.designatorPrefixes) {
      const prefix = /^[A-Za-z]+/.exec(node.id)?.[0] ?? "";
      const accepted = standard.designatorPrefixes.map((value) => value.toUpperCase());
      if (prefix !== "" && !accepted.includes(prefix.toUpperCase())) {
        this.report(
          "warning",
          DiagnosticCodes.componentUnusualDesignator,
          `Instance "${node.id}" uses an unusual designator for ${node.componentType} (expected ${standard.designatorPrefixes.join("/")}).`,
          node.idRange,
        );
      }
    }

    const properties: NormalizedProperty[] = [];
    let dynamicTerminals: string[] | null = null;
    let icPins: IcPin[] | null = null;
    for (const property of node.properties) {
      const normalized = this.normalizeProperty(property, type);
      properties.push(normalized);
      if (!type?.dynamicTerminals || property.name !== "pins" || !normalized.items) continue;
      const def = type.properties.find((entry) => entry.name === "pins");
      if (def?.kind === "ic-pin-list") {
        icPins = this.parseIcPins(normalized.items, property);
        dynamicTerminals = icPins.map((pin) => pin.name);
      } else {
        dynamicTerminals = [...normalized.items];
      }
    }

    if (type) this.checkRecommendedProperties(type, node, properties);

    const terminals = type?.dynamicTerminals ? (dynamicTerminals ?? []) : [...baseTerminals];
    const labels = this.computeLabels(type, node.id, properties);

    const instance: MutableInstance = {
      id: node.id,
      typeName: node.componentType,
      type,
      terminals,
      properties,
      labels,
      group: null,
      local: isLocal,
      symbol,
      roleMappings: [...roleMappings],
      pins: icPins ?? undefined,
      sourceIndex: this.instances.length,
      orientation: null,
      side: null,
      anchorCenter: false,
    };
    this.instances.push(instance);
    this.instanceById.set(node.id, instance);
  }

  private normalizeProperty(
    property: PropertyNode,
    type: ComponentTypeDef | null,
  ): NormalizedProperty {
    const value = property.value;
    // Every normalized property shares this shape; only validation and the
    // optional `quantity`/`items` fields differ per kind.
    const base = {
      name: property.name,
      valueKind: value.valueKind,
      raw: value.raw,
      display: value.raw,
    } as const;

    const def = type?.properties.find((entry) => entry.name === property.name);
    if (!def) {
      if (type) {
        this.report(
          "warning",
          DiagnosticCodes.componentUnknownProperty,
          `Unknown property "${property.name}" on ${type.name}.`,
          property.nameRange,
        );
      }
      return { ...base, items: value.items, known: false };
    }

    switch (def.kind) {
      case "quantity": {
        const quantity = parseQuantity(value.raw, def.dimension);
        if (!quantity) {
          this.reportInvalidValue(
            property,
            `expects a ${def.dimension ?? "quantity"} value, got "${value.raw}"`,
          );
        }
        return { ...base, ...(quantity ? { quantity } : {}), known: true };
      }
      case "enum": {
        if (def.enumValues && !def.enumValues.includes(value.raw)) {
          this.reportInvalidValue(property, `must be one of: ${def.enumValues.join(", ")}`);
        }
        return { ...base, known: true };
      }
      case "boolean": {
        if (value.raw !== "true" && value.raw !== "false") {
          this.reportInvalidValue(property, "must be true or false");
        }
        return { ...base, known: true };
      }
      case "pin-list": {
        if (value.valueKind !== "list") {
          this.reportInvalidValue(property, "must be a list like [VCC,GND]");
        }
        return { ...base, items: value.items, known: true };
      }
      case "ic-pin-list": {
        if (value.valueKind !== "list") {
          this.reportInvalidValue(property, "must be a list like [1:VCC@left, 2:GND@right]");
        }
        return { ...base, items: value.items, known: true };
      }
      default:
        return { ...base, known: true };
    }
  }

  /**
   * Parse `IC` pin items of the form `[number:]name[@side]` into structured
   * pins. Pin numbers and sides are optional; an omitted side defaults to
   * `left`. Duplicate pin names are dropped with a diagnostic.
   */
  private parseIcPins(items: readonly string[], property: PropertyNode): IcPin[] {
    const pins: IcPin[] = [];
    const seen = new Set<string>();
    const pinPattern = /^(?:([^:@\s]+):)?([^:@\s]+)(?:@([^:@\s]+))?$/;
    for (const item of items) {
      const match = pinPattern.exec(item);
      if (!match) {
        this.reportInvalidValue(
          property,
          `has malformed pin "${item}" (expected number:name@side)`,
        );
        continue;
      }
      const [, rawNumber, name, rawSide] = match;
      const pinName = name!;
      let side: Side = "left";
      if (rawSide !== undefined) {
        if (!SIDES.includes(rawSide as Side)) {
          this.reportInvalidValue(
            property,
            `pin "${pinName}" has invalid side "${rawSide}" (expected ${SIDES.join("/")})`,
          );
        } else {
          side = rawSide as Side;
        }
      }
      if (seen.has(pinName)) {
        this.reportInvalidValue(property, `has duplicate pin name "${pinName}"`);
        continue;
      }
      seen.add(pinName);
      pins.push({ number: rawNumber ?? null, name: pinName, side });
    }
    return pins;
  }

  // ---- no-connect flags ----------------------------------------------------

  private collectNoConnect(node: NoConnectNode): void {
    for (const member of node.members) {
      const instance = this.instanceById.get(member.component);
      if (!instance) {
        this.report(
          "error",
          DiagnosticCodes.noConnectUnknownComponent,
          `no-connect references unknown component "${member.component}".`,
          member.componentRange,
        );
        continue;
      }

      let terminal = member.terminal;
      if (!this.unresolvedComponentIds.has(member.component) && instance.type) {
        const resolved = resolveTerminal(instance.type, member.terminal, instance.terminals);
        if (!resolved) {
          this.report(
            "error",
            DiagnosticCodes.noConnectUnknownTerminal,
            `Component "${member.component}" (${instance.typeName}) has no terminal "${member.terminal}".`,
            member.terminalRange,
          );
          continue;
        }
        terminal = resolved;
      }

      const key = `${member.component}.${terminal}`;
      const owner = this.terminalOwner.get(key);
      if (owner !== undefined) {
        this.report(
          "error",
          DiagnosticCodes.noConnectConflict,
          `Terminal ${key} is marked no-connect but is also connected to net ${owner}.`,
          member.range,
        );
        continue;
      }
      if (this.noConnectKeys.has(key)) {
        this.report(
          "warning",
          DiagnosticCodes.noConnectDuplicate,
          `Terminal ${key} is already marked no-connect.`,
          member.range,
        );
        continue;
      }
      this.noConnectKeys.add(key);
      this.noConnects.push({ component: member.component, terminal });
    }
  }

  private reportInvalidValue(property: PropertyNode, expectation: string): void {
    this.report(
      "error",
      DiagnosticCodes.componentInvalidPropertyValue,
      `Property "${property.name}" ${expectation}.`,
      property.value.range,
    );
  }

  private checkRecommendedProperties(
    type: ComponentTypeDef,
    node: ComponentNode,
    properties: readonly NormalizedProperty[],
  ): void {
    for (const def of type.properties) {
      if (!def.recommended) continue;
      if (!properties.some((property) => property.name === def.name)) {
        this.report(
          "warning",
          DiagnosticCodes.componentMissingRecommendedProperty,
          `${type.name} ${node.id} is missing recommended property "${def.name}".`,
          node.idRange,
        );
      }
    }
  }

  private computeLabels(
    type: ComponentTypeDef | null,
    id: string,
    properties: readonly NormalizedProperty[],
  ): string[] {
    const labels: string[] = [];
    const defaults = type?.defaultLabels ?? ["id"];
    for (const label of defaults) {
      if (label === "id") {
        labels.push(id);
        continue;
      }
      const property = properties.find((entry) => entry.name === label);
      if (property) labels.push(property.display);
    }
    return labels;
  }

  // ---- nets ----------------------------------------------------------------

  private collectNet(
    name: string,
    anonymous: boolean,
    members: readonly TerminalRefNode[],
    range: SourceRange,
  ): void {
    let builder = anonymous ? undefined : this.netsByName.get(name);
    if (!builder) {
      builder = {
        name,
        anonymous,
        members: [],
        memberKeys: new Set(),
        style: "wire",
        sourceIndex: this.netOrder++,
        range,
      };
      this.nets.push(builder);
      if (!anonymous) this.netsByName.set(name, builder);
    }

    for (const member of members) {
      this.addNetMember(builder, member);
    }
  }

  private addNetMember(builder: NetBuilder, member: TerminalRefNode): void {
    const instance = this.instanceById.get(member.component);
    if (!instance) {
      this.report(
        "error",
        DiagnosticCodes.netUnknownComponent,
        `Net references unknown component "${member.component}".`,
        member.componentRange,
      );
      return;
    }

    let terminal = member.terminal;
    if (!this.unresolvedComponentIds.has(member.component) && instance.type) {
      const resolved = resolveTerminal(instance.type, member.terminal, instance.terminals);
      if (!resolved) {
        this.report(
          "error",
          DiagnosticCodes.netUnknownTerminal,
          `Component "${member.component}" (${instance.typeName}) has no terminal "${member.terminal}".`,
          member.terminalRange,
        );
        return;
      }
      terminal = resolved;
    }

    const key = `${member.component}.${terminal}`;
    const owner = this.terminalOwner.get(key);
    if (owner !== undefined && owner !== builder.name) {
      this.report(
        "error",
        DiagnosticCodes.netConflict,
        `Terminal ${key} is assigned to multiple nets (${owner} and ${builder.name}).`,
        member.range,
      );
      return;
    }
    this.terminalOwner.set(key, builder.name);

    if (!builder.memberKeys.has(key)) {
      builder.memberKeys.add(key);
      builder.members.push({ component: member.component, terminal });
    }
  }

  private finalizeFloatingNets(): void {
    for (const net of this.nets) {
      if (net.members.length === 1) {
        this.report(
          "warning",
          DiagnosticCodes.netFloating,
          `Net ${net.anonymous ? "(anonymous)" : net.name} connects only one terminal.`,
          net.range,
        );
      }
    }
  }

  // ---- groups --------------------------------------------------------------

  private collectGroup(
    name: string,
    node: {
      name: string;
      nameRange: SourceRange;
      members: readonly { id: string; range: SourceRange }[];
    },
  ): void {
    if (this.instanceById.has(name)) {
      this.report(
        "error",
        DiagnosticCodes.groupIdCollision,
        `Group name "${name}" collides with a component id.`,
        node.nameRange,
      );
      return;
    }
    this.report(
      "warning",
      DiagnosticCodes.groupNotYetHonored,
      `Group "${name}" is accepted but the bundled renderer does not lay groups out yet.`,
      node.nameRange,
    );

    // A repeated group name merges into the existing group.
    let group = this.groupByName.get(name);
    if (!group) {
      group = { name, members: [], side: null };
      this.groups.push(group);
      this.groupByName.set(name, group);
    }

    for (const member of node.members) {
      const instance = this.instanceById.get(member.id);
      if (!instance) {
        this.report(
          "warning",
          DiagnosticCodes.groupUnknownComponent,
          `Group "${name}" references unknown component "${member.id}".`,
          member.range,
        );
        continue;
      }
      if (instance.group !== null && instance.group !== name) {
        this.report(
          "warning",
          DiagnosticCodes.groupDuplicateMembership,
          `Component "${member.id}" is already in group "${instance.group}"; ignoring "${name}".`,
          member.range,
        );
        continue;
      }
      if (!group.members.includes(member.id)) {
        instance.group = name;
        group.members.push(member.id);
      }
    }
  }

  // ---- annotations ---------------------------------------------------------

  private collectAnnotation(node: {
    text: string;
    target: { targetKind: "component" | "net"; name: string; range: SourceRange } | null;
  }): void {
    if (!node.target) return;
    const { targetKind, name } = node.target;
    const exists =
      targetKind === "component" ? this.instanceById.has(name) : this.netsByName.has(name);
    if (!exists) {
      this.report(
        "warning",
        DiagnosticCodes.annotationUnknownTarget,
        `Annotation targets unknown ${targetKind} "${name}".`,
        node.target.range,
      );
    }
    this.annotations.push({ text: node.text, targetKind, target: name });
  }

  // ---- render hints --------------------------------------------------------

  private collectRender(node: RenderNode): void {
    if (node.scope === "global") {
      if (node.hintKey === "crossings") {
        if (!CROSSING_STYLES.includes(node.hintValue as CrossingStyle)) {
          this.report(
            "warning",
            DiagnosticCodes.renderInvalidValue,
            `Invalid crossings style "${node.hintValue}" (expected ${CROSSING_STYLES.join("/")}).`,
            node.range,
          );
          return;
        }
        if (this.crossingsSet) {
          this.report(
            "warning",
            DiagnosticCodes.renderDuplicate,
            "Duplicate global crossings hint; using the last value.",
            node.range,
          );
        }
        this.crossings = node.hintValue as CrossingStyle;
        this.crossingsSet = true;
        return;
      }
      if (node.hintKey === "layout") {
        if (!LAYOUT_MODES.includes(node.hintValue as LayoutMode)) {
          this.report(
            "warning",
            DiagnosticCodes.renderInvalidValue,
            `Invalid layout "${node.hintValue}" (expected ${LAYOUT_MODES.join("/")}).`,
            node.range,
          );
          return;
        }
        if (this.layoutModeSet) {
          this.report(
            "warning",
            DiagnosticCodes.renderDuplicate,
            "Duplicate global layout hint; using the last value.",
            node.range,
          );
        }
        this.layoutMode = node.hintValue as LayoutMode;
        this.layoutModeSet = true;
        return;
      }
      if (node.hintKey !== "direction") {
        this.report(
          "warning",
          DiagnosticCodes.renderUnknownKey,
          `Unknown global render hint "${node.hintKey}".`,
          node.range,
        );
        return;
      }
      if (!DIRECTIONS.includes(node.hintValue as Direction)) {
        this.report(
          "warning",
          DiagnosticCodes.renderInvalidValue,
          `Invalid direction "${node.hintValue}".`,
          node.range,
        );
        return;
      }
      if (this.directionSet) {
        this.report(
          "warning",
          DiagnosticCodes.renderDuplicate,
          "Duplicate global direction hint; using the last value.",
          node.range,
        );
      }
      this.direction = node.hintValue as Direction;
      this.directionSet = true;
      return;
    }

    if (node.scope === "net") {
      const net = node.target ? this.netsByName.get(node.target) : undefined;
      if (!net) {
        this.report(
          "warning",
          DiagnosticCodes.renderUnknownNet,
          `Render hint targets unknown net "${node.target}".`,
          node.range,
        );
        return;
      }
      if (node.hintKey !== "style") {
        this.report(
          "warning",
          DiagnosticCodes.renderUnknownKey,
          `Unknown net render hint "${node.hintKey}".`,
          node.range,
        );
        return;
      }
      if (!NET_STYLES.includes(node.hintValue as NetStyle)) {
        this.report(
          "warning",
          DiagnosticCodes.renderInvalidValue,
          `Invalid net style "${node.hintValue}".`,
          node.range,
        );
        return;
      }
      net.style = node.hintValue as NetStyle;
      return;
    }

    // Targeted hint (component or group).
    const target = node.target ?? "";
    const instance = this.instanceById.get(target);
    const group = this.groupByName.get(target);
    if (!instance && !group) {
      this.report(
        "warning",
        DiagnosticCodes.renderUnknownTarget,
        `Render hint targets unknown component or group "${target}".`,
        node.range,
      );
      return;
    }

    switch (node.hintKey) {
      case "orientation": {
        if (!ORIENTATIONS.includes(node.hintValue as Orientation)) {
          this.invalidValue(node);
          return;
        }
        if (!instance) {
          this.report(
            "warning",
            DiagnosticCodes.renderInvalidValue,
            `Orientation applies to a component, not group "${target}".`,
            node.range,
          );
          return;
        }
        instance.orientation = node.hintValue as Orientation;
        this.notYetHonored(node);
        return;
      }
      case "side": {
        if (!SIDES.includes(node.hintValue as Side)) {
          this.invalidValue(node);
          return;
        }
        if (instance) instance.side = node.hintValue as Side;
        else if (group) group.side = node.hintValue as Side;
        this.notYetHonored(node);
        return;
      }
      case "anchor": {
        if (node.hintValue !== "center") {
          this.invalidValue(node);
          return;
        }
        if (!instance) {
          this.report(
            "warning",
            DiagnosticCodes.renderInvalidValue,
            `Anchor applies to a component, not group "${target}".`,
            node.range,
          );
          return;
        }
        instance.anchorCenter = true;
        this.notYetHonored(node);
        return;
      }
      default:
        this.report(
          "warning",
          DiagnosticCodes.renderUnknownKey,
          `Unknown render hint "${node.hintKey}".`,
          node.range,
        );
    }
  }

  private invalidValue(node: RenderNode): void {
    this.report(
      "warning",
      DiagnosticCodes.renderInvalidValue,
      `Invalid value "${node.hintValue}" for render hint "${node.hintKey}".`,
      node.range,
    );
  }

  /**
   * Flag a hint that the compiler accepts and records on the model, but the
   * bundled renderer does not yet position by. Keeps authors from assuming a
   * silent no-op worked. See docs/MVP.md "Render Hints".
   */
  private notYetHonored(node: RenderNode): void {
    this.report(
      "warning",
      DiagnosticCodes.renderNotYetHonored,
      `Render hint "${node.hintKey}" is accepted but the bundled renderer does not position by it yet.`,
      node.range,
    );
  }

  // ---- disconnected subschematics ------------------------------------------

  private warnDisconnected(): void {
    if (this.instances.length < 2) return;
    const count = countConnectedSubschematics(
      this.instances.map((instance) => instance.id),
      this.nets.map((net) => net.members.map((member) => member.component)),
    );
    if (count > 1) {
      this.report(
        "warning",
        DiagnosticCodes.schematicDisconnected,
        `Schematic has ${count} disconnected subschematics.`,
        null,
      );
    }
  }

  // ---- assembly ------------------------------------------------------------

  private buildModel(): SchematicModel {
    const components: ComponentInstance[] = this.instances.map((instance) => ({
      id: instance.id,
      typeName: instance.typeName,
      type: instance.type,
      terminals: instance.terminals,
      properties: instance.properties,
      labels: instance.labels,
      group: instance.group,
      local: instance.local,
      symbol: instance.symbol,
      roleMappings: instance.roleMappings,
      pins: instance.pins,
      sourceIndex: instance.sourceIndex,
      orientation: instance.orientation,
      side: instance.side,
      anchorCenter: instance.anchorCenter,
    }));

    const nets: Net[] = this.nets.map((net) => ({
      name: net.name,
      anonymous: net.anonymous,
      members: net.members,
      style: net.style,
      sourceIndex: net.sourceIndex,
    }));

    const groups: Group[] = this.groups.map((group) => ({
      name: group.name,
      members: group.members,
      side: group.side,
    }));

    const localDefinitions: LocalComponentDef[] = [...this.localDefs.values()];

    return {
      title: this.title,
      description: this.description,
      languageVersion: LANGUAGE_VERSION,
      direction: this.direction,
      crossings: this.crossings,
      layout: this.layoutMode,
      components,
      localDefinitions,
      nets,
      groups,
      annotations: this.annotations.map((annotation) => ({ ...annotation })),
      noConnects: this.noConnects.map((noConnect) => ({ ...noConnect })),
      diagnostics: this.diagnostics,
    };
  }

  private report(
    severity: DiagnosticSeverity,
    code: string,
    message: string,
    range: SourceRange | null,
  ): void {
    this.diagnostics.push({ severity, code, message, range });
  }
}

interface MutableInstance {
  id: string;
  typeName: string;
  type: ComponentTypeDef | null;
  terminals: string[];
  properties: NormalizedProperty[];
  labels: string[];
  group: string | null;
  local: boolean;
  symbol: string;
  roleMappings: SymbolRoleMapping[];
  pins?: readonly IcPin[];
  sourceIndex: number;
  orientation: Orientation | null;
  side: Side | null;
  anchorCenter: boolean;
}

interface MutableGroup {
  name: string;
  members: string[];
  side: Side | null;
}

/** Compile `.wire` source or a parsed document into a schematic model. */
export function compile(input: string | DocumentNode): CompileResult {
  if (typeof input === "string") {
    const parsed = parseDocument(input);
    return new Compiler().compile(parsed.ast, parsed.diagnostics);
  }
  return new Compiler().compile(input, []);
}
