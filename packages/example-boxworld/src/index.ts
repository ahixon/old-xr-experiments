import { TransformComponent } from '@realityshell/engine/components/TransformComponent';
import { ModelComponent } from '@realityshell/engine/components/ModelComponent';
import { WebGLAttribute, WebGLAttributesComponent } from '@realityshell/engine/components/WebGLAttributesComponent'

import { mat4, quat, vec3, vec4 } from 'gl-matrix'
import { Program } from '@realityshell/engine/program'

import { createCubeVertices } from '../../engine/src/geometry/cube'

import { createWebGLContext } from '@realityshell/engine/context'
import { degToRad } from '@realityshell/engine/utils'
import { Entity, World } from '@realityshell/ecs';
import { createF } from '@realityshell/engine/geometry/f';
import { Mesh, MeshBufferType, MeshModel, MeshPart } from '@realityshell/engine/mesh';
import { SizedArray } from '../../engine/src/array';

///// world setup

const world = new World();

class ParentComponent {
    parent: Entity;
    constructor(parent: Entity) {
        this.parent = parent;
    }
}

///////////////////////////////


// var numFs = 5;
// var radius = 200;

// var fPosition = [0, 0, 0];

// let mainF: undefined | number = undefined;
// for (let i = 0; i < numFs; i++) {
//     var angle = i * Math.PI * 2 / numFs;
//     var x = Math.cos(angle) * radius;
//     var y = Math.sin(angle) * radius;

//     const f = world.addEntity();
//     world.addComponent(f, new TransformComponent(vec3.fromValues(fPosition[0] + x, fPosition[1], fPosition[2] + y), quat.create(), vec3.fromValues(1, 1, 1)))
//     // world.addComponent(f, new ModelComponent(new Map(Object.entries(createF())), null))
//     world.addComponent(f, new ModelComponent(new Map(Object.entries(createCubeVertices())), null))

//     if (!mainF) {
//         mainF = f;
//     }
// }

// const f = world.addEntity();
// world.addComponent(f, new TransformComponent(vec3.fromValues(0, 0, 0), quat.create(), vec3.fromValues(1, 1, 1)))
// const fMesh = new Mesh();
// const fModel = new MeshModel("f-model");
// const fParts = createF();
// fModel.parts.push(...fParts)
// fMesh.models.push(fModel)
// world.addComponent(f, new ModelComponent(fMesh, null))

// const f2 = world.addEntity();
// world.addComponent(f2, new TransformComponent(vec3.fromValues(100, 100, 100), quat.create(), vec3.fromValues(0.5, 0.5, 0.5)))
// world.addComponent(f2, new ModelComponent(fMesh, null))

const sceneJson = (await import('./tv_retro.json')).default
const defaultNode = sceneJson.nodes[sceneJson.default];
// const defaultNode = sceneJson.nodes['/__Prototype_97/Geom'];

const addEntity = (sceneEntity, parent) => {
    // console.log('adding', sceneEntity)
    const bottle = world.addEntity();

    if (sceneEntity.points) {
        const bottleMesh = new Mesh();
        const bottleModel = new MeshModel('bottle');
        const bottlePart = new MeshPart('bottle-mesh', 0)
        bottlePart.buffers.set(MeshBufferType.Positions, new SizedArray(new Float32Array(sceneEntity.points.flat()), 3))
        bottlePart.buffers.set(MeshBufferType.Normals, new SizedArray(new Float32Array(sceneEntity.normals.flat()), 3))
        bottlePart.triangleIndices = {
            type: MeshBufferType.TriangleIndicies,
            data: new SizedArray(new Uint16Array(sceneEntity.triangleIndices), 3)
        }
        bottleModel.parts.push(bottlePart)
        bottleMesh.models.push(bottleModel);
        
        world.addComponent(bottle, new ModelComponent(bottleMesh, null))
    }
    
    const m = mat4.fromValues(...sceneEntity.transform.flat());
    world.addComponent(bottle, new TransformComponent(m));
    if (parent) {
        world.addComponent(bottle, new ParentComponent(parent))
    }

    for (const child of sceneEntity.children) {
        addEntity(sceneJson.nodes[child], bottle)
    }
}

