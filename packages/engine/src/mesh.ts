import { SizedArray } from "./array";

export class MeshModel {
    id: string;
    parts: MeshPart[] = [];

    constructor(id: string) {
        this.id = id;
    }
}

export class Mesh {
    models: MeshModel[] = [];
    // instances - https://webglfundamentals.org/webgl/lessons/webgl-instanced-drawing.html
}

export enum MeshBufferType {
    Normals = 'normal',
    TriangleIndicies = 'indices',
    UV = 'uv',
    Positions = 'position',
    Tangent = 'tangent',
}

export type MeshBuffer<T> = {
    type: T,
    data: SizedArray,
}

export class MeshPart {
    id: string;
    materialIndex: number;
    primitiveType: number;

    buffers: Map<Exclude<MeshBufferType, MeshBufferType.TriangleIndicies>, SizedArray> = new Map();
    triangleIndices?: MeshBuffer<MeshBufferType.TriangleIndicies>;

    constructor(id: string, materialIndex: number, primitiveType: number = WebGLRenderingContext.TRIANGLES) {
        this.id = id;
        this.materialIndex = materialIndex;
        this.primitiveType = primitiveType
    }
}