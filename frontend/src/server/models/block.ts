import type { Entity } from "./entity";

export interface Block {
  name: string;
  entities: Entity[];
}