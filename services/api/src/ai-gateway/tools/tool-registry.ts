import { Inject, Injectable } from '@nestjs/common';
import type { PrincipalKind } from '../../auth/auth-user.js';
import type { Principal } from '../auth/principal.js';

export interface ToolDefinition {
  name: string;
  description: string;
  /** JSON Schema for the tool's input — reused directly as the Bedrock `ToolSpec`. */
  inputSchema: Record<string, unknown>;
  kind: 'read' | 'write';
  /** RBAC: which principal kinds may call this tool. Checked on every call, not once per chat. */
  allowedKinds: PrincipalKind[];
  /** Always `true` for `kind: 'write'` — every write tool needs confirmation. */
  requiresConfirmation: boolean;
  execute(principal: Principal, args: Record<string, unknown>): Promise<unknown>;
  /** Required for `kind: 'write'` — the human-readable confirmation-card text. */
  summarize?(args: Record<string, unknown>): string;
}

/** DI token for the array of registered tool definitions (see {@link AiGatewayModule}). */
export const AI_TOOLS = 'AI_TOOLS';

/** Looks up a {@link ToolDefinition} by name. Unknown names return `undefined`. */
@Injectable()
export class ToolRegistryService {
  private readonly tools: Map<string, ToolDefinition>;

  constructor(@Inject(AI_TOOLS) tools: ToolDefinition[]) {
    this.tools = new Map(tools.map((tool) => [tool.name, tool]));
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  list(): ToolDefinition[] {
    return [...this.tools.values()];
  }

  /** Tools this principal may call at all — the set offered to Bedrock as `toolConfig`. */
  listFor(principal: Principal): ToolDefinition[] {
    return this.list().filter((tool) => tool.allowedKinds.includes(principal.kind));
  }
}
