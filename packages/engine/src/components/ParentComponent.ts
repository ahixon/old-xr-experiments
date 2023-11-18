import { Entity } from "@realityshell/ecs";

export class ParentComponent {
    parent: Entity;
    constructor(parent: Entity) {
        this.parent = parent;
    }
}