console.log(defaultNode)
addEntity(defaultNode, null);

const light = world.addEntity();
let initialLightDir = vec3.fromValues(1.0, -0.5, 0.9)
vec3.normalize(initialLightDir, vec3.clone(initialLightDir));

const lightTransform = mat4.create();
mat4.fromTranslation(lightTransform, initialLightDir)
world.addComponent(light, new TransformComponent(lightTransform))
// world.addComponent(light, new ModelComponent(fMesh, null))


// const cubeMesh = new Mesh();
// const cubeModel = new MeshModel("cube-model");
// const cubeParts = createCubeVertices();
// cubeModel.parts.push(...cubeParts)
// cubeMesh.models.push(cubeModel)

// for (let i = 0; i < 5; i++) {
//     const cube = world.addEntity();
//     const cubeRot = quat.create();
//     quat.fromEuler(cubeRot, Math.random() * 360, Math.random() * 360, Math.random() * 360)
//     world.addComponent(cube, new TransformComponent(vec3.fromValues(Math.random() * 500 - 250, Math.random() * 500 - 250, Math.random() * 500), cubeRot, vec3.fromValues(50, 50, 50)))

//     world.addComponent(cube, new ModelComponent(cubeMesh, null))
// }

///////////////////////////////

const gl = createWebGLContext({
    xrCompatible: true
});

if (!gl || !(gl instanceof WebGLRenderingContext || gl instanceof WebGL2RenderingContext)) {
    throw new Error('no gl context');
}

document.body.appendChild(gl.canvas);

gl.canvas.width = 500;
gl.canvas.height = 500;

///// shader programs

var vertexShaderSource = `attribute vec4 a_position;
attribute vec3 a_normal;

uniform mat4 u_worldViewProjection;
uniform mat4 u_world;

varying vec3 v_normal;

void main() {
    gl_Position = u_worldViewProjection * a_position;

    // orient the normals and pass to the fragment shader
    v_normal = mat3(u_world) * a_normal;
}`;

var fragmentShaderSource = `precision mediump float;

varying vec3 v_normal;
 
uniform vec3 u_reverseLightDirection;
uniform vec4 u_color;

void main() {
    // because v_normal is a varying it's interpolated
    // so it will not be a unit vector. Normalizing it
    // will make it a unit vector again
    vec3 normal = normalize(v_normal);
  
    float light = dot(normal, u_reverseLightDirection);
  
    gl_FragColor = u_color;
  
    // Lets multiply just the color portion (not the alpha)
    // by the light
    gl_FragColor.rgb *= light;
}`;

var program = new Program(gl, vertexShaderSource, fragmentShaderSource);

// lookup uniforms
var worldViewProjectionLocation = gl.getUniformLocation(program.program, "u_worldViewProjection");
var worldLocation = gl.getUniformLocation(program.program, "u_world");
var u_color = gl.getUniformLocation(program.program, "u_color");
var reverseLightDirectionLocation = gl.getUniformLocation(program.program, "u_reverseLightDirection");

var fieldOfViewRadians = degToRad(60);

