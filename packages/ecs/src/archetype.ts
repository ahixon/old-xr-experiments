import { Component, Entity } from "./types";
import { BitSet, createBitSet } from "./utils/bitset"

function makeMask(componentIds: Component[]): BitSet {
    const max = Math.max(...componentIds)
    const mask = createBitSet(Math.ceil(max / 32))
    for (let i = 0; i < componentIds.length; i++) {
        mask.or(componentIds[i])
    }
    return mask
}

export class Archetype {
    #mask: Readonly<BitSet>;
    #adjacent: Array<Archetype> = [];

    #entities: Set<Entity> = new Set();

    // TODO: entered, exited entity sets

    constructor(mask: BitSet) {
        this.#mask = mask
    }

    get componentIds() {
        return this.#mask.values()
    }

    get entities(): Entity[] {
        return Array.from(this.#entities.values());
    }

    addEntity(entity: Entity) {
        this.#entities.add(entity)
    }

    deleteEntity(entity: Entity) {
        this.#entities.delete(entity)
    }

    toggleComponent(component: Component, onCreate: (archetype: Archetype) => void): Archetype {
        if (this.#adjacent[component] !== undefined) {
            return this.#adjacent[component]
        }

        const nextMask = this.#mask.copy().xor(component);

        // see if there was an existing archetype with this mask
        const existing = Archetype.walkGraph(this, node => node.#mask.equals(nextMask));

        let updated = existing;
        let didCreate = false;
        if (!updated) {
            updated = new Archetype(nextMask.copy())
            didCreate = true;
        }

        updated.#adjacent[component] = this
        this.#adjacent[component] = updated

        if (didCreate) {
            onCreate(updated)
        }

        return updated
    }

    hasComponent(component: Component) {
        return this.#mask.has(component)
    }

    hasEveryComponent(components: Component[]) {
        return this.#mask.contains(makeMask(components))
    }

    hasNoneComponents(components: Component[]) {
        return !this.#mask.contains(makeMask(components))
    }

    hasSomeComponents(components: Component[]) {
        return this.#mask.intersects(makeMask(components))
    }

    hasNotComponents(components: Component[]) {
        return !this.#mask.intersects(makeMask(components))
    }

    static walkGraph = (archetype: Archetype, cb: (archetype: Archetype) => boolean | void, seen = new Set<Archetype>): Archetype | undefined => {
        seen.add(archetype)
    
        if (cb(archetype)) {
            return archetype;
        }
    
        for (const adj of archetype.#adjacent) {
            if (adj && !seen.has(adj)) {
                if (Archetype.walkGraph(adj, cb, seen)) {
                    return adj;
                }
            }
        }
    }
}