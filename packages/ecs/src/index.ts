export type Entity = number

export type System<T = unknown> = {
    matchers: Set<Function>
    update(updater: { entities: Set<Entity>, data: T }): void
}

type ComponentClass<T> = new (...args: any[]) => T

class ComponentContainer {
    private map = new Map<Function, any>()

    public add(component: any): void {
        this.map.set(component.constructor, component);
    }

    public get<T extends any>(
        componentClass: ComponentClass<T>
    ): T | undefined {
        return this.map.get(componentClass);
    }

    public has(componentClass: Function): boolean {
        return this.map.has(componentClass);
    }

    public hasAll(componentClasses: Iterable<Function>): boolean {
        for (let cls of componentClasses) {
            if (!this.map.has(cls)) {
                return false;
            }
        }
        return true;
    }

    public delete(componentClass: Function): void {
        this.map.delete(componentClass);
    }
}

export class World<T = unknown> {
    private entities = new Map<Entity, ComponentContainer>()
    private entitiesForSystems = new Map<System<T>, Set<Entity>>()
    private entitiesToDestroy = new Array<Entity>()

    private nextEntityId = 0

    public addEntity(): Entity {
        let entity = this.nextEntityId;
        this.nextEntityId++;
        this.entities.set(entity, new ComponentContainer());
        return entity;
    }

    public removeEntity(entity: Entity): void {
        this.entitiesToDestroy.push(entity);
    }

    public addComponent(entity: Entity, component: any): void {
        const container = this.entities.get(entity);
        if (!container) {
            return;
        }
        container.add(component);
        this.addEntityToSystems(entity);
    }

    public getComponents(entity: Entity): ComponentContainer | undefined {
        return this.entities.get(entity);
    }

    public removeComponent(
        entity: Entity, componentClass: Function
    ): void {
        const componentContainer = this.entities.get(entity);
        if (!componentContainer) {
            return;
        }

        componentContainer.delete(componentClass);
        this.addEntityToSystems(entity);
    }

    public addSystem(system: System): void {
        if (system.matchers.size == 0) {
            return;
        }

        // Save system and set who it should track immediately.
        this.entitiesForSystems.set(system, new Set());
        for (let entity of this.entities.keys()) {
            this.addEntityToSystem(entity, system);
        }
    }

    public update(data: T): void {
        for (let [system, entities] of this.entitiesForSystems.entries()) {
            system.update({
                entities, data
            })
        }

        let toDestroy;
        do {
            toDestroy = this.entitiesToDestroy.pop()
            if (toDestroy) {
                this.destroyEntity(toDestroy);
            }
        } while (toDestroy)
    }

    private destroyEntity(entity: Entity): void {
        this.entities.delete(entity);
        for (let entities of this.entitiesForSystems.values()) {
            entities.delete(entity);
        }
    }

    private addEntityToSystems(entity: Entity): void {
        for (let system of this.entitiesForSystems.keys()) {
            this.addEntityToSystem(entity, system);
        }
    }

    private addEntityToSystem(entity: Entity, system: System): void {
        let have = this.entities.get(entity);
        const entitiesForSystem = this.entitiesForSystems.get(system);
        if (!have || !entitiesForSystem) {
            return;
        }

        let need = system.matchers;
        if (have.hasAll(need)) {
            entitiesForSystem.add(entity);
        } else {
            entitiesForSystem.delete(entity);
        }
    }
}