import { SizedArray } from "./array";

const CUBE_FACE_INDICES = [
    [3, 7, 5, 1], // right
    [6, 2, 0, 4], // left
    [6, 7, 3, 2], // ??
    [0, 1, 5, 4], // ??
    [7, 6, 4, 5], // front
    [2, 3, 1, 0], // back
];

export function createCubeVertices(size: number) {
    const k = size / 2;

    const cornerVertices = [
        [-k, -k, -k],
        [+k, -k, -k],
        [-k, +k, -k],
        [+k, +k, -k],
        [-k, -k, +k],
        [+k, -k, +k],
        [-k, +k, +k],
        [+k, +k, +k],
    ];

    const faceNormals = [
        [+1, +0, +0],
        [-1, +0, +0],
        [+0, +1, +0],
        [+0, -1, +0],
        [+0, +0, +1],
        [+0, +0, -1],
    ];

    const uvCoords = [
        [1, 0],
        [0, 0],
        [0, 1],
        [1, 1],
    ];

    const numVertices = 6 * 4;
    const positions = new Float32Array(3 * numVertices);
    const normals = new Float32Array(3 * numVertices);
    const texCoords = new Float32Array(2 * numVertices);
    const indices = new Uint32Array(3 * 6 * 2);

    let i = 0;
    let j = 0;
    let l = 0;
    for (let f = 0; f < 6; ++f) {
        const faceIndices = CUBE_FACE_INDICES[f];
        for (let v = 0; v < 4; ++v) {
            const position = cornerVertices[faceIndices[v]];
            const normal = faceNormals[f];
            const uv = uvCoords[v];

            // Each face needs all four vertices because the normals and texture
            // coordinates are not all the same.
            positions[i] = position[0];
            positions[i + 1] = position[1];
            positions[i + 2] = position[2];

            normals[i] = normal[0];
            normals[i + 1] = normal[1];
            normals[i + 2] = normal[2];

            texCoords[l] = uv[0];
            texCoords[l + 1] = uv[1];
            i += 3;
            l += 2;
        }
        
        // Two triangles make a square face.
        const offset = 4 * f;
        indices[j] = offset + 0;
        indices[j + 1] = offset + 1;
        indices[j + 2] = offset + 2;

        indices[j + 3] = offset + 0;
        indices[j + 4] = offset + 2;
        indices[j + 5] = offset + 3;

        j += 6;
    }

    return {
        position: new SizedArray(positions, 3),
        normal: new SizedArray(normals, 3),
        texcoord: new SizedArray(texCoords, 2),
        indices: new SizedArray(indices, 3),
        color: new SizedArray(new Uint8Array(indices.length * 4).map((indice, idx) => {
            if (idx % 3 === 0) {
                return 255;
            }

            return Math.floor((Math.random() * 256))
        }), 4),
    };
}