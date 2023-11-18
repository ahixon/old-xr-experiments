import { TransformComponent } from '@realityshell/engine/components/TransformComponent';
import { ModelComponent } from '@realityshell/engine/components/ModelComponent';
import { WebGLAttribute, WebGLAttributesComponent } from '@realityshell/engine/components/WebGLAttributesComponent'

import { mat4, vec2, vec3 } from 'gl-matrix'
import { Program } from '@realityshell/engine/program'

import { createWebGLContext } from '@realityshell/engine/context'
import { degToRad } from '@realityshell/engine/utils'
import { Entity, World } from '@realityshell/ecs';
import { Mesh, MeshBufferType, MeshModel, MeshPart } from '@realityshell/engine/mesh';
import { SizedArray } from '../../engine/src/array';
import libtess from 'libtess';
console.log(libtess)

let lightPos = [-10.0, -200, -10.0]

///// world setup

const world = new World();

const gl = createWebGLContext({
    xrCompatible: true
});

if (!gl || !(gl instanceof WebGLRenderingContext || gl instanceof WebGL2RenderingContext)) {
    throw new Error('no gl context');
}

document.getElementById('canvas').appendChild(gl.canvas);

gl.canvas.height = document.getElementById('canvas')?.clientHeight
gl.canvas.width = document.getElementById('canvas')?.clientWidth


class ParentComponent {
    parent: Entity;
    constructor(parent: Entity) {
        this.parent = parent;
    }
}

// import binUrl from './lab_electronics01.bin?url'
import binUrl from './pancakes.bin?url'
// import binUrl from './Kitchen_set.bin?url'
const sceneBin = await (await fetch(binUrl)).arrayBuffer()
console.log(sceneBin)
// const sceneJson = (await import('./lab_electronics01.json')).default
const sceneJson = (await import('./pancakes.json')).default
// const sceneJson = (await import('./Kitchen_set.json')).default
const defaultNode = sceneJson.nodes[sceneJson.default];
// const defaultNode = sceneJson.nodes['/__Prototype_1/Geom/Edge'];

