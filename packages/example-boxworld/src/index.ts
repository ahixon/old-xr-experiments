import { TransformComponent } from '@realityshell/engine/components/TransformComponent';
import { ModelComponent } from '@realityshell/engine/components/ModelComponent';
import { WebGLAttribute, WebGLAttributesComponent } from '@realityshell/engine/components/WebGLAttributesComponent'

import { mat4, quat, vec3, vec4 } from 'gl-matrix'
import { Program } from '@realityshell/engine/program'

import { createCubeVertices } from '@realityshell/engine/cube'

import { createWebGLContext } from '@realityshell/engine/context'
import { degToRad } from '@realityshell/engine/utils'
import { World } from '@realityshell/ecs';
import { createF } from '@realityshell/engine/f';

///// world setup

const world = new World();

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

const f = world.addEntity();
world.addComponent(f, new TransformComponent(vec3.fromValues(0, 0, 0), quat.create(), vec3.fromValues(1, 1, 1)))
world.addComponent(f, new ModelComponent(new Map(Object.entries(createF())), null))


for (let i = 0; i < 5; i++) {
    const cube = world.addEntity();
    const cubeRot = quat.create();
    quat.fromEuler(cubeRot, Math.random() * 360, Math.random() * 360, Math.random() * 360)
    world.addComponent(cube, new TransformComponent(vec3.fromValues(Math.random() * 500 - 250, Math.random() * 500 - 250, Math.random() * 500), cubeRot, vec3.fromValues(50, 50, 50)))
    world.addComponent(cube, new ModelComponent(new Map(Object.entries(createCubeVertices())), null))
}

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
attribute vec4 a_color;

uniform mat4 u_matrix;

varying vec4 v_color;

void main() {
  // Multiply the position by the matrix.
  gl_Position = u_matrix * a_position;

  // Pass the color to the fragment shader.
  v_color = a_color;
}`;

var fragmentShaderSource = `precision mediump float;

// Passed in from the vertex shader.
varying vec4 v_color;

void main() {
   gl_FragColor = v_color;
}`;

var program = new Program(gl, vertexShaderSource, fragmentShaderSource);

// lookup uniforms
var matrixLocation = gl.getUniformLocation(program.program, "u_matrix");
// var u_colorMult = gl.getUniformLocation(program.program, "u_colorMult");

var fieldOfViewRadians = degToRad(60);

world.addSystem({
    matchers: new Set([ModelComponent]),
    update(entities) {
        for (const entity of entities) {
            const model = world.getComponents(entity)?.get(ModelComponent)!;
            const exisingAttributes = world.getComponents(entity)?.get(WebGLAttributesComponent);

            if (!exisingAttributes) {
                const attributes = Array.from(model.mesh.keys()).reduce((acc: Record<string, WebGLAttribute>, meshKey: string) => {
                    const bufferData = model.mesh.get(meshKey)!;

                    acc[meshKey] = new WebGLAttribute(gl, bufferData, true, meshKey === 'indices' ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER);

                    return acc;
                }, {})

                world.addComponent(entity, new WebGLAttributesComponent(attributes));
            }
        }
    }
})

world.addSystem({
    matchers: new Set([TransformComponent]),
    update(entities) {

        for (const entity of entities) {
            const transform = world.getComponents(entity)?.get(TransformComponent)!;
            quat.rotateX(transform.rotation, quat.clone(transform.rotation), degToRad(1))
            quat.rotateY(transform.rotation, quat.clone(transform.rotation), degToRad(1))
            quat.rotateZ(transform.rotation, quat.clone(transform.rotation), degToRad(1))
        }
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

        // Compute the camera's matrix using look at.
        const cameraMatrix = mat4.create();
        var cameraPosition = [
            0, 0, 900,
        ];
        var up = [0, 1, 0];
        // mat4.targetTo(cameraMatrix, vec3.fromValues(cameraPosition[0], cameraPosition[1], cameraPosition[2]), vec3.create(), vec3.fromValues(up[0], up[1], up[2]))
        mat4.targetTo(cameraMatrix, vec3.fromValues(cameraPosition[0], cameraPosition[1], cameraPosition[2]), vec3.create(), vec3.fromValues(up[0], up[1], up[2]))

        // Make a view matrix from the camera matrix
        const viewMatrix = mat4.create();
        mat4.invert(viewMatrix, cameraMatrix);

        // Compute a view projection matrix
        const viewProjectionMatrix = mat4.create();
        mat4.multiply(viewProjectionMatrix, projectionMatrix, viewMatrix);

        for (const entity of entities) {
            const transform = world.getComponents(entity)?.get(TransformComponent)!;
            const attributes = world.getComponents(entity)?.get(WebGLAttributesComponent)!;

            gl.useProgram(program.program);

            for (let i = 0; i < gl.getProgramParameter(program.program, gl.ACTIVE_ATTRIBUTES); i++) {
                const attribInfo = gl.getActiveAttrib(program.program, i);
                if (!attribInfo) {
                    continue;
                }

                const attribPointer = gl.getAttribLocation(program.program, attribInfo.name);

                const attrs = attributes.attributes[attribInfo.name.split('_')[1]]
                if (!attrs) {
                    continue
                }

                // console.log('binding', attribInfo.name, attrs)

                gl.bindBuffer(gl.ARRAY_BUFFER, attrs.glBuffer);
                gl.enableVertexAttribArray(attribPointer);
                gl.vertexAttribPointer(
                    attribPointer, attrs.backingArray.components, attrs.glComponentType, attrs.normalize,
                    0, // b.stride || 0, 
                    0, // b.offset || 0
                );
            }

            const indices = attributes.attributes['indices']
            if (indices) {
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, attributes.attributes['indices'].glBuffer);
            }

            const matrix = mat4.create();
            const rotMat = mat4.create();
            mat4.fromQuat(rotMat, transform.rotation);

            mat4.translate(matrix, viewProjectionMatrix, transform.position)
            mat4.multiply(matrix, mat4.clone(matrix), rotMat);
            mat4.scale(matrix, mat4.clone(matrix), transform.scale)

            gl.uniformMatrix4fv(matrixLocation, false, matrix);
            // gl.uniform4fv(u_colorMult, [1, 1, 1, 1]);

            // Draw the geometry.
            var primitiveType = gl.TRIANGLES;
            var offset = 0;

            // console.log(indices)
            if (!indices) {
                const triangleCount = attributes.attributes['position'].backingArray.arr.length / attributes.attributes['position'].backingArray.components;
                gl.drawArrays(primitiveType, offset, triangleCount);
            } else {
                const triangleCount = indices.backingArray.arr.length;
                gl.drawElements(primitiveType, triangleCount, gl.UNSIGNED_SHORT, 0)
            }
        }
    },
})


const runWorld = () => {
    world.update();
    requestAnimationFrame(runWorld);
}

requestAnimationFrame(runWorld);
