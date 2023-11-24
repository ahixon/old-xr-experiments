import { mat4 } from "gl-matrix";
import { SizedArray } from "./array";

export class MeshModel {
    id: string;
    parts: MeshPart[] = [];

    constructor(id: string) {
        this.id = id;
    }
}

export class MeshInstance {
    model: MeshModel;
    transform: mat4;

    constructor(model: MeshModel, transform: mat4) {
        this.model = model;
        this.transform = transform;
    }
}

export class MeshData {
    models: MeshModel[] = [];
    instances: MeshInstance[] = [];

    static createCube(size: number = 1, splitMeshIntoFaces = false): MeshData {
        const meshData = new MeshData();

        const model = new MeshModel('cube');

        const positions = new Float32Array([
            // Front face
            -size, -size, size,
            size, -size, size,
            size, size, size,
            -size, size, size,

            // Back face
            -size, -size, -size,
            -size, size, -size,
            size, size, -size,
            size, -size, -size,

            // Top face
            -size, size, -size,
            -size, size, size,
            size, size, size,
            size, size, -size,

            // Bottom face
            -size, -size, -size,
            size, -size, -size,
            size, -size, size,
            -size, -size, size,

            // Right face
            size, -size, -size,
            size, size, -size,
            size, size, size,
            size, -size, size,

            // Left face
            -size, -size, -size,
            -size, -size, size,
            -size, size, size,
            -size, size, -size,
        ]);

        const normals = new Float32Array([
            // Front face
            0, 0, 1,
            0, 0, 1,
            0, 0, 1,
            0, 0, 1,

            // Back face
            0, 0, -1,
            0, 0, -1,
            0, 0, -1,
            0, 0, -1,

            // Top face
            0, 1, 0,
            0, 1, 0,
            0, 1, 0,
            0, 1, 0,

            // Bottom face
            0, -1, 0,
            0, -1, 0,
            0, -1, 0,
            0, -1, 0,

            // Right face
            1, 0, 0,
            1, 0, 0,
            1, 0, 0,
            1, 0, 0,
        ]);

        const indices = new Uint16Array([
            0, 1, 2, 0, 2, 3, // Front face
            4, 5, 6, 4, 6, 7, // Back face
            8, 9, 10, 8, 10, 11, // Top face
            12, 13, 14, 12, 14, 15, // Bottom face
            16, 17, 18, 16, 18, 19, // Right face
            20, 21, 22, 20, 22, 23, // Left face
        ]);

        const partExtents = splitMeshIntoFaces ? { parts: 6, partSize: 6 } : { parts: 1, partSize: 6 * 6 };
        for (let i = 0; i < partExtents.parts; i++) {
            const part = new MeshPart('cube', i);

            const partPositions = positions.subarray(i * partExtents.partSize * 3, (i + 1) * partExtents.partSize * 3);
            const partNormals = normals.subarray(i * partExtents.partSize * 3, (i + 1) * partExtents.partSize * 3);
            const partIndices = indices.subarray(i * partExtents.partSize, (i + 1) * partExtents.partSize);

            part.buffers.set(MeshBufferType.Positions, new SizedArray(partPositions, 3));
            part.buffers.set(MeshBufferType.Normals, new SizedArray(partNormals, 3));
            part.buffers.set(MeshBufferType.TriangleIndicies, new SizedArray(partIndices, 1));

            model.parts.push(part);
        }
        meshData.models.push(model);

        meshData.instances.push(new MeshInstance(model, mat4.create()));

        return meshData;
    }
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

    buffers: Map<MeshBufferType, SizedArray> = new Map();

    constructor(id: string, materialIndex: number) {
        this.id = id;
        this.materialIndex = materialIndex;
    }
}