world.addSystem({
    matchers: new Set([ModelComponent]),
    update(entities) {
        for (const entity of entities) {
            const exisingAttributes = world.getComponents(entity)?.get(WebGLAttributesComponent);
            
            if (!exisingAttributes) {
                const model = world.getComponents(entity)?.get(ModelComponent)!;
                const attributes = new Map();
                for (const meshmodel of model.mesh.models) {
                    // FIXME: what about submodels with same IDs
                    for (const part of meshmodel.parts) {
                        const attributesForPart = Array.from(part.buffers.keys() as any as Exclude<MeshBufferType, MeshBufferType.TriangleIndicies>[]).reduce((acc: Record<MeshBufferType, WebGLAttribute>, meshKey: Exclude<MeshBufferType, MeshBufferType.TriangleIndicies>) => {
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

                for (let i = 0; i < gl.getProgramParameter(program.program, gl.ACTIVE_ATTRIBUTES); i++) {
                    const attribInfo = gl.getActiveAttrib(program.program, i);
                    if (!attribInfo) {
                        continue;
                    }

                    const attribPointer = gl.getAttribLocation(program.program, attribInfo.name);

                    locs.set(attribInfo.name.split('_')[1], attribPointer);
                }

                world.addComponent(entity, new WebGLAttributesComponent(attributes, locs));
            }
        }
    }
})

// world.addSystem({
//     matchers: new Set([TransformComponent]),
//     update(entities) {

//         for (const entity of entities) {
//             const transform = world.getComponents(entity)?.get(TransformComponent)!;
//             if (entity === light) {
//                 // transform.position[2] += 0.1
//             } else {
//                 quat.rotateX(transform.rotation, quat.clone(transform.rotation), degToRad(1))
//                 quat.rotateY(transform.rotation, quat.clone(transform.rotation), degToRad(1))
//                 quat.rotateZ(transform.rotation, quat.clone(transform.rotation), degToRad(1))
//             }
//         }
//     }
// })

var cameraPosition = [
    0, -300, 200,
];

gl.useProgram(program.program);

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

        // Compute the camera's matrix using look at.
        const cameraMatrix = mat4.create();
       
        var up = [0, 1, 0];
        mat4.targetTo(cameraMatrix, vec3.fromValues(cameraPosition[0], cameraPosition[1], cameraPosition[2]), vec3.fromValues(0, 0, 120), vec3.fromValues(up[0], up[1], up[2]))

        // Make a view matrix from the camera matrix
        const viewMatrix = mat4.create();
        mat4.invert(viewMatrix, cameraMatrix);

        // Compute a view projection matrix
        const viewProjectionMatrix = mat4.create();
        mat4.multiply(viewProjectionMatrix, projectionMatrix, viewMatrix);

        for (const entity of entities.keys()) {
            const transform = world.getComponents(entity)?.get(TransformComponent)!;
            const attributes = world.getComponents(entity)?.get(WebGLAttributesComponent)!;

            for (const partName of attributes.attributesForPart.keys()) {
                const part = attributes.attributesForPart.get(partName)!;
                for (const attribName of attributes.locs.keys()) {
                    const partAttr = part[attribName];
                    const attribPointer = attributes.locs.get(attribName)!;

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
                gl.uniformMatrix4fv(worldLocation, false, worldMatrix);
                gl.uniform4fv(u_color, [1, 1.0, 1, 1]);

                // set the light direction.
                const normalizedPos = vec3.create();

                const lightPos = vec3.create();
                // const scale = vec3.create();
                // const rot = quat.create();
                mat4.getTranslation(lightPos, world.getComponents(light)?.get(TransformComponent)!.transform);
                // mat4.getScaling(scale, m)
                // mat4.getRotation(rot, m);


                vec3.normalize(normalizedPos, lightPos)
                gl.uniform3fv(reverseLightDirectionLocation, normalizedPos);

                // Draw the geometry.
                var primitiveType = gl.TRIANGLES;
                var offset = 0;

                // console.log(indices)
                if (!indices) {
                    const triangleCount = part['position'].backingArray.arr.length / part['position'].backingArray.components;
                    gl.drawArrays(primitiveType, offset, triangleCount);
                } else {
                    const triangleCount = indices.backingArray.arr.length;
                    // console.log(indices);
                    // break;
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

    cameraPosition[1] += 0.05
    // cameraPosition[2] += 0.05
    requestAnimationFrame(runWorld);
}

function boot() {
    start = performance.now();
    requestAnimationFrame(runWorld);
}

boot()
