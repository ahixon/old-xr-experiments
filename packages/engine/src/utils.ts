export function degToRad(d: number) {
  return d * Math.PI / 180;
}

export function calculateNormalsVertices(vertices) {
  if (vertices.length % 9 !== 0) {
    throw new Error('Invalid number of vertices for triangles');
  }

  const normals = new Array(vertices.length);

  // Initialize normals array
  for (let i = 0; i < vertices.length; i++) {
    normals[i] = 0.0;
  }

  for (let i = 0; i < vertices.length; i += 9) {
    // Get the three vertices of the triangle
    const v1 = { x: vertices[i], y: vertices[i + 1], z: vertices[i + 2] };
    const v2 = { x: vertices[i + 3], y: vertices[i + 4], z: vertices[i + 5] };
    const v3 = { x: vertices[i + 6], y: vertices[i + 7], z: vertices[i + 8] };

    // Calculate the normal for the triangle
    const edge1 = { x: v2.x - v1.x, y: v2.y - v1.y, z: v2.z - v1.z };
    const edge2 = { x: v3.x - v1.x, y: v3.y - v1.y, z: v3.z - v1.z };

    const normal = {
      x: edge1.y * edge2.z - edge1.z * edge2.y,
      y: edge1.z * edge2.x - edge1.x * edge2.z,
      z: edge1.x * edge2.y - edge1.y * edge2.x
    };

    // Add the normal to each vertex of the triangle
    for (let j = 0; j < 3; j++) {
      normals[i + j * 3] += normal.x;
      normals[i + j * 3 + 1] += normal.y;
      normals[i + j * 3 + 2] += normal.z;
    }
  }

  // Normalize the normals
  for (let i = 0; i < normals.length; i += 3) {
    const length = Math.sqrt(normals[i] * normals[i] + normals[i + 1] * normals[i + 1] + normals[i + 2] * normals[i + 2]);
    normals[i] /= length;
    normals[i + 1] /= length;
    normals[i + 2] /= length;
  }

  return normals;
}

export function calculateNormalsIndicesPositions(indices, positions) {
  let normals = new Array(positions.length).fill(0);

  for (let i = 0; i < indices.length; i += 3) {
    let i0 = indices[i] * 3;
    let i1 = indices[i + 1] * 3;
    let i2 = indices[i + 2] * 3;

    let p0 = [positions[i0], positions[i0 + 1], positions[i0 + 2]];
    let p1 = [positions[i1], positions[i1 + 1], positions[i1 + 2]];
    let p2 = [positions[i2], positions[i2 + 1], positions[i2 + 2]];

    let v0 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
    let v1 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];

    let normal = [
      v0[1] * v1[2] - v0[2] * v1[1],
      v0[2] * v1[0] - v0[0] * v1[2],
      v0[0] * v1[1] - v0[1] * v1[0]
    ];

    normals[i0] += normal[0];
    normals[i0 + 1] += normal[1];
    normals[i0 + 2] += normal[2];

    normals[i1] += normal[0];
    normals[i1 + 1] += normal[1];
    normals[i1 + 2] += normal[2];

    normals[i2] += normal[0];
    normals[i2 + 1] += normal[1];
    normals[i2 + 2] += normal[2];
  }

  for (let i = 0; i < normals.length; i += 3) {
    let nx = normals[i];
    let ny = normals[i + 1];
    let nz = normals[i + 2];

    let length = Math.sqrt(nx * nx + ny * ny + nz * nz);

    normals[i] = nx / length;
    normals[i + 1] = ny / length;
    normals[i + 2] = nz / length;
  }

  return normals;
}

export function calculateTangentsWithoutUV(vertices, normals) {
  if (vertices.length % 9 !== 0 || normals.length !== vertices.length) {
    throw new Error('Invalid number of vertices or normals for triangles');
  }

  const tangents = new Array(vertices.length);

  // Initialize tangents array
  for (let i = 0; i < vertices.length; i++) {
    tangents[i] = 0.0;
  }

  for (let i = 0; i < vertices.length; i += 9) {
    // Get the three vertices of the triangle
    const v1 = { x: vertices[i], y: vertices[i + 1], z: vertices[i + 2] };
    const v2 = { x: vertices[i + 3], y: vertices[i + 4], z: vertices[i + 5] };
    const v3 = { x: vertices[i + 6], y: vertices[i + 7], z: vertices[i + 8] };

    // Get the corresponding normals
    const n1 = { x: normals[i], y: normals[i + 1], z: normals[i + 2] };
    const n2 = { x: normals[i + 3], y: normals[i + 4], z: normals[i + 5] };
    const n3 = { x: normals[i + 6], y: normals[i + 7], z: normals[i + 8] };

    // Calculate the edges
    const edge1 = { x: v2.x - v1.x, y: v2.y - v1.y, z: v2.z - v1.z };
    const edge2 = { x: v3.x - v1.x, y: v3.y - v1.y, z: v3.z - v1.z };

    // Calculate the tangent and bitangent
    const tangent = {
      x: edge1.x - n1.x * (n1.x * edge1.x + n1.y * edge1.y + n1.z * edge1.z),
      y: edge1.y - n1.y * (n1.x * edge1.x + n1.y * edge1.y + n1.z * edge1.z),
      z: edge1.z - n1.z * (n1.x * edge1.x + n1.y * edge1.y + n1.z * edge1.z)
    };

    // Add the tangent to each vertex of the triangle
    for (let j = 0; j < 3; j++) {
      tangents[i + j * 3] += tangent.x;
      tangents[i + j * 3 + 1] += tangent.y;
      tangents[i + j * 3 + 2] += tangent.z;
    }
  }

  // Normalize the tangents
  for (let i = 0; i < tangents.length; i += 3) {
    const length = Math.sqrt(tangents[i] * tangents[i] + tangents[i + 1] * tangents[i + 1] + tangents[i + 2] * tangents[i + 2]);
    tangents[i] /= length;
    tangents[i + 1] /= length;
    tangents[i + 2] /= length;
  }

  return tangents;
}