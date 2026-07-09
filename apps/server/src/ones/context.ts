export interface OnesOpenApiContext {
  teamUUID: string;
  userUUID?: string;
}

export interface OnesInternalApiContext {
  teamUUID: string;
  authorizationHeader: string;
}

export interface OnesWebContext extends OnesOpenApiContext, OnesInternalApiContext {
  userUUID: string;
}
