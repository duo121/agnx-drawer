import {deflateRawSync} from "zlib";

type AnyObject = Record<string, any>;

export type DiagramType = "activity" | "sequence" | "state" | "mindmap" | "er" | "deployment" | "usecase" | "class";

export interface ParsedDiagram {
  type: DiagramType;
  classes: any[];
  relations: any[];
  actors?: any[];
  usecases?: any[];
  messages?: any[];
  groups?: any[];
  components?: any[];
  nodes?: any[];
  notes?: any[];
  activities?: any[];
  sequences?: any[];
  participants?: any[];
  states?: any[];
  mindmap?: any[];
  entities?: any[];
  relationships?: any[];
  deployments?: any[];
  swimlanes?: any[];
  partitions?: any[];
  connections?: any[];
  transitions?: any[];
  rectangles?: any[];
}

export class PlantUMLParser {
  input: string;
  classes: any[];
  relations: any[];
  actors: any[];
  usecases: any[];
  components: any[];
  nodes: any[];
  notes: any[];
  activities: any[];
  sequences: any[];
  participants: any[];
  states: any[];
  mindmap: any[];
  entities: any[];
  deployments: any[];
  swimlanes: any[];
  partitions: any[];
  diagramType: DiagramType;

  constructor(input: string) {
    this.input = input;
    this.classes = [];
    this.relations = [];
    this.actors = [];
    this.usecases = [];
    this.components = [];
    this.nodes = [];
    this.notes = [];
    this.activities = [];
    this.sequences = [];
    this.participants = [];
    this.states = [];
    this.mindmap = [];
    this.entities = [];
    this.deployments = [];
    this.swimlanes = [];
    this.partitions = [];
    this.diagramType = "class";
  }

  parse(): ParsedDiagram {
    const lines = this.input
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("'"));
    this.diagramType = this.detectDiagramType(lines);

