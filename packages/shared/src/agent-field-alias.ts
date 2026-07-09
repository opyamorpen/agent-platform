export type AgentFieldContext = 'current' | 'parent';

export const AGENT_PARENT_ALIAS_PREFIX = 'parent.';

export interface ParsedAgentFieldAlias {
  context: AgentFieldContext;
  baseAlias: string;
}

export function parseAgentFieldAlias(alias: string): ParsedAgentFieldAlias {
  const normalizedAlias = alias.trim();

  if (!normalizedAlias) {
    throw new Error('Agent field alias cannot be empty');
  }

  if (normalizedAlias === 'parent') {
    throw new Error('Agent field alias "parent" is reserved');
  }

  if (normalizedAlias.startsWith(AGENT_PARENT_ALIAS_PREFIX)) {
    const baseAlias = normalizedAlias.slice(AGENT_PARENT_ALIAS_PREFIX.length).trim();

    if (!baseAlias) {
      throw new Error(`Invalid parent field alias: ${alias}`);
    }

    if (baseAlias.includes('.')) {
      throw new Error(`Nested parent field alias is not supported: ${alias}`);
    }

    return {
      context: 'parent',
      baseAlias
    };
  }

  if (normalizedAlias.includes('.')) {
    throw new Error(`Unsupported nested field alias: ${alias}`);
  }

  return {
    context: 'current',
    baseAlias: normalizedAlias
  };
}

export function buildAgentFieldAlias(
  baseAlias: string,
  context: AgentFieldContext
): string {
  const normalizedBaseAlias = baseAlias.trim();

  if (!normalizedBaseAlias) {
    throw new Error('Agent field base alias cannot be empty');
  }

  if (normalizedBaseAlias.includes('.')) {
    throw new Error(
      `Agent field base alias cannot include ".": ${normalizedBaseAlias}`
    );
  }

  if (normalizedBaseAlias === 'parent') {
    throw new Error('Agent field base alias "parent" is reserved');
  }

  return context === 'parent'
    ? `${AGENT_PARENT_ALIAS_PREFIX}${normalizedBaseAlias}`
    : normalizedBaseAlias;
}