function calculateNormals(vertices) {
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

  function calculateTangentsWithoutUV(vertices, normals) {
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
  

const addEntity = (gl, sceneEntity, parent) => {
    const bottle = world.addEntity();

    if (sceneEntity.points) {
        const bottleMesh = new Mesh();
        const bottleModel = new MeshModel('bottle');
        const bottlePart = new MeshPart('bottle-mesh', 0)

        const posSlice = sceneBin.slice(sceneEntity.points.offset, sceneEntity.points.offset + sceneEntity.points.size);
        const pos = new Float32Array(posSlice);

        const faceIndicesSlice = sceneBin.slice(sceneEntity.faceIndices.offset, sceneEntity.faceIndices.offset + sceneEntity.faceIndices.size)
        const faceIndices = new Uint16Array(faceIndicesSlice);
        const faceCountsSlice = sceneBin.slice(sceneEntity.faceCounts.offset, sceneEntity.faceCounts.offset + sceneEntity.faceCounts.size)
        const faceCounts = new Uint16Array(faceCountsSlice);

        console.log('face indices', faceIndices.length, 'counts', faceCounts.length, 'pos', pos.length)

        var tessy = (function initTesselator() {
            // function called for each vertex of tesselator output
            function vertexCallback(data, polyVertArray) {
                //   console.log(data);
                polyVertArray[polyVertArray.length] = data[0];
                polyVertArray[polyVertArray.length] = data[1];
                polyVertArray[polyVertArray.length] = data[2];
            }
            function begincallback(type) {
                if (type !== libtess.primitiveType.GL_TRIANGLES) {
                    console.log('expected TRIANGLES but got type: ' + type);
                }
            }
            function errorcallback(errno) {
                console.log('error callback');
                console.log('error number: ' + errno);
            }
            // callback for when segments intersect and must be split
            function combinecallback(coords, data, weight) {
                //   console.log('combine callback', coords);
                return [coords[0], coords[1], coords[2]];
            }
            function edgeCallback(flag) {
                // don't really care about the flag, but need no-strip/no-fan behavior
                //   console.log('edge flag: ' + flag);
            }

            var tessy = new libtess.GluTesselator();
            // tessy.gluTessProperty(libtess.gluEnum.GLU_TESS_WINDING_RULE, libtess.windingRule.GLU_TESS_WINDING_POSITIVE);
            tessy.gluTessCallback(libtess.gluEnum.GLU_TESS_VERTEX_DATA, vertexCallback);
            tessy.gluTessCallback(libtess.gluEnum.GLU_TESS_BEGIN, begincallback);
            tessy.gluTessCallback(libtess.gluEnum.GLU_TESS_ERROR, errorcallback);
            tessy.gluTessCallback(libtess.gluEnum.GLU_TESS_COMBINE, combinecallback);
            tessy.gluTessCallback(libtess.gluEnum.GLU_TESS_EDGE_FLAG, edgeCallback);

            return tessy;
        })();


        // TODO: support holes in meshes

        let vertexIndexPointer = 0;
        const totalPositions = [];

        for (let i = 0; i < faceCounts.length; i++) {
            const numVertices = faceCounts[i];

            var trianglePositions = [];
            const faceIndicesForCurrentPolygon = [];

            tessy.gluTessBeginPolygon(trianglePositions);

            tessy.gluTessBeginContour();

            // Iterate over vertices in the current face
            for (let j = 0; j < numVertices; j++) {
                const vertexIndex = faceIndices[vertexIndexPointer++];

                const positionPointer = 3 * vertexIndex;

                // Retrieve 3D position for the current vertex
                const x = pos[positionPointer];
                const y = pos[positionPointer + 1];
                const z = pos[positionPointer + 2];

                const coords = [x, y, z];
                tessy.gluTessVertex(coords, coords);

                // Store vertex index for later normal computation
                faceIndicesForCurrentPolygon.push(vertexIndex);
            }

            tessy.gluTessEndContour();

            tessy.gluTessEndPolygon();

            totalPositions.push([...trianglePositions]);
        }

        console.log('ddd', totalPositions)
        const flatTriangleVerts = new Float32Array(totalPositions.flat())
        console.log(flatTriangleVerts)
        
        bottlePart.buffers.set(MeshBufferType.Positions, new SizedArray(flatTriangleVerts, 3))

        // console.log(trianglePositions)
        // console.log(totalFaces.flat())
        var normals = calculateNormals(flatTriangleVerts);
        // var normals = calculateNormals(flatTriangleVerts)
        console.log('normals', normals)
        const normalsFlat = new Float32Array(normals);
        // // console.log('normals falt', normalsFlat)
        bottlePart.buffers.set(MeshBufferType.Normals, new SizedArray(normalsFlat, 3))

        // if (sceneEntity.uv) {
        //     const uvSlice = sceneBin.slice(sceneEntity.uv.offset, sceneEntity.uv.offset + sceneEntity.uv.size)
        //     bottlePart.buffers.set(MeshBufferType.UV, new SizedArray(new Float32Array(uvSlice), 2))
        // }

        const tangents = calculateTangentsWithoutUV(flatTriangleVerts, normalsFlat)
        console.log('tanny', tangents)

        // if (sceneEntity.tangent) {
        bottlePart.buffers.set(MeshBufferType.Tangent, new SizedArray(new Float32Array(tangents), 2))
        // }

        bottleModel.parts.push(bottlePart)
        bottleMesh.models.push(bottleModel);

        let material = null;
        if (sceneEntity.material) {
            console.log(sceneEntity.material)
            material = {
                program: new Program(gl, sceneEntity.material.vert, sceneEntity.material.frag),
                variables: sceneEntity.material.variables
            }
        }

        world.addComponent(bottle, new ModelComponent(bottleMesh, material))
    }

    const m = mat4.fromValues(...sceneEntity.transform.flat());
    world.addComponent(bottle, new TransformComponent(m));
    if (parent) {
        world.addComponent(bottle, new ParentComponent(parent))
    }

    for (const child of sceneEntity.children) {
        addEntity(gl, sceneJson.nodes[child], bottle)
    }
}

console.log(defaultNode)
addEntity(gl, defaultNode, null);

///////////////////////////////


var fieldOfViewRadians = degToRad(60);

const cameraMatrix = mat4.create();

var cameraLookAt = [
    0, 10, 20
];

var up = [0, 1, 0];
mat4.targetTo(cameraMatrix, vec3.fromValues(cameraLookAt[0], cameraLookAt[1], cameraLookAt[2]), vec3.fromValues(0, 0, 0), vec3.fromValues(up[0], up[1], up[2]))

world.addSystem({
    matchers: new Set([ModelComponent]),
    update(entities) {
        for (const entity of entities) {
            const exisingAttributes = world.getComponents(entity)?.get(WebGLAttributesComponent);
            const model = world.getComponents(entity)?.get(ModelComponent)!;

            if (!model.material) {
                // FIXME: infinite loop
                // console.log('model', model)
                continue
            }

            if (!exisingAttributes) {
                const attributes = new Map();
                for (const meshmodel of model.mesh.models) {
                    // FIXME: what about submodels with same IDs
                    for (const part of meshmodel.parts) {
                        // part.buffers.set('tangent', part.buffers.get('position'));
                        const attributesForPart = Array.from(part.buffers.keys() as any as Exclude<MeshBufferType, MeshBufferType.TriangleIndicies>[]).reduce((acc: Record<MeshBufferType, WebGLAttribute>, meshKey: Exclude<MeshBufferType, MeshBufferType.TriangleIndicies>) => {
                            console.log('uploading attr', meshKey)
                            const bufferData = part.buffers.get(meshKey)!;
                            acc[meshKey] = new WebGLAttribute(gl, bufferData, true, gl.ARRAY_BUFFER);
                            return acc;
                        }, {} as Record<MeshBufferType, WebGLAttribute>)

                        if (part.triangleIndices) {
                            attributesForPart['indices'] = new WebGLAttribute(gl, part.triangleIndices.data, true, gl.ELEMENT_ARRAY_BUFFER);
                        }

                        attributes.set(part.id, attributesForPart);
                    }
                }

                const locs = new Map();

                for (let i = 0; i < gl.getProgramParameter(model.material.program.program, gl.ACTIVE_ATTRIBUTES); i++) {
                    const attribInfo = gl.getActiveAttrib(model.material.program.program, i);
                    if (!attribInfo) {
                        console.warn('failed to find attr', attribInfo)
                        continue;
                    }

                    console.log('have attr', attribInfo)

                    const attribPointer = gl.getAttribLocation(model.material.program.program, attribInfo.name);

                    locs.set(attribInfo.name.split('_')[1], attribPointer);
                }

                world.addComponent(entity, new WebGLAttributesComponent(attributes, locs));
            }
        }
    }
})

world.addSystem({
    matchers: new Set([TransformComponent]),
    update(entities) {
        // mat4.rotateZ(cameraMatrix, mat4.clone(cameraMatrix), degToRad(1))
        cameraLookAt[0] -= 0.01
        // cameraLookAt[1] -= 0.1
        cameraLookAt[2] -= 0.01
        mat4.targetTo(cameraMatrix, vec3.fromValues(cameraLookAt[0], cameraLookAt[1], cameraLookAt[2]), vec3.fromValues(0, 0, 0), vec3.fromValues(up[0], up[1], up[2]))
        // lightPos[0] += 0
        // let idx = 0;
        // for (const entity of entities) {
        //     const transform = world.getComponents(entity)?.get(TransformComponent)!;
        //     if (idx === 2) {
        //         mat4.rotateY(cameraMatrix, mat4.clone(cameraMatrix), degToRad(10))
        //         // lightPos[0] += 0.01
        //         // lightPos[1] += 0.01
        //         // lightPos[2] -= 0.01
        //     }

        //     idx ++;
        // }
    }
})

world.addSystem({
    matchers: new Set([TransformComponent, WebGLAttributesComponent]),
    update(entities) {
        // Tell WebGL how to convert from clip space to pixels
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        // Clear the canvas AND the depth buffer.
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // Turn on culling. By default backfacing triangles
        // will be culled.
        gl.enable(gl.CULL_FACE);

        // Enable the depth buffer
        gl.enable(gl.DEPTH_TEST);

        gl.depthFunc(gl.LEQUAL);

        // Compute the projection matrix
        var aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
        var zNear = 1;
        var zFar = 2000;

        var projectionMatrix = mat4.create();
        mat4.perspective(projectionMatrix, fieldOfViewRadians, aspect, zNear, zFar);

        // Make a view matrix from the camera matrix
        const viewMatrix = mat4.create();
        mat4.invert(viewMatrix, cameraMatrix);

        // Compute a view projection matrixcoat_bsdf_out.response;
        const viewProjectionMatrix = mat4.create();
        mat4.multiply(viewProjectionMatrix, projectionMatrix, viewMatrix);

        for (const entity of entities.keys()) {
            const transform = world.getComponents(entity)?.get(TransformComponent)!;
            const attributes = world.getComponents(entity)?.get(WebGLAttributesComponent)!;

            const model = world.getComponents(entity)?.get(ModelComponent)!;

            gl.useProgram(model.material.program.program);

            var worldLocation = gl.getUniformLocation(model.material.program.program, "u_worldMatrix");
            var worldViewProjectionLocation = gl.getUniformLocation(model.material.program.program, "u_viewProjectionMatrix");
            var worldInverseTransposeLocation = gl.getUniformLocation(model.material.program.program, "u_worldInverseTransposeMatrix");

            for (const partName of attributes.attributesForPart.keys()) {
                const part = attributes.attributesForPart.get(partName)!;
                for (const attribName of attributes.locs.keys()) {
                    const partAttr = part[attribName];
                    if (!partAttr) {
                        continue;
                    }

                    const attribPointer = attributes.locs.get(attribName)!;

                    // console.log('binding', attribName, 'to', attribPointer)

                    gl.bindBuffer(gl.ARRAY_BUFFER, partAttr.glBuffer);
                    gl.enableVertexAttribArray(attribPointer);
                    gl.vertexAttribPointer(
                        attribPointer, partAttr.backingArray.components, partAttr.glComponentType, partAttr.normalize,
                        0, // b.stride || 0, 
                        0, // b.offset || 0
                    );
                }

                const indices = part['indices']
                if (indices) {
                    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, part['indices'].glBuffer);
                }

                const worldMatrix = mat4.clone(transform.transform);
                let parent = world.getComponents(entity)?.get(ParentComponent)
                while (parent) {
                    const parentComp = world.getComponents(parent.parent)
                    const parentTransform = parentComp?.get(TransformComponent);

                    if (parentTransform) {
                        // const m = mat4.fromValues(...parentTransform.transform.flat());
                        mat4.mul(worldMatrix, parentTransform.transform, worldMatrix)
                    }

                    parent = parentComp?.get(ParentComponent);
                    // console.log('parent', parent)
                }

                const worldViewProjectionMatrix = mat4.create();
                mat4.multiply(worldViewProjectionMatrix, viewProjectionMatrix, worldMatrix);

                gl.uniformMatrix4fv(
                    worldViewProjectionLocation, false,
                    worldViewProjectionMatrix);

                const worldInverseTransposeMatrix = mat4.create();
                const worldInverted = mat4.create();
                mat4.invert(worldInverted, worldMatrix)
                mat4.transpose(worldInverseTransposeMatrix, worldInverted)
                gl.uniformMatrix4fv(
                    worldInverseTransposeLocation, false,
                    worldInverseTransposeMatrix);

                gl.uniformMatrix4fv(worldLocation, false, worldMatrix);

                var lightTypePos = gl.getUniformLocation(model.material.program.program, "u_lightData[0].type");
                var lightDirectionPos = gl.getUniformLocation(model.material.program.program, "u_lightData[0].direction");

                var lightColorPos = gl.getUniformLocation(model.material.program.program, "u_lightData[0].color");
                var lightColorIntensity = gl.getUniformLocation(model.material.program.program, "u_lightData[0].intensity");

                var activeLightPos = gl.getUniformLocation(model.material.program.program, "u_numActiveLightSources");

                var viewPositionPos = gl.getUniformLocation(model.material.program.program, "u_viewPosition");

                for (const variable of Object.keys(model.material.variables)) {
                    const type = model.material.variables[variable].type;
                    const value = model.material.variables[variable].value;

                    var uniformLocation = gl.getUniformLocation(model.material.program.program, variable);

                    if (type === 'integer') {
                        gl.uniform1i(uniformLocation, value)
                    } else if (type === 'float') {
                        gl.uniform1f(uniformLocation, value)
                    } else if (type === 'vec3float') {
                        gl.uniform3fv(uniformLocation, value)
                    } else if (type === 'matrix4float') {
                        gl.uniformMatrix4fv(uniformLocation, false, value);
                    } else {
                        throw new Error('unsupported type')
                    }
                }

                // console.log(model.material.variables)

                const cameraPos = vec3.create();
                mat4.getTranslation(cameraPos, cameraMatrix);
                gl.uniform1i(lightTypePos, 1) // directional
                gl.uniform3fv(lightDirectionPos, lightPos)
                gl.uniform3fv(lightColorPos, [1, 1, 1])
                gl.uniform3fv(viewPositionPos, cameraPos)
                gl.uniform1f(lightColorIntensity, 2.527)
                gl.uniform1i(activeLightPos, 1)

                var primitiveType = gl.TRIANGLES;
                var offset = 0;

                if (!indices) {
                    const triangleCount = part['position'].backingArray.arr.length / part['position'].backingArray.components;
                    gl.drawArrays(primitiveType, offset, triangleCount);
                } else {
                    const triangleCount = indices.backingArray.arr.length;
                    gl.drawElements(primitiveType, triangleCount, gl.UNSIGNED_SHORT, 0)
                }
            }
        }
    }
})


const avgElem = document.getElementById('fps')!;
let frameCounter = 0;
let start = 0;

const runWorld = () => {
    world.update();
    const finish = performance.now();
    const time = finish - start;
    frameCounter++;

    const fps = (frameCounter / (time)) * 1000

    if (frameCounter % 60 === 0) {
        avgElem.textContent = fps.toFixed(2).toString();
    }

    // cameraPosition[0] += 0.05
    // cameraPosition[2] += 0.05
    requestAnimationFrame(runWorld);
}

function boot() {
    start = performance.now();
    requestAnimationFrame(runWorld);
}

boot()


let mousePressed = false;
let startMousePos = { x: 0, y: 0 };

// Event listeners
document.addEventListener('mousedown', (event) => {
    if (event.button === 0) { // Left mouse button
        mousePressed = true;
        startMousePos = { x: event.clientX, y: event.clientY };
    }
});

document.addEventListener('mouseup', () => {
    mousePressed = false;
});

document.addEventListener('mousemove', (event) => {
    if (mousePressed) {
        const dx = event.clientX - startMousePos.x;
        const dy = event.clientY - startMousePos.y;

        mat4.rotateX(cameraMatrix, mat4.clone(cameraMatrix), degToRad(dy * 0.1))
        mat4.rotateY(cameraMatrix, mat4.clone(cameraMatrix), degToRad(dx * 0.1))

        startMousePos = { x: event.clientX, y: event.clientY };
    }
});

document.addEventListener('wheel', (event) => {
    // Adjust the camera's field of view for zooming
    fieldOfViewRadians += degToRad(event.deltaY * 0.05);
    fieldOfViewRadians = Math.max(degToRad(10), Math.min(degToRad(100), fieldOfViewRadians)); // Clamp FOV
    // camera.updateProjectionMatrix();
});