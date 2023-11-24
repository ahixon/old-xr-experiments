import { MeshData } from "../mesh";

export class ModelComponent {
    meshData: MeshData;
    materials: any[];

    constructor(meshData: MeshData, materials: any[]) {
        this.meshData = meshData;
        this.materials = materials;
    }
}