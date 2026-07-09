export interface OnesPageInfo {
  hasNextPage: boolean;
  startCursor?: string;
  endCursor?: string;
  totalCount?: number;
  count?: number;
}

export interface OnesField {
  uuid: string;
  name: string;
  fieldType: string;
  valueType: string;
  referenceObjectType: string | null;
  readonly: boolean;
}

export interface OnesOneSqlRow {
  type?: string;
  item?: Record<string, unknown>;
  aggregate?: Record<string, unknown>;
  groupAggregate?: Record<string, unknown>[];
  group?: {
    key?: string;
    total?: string;
    info?: Record<string, unknown> | null;
  };
}
