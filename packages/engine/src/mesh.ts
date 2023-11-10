import { vec3 } from "gl-matrix";

export enum MeshAttribute {
    Vertices,
    UV,
    Normal,
    TriangleIndicies,
}

type MeshBuffers = Map<MeshAttribute, Float32Array>;

export class MeshGroup {
    materialIndex: number;
    buffers: MeshBuffers = new Map()

    constructor(materialIndex: number, buffers: MeshBuffers = new Map()) {
        this.materialIndex = materialIndex;
        this.buffers = buffers;
    }
}

export class Mesh {
    groups: MeshGroup[];

    constructor(groups: MeshGroup[] = []) {
        this.groups = groups;
    }

    static box(dimensions: vec3 = vec3.create(), segmentSizes: vec3 = vec3.create()) {
        return null;
    }
    
}