import { Archetype } from "./archetype";
import { Entity } from "./types";

export type Query = (target: Archetype) => boolean

export interface System {
    query: Query;
    add: (archetype: Archetype) => void;
    archetypes: Archetype[]
}

export class EntitySystem implements System {
    query: Query;
    update: (entites: Entity[]) => void;
    archetypes: Archetype[] = []
    
    constructor(query: Query, update: (entites: Entity[]) => void) {
        this.query = query;
        this.update = update;
    }

    add(archetype: Archetype) {
        if (this.query(archetype)) {
            this.archetypes.push(archetype)
        }
    }
}

export class ArchetypeSystem implements System {
    query: Query;
    update: (archetypes: Archetype[]) => void;
    archetypes: Archetype[] = []
    
    constructor(query: Query, update: (archetypes: Archetype[]) => void) {
        this.query = query;
        this.update = update;
    }

    add(archetype: Archetype) {
        if (this.query(archetype)) {
            this.archetypes.push(archetype)
        }
    }
}