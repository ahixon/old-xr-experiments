import { SizedArray } from "../array";

export class ModelComponent {
    mesh: Map<string, SizedArray>;
    material: any;

    constructor(mesh: Map<string, SizedArray>, material: any ) {
        this.mesh = mesh;
        this.material = material;
    }
}