    switch (this.diagramType) {
      case "activity":
        return this.parseActivityDiagram(lines);
      case "sequence":
        return this.parseSequenceDiagram(lines);
      case "state":
        return this.parseStateDiagram(lines);
      case "mindmap":
        return this.parseMindMap(lines);
      case "er":
        return this.parseERDiagram(lines);
      case "deployment":
        return this.parseDeploymentDiagram(lines);
      case "usecase":
        return this.parseUseCaseDiagram(lines);
      default:
        return this.parseClassDiagram(lines);
    }
  }

  detectDiagramType(lines: string[]): DiagramType {
    const input = this.input.toLowerCase();
    const rawInput = this.input;

    // Check for sequence diagram FIRST - has participant or actor with -> messages
    // Key: sequence diagrams have "A -> B : message" pattern
    if (
      lines.some((l) => /^[\w"]+\s*-+>+\s*[\w"]+\s*:/.test(l)) ||
      (input.includes("participant ") && input.includes(" -> ")) ||
      (input.includes("actor ") && input.includes(" -> ") && lines.some((l) => /^\w+\s*-+>\s*\w+\s*:/.test(l)))
    ) {
      return "sequence";
    }

    // Check for usecase diagram - actor with usecase or rectangle (but NOT sequence messages)
    if (
      input.includes("actor ") &&
      (input.includes("usecase ") || input.includes("rectangle ")) &&
      !lines.some((l) => /^\w+\s*-+>\s*\w+\s*:/.test(l))
    ) {
      return "usecase";
    }

    // Check for activity diagram
    if (
      (input.includes("start") && (input.includes("stop") || (rawInput.includes(":") && rawInput.includes(";")))) ||
      lines.some((l) => /^:.*;\s*$/.test(l)) ||
      (input.includes("if (") && input.includes("endif"))
    ) {
      return "activity";
    }

    // Check for state diagram
    if (input.includes("[*]") || (input.includes("state ") && lines.some((l) => /--?>/.test(l)))) {
      return "state";
    }

    if (input.includes("@startmindmap")) return "mindmap";
    if (input.includes("entity ") || input.includes("}|") || input.includes("|{")) return "er";
    if (input.includes("database ") || input.includes("cloud ") || input.includes("artifact ")) return "deployment";

    return "class";
  }

  // ==================== Activity Diagram ====================
  parseActivityDiagram(lines: string[]): ParsedDiagram {
    const activities: AnyObject[] = [];
    const edges: AnyObject[] = [];
    const swimlanes: AnyObject[] = [];
    const partitions: AnyObject[] = [];
    let nodeId = 0;
    let stack: AnyObject[] = [];
    let noteBuffer: string[] = [];
    let inNote = false;
    let currentSwimlane: AnyObject | null = null;
    const swimlaneMap = new Map<string, AnyObject>();
    let partitionStack: AnyObject[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (
        line.startsWith("@") ||
        line.startsWith("!") ||
        line.startsWith("skinparam") ||
        line.startsWith("title") ||
        line === ""
      )
        continue;

      // Multi-line notes
      if (line.startsWith("note ")) {
        inNote = true;
        noteBuffer = [line.replace(/note\s+(left|right|top|bottom)/, "").trim()];
        continue;
      }
      if (line === "end note") {
        inNote = false;
        if (activities.length > 0) {
          activities[activities.length - 1].note = noteBuffer.join("\n").replace(/^\s+/gm, "");
        }
        noteBuffer = [];
        continue;
      }
      if (inNote) {
        noteBuffer.push(line);
        continue;
      }

      // Swimlane
      const swimlaneMatch = line.match(/^\|(?:#(\w+)\|)?([^|]+)\|$/);
      if (swimlaneMatch) {
        const color = swimlaneMatch[1] || null;
        const label = swimlaneMatch[2].trim();
        if (!swimlaneMap.has(label)) {
          const swimlane: AnyObject = {id: swimlanes.length, label, color, startIndex: activities.length};
          swimlanes.push(swimlane);
          swimlaneMap.set(label, swimlane);
        }
        currentSwimlane = swimlaneMap.get(label) || null;
        continue;
      }

      // Partition
      const partitionMatch = line.match(/^partition\s+"?([^"{]+)"?\s*\{?$/);
      if (partitionMatch) {
        const partition: AnyObject = {
          id: partitions.length,
          label: partitionMatch[1].trim(),
          startIndex: activities.length,
          endIndex: -1,
        };
        partitions.push(partition);
        partitionStack.push(partition);
        continue;
      }
      if (line === "}" && partitionStack.length > 0) {
        const popped = partitionStack.pop();
        if (popped) popped.endIndex = activities.length;
        continue;
      }

      const currentPartition = partitionStack.length > 0 ? partitionStack[partitionStack.length - 1] : null;
      const baseProps = {
        swimlane: currentSwimlane ? currentSwimlane.id : null,
        partition: currentPartition ? currentPartition.id : null,
      };

      if (line === "start") {
        activities.push({id: nodeId++, type: "start", label: "Start", ...baseProps});
        continue;
      }
      if (line === "stop" || line === "end") {
        activities.push({id: nodeId++, type: "end", label: "End", ...baseProps});
        continue;
      }
      if (line === "fork" || line === "fork again" || line === "end fork") {
        activities.push({id: nodeId++, type: "fork", label: "", ...baseProps});
        continue;
      }

      // Activity :text;
      const activityMatch = line.match(/^:(.+);$/);
      if (activityMatch) {
        activities.push({id: nodeId++, type: "action", label: activityMatch[1].trim(), ...baseProps});
        continue;
      }

      // If condition
      const ifMatch = line.match(/^if\s*\((.+)\)\s*then\s*\((.+)\)$/);
      if (ifMatch) {
        const id = nodeId++;
        activities.push({id, type: "decision", label: ifMatch[1].trim(), yesBranch: ifMatch[2].trim(), ...baseProps});
        stack.push({type: "if", id, branches: [{label: ifMatch[2].trim(), startIndex: activities.length}]});
        continue;
      }

      // Elseif
      const elseifMatch = line.match(/^elseif\s*\((.+)\)\s*then\s*\((.+)\)$/);
      if (elseifMatch && stack.length > 0) {
        const current = stack[stack.length - 1];
        activities.push({
          id: nodeId++,
          type: "elseif_marker",
          label: elseifMatch[2].trim(),
          condition: elseifMatch[1].trim(),
          relatedDecision: current.id,
          ...baseProps,
        });
        current.branches.push({label: elseifMatch[2].trim(), startIndex: activities.length});
        continue;
      }

      // Else
      const elseMatch = line.match(/^else\s*\((.+)\)$/);
      if (elseMatch && stack.length > 0) {
        const current = stack[stack.length - 1];
        activities.push({
          id: nodeId++,
          type: "else_marker",
          label: elseMatch[1].trim(),
          relatedDecision: current.id,
          ...baseProps,
        });
        current.branches.push({label: elseMatch[1].trim(), startIndex: activities.length});
        continue;
      }

      if (line === "endif" && stack.length > 0) {
        const finished = stack.pop();
        if (finished) {
          activities.push({id: nodeId++, type: "merge", label: "", relatedDecision: finished.id, ...baseProps});
        }
        continue;
      }

      // While
      const whileMatch = line.match(/^while\s*\((.+)\)\s*(?:is\s*\((.+)\))?$/);
      if (whileMatch) {
        activities.push({
          id: nodeId++,
          type: "decision",
          label: whileMatch[1],
          yesBranch: whileMatch[2] || "yes",
          ...baseProps,
        });
        continue;
      }
      if (line.startsWith("endwhile")) {
        activities.push({id: nodeId++, type: "merge", label: "", ...baseProps});
        continue;
      }
    }

    this.buildActivityEdges(activities, edges);
    return {
      type: "activity",
      activities,
      relations: edges,
      swimlanes,
      partitions,
      classes: [],
      actors: [],
      usecases: [],
      components: [],
      nodes: [],
      notes: [],
    };
  }

  buildActivityEdges(activities: any[], edges: any[]) {
    const decisionMergeMap = new Map<number, number>();
    for (const act of activities) {
      if (act.type === "merge" && act.relatedDecision !== undefined) {
        decisionMergeMap.set(act.relatedDecision, act.id);
      }
    }

    for (let i = 0; i < activities.length - 1; i++) {
      const current = activities[i];
      const next = activities[i + 1];

      if (current.type === "else_marker" || current.type === "elseif_marker") continue;

      if (current.type === "merge") {
        if (next && next.type !== "end") edges.push({from: current.id, to: next.id, label: ""});
        continue;
      }

      if (current.type === "decision") {
        edges.push({from: current.id, to: next.id, label: current.yesBranch || ""});
        for (let j = i + 1; j < activities.length; j++) {
          const act = activities[j];
          if ((act.type === "else_marker" || act.type === "elseif_marker") && act.relatedDecision === current.id) {
            if (j + 1 < activities.length) edges.push({from: current.id, to: activities[j + 1].id, label: act.label});
          }
        }
        continue;
      }

      if (next.type !== "else_marker" && next.type !== "elseif_marker") {
        edges.push({from: current.id, to: next.id, label: ""});
      } else {
        const mergeId = decisionMergeMap.get(next.relatedDecision);
        if (mergeId !== undefined) edges.push({from: current.id, to: mergeId, label: ""});
      }
    }
  }

  // ==================== Sequence Diagram ====================
  parseSequenceDiagram(lines: string[]): ParsedDiagram {
    const participants: AnyObject[] = [];
    const messages: AnyObject[] = [];
    const groups: AnyObject[] = [];
    const participantMap = new Map<string, AnyObject>();
    let msgId = 0;
    let currentGroup: AnyObject | null = null;
    let inAlt = false;
    let altStack: AnyObject[] = [];
    let noteBuffer: string[] = [];
    let inNote = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (
        line.startsWith("@") ||
        line.startsWith("!") ||
        line.startsWith("skinparam") ||
        line.startsWith("title") ||
        line.startsWith("hide")
      )
        continue;

      // Note handling
      if (line.startsWith("note ")) {
        inNote = true;
        noteBuffer = [line];
        continue;
      }
      if (line === "end note") {
        inNote = false;
        if (messages.length > 0) messages[messages.length - 1].note = noteBuffer.join("\n");
        noteBuffer = [];
        continue;
      }
      if (inNote) {
        noteBuffer.push(line);
        continue;
      }

      // Group separator: == Title ==
      const groupMatch = line.match(/^==\s*(.+)\s*==$/);
      if (groupMatch) {
        groups.push({label: groupMatch[1].trim(), startIndex: messages.length});
        continue;
      }

      // Alt/else/end blocks
      if (line.startsWith("alt ")) {
        altStack.push({type: "alt", label: line.replace("alt ", "").trim(), startIndex: messages.length});
        continue;
      }
      if (line.startsWith("else")) {
        if (altStack.length > 0) altStack[altStack.length - 1].elseIndex = messages.length;
        continue;
      }
      if (line === "end") {
        if (altStack.length > 0) altStack.pop();
        continue;
      }

      // Participant/Actor
      const participantMatch =
        line.match(/^(participant|actor)\s+"([^"]+)"\s+as\s+(\w+)/i) ||
        line.match(/^(participant|actor)\s+(\w+)(?:\s+as\s+(\w+))?/i);
      if (participantMatch) {
        const type = participantMatch[1].toLowerCase();
        const label = participantMatch[2];
        const name = participantMatch[3] || participantMatch[2];
        if (!participantMap.has(name)) {
          participantMap.set(name, {name, label, type});
          participants.push({name, label, type});
        }
        continue;
      }

      // Message: A -> B : text or A ->> B : text
      const messageMatch = line.match(/^("?[^"]+?"?)\s*([-<>\.]+)\s*("?[^"]+?"?)\s*:\s*(.*)$/);
      if (messageMatch) {
        let from = messageMatch[1].replace(/"/g, "").trim();
        const arrow = messageMatch[2];
        let to = messageMatch[3].replace(/"/g, "").trim();
        const text = messageMatch[4].trim();

        [from, to].forEach((p) => {
          if (!participantMap.has(p)) {
            participantMap.set(p, {name: p, label: p, type: "participant"});
            participants.push({name: p, label: p, type: "participant"});
          }
        });

        messages.push({
          id: msgId++,
          from,
          to,
          text,
          isReturn: arrow.includes("<") || arrow.includes("--"),
          isAsync: arrow.includes(">>"),
          isDashed: arrow.includes("--") || arrow.includes(".."),
        });
      }
    }

    return {
      type: "sequence",
      participants,
      messages,
      groups,
      notes: this.notes,
      classes: [],
      actors: [],
      usecases: [],
      components: [],
      nodes: [],
      activities: [],
      relations: [],
    };
  }

  // ==================== State Diagram ====================
  parseStateDiagram(lines: string[]): ParsedDiagram {
    const states = [];
    const transitions = [];
    const stateMap = new Map();
    let stateId = 0;
    let noteBuffer = [];
    let inNote = false;
    let noteTarget = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (
        line.startsWith("@") ||
        line.startsWith("!") ||
        line.startsWith("skinparam") ||
        line.startsWith("title") ||
        line.startsWith("hide") ||
        line === ""
      )
        continue;

      // Note handling
      const noteStartMatch = line.match(/^note\s+(left|right)\s+of\s+(\w+)/);
      if (noteStartMatch || line.startsWith("note ")) {
        inNote = true;
        noteTarget = noteStartMatch ? noteStartMatch[2] : null;
        noteBuffer = [];
        continue;
      }
      if (line === "end note") {
        inNote = false;
        if (noteTarget && stateMap.has(noteTarget)) {
          stateMap.get(noteTarget).note = noteBuffer.join("\n");
        }
        noteBuffer = [];
        noteTarget = null;
        continue;
      }
      if (inNote) {
        noteBuffer.push(line);
        continue;
      }

      // State with label: state "Label" as Name
      const stateMatch = line.match(/^state\s+"([^"]+)"\s+as\s+(\w+)/);
      if (stateMatch) {
        if (!stateMap.has(stateMatch[2])) {
          const state = {id: stateId++, name: stateMatch[2], label: stateMatch[1], type: "state"};
          stateMap.set(stateMatch[2], state);
          states.push(state);
        }
        continue;
      }

      // Simple state: state StateName
      const simpleStateMatch = line.match(/^state\s+(\w+)(?:\s*\{)?$/);
      if (simpleStateMatch) {
        if (!stateMap.has(simpleStateMatch[1])) {
          const state = {id: stateId++, name: simpleStateMatch[1], label: simpleStateMatch[1], type: "state"};
          stateMap.set(simpleStateMatch[1], state);
          states.push(state);
        }
        continue;
      }

      // Transition: [*] --> State or State --> State : label
      const transMatch = line.match(
        /^(\[\*\]|[\u4e00-\u9fa5\w]+)\s*([-]+>)\s*(\[\*\]|[\u4e00-\u9fa5\w]+)(?:\s*:\s*(.+))?$/
      );
      if (transMatch) {
        const from = transMatch[1];
        const to = transMatch[3];
        const label = transMatch[4] || "";

        [
          {s: from, isFrom: true},
          {s: to, isFrom: false},
        ].forEach(({s, isFrom}) => {
          if (s === "[*]") {
            const key = isFrom ? "[*]_start" : "[*]_end";
            if (!stateMap.has(key)) {
              stateMap.set(key, {
                id: stateId++,
                name: s,
                label: isFrom ? "Start" : "End",
                type: isFrom ? "start" : "end",
              });
              states.push(stateMap.get(key));
            }
          } else if (!stateMap.has(s)) {
            const state = {id: stateId++, name: s, label: s, type: "state"};
            stateMap.set(s, state);
            states.push(state);
          }
        });

        transitions.push({from, to, label});
      }
    }

    return {
      type: "state",
      states,
      transitions,
      classes: [],
      actors: [],
      usecases: [],
      components: [],
      nodes: [],
      activities: [],
      relations: [],
      notes: [],
    };
  }

  // ==================== Use Case Diagram ====================
  parseUseCaseDiagram(lines: string[]): ParsedDiagram {
    const actors: AnyObject[] = [];
    const usecases: AnyObject[] = [];
    const relations: AnyObject[] = [];
    const rectangles: AnyObject[] = [];
    const actorMap = new Map<string, AnyObject>();
    const usecaseMap = new Map<string, AnyObject>();
    let currentRectangle: AnyObject | null = null;
    let rectStack: AnyObject[] = [];

    for (const line of lines) {
      if (
        line.startsWith("@") ||
        line.startsWith("!") ||
        line.startsWith("skinparam") ||
        line.startsWith("title") ||
        line.startsWith("hide") ||
        line === ""
      )
        continue;

      // Rectangle container
      const rectMatch = line.match(/^rectangle\s+"([^"]+)"\s*\{?$/);
      if (rectMatch) {
        const rect = {label: rectMatch[1], usecases: []};
        rectangles.push(rect);
        rectStack.push(rect);
        currentRectangle = rect;
        continue;
      }
      if (line === "}" && rectStack.length > 0) {
        rectStack.pop();
        currentRectangle = rectStack.length > 0 ? rectStack[rectStack.length - 1] : null;
        continue;
      }

      // Actor: actor "Label" as name or actor name
      const actorMatch = line.match(/^actor\s+"([^"]+)"\s+as\s+(\w+)/i) || line.match(/^actor\s+(\w+)/i);
      if (actorMatch) {
        const label = actorMatch[1];
        const name = actorMatch[2] || actorMatch[1];
        if (!actorMap.has(name)) {
          actorMap.set(name, {name, label});
          actors.push({name, label});
        }
        continue;
      }

      // Usecase: usecase "Label" as name or (Label) as name
      const usecaseMatch =
        line.match(/^usecase\s+"([^"]+)"\s+as\s+(\w+)/i) ||
        line.match(/^usecase\s+"?([^"]+)"?/i) ||
        line.match(/^\(([^)]+)\)\s*(?:as\s+(\w+))?/);
      if (usecaseMatch) {
        const label = usecaseMatch[1];
        const name = usecaseMatch[2] || usecaseMatch[1].replace(/\s+/g, "_");
        if (!usecaseMap.has(name)) {
          usecaseMap.set(name, {name, label, rectangle: currentRectangle ? currentRectangle.label : null});
          usecases.push({name, label, rectangle: currentRectangle ? currentRectangle.label : null});
          if (currentRectangle) currentRectangle.usecases.push(name);
        }
        continue;
      }

      // Relation: actor --> usecase or actor -- usecase
      const relMatch = line.match(/^(\w+)\s*([-\.]+>?)\s*(\w+|\([^)]+\))(?:\s*:\s*(.+))?$/);
      if (relMatch) {
        let from = relMatch[1];
        let to = relMatch[3].replace(/[()]/g, "");
        const label = relMatch[4] || "";
        const arrow = relMatch[2];

        // Auto-add actors/usecases
        if (!actorMap.has(from) && !usecaseMap.has(from)) {
          if (from.match(/^[A-Z]/) || from.includes("用户") || from.includes("员")) {
            actorMap.set(from, {name: from, label: from});
            actors.push({name: from, label: from});
          }
        }
        if (!usecaseMap.has(to) && !actorMap.has(to)) {
          usecaseMap.set(to, {name: to, label: to, rectangle: null});
          usecases.push({name: to, label: to, rectangle: null});
        }

        relations.push({from, to, label, type: arrow.includes(">") ? "association" : "link"});
      }
    }

    return {
      type: "usecase",
      actors,
      usecases,
      relations,
      rectangles,
      classes: [],
      components: [],
      nodes: [],
      activities: [],
      notes: [],
    };
  }

  // ==================== Mind Map ====================
  parseMindMap(lines: string[]): ParsedDiagram {
    const nodes: AnyObject[] = [];
    let nodeId = 0;
    const lastNodeByLevel: Record<number, number> = {};

    for (const line of lines) {
      if (
        line.startsWith("@") ||
        line.startsWith("!") ||
        line.startsWith("skinparam") ||
        line === "" ||
        line.startsWith("title")
      )
        continue;

      const levelMatch = line.match(/^([+\-*]+)\s*(.+)$/);
      if (levelMatch) {
        const level = levelMatch[1].length;
        const text = levelMatch[2].trim();
        const isRight = levelMatch[1].includes("+");
        const node = {
          id: nodeId++,
          text,
          level,
          side: isRight ? "right" : "left",
          parent: level > 1 ? lastNodeByLevel[level - 1] : null,
        };
        nodes.push(node);
        lastNodeByLevel[level] = node.id;
      }
    }

    return {
      type: "mindmap",
      mindmap: nodes,
      classes: [],
      actors: [],
      usecases: [],
      components: [],
      nodes: [],
      activities: [],
      relations: [],
      notes: [],
    };
  }

  // ==================== ER Diagram ====================
  parseERDiagram(lines: string[]): ParsedDiagram {
    const entities: AnyObject[] = [];
    const relationships: AnyObject[] = [];
    const entityMap = new Map<string, AnyObject>();
    let entityId = 0;
    let currentEntity: AnyObject | null = null;

    for (const line of lines) {
      if (
        line.startsWith("@") ||
        line.startsWith("!") ||
        line.startsWith("skinparam") ||
        line.startsWith("title") ||
        line.startsWith("hide")
      )
        continue;

      const entityMatch = line.match(/^entity\s+"?([^"{\s]+)"?\s*(?:as\s+(\w+))?\s*\{?$/);
      if (entityMatch) {
        const name = entityMatch[2] || entityMatch[1];
        currentEntity = {id: entityId++, name, label: entityMatch[1], attributes: []};
        entityMap.set(name, currentEntity);
        entities.push(currentEntity);
        continue;
      }

      if (line === "}") {
        currentEntity = null;
        continue;
      }

      if (currentEntity && line && !line.includes("--") && !line.includes("..")) {
        const attrMatch = line.match(/^\*?\s*([^:]+)(?:\s*:\s*(.+))?$/);
        if (attrMatch) {
          currentEntity.attributes.push({
            name: attrMatch[1].replace("*", "").trim(),
            type: attrMatch[2] || "",
            isPrimaryKey: line.startsWith("*"),
          });
        }
        continue;
      }

      const relMatch = line.match(/^(\w+)\s*([|o{}\[\]]+[-\.]+[|o{}\[\]]+)\s*(\w+)(?:\s*:\s*(.+))?$/);
      if (relMatch) {
        [relMatch[1], relMatch[3]].forEach((e) => {
          if (!entityMap.has(e)) {
            const ent = {id: entityId++, name: e, label: e, attributes: []};
            entityMap.set(e, ent);
            entities.push(ent);
          }
        });
        relationships.push({from: relMatch[1], to: relMatch[3], label: relMatch[4] || "", fromCard: "1", toCard: "n"});
      }
    }

    return {
      type: "er",
      entities,
      relationships,
      classes: [],
      actors: [],
      usecases: [],
      components: [],
      nodes: [],
      activities: [],
      relations: [],
      notes: [],
    };
  }

  // ==================== Deployment Diagram ====================
  parseDeploymentDiagram(lines: string[]): ParsedDiagram {
    const deployments: AnyObject[] = [];
    const connections: AnyObject[] = [];
    const nodeMap = new Map<string, AnyObject>();
    let nodeId = 0;

    for (const line of lines) {
      if (
        line.startsWith("@") ||
        line.startsWith("!") ||
        line.startsWith("skinparam") ||
        line.startsWith("title") ||
        line.startsWith("hide")
      )
        continue;

      const nodeMatch =
        line.match(
          /^(node|database|cloud|artifact|folder|frame|package|rectangle|storage)\s+"([^"]+)"\s+as\s+(\w+)/i
        ) ||
        line.match(/^(node|database|cloud|artifact|folder|frame|package|rectangle|storage)\s+"?([^"{\s]+)"?\s*\{?$/i);
      if (nodeMatch) {
        const type = nodeMatch[1].toLowerCase();
        const label = nodeMatch[2];
        const name = nodeMatch[3] || label;
        if (!nodeMap.has(name)) {
          const node = {id: nodeId++, name, label, type};
          nodeMap.set(name, node);
          deployments.push(node);
        }
        continue;
      }

      const connMatch = line.match(/^(\w+)\s*([-\.]+>?)\s*(\w+)(?:\s*:\s*(.+))?$/);
      if (connMatch) {
        [connMatch[1], connMatch[3]].forEach((n) => {
          if (!nodeMap.has(n)) {
            const node = {id: nodeId++, name: n, label: n, type: "node"};
            nodeMap.set(n, node);
            deployments.push(node);
          }
        });
        connections.push({
          from: connMatch[1],
          to: connMatch[3],
          label: connMatch[4] || "",
          isDashed: connMatch[2].includes("."),
        });
      }
    }

    return {
      type: "deployment",
      deployments,
      connections,
      classes: [],
      actors: [],
      usecases: [],
      components: [],
      nodes: [],
      activities: [],
      relations: [],
      notes: [],
    };
  }

  // ==================== Class Diagram ====================
  parseClassDiagram(lines: string[]): ParsedDiagram {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith("@") || line.startsWith("skinparam") || line.startsWith("hide") || line.startsWith("show"))
        continue;

      if (
        line.startsWith("class ") ||
        line.startsWith("interface ") ||
        line.startsWith("abstract ") ||
        line.startsWith("enum ")
      ) {
        const classData = this.parseClass(lines, i);
        if (classData) {
          this.classes.push(classData.classObj);
          i = classData.endIndex;
        }
        continue;
      }

      if (line.startsWith("actor ")) {
        const match = line.match(/actor\s+"?([^"]+)"?\s*(?:as\s+(\w+))?/);
        if (match) this.actors.push({name: match[2] || match[1], label: match[1]});
        continue;
      }

      const relation = this.parseRelation(line);
      if (relation) this.relations.push(relation);
    }

    return {
      type: this.diagramType,
      classes: this.classes,
      relations: this.relations,
      actors: this.actors,
      usecases: this.usecases,
      components: this.components,
      nodes: this.nodes,
      notes: this.notes,
      activities: this.activities,
    };
  }

  parseClass(lines: string[], startIndex: number): {classObj: any; endIndex: number} | null {
    const line = lines[startIndex];
    const typeMatch = line.match(/^(class|interface|abstract|enum)\s+/);
    const type = typeMatch ? typeMatch[1] : "class";
    const nameMatch = line.match(/(?:class|interface|abstract|enum)\s+"?([^"{\s]+)"?/);
    if (!nameMatch) return null;

    const classObj: AnyObject = {name: nameMatch[1], type, attributes: [] as AnyObject[], methods: [] as AnyObject[]};

    if (line.includes("{")) {
      let i = startIndex + 1;
      while (i < lines.length && !lines[i].startsWith("}")) {
        const memberLine = lines[i].trim();
        if (memberLine && memberLine !== "{") {
          const member = this.parseMember(memberLine);
          if (member) {
            if (member.isMethod) classObj.methods.push(member);
            else classObj.attributes.push(member);
          }
        }
        i++;
      }
      return {classObj, endIndex: i};
    }
    return {classObj, endIndex: startIndex};
  }

  parseMember(line: string): {visibility: string; name: string; type: string; isMethod: boolean} {
    const visibilityMatch = line.match(/^([+\-#~])\s*/);
    const visibility = visibilityMatch ? visibilityMatch[1] : "+";
    const content = line.replace(/^[+\-#~]\s*/, "").trim();
    const isMethod = content.includes("(");
    let name, type;
    if (content.includes(":")) {
      const parts = content.split(":");
      name = parts[0].trim();
      type = parts[1].trim();
    } else {
      name = content;
      type = "";
    }
    return {visibility, name, type, isMethod};
  }

  parseRelation(line: string) {
    const patterns = [
      {regex: /(\w+)\s*<\|[-.]+(.*?)(\w+)/, type: "extends", from: 3, to: 1},
      {regex: /(\w+)\s*[-.]+(.*?)\|>\s*(\w+)/, type: "extends", from: 1, to: 3},
      {regex: /(\w+)\s*<\|\.\.+(.*?)(\w+)/, type: "implements", from: 3, to: 1},
      {regex: /(\w+)\s*\*[-.]+(.*?)(\w+)/, type: "composition", from: 1, to: 3},
      {regex: /(\w+)\s*o[-.]+(.*?)(\w+)/, type: "aggregation", from: 1, to: 3},
      {regex: /(\w+)\s*[-]+>\s*(\w+)(?:\s*:\s*(.+))?/, type: "association", from: 1, to: 2, label: 3},
      {regex: /(\w+)\s*\.+>\s*(\w+)(?:\s*:\s*(.+))?/, type: "dependency", from: 1, to: 2, label: 3},
      {regex: /(\w+)\s*--\s*(\w+)(?:\s*:\s*(.+))?/, type: "association", from: 1, to: 2, label: 3},
    ];
    for (const pattern of patterns) {
      const match = line.match(pattern.regex);
      if (match)
        return {
          from: match[pattern.from],
          to: match[pattern.to],
          type: pattern.type,
          label: pattern.label ? (match[pattern.label] || "").trim() : "",
        };
    }
    return null;
  }
}

// ==================== Draw.io Generator ====================
export class DrawioGenerator {
  data: ParsedDiagram;
  nodePositions: Map<any, any>;
  cellId: number;
  idPrefix: string;

  constructor(parsedData: ParsedDiagram) {
    this.data = parsedData;
    this.nodePositions = new Map();
    this.cellId = 2;
    this.idPrefix = this.generateIdPrefix();
  }

  // Generate random prefix like draw.io does
  generateIdPrefix(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < 20; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // Get next unique ID in draw.io format
  nextId(): string {
    return `${this.idPrefix}-${this.cellId++}`;
  }

  // Helper: create vertex mxCell with correct attribute order (matching draw.io export)
  createVertex(
    id: string,
    value: string,
    style: string,
    x: number,
    y: number,
    width: number,
    height: number,
    parent = "1"
  ): string {
    return `<mxCell id="${id}" parent="${parent}" style="${style}" value="${this.escapeXml(value)}" vertex="1"><mxGeometry height="${height}" width="${width}" x="${x}" y="${y}" as="geometry" /></mxCell>`;
  }

  // Helper: create edge mxCell with source/target
  createEdge(id: string, value: string, style: string, sourceId: string, targetId: string, parent = "1"): string {
    return `<mxCell id="${id}" edge="1" parent="${parent}" source="${sourceId}" style="${style}" target="${targetId}" value="${this.escapeXml(value)}"><mxGeometry relative="1" as="geometry" /></mxCell>`;
  }

  // Helper: create edge with points (no source/target connection)
  createEdgeWithPoints(
    id: string,
    value: string,
    style: string,
    sourceX: number,
    sourceY: number,
    targetX: number,
    targetY: number,
    parent = "1"
  ): string {
    return `<mxCell id="${id}" edge="1" parent="${parent}" style="${style}" value="${this.escapeXml(value)}"><mxGeometry relative="1" as="geometry"><mxPoint x="${sourceX}" y="${sourceY}" as="sourcePoint" /><mxPoint x="${targetX}" y="${targetY}" as="targetPoint" /></mxGeometry></mxCell>`;
  }

  generate(compressed = false): string {
    let xml = "";
    switch (this.data.type) {
      case "activity":
        xml = this.generateActivityDiagram();
        break;
      case "sequence":
        xml = this.generateSequenceDiagram();
        break;
      case "state":
        xml = this.generateStateDiagram();
        break;
      case "mindmap":
        xml = this.generateMindMap();
        break;
      case "er":
        xml = this.generateERDiagram();
        break;
      case "deployment":
        xml = this.generateDeploymentDiagram();
        break;
      case "usecase":
        xml = this.generateUseCaseDiagram();
        break;
      default:
        xml = this.generateNodes() + this.generateEdges();
    }
    return this.wrapInDrawioFormat(xml, compressed);
  }

  // ==================== Activity Diagram ====================
  generateActivityDiagram(): string {
    let xml = "";
    const activities = this.data.activities || [];
    const swimlanes = this.data.swimlanes || [];
    const relations = this.data.relations || [];
    const hasSwimlanes = swimlanes.length > 0;
    const swimlaneWidth = 250;
    const nodeWidth = 140;
    const nodeHeight = 40;
    const spacing = 70;
    let startY = 40;

    if (hasSwimlanes) {
      let swimlaneX = 20;
      const swimlaneHeight = 100 + activities.length * spacing;
      for (const swimlane of swimlanes) {
        const id = this.nextId();
        const fillColor = swimlane.color || "#f5f5f5";
        xml += `        <mxCell id="${id}" value="${this.escapeXml(swimlane.label)}" style="swimlane;horizontal=0;whiteSpace=wrap;html=1;fillColor=${fillColor};strokeColor=#666666;startSize=30;" vertex="1" parent="1">
          <mxGeometry x="${swimlaneX}" y="${startY}" width="${swimlaneWidth}" height="${swimlaneHeight}" as="geometry"/>
        </mxCell>\n`;
        swimlane.cellId = id;
        swimlane.x = swimlaneX;
        swimlaneX += swimlaneWidth;
      }
      startY += 50;
    }

    const yPositions = new Map<number, number>();
    let currentY = startY;
    for (const activity of activities) {
      if (activity.type === "else_marker" || activity.type === "elseif_marker") continue;
      yPositions.set(activity.id, currentY);
      if (activity.type === "start" || activity.type === "end") currentY += 50;
      else if (activity.type === "decision") currentY += 80;
      else if (activity.type === "merge" || activity.type === "fork") currentY += 40;
      else currentY += spacing;
    }

    for (const activity of activities) {
      if (activity.type === "else_marker" || activity.type === "elseif_marker") continue;
      const id = this.nextId();
      const y = yPositions.get(activity.id) ?? 0;
      let x = 150;
      if (hasSwimlanes && activity.swimlane !== null && swimlanes[activity.swimlane]) {
        const lane = swimlanes[activity.swimlane];
        x = lane.x + swimlaneWidth / 2 - nodeWidth / 2 + 30;
      }
      this.nodePositions.set(activity.id, {id, x: x + nodeWidth / 2, y: y + nodeHeight / 2});

      switch (activity.type) {
        case "start":
          xml += `        <mxCell id="${id}" value="" style="ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#000000;strokeColor=#000000;" vertex="1" parent="1">
          <mxGeometry x="${x + nodeWidth / 2 - 15}" y="${y}" width="30" height="30" as="geometry"/>
        </mxCell>\n`;
          break;
        case "end":
          xml += `        <mxCell id="${id}" value="" style="ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#000000;strokeColor=#000000;strokeWidth=3;" vertex="1" parent="1">
          <mxGeometry x="${x + nodeWidth / 2 - 15}" y="${y}" width="30" height="30" as="geometry"/>
        </mxCell>\n`;
          xml += `        <mxCell id="${this.nextId()}" value="" style="ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=none;strokeColor=#000000;strokeWidth=2;" vertex="1" parent="1">
          <mxGeometry x="${x + nodeWidth / 2 - 20}" y="${y - 5}" width="40" height="40" as="geometry"/>
        </mxCell>\n`;
          break;
        case "action":
          const width = Math.max(nodeWidth, activity.label.length * 8 + 20);
          xml += `        <mxCell id="${id}" value="${this.escapeXml(activity.label)}" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="1">
          <mxGeometry x="${x}" y="${y}" width="${width}" height="${nodeHeight}" as="geometry"/>
        </mxCell>\n`;
          if (activity.note) {
            xml += `        <mxCell id="${this.nextId()}" value="${this.escapeXml(activity.note)}" style="shape=note;whiteSpace=wrap;html=1;backgroundOutline=1;fillColor=#fff2cc;strokeColor=#d6b656;size=14;align=left;spacingLeft=5;fontSize=10;" vertex="1" parent="1">
          <mxGeometry x="${x + width + 20}" y="${y - 10}" width="140" height="60" as="geometry"/>
        </mxCell>\n`;
          }
          break;
        case "decision":
          xml += `        <mxCell id="${id}" value="${this.escapeXml(activity.label)}" style="rhombus;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;" vertex="1" parent="1">
          <mxGeometry x="${x}" y="${y}" width="100" height="60" as="geometry"/>
        </mxCell>\n`;
          break;
        case "merge":
          xml += `        <mxCell id="${id}" value="" style="rhombus;whiteSpace=wrap;html=1;fillColor=#f5f5f5;strokeColor=#666666;" vertex="1" parent="1">
          <mxGeometry x="${x + nodeWidth / 2 - 15}" y="${y}" width="30" height="30" as="geometry"/>
        </mxCell>\n`;
          break;
        case "fork":
          xml += `        <mxCell id="${id}" value="" style="line;html=1;strokeWidth=4;fillColor=none;align=left;verticalAlign=middle;spacingTop=-1;spacingLeft=3;spacingRight=3;rotatable=0;labelPosition=right;points=[];portConstraint=eastwest;strokeColor=#000000;" vertex="1" parent="1">
          <mxGeometry x="${x}" y="${y}" width="100" height="10" as="geometry"/>
        </mxCell>\n`;
          break;
      }
    }

    for (const rel of relations) {
      const source = this.nodePositions.get(rel.from);
      const target = this.nodePositions.get(rel.to);
      if (source && target) {
        xml += `        <mxCell id="${this.nextId()}" value="${this.escapeXml(rel.label || "")}" style="endArrow=classic;html=1;rounded=0;" edge="1" parent="1">
          <mxGeometry relative="1" as="geometry">
            <mxPoint x="${source.x}" y="${source.y + 20}" as="sourcePoint"/>
            <mxPoint x="${target.x}" y="${target.y - 20}" as="targetPoint"/>
          </mxGeometry>
        </mxCell>\n`;
      }
    }
    return xml;
  }

  // ==================== Sequence Diagram ====================
  generateSequenceDiagram(): string {
    let xml = "";
    const participants = this.data.participants || [];
    const messages = this.data.messages || [];
    const groups = this.data.groups || [];
    const participantWidth = 100;
    const participantSpacing = 150;
    const messageSpacing = 50;
    const totalWidth = 50 + participants.length * participantSpacing;
    let y = 40;

    // Participants (rectangles at top)
    participants.forEach((p: AnyObject, index: number) => {
      const x = 50 + index * participantSpacing;
      const id = this.nextId();
      this.nodePositions.set(p.name, {id, x: x + participantWidth / 2, topY: y});
      const width = p.type === "actor" ? 30 : participantWidth;
      const height = p.type === "actor" ? 60 : 40;
      const style =
        p.type === "actor"
          ? "shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;"
          : "fillColor=#dae8fc;strokeColor=#6c8ebf;";
      xml += this.createVertex(id, p.label, style, x + (participantWidth - width) / 2, y, width, height);
      // Lifeline - vertical dashed line using edge
      const lifelineHeight = 100 + messages.length * messageSpacing;
      const lifelineX = x + participantWidth / 2;
      xml += this.createEdgeWithPoints(
        this.nextId(),
        "",
        "strokeColor=#999999;dashed=1;strokeWidth=1;endArrow=none;",
        lifelineX,
        y + height,
        lifelineX,
        y + height + lifelineHeight
      );
    });

    // Groups (== Title ==) - horizontal separator lines with labels
    if (groups.length > 0) {
      for (const group of groups) {
        const groupY = 100 + group.startIndex * messageSpacing;
        // Horizontal line spanning all participants
        xml += this.createVertex(
          this.nextId(),
          "",
          "strokeWidth=1;fillColor=none;strokeColor=#999999;",
          30,
          groupY,
          totalWidth,
          1
        );
        // Label for the separator
        xml += this.createVertex(
          this.nextId(),
          group.label,
          "text;strokeColor=none;fillColor=#e1d5e7;align=center;verticalAlign=middle;fontStyle=1;fontSize=11;",
          totalWidth / 2 - 60,
          groupY - 12,
          120,
          24
        );
      }
    }

    // Messages (arrows between participants)
    let msgY = 120;
    for (const msg of messages) {
      const fromPos = this.nodePositions.get(msg.from);
      const toPos = this.nodePositions.get(msg.to);
      if (!fromPos || !toPos) continue;
      const style = msg.isDashed
        ? "endArrow=open;strokeColor=#666666;endFill=0;rounded=0;dashed=1;"
        : "endArrow=block;strokeColor=#333333;endFill=1;rounded=0;";
      xml += this.createEdgeWithPoints(this.nextId(), msg.text, style, fromPos.x, msgY, toPos.x, msgY);
      msgY += messageSpacing;
    }
    return xml;
  }

  // ==================== State Diagram ====================
  generateStateDiagram(): string {
    let xml = "";
    const states = this.data.states || [];
    const transitions = this.data.transitions || [];
    let x = 100,
      y = 50;
    const spacing = 180;
    let count = 0;

    for (const state of states) {
      const id = this.nextId();
      this.nodePositions.set(state.name, {id, x, y});
      let style, width, height;
      if (state.type === "start") {
        style = "ellipse;fillColor=#000000;strokeColor=#000000;";
        width = height = 30;
      } else if (state.type === "end") {
        style = "ellipse;fillColor=#000000;strokeColor=#000000;strokeWidth=3;";
        width = height = 30;
      } else {
        style = "rounded=1;whiteSpace=wrap;fillColor=#dae8fc;strokeColor=#6c8ebf;";
        width = Math.max(120, state.label.length * 8 + 20);
        height = 50;
      }
      xml += this.createVertex(id, state.label, style, x, y, width, height);
      if (state.note) {
        xml += this.createVertex(
          this.nextId(),
          state.note,
          "shape=note;whiteSpace=wrap;size=17;fillColor=#fff2cc;strokeColor=#d6b656;",
          x + width + 10,
          y,
          120,
          60
        );
      }
      count++;
      if (count % 4 === 0) {
        x = 100;
        y += 100;
      } else {
        x += spacing;
      }
    }

    for (const trans of transitions) {
      let fromKey = trans.from === "[*]" ? "[*]_start" : trans.from;
      let toKey = trans.to === "[*]" ? "[*]_end" : trans.to;
      let source = this.nodePositions.get(fromKey) || this.nodePositions.get(trans.from);
      let target = this.nodePositions.get(toKey) || this.nodePositions.get(trans.to);
      if (!source || !target) continue;
      xml += this.createEdge(
        this.nextId(),
        trans.label,
        "endArrow=classic;strokeColor=#333333;rounded=0;",
        source.id,
        target.id
      );
    }
    return xml;
  }

  // ==================== Use Case Diagram ====================
  generateUseCaseDiagram(): string {
    let xml = "";
    const actors = this.data.actors || [];
    const usecases = this.data.usecases || [];
    const rectangles = this.data.rectangles || [];
    const relations = this.data.relations || [];
    let actorX = 50,
      actorY = 100;
    let usecaseX = 300,
      usecaseY = 50;
    const actorSpacing = 100;
    const usecaseSpacing = 80;

    // Rectangles
    if (rectangles.length > 0) {
      for (const rect of rectangles) {
        const height = Math.max(200, rect.usecases.length * usecaseSpacing + 50);
        xml += `        <mxCell id="${this.nextId()}" value="${this.escapeXml(rect.label)}" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#f5f5f5;strokeColor=#666666;verticalAlign=top;fontStyle=1;spacingTop=5;" vertex="1" parent="1">
          <mxGeometry x="250" y="30" width="300" height="${height}" as="geometry"/>
        </mxCell>\n`;
      }
    }

    // Actors
    for (const actor of actors) {
      const id = this.nextId();
      this.nodePositions.set(actor.name, {id, x: actorX + 15, y: actorY + 30});
      xml += `        <mxCell id="${id}" value="${this.escapeXml(actor.label)}" style="shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;outlineConnect=0;" vertex="1" parent="1">
          <mxGeometry x="${actorX}" y="${actorY}" width="30" height="60" as="geometry"/>
        </mxCell>\n`;
      actorY += actorSpacing;
    }

    // Usecases
    for (const uc of usecases) {
      const id = this.nextId();
      const rectOffset =
        uc.rectangle !== null && uc.rectangle !== undefined && rectangles[uc.rectangle]
          ? rectangles[uc.rectangle].offsetY || 0
          : 0;
      this.nodePositions.set(uc.name, {id, x: usecaseX + 60, y: usecaseY + rectOffset + 25});
      xml += `        <mxCell id="${id}" value="${this.escapeXml(uc.label)}" style="ellipse;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="1">
          <mxGeometry x="${usecaseX}" y="${usecaseY}" width="120" height="50" as="geometry"/>
        </mxCell>\n`;
      usecaseY += usecaseSpacing;
    }

    // Relations
    for (const rel of relations) {
      const source = this.nodePositions.get(rel.from);
      const target = this.nodePositions.get(rel.to);
      if (!source || !target) continue;
      xml += `        <mxCell id="${this.nextId()}" value="${this.escapeXml(rel.label || "")}" style="endArrow=none;html=1;rounded=0;" edge="1" parent="1">
          <mxGeometry relative="1" as="geometry">
            <mxPoint x="${source.x}" y="${source.y}" as="sourcePoint"/>
            <mxPoint x="${target.x}" y="${target.y}" as="targetPoint"/>
          </mxGeometry>
        </mxCell>\n`;
    }
    return xml;
  }

  // ==================== Mind Map ====================
  generateMindMap(): string {
    let xml = "";
    const mindmap = this.data.mindmap || [];
    const centerX = 400,
      centerY = 300;
    const levelSpacing = 180;
    const nodeHeight = 40;
    let rightY = centerY - 100,
      leftY = centerY - 100;

    for (const node of mindmap) {
      const id = this.nextId();
      let x,
        y,
        width = Math.max(100, node.text.length * 8 + 20);
      if (node.level === 1) {
        x = centerX - width / 2;
        y = centerY - nodeHeight / 2;
      } else {
        const offset = (node.level - 1) * levelSpacing;
        if (node.side === "right") {
          x = centerX + offset;
          y = rightY;
          rightY += 60;
        } else {
          x = centerX - offset - width;
          y = leftY;
          leftY += 60;
        }
      }
      this.nodePositions.set(node.id, {id, x: x + width / 2, y: y + nodeHeight / 2});
      const fillColor = node.level === 1 ? "#e1d5e7" : node.level === 2 ? "#dae8fc" : "#d5e8d4";
      const strokeColor = node.level === 1 ? "#9673a6" : node.level === 2 ? "#6c8ebf" : "#82b366";
      xml += `        <mxCell id="${id}" value="${this.escapeXml(node.text)}" style="rounded=1;whiteSpace=wrap;html=1;fillColor=${fillColor};strokeColor=${strokeColor};" vertex="1" parent="1">
          <mxGeometry x="${x}" y="${y}" width="${width}" height="${nodeHeight}" as="geometry"/>
        </mxCell>\n`;
      if (node.parent !== null) {
        const parentPos = this.nodePositions.get(node.parent);
        if (parentPos) {
          xml += `        <mxCell id="${this.nextId()}" value="" style="endArrow=none;html=1;rounded=1;curved=1;strokeColor=#666666;" edge="1" parent="1" source="${parentPos.id}" target="${id}">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>\n`;
        }
      }
    }
    return xml;
  }

  // ==================== ER Diagram ====================
  generateERDiagram(): string {
    let xml = "";
    const entities = this.data.entities || [];
    const relationships = this.data.relationships || [];
    let x = 50,
      y = 50;
    const spacing = 250;
    let count = 0;

    for (const entity of entities) {
      const id = this.nextId();
      const height = 30 + entity.attributes.length * 20;
      const width = 180;
      this.nodePositions.set(entity.name, {id, x: x + width / 2, y: y + height / 2});
      xml += `        <mxCell id="${id}" value="${this.escapeXml(entity.label)}" style="swimlane;fontStyle=1;align=center;verticalAlign=top;childLayout=stackLayout;horizontal=1;startSize=26;horizontalStack=0;resizeParent=1;resizeParentMax=0;resizeLast=0;collapsible=0;marginBottom=0;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="1">
          <mxGeometry x="${x}" y="${y}" width="${width}" height="${height}" as="geometry"/>
        </mxCell>\n`;
      let attrY = 26;
      for (const attr of entity.attributes) {
        const attrId = this.nextId();
        const prefix = attr.isPrimaryKey ? "PK " : "";
        const style = attr.isPrimaryKey
          ? "text;strokeColor=none;fillColor=none;align=left;verticalAlign=top;spacingLeft=4;spacingRight=4;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;fontStyle=4;"
          : "text;strokeColor=none;fillColor=none;align=left;verticalAlign=top;spacingLeft=4;spacingRight=4;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;";
        xml += `        <mxCell id="${attrId}" value="${this.escapeXml(prefix + attr.name + (attr.type ? ": " + attr.type : ""))}" style="${style}" vertex="1" parent="${id}">
          <mxGeometry y="${attrY}" width="${width}" height="20" as="geometry"/>
        </mxCell>\n`;
        attrY += 20;
      }
      count++;
      if (count % 3 === 0) {
        x = 50;
        y += height + 80;
      } else {
        x += spacing;
      }
    }

    for (const rel of relationships) {
      const source = this.nodePositions.get(rel.from);
      const target = this.nodePositions.get(rel.to);
      if (!source || !target) continue;
      xml += `        <mxCell id="${this.nextId()}" value="${this.escapeXml(rel.label)}" style="endArrow=ERone;startArrow=ERmany;html=1;rounded=0;" edge="1" parent="1">
          <mxGeometry relative="1" as="geometry">
            <mxPoint x="${source.x + 90}" y="${source.y}" as="sourcePoint"/>
            <mxPoint x="${target.x - 90}" y="${target.y}" as="targetPoint"/>
          </mxGeometry>
        </mxCell>\n`;
    }
    return xml;
  }

  // ==================== Deployment Diagram ====================
  generateDeploymentDiagram(): string {
    let xml = "";
    const deployments = this.data.deployments || [];
    const connections = this.data.connections || [];
    let x = 50,
      y = 50;
    const spacing = 200;
    let count = 0;

    for (const node of deployments) {
      const id = this.nextId();
      let style,
        width = 120,
        height = 80;
      switch (node.type) {
        case "database":
          style =
            "shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;size=15;fillColor=#dae8fc;strokeColor=#6c8ebf;";
          break;
        case "cloud":
          style = "ellipse;shape=cloud;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;";
          width = 140;
          break;
        case "artifact":
          style = "shape=document;whiteSpace=wrap;html=1;boundedLbl=1;fillColor=#fff2cc;strokeColor=#d6b656;";
          break;
        default:
          style = "rounded=0;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;";
      }
      this.nodePositions.set(node.name, {id, x: x + width / 2, y: y + height / 2});
      xml += `        <mxCell id="${id}" value="${this.escapeXml(node.label)}" style="${style}" vertex="1" parent="1">
          <mxGeometry x="${x}" y="${y}" width="${width}" height="${height}" as="geometry"/>
        </mxCell>\n`;
      count++;
      if (count % 4 === 0) {
        x = 50;
        y += 120;
      } else {
        x += spacing;
      }
    }

    for (const conn of connections) {
      const source = this.nodePositions.get(conn.from);
      const target = this.nodePositions.get(conn.to);
      if (!source || !target) continue;
      const style = conn.isDashed
        ? "endArrow=classic;html=1;rounded=0;dashed=1;"
        : "endArrow=classic;html=1;rounded=0;";
      xml += `        <mxCell id="${this.nextId()}" value="${this.escapeXml(conn.label)}" style="${style}" edge="1" parent="1" source="${source.id}" target="${target.id}">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>\n`;
    }
    return xml;
  }

  // ==================== Class Diagram ====================
  generateNodes(): string {
    let xml = "";
    const classes = this.data.classes || [];
    const actors = this.data.actors || [];
    let x = 40,
      y = 40;
    const spacing = 200;
    let count = 0;

    for (const cls of classes) {
      const id = this.nextId();
      this.nodePositions.set(cls.name, {id, x, y});
      const height = 60 + (cls.attributes.length + cls.methods.length) * 20;
      const width = 160;
      const fillColor =
        cls.type === "interface"
          ? "#d5e8d4"
          : cls.type === "abstract"
            ? "#fff2cc"
            : cls.type === "enum"
              ? "#e1d5e7"
              : "#dae8fc";
      const strokeColor =
        cls.type === "interface"
          ? "#82b366"
          : cls.type === "abstract"
            ? "#d6b656"
            : cls.type === "enum"
              ? "#9673a6"
              : "#6c8ebf";
      xml += `        <mxCell id="${id}" value="${this.escapeXml(cls.name)}" style="swimlane;fontStyle=1;align=center;verticalAlign=top;childLayout=stackLayout;horizontal=1;startSize=26;horizontalStack=0;resizeParent=1;resizeParentMax=0;resizeLast=0;collapsible=1;marginBottom=0;fillColor=${fillColor};strokeColor=${strokeColor};" vertex="1" parent="1">
          <mxGeometry x="${x}" y="${y}" width="${width}" height="${height}" as="geometry"/>
        </mxCell>\n`;
      let memberY = 26;
      for (const attr of cls.attributes) {
        const attrId = this.nextId();
        xml += `        <mxCell id="${attrId}" value="${this.escapeXml(attr.visibility + " " + attr.name + (attr.type ? ": " + attr.type : ""))}" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=top;spacingLeft=4;spacingRight=4;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;" vertex="1" parent="${id}">
          <mxGeometry y="${memberY}" width="${width}" height="20" as="geometry"/>
        </mxCell>\n`;
        memberY += 20;
      }
      if (cls.attributes.length > 0 && cls.methods.length > 0) {
        xml += `        <mxCell id="${this.nextId()}" value="" style="line;strokeWidth=1;fillColor=none;align=left;verticalAlign=middle;spacingTop=-1;spacingLeft=3;spacingRight=3;rotatable=0;labelPosition=right;points=[];portConstraint=eastwest;" vertex="1" parent="${id}">
          <mxGeometry y="${memberY}" width="${width}" height="8" as="geometry"/>
        </mxCell>\n`;
        memberY += 8;
      }
      for (const method of cls.methods) {
        xml += `        <mxCell id="${this.nextId()}" value="${this.escapeXml(method.visibility + " " + method.name + (method.type ? ": " + method.type : ""))}" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=top;spacingLeft=4;spacingRight=4;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;" vertex="1" parent="${id}">
          <mxGeometry y="${memberY}" width="${width}" height="20" as="geometry"/>
        </mxCell>\n`;
        memberY += 20;
      }
      count++;
      if (count % 4 === 0) {
        x = 40;
        y += height + 60;
      } else {
        x += spacing;
      }
    }

    for (const actor of actors) {
      const id = this.nextId();
      this.nodePositions.set(actor.name, {id, x, y});
      xml += `        <mxCell id="${id}" value="${this.escapeXml(actor.label)}" style="shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;outlineConnect=0;" vertex="1" parent="1">
          <mxGeometry x="${x}" y="${y}" width="30" height="60" as="geometry"/>
        </mxCell>\n`;
      count++;
      if (count % 4 === 0) {
        x = 40;
        y += 120;
      } else {
        x += spacing;
      }
    }
    return xml;
  }

  generateEdges(): string {
    let xml = "";
    const relations = this.data.relations || [];
    const styles = {
      extends: "endArrow=block;endSize=16;endFill=0;html=1;rounded=0;",
      implements: "endArrow=block;endSize=16;endFill=0;html=1;rounded=0;dashed=1;",
      composition: "endArrow=diamondThin;endFill=1;endSize=24;html=1;rounded=0;",
      aggregation: "endArrow=diamondThin;endFill=0;endSize=24;html=1;rounded=0;",
      association: "endArrow=open;endSize=12;html=1;rounded=0;",
      dependency: "endArrow=open;endSize=12;html=1;rounded=0;dashed=1;",
    };
    for (const rel of relations) {
      const source = this.nodePositions.get(rel.from);
      const target = this.nodePositions.get(rel.to);
      if (!source || !target) continue;
      const style = (styles as AnyObject)[rel.type] || styles["association"];
      xml += `        <mxCell id="${this.nextId()}" value="${this.escapeXml(rel.label || "")}" style="${style}" edge="1" parent="1" source="${source.id}" target="${target.id}">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>\n`;
    }
    return xml;
  }

  escapeXml(str: string): string {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  wrapInDrawioFormat(content: string, compressed = false): string {
    const timestamp = new Date().toISOString();
    // Remove extra whitespace from content to create cleaner XML
    const cleanContent = content.replace(/\n\s*/g, "").trim();
    const mxGraphModel = `<mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1169" pageHeight="826" background="none" math="0" shadow="0"><root><mxCell id="0" /><mxCell id="1" parent="0" />${cleanContent}</root></mxGraphModel>`;

    if (compressed) {
      // Compressed format for better compatibility
      const encodedContent = this.compressAndEncode(mxGraphModel);
      return `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net" modified="${timestamp}" agent="Mozilla/5.0" etag="plantuml2drawio" version="21.6.5" type="device">
  <diagram id="diagram-1" name="Page-1">${encodedContent}</diagram>
</mxfile>`;
    }

    // Uncompressed format - no extra whitespace
    return `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net" modified="${timestamp}" agent="Mozilla/5.0" etag="plantuml2drawio" version="21.6.5" type="device">
  <diagram id="diagram-1" name="Page-1">
    ${mxGraphModel}
  </diagram>
</mxfile>`;
  }

  compressAndEncode(data: string): string {
    try {
      const compressed = deflateRawSync(Buffer.from(data, "utf-8"));
      return compressed.toString("base64");
    } catch (e) {
      return Buffer.from(data, "utf-8").toString("base64");
    }
  }
}
