import { SizedArray } from "../array";
import { MeshBufferType, MeshPart } from "../mesh";

export function createCubeVertices() {
  const parts: MeshPart[] = []

  const positions = new Float32Array([
    // Front face
    -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0, 1.0, 1.0, -1.0, 1.0, 1.0,

    // Back face
    -1.0, -1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0, -1.0, -1.0,

    // Top face
    -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0,

    // Bottom face
    -1.0, -1.0, -1.0, 1.0, -1.0, -1.0, 1.0, -1.0, 1.0, -1.0, -1.0, 1.0,

    // Right face
    1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0, 1.0, 1.0, -1.0, 1.0,

    // Left face
    -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0, -1.0,
  ]);

  const faceColors = [
    [1.0, 1.0, 1.0, 1.0], // Front face: white
    [1.0, 0.0, 0.0, 1.0], // Back face: red
    [0.0, 1.0, 0.0, 1.0], // Top face: green
    [0.0, 0.0, 1.0, 1.0], // Bottom face: blue
    [1.0, 1.0, 0.0, 1.0], // Right face: yellow
    [1.0, 0.0, 1.0, 1.0], // Left face: purple
  ];

  // Convert the array of colors into a table for all the vertices.

  var colors: number[] = [];

  for (var j = 0; j < faceColors.length; ++j) {
    const c = faceColors[j];
    // Repeat each color four times for the four vertices of the face
    colors = colors.concat(c, c, c, c);
  }

  // var colors = new Array(faceColors.length * 4 * 4).fill(127)

  const indices = new Uint16Array([
    0,
    1,
    2,
    0,
    2,
    3, // front
    4,
    5,
    6,
    4,
    6,
    7, // back
    8,
    9,
    10,
    8,
    10,
    11, // top
    12,
    13,
    14,
    12,
    14,
    15, // bottom
    16,
    17,
    18,
    16,
    18,
    19, // right
    20,
    21,
    22,
    20,
    22,
    23, // left
  ]);

  // const normals = calculateNormals(positions);

  const normals = new Float32Array([
    // Front face
    0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0,

    // Back face
    0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0,

    // Top face
    0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0,

    // Bottom face
    0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0,

    // Right face
    1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0,

    // Left face
    -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0,
  ]);

  // const chunkSize = 12;
  // let partIdx = 0;
  // for (let i = 0; i < positions.length; i += chunkSize) {
  //     const part = new MeshPart(`cube-part-${partIdx}`, partIdx);

  //     const posChunk = positions.slice(i, i + chunkSize);
  //     part.buffers.set(MeshBufferType.Positions, new SizedArray(posChunk, 3))

  //     const normalsChunk = normals.slice(i, i + chunkSize);
  //     part.buffers.set(MeshBufferType.Normals, new SizedArray(normalsChunk, 3))
  //     partIdx++;
  //     parts.push(part);
  // }

  // console.log(parts);

  // for (let i = 0; i < parts.length; i++) {
  //   const part = parts[i];
  //   const indicesChunk = indices.slice(i * 6, i * 6 + 6);
  //   part.triangleIndices = {
  //     type: MeshBufferType.TriangleIndicies,
  //     data: new SizedArray(indicesChunk, 3)
  //   }
  // }

  // console.log(parts);

  parts.push(new MeshPart('cube', 0));
  parts[0].buffers.set(MeshBufferType.Positions, new SizedArray(positions, 3))
  parts[0].buffers.set(MeshBufferType.Normals, new SizedArray(normals, 3))
  parts[0].triangleIndices = {
    type: MeshBufferType.TriangleIndicies,
    data: new SizedArray(indices, 3)
  }

  return parts;
}