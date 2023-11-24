export type EntityID = number;

export type System = {
    matchers: Set<Function>
    update(updater: Set<Entity>): void
}

type ComponentClass<T> = new (...args: any[]) => T


export class Entity {
    private id: number;
    private children: Array<Entity> = [];
    private world: World;
    private parent: Entity | null = null;
    private componentMap = new Map<Function, any>()

    constructor(world: World, id: EntityID) {
        this.id = id;
        this.world = world;
    }

    public getId(): number {
        return this.id;
    }

    public getParent(): Entity | null {
        return this.parent;
    }

    public addChild(child: Entity): void {
        child.parent = this;
        this.children.push(child);
    }

    public getChildren(): Array<Entity> {
        return this.children;
    }

    public removeChild(child: Entity): void {
        const index = this.children.indexOf(child);
        if (index == -1) {
            return;
        }
        this.children.splice(index, 1);
    }

    public addComponent(component: any): void {
        this.componentMap.set(component.constructor, component);
        this.world.updateEntityForSystems(this);
    }

    public getComponent<T extends any>(
        componentClass: ComponentClass<T>
    ): T | undefined {
        return this.componentMap.get(componentClass);
    }

    public getComponents(): Iterable<ComponentClass<any>> {
        return this.componentMap.values();
    }

    public hasComponent(componentClass: Function): boolean {
        return this.componentMap.has(componentClass);
    }

    public hasAllComponents(componentClasses: Iterable<Function>): boolean {
        for (const cls of componentClasses) {
            if (!this.componentMap.has(cls)) {
                return false;
            }
        }

        return true;
    }

    public removeComponent(componentClass: Function): void {
        this.componentMap.delete(componentClass);
        this.world.updateEntityForSystems(this);
    }
}

export class World {
    private entities = new Set<Entity>()
    private entitiesForSystems = new Map<System, Set<Entity>>()
    private entitiesToDestroy = new Array<Entity>()

    private nextEntityId: EntityID = 0

    public createEntity(): Entity {
        const entity = new Entity(this, this.nextEntityId++);
        this.entities.add(entity);
        return entity;
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

    public update(): void {
        for (let [system, entities] of this.entitiesForSystems.entries()) {
            system.update(entities)
        }

        let toDestroy;
        do {
            toDestroy = this.entitiesToDestroy.pop()
            if (toDestroy) {
                this.destroyEntity(toDestroy);
            }
        } while (toDestroy)
    }

    // TODO: destroy entity when it's unreachable

    private destroyEntity(entity: Entity): void {
        this.entities.delete(entity);
        for (let entities of this.entitiesForSystems.values()) {
            entities.delete(entity);
        }
    }

    public updateEntityForSystems(entity: Entity): void {
        for (let system of this.entitiesForSystems.keys()) {
            this.addEntityToSystem(entity, system);
        }
    }

    private addEntityToSystem(entity: Entity, system: System): void {
        const entitiesForSystem = this.entitiesForSystems.get(system);
        if (!entitiesForSystem) {
            return;
        }

        let need = system.matchers;
        if (entity.hasAllComponents(need)) {
            entitiesForSystem.add(entity);
        } else {
            entitiesForSystem.delete(entity);
        }
    }
}