import { Mesh } from "../mesh";

export class ModelComponent {
    mesh: Mesh;
    material: any;

    constructor(mesh: Mesh, material: any ) {
        this.mesh = mesh;
        this.material = material;
    }
}