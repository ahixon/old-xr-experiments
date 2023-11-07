import { Archetype } from "./archetype";
import { ArchetypeSystem, EntitySystem, System } from "./system";
import { Component, Entity } from "./types";
import { createBitSet } from "./utils/bitset";

// TODO: would be nice to support unlimited sizes
export const BITMAP_SIZE = 8;

export class World {
    #rootArchetype: Archetype = new Archetype(createBitSet(BITMAP_SIZE));
    #entities: Map<Entity, Archetype> = new Map()
    #nextEntityId = 0;
    #nextComponentId = 0;
    #systems: System[] = [];

    createComponent(): Component {
        return this.#nextComponentId++;
    }

    createEntity(archetype: Archetype = this.#rootArchetype): Entity {
        const entity = this.#nextEntityId++;

        archetype.addEntity(entity)
        this.#entities.set(entity, archetype);

        return entity;
    }

    deleteEntity(entity: Entity) {
        const archetype = this.#entities.get(entity);
        if (!archetype) {
            return;
        }

        archetype.deleteEntity(entity);
        this.#entities.delete(entity);
    }

    setEntity(entity: Entity, archetype: Archetype) {
        this.#entities.get(entity)?.deleteEntity(entity);

        archetype.addEntity(entity);
        this.#entities.set(entity, archetype);
    }

    hasComponent(entity: Entity, component: Component) {
        const archetype = this.#entities.get(entity);
        if (archetype) {
            return archetype.hasComponent(component);
        }

        return false;
    }

    addComponent(entity: Entity, component: Component) {
        const archetype = this.#entities.get(entity);
        if (archetype) {
            if (!archetype.hasComponent(component)) {
                this.toggleComponentForEntity(archetype, component, entity)
            }
        }
    }

    removeComponent(entity: Entity, component: Component) {
        const archetype = this.#entities.get(entity);
        if (archetype) {
            if (archetype.hasComponent(component)) {
                this.toggleComponentForEntity(archetype, component, entity)
            }
        }
    }

    private toggleComponentForEntity(archetype: Archetype, component: Component, entity: Entity) {
        archetype.deleteEntity(entity);

        archetype.toggleComponent(component, (newArchetype) => {
            this.addArchetypeToSystems(newArchetype)
        });

        archetype.addEntity(entity)
        this.#entities.set(entity, archetype);
    }

    addSystem(system: System) {
        this.#systems.push(system)
        Archetype.walkGraph(this.#rootArchetype, arch => this.addArchetypeToSystems(arch))
    }

    private addArchetypeToSystems(archetype: Archetype) {
        for (const system of this.#systems) {
            system.add(archetype);
        }
    }

    update() {
        for (const system of this.#systems) {
            if (system instanceof EntitySystem) {
                for (const archetype of system.archetypes) {
                    system.update(Array.from(archetype.entities.values()))
                }
            } else if (system instanceof ArchetypeSystem) {
                system.update(system.archetypes)
            } else {
                throw new Error('tried to update unknown system type')
            }
        }
    }
}