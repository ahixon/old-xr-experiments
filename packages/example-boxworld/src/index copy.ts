
import { WorldWithStorage } from '@realityshell/ecs/world-with-storage';
import { SystemWithStorage } from '@realityshell/ecs/system-with-storage';

import { TransformComponent } from '@realityshell/engine/components/TransformComponent';
import { ModelComponent } from '@realityshell/engine/components/ModelComponent';
import { WebGLAttribute, WebGLAttributesComponent } from '@realityshell/engine/components/WebGLAttributesComponent'

import { mat4, quat, vec3 } from 'gl-matrix'
import { Program } from '@realityshell/engine/program'

import { createCubeVertices } from '../../engine/src/geometry/cube'
import { createF } from '../../engine/src/geometry/f'

import { createWebGLContext } from '@realityshell/engine/context'
import { degToRad } from '@realityshell/engine/utils'

///// world setup

const world = new WorldWithStorage();

world.registerComponent(TransformComponent);
world.registerComponent(ModelComponent);
world.registerComponent(WebGLAttributesComponent);

const cube = world.createEntity();
const cubeRot = quat.create();
quat.fromEuler(cubeRot, degToRad(40), degToRad(25), degToRad(325));

world.addComponent(cube, new TransformComponent(
    vec3.fromValues(-150, 0, 360),
    cubeRot,
    vec3.fromValues(1, 1, 1)
))

world.addComponent(cube, new ModelComponent(
    // new Map(Object.entries(createCubeVertices(20))),
    new Map(Object.entries(createF())),
    null,
));


///// canvas setup

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

///// viewport

var fieldOfViewRadians = degToRad(60);
var aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
var zNear = 1;
var zFar = 2000;
var base_matrix = mat4.create();
mat4.perspective(base_matrix, fieldOfViewRadians, aspect, zNear, zFar);


// TODO: figure out how to do changed entites, so we can re-upload their attributes if they change
const compilerSystem = new SystemWithStorage(q => q.hasEveryComponent(ModelComponent) && q.hasNotComponents(WebGLAttributesComponent), (entities) => {
    entities.map(entity => {
        const model = world.getComponent(entity, ModelComponent)!;

        const attributes = Array.from(model.mesh.keys()).reduce((acc: Record<string, WebGLAttribute>, meshKey: string) => {
            const bufferData = model.mesh.get(meshKey)!;

            acc[meshKey] = new WebGLAttribute(gl, bufferData, undefined, undefined);

            return acc;
        }, {})

        world.addComponent(entity, new WebGLAttributesComponent(
            attributes
        ));
    })
});

const renderMeshSystem = new SystemWithStorage(q => q.hasEveryComponent(TransformComponent, WebGLAttributesComponent), (entities) => {
    // calculate projection matrix
    // const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    // const projectionMatrix = mat4.create();
    // mat4.perspective(projectionMatrix, fieldOfViewRadians, aspect, 1, 2000)

    // // Compute the camera's matrix using look at.
    // var cameraPosition = vec3.fromValues(0, 0, 100);
    // var target = vec3.fromValues(0, 0, 0);
    // var up = vec3.fromValues(0, 1, 0);

    // const cameraMatrix = mat4.create();
    // mat4.targetTo(cameraMatrix, cameraPosition, target, up);

    // // Make a view matrix from the camera matrix.
    // const viewMatrix = mat4.create();
    // mat4.invert(viewMatrix, cameraMatrix)

    // const viewProjectionMatrix = mat4.create();
    // mat4.multiply(viewProjectionMatrix, projectionMatrix, viewMatrix);

    entities.forEach(entity => {
        console.log('rendering entity', entity);

        const transform = world.getComponent(entity, TransformComponent)!;

        const attributes = world.getComponent(entity, WebGLAttributesComponent)!;
        console.log(attributes)

        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.CULL_FACE);
        gl.enable(gl.DEPTH_TEST);

        gl.useProgram(program.program);

        // connect attributes buffers
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

            console.log('binding', attribInfo, 'to pos', attribPointer)
            gl.bindBuffer(gl.ARRAY_BUFFER, attrs.glBuffer);
            gl.enableVertexAttribArray(attribPointer);
            console.log('size', attrs.backingArray.components, 'type', attrs.glComponentType)
            gl.vertexAttribPointer(
                attribPointer, attrs.backingArray.components, attrs.glComponentType, attrs.normalize,
                0, // b.stride || 0, 
                0, // b.offset || 0
            );
        }

        // // // connect element array bufffer
        // // const indices = attributes.attributes['position'];
        // // // if (indices) {
        // // //     gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices.glBuffer);
        // // // }

        // calculate u_matrix
        // const u_matrix = mat4.create();
        // mat4.translate(u_matrix, viewProjectionMatrix, tranform.position)

        // mat4.translate(u_matrix, mat4.clone(base_matrix), transform.position);
        // mat4.scale(u_matrix, mat4.clone(u_matrix), transform.scale)
        // matrix = m4.xRotate(matrix, rotation[0]);
        // matrix = m4.yRotate(matrix, rotation[1]);
        // matrix = m4.zRotate(matrix, rotation[2])


        // // // TODO: uncomment and check rotation works
        // // // const rotation_mat4 = mat4.create();
        // // // mat4.fromQuat(rotation_mat4, tranform.rotation);
        // // // mat4.multiply(u_matrix, mat4.clone(u_matrix), rotation_mat4)

        // // const numUniforms = gl.getProgramParameter(program.program, gl.ACTIVE_UNIFORMS);

        // // for (let i = 0; i < numUniforms; i++) {
        // //     const uniformInfo = gl.getActiveUniform(program.program, i);
        // //     if (!uniformInfo) {
        // //         break;
        // //     }

        // //     const location = gl.getUniformLocation(program.program, uniformInfo.name);
        // //     console.log(uniformInfo)
        // //     if (uniformInfo.name === 'u_matrix') {
        // //         gl.uniformMatrix4fv(location, false, u_matrix);
        // //     } else if (uniformInfo.name === 'u_colorMult') {
        // //         gl.uniform4fv(location, [50, 50, 40, 1]);
        // //     }
        // // }

        // // Draw
        // const triangleCount = indices.backingArray.arr.length / indices.backingArray.components;
        // console.log('drawing', triangleCount, 'triangles')
        // gl.drawArrays(gl.TRIANGLES, 0, triangleCount);

        var positionLocation = gl.getAttribLocation(program.program, "a_position");
        var colorLocation = gl.getAttribLocation(program.program, "a_color");

        var matrixLocation = gl.getUniformLocation(program.program, "u_matrix");

        gl.enableVertexAttribArray(positionLocation);

        // Bind the position buffer.
        gl.bindBuffer(gl.ARRAY_BUFFER, attributes.attributes['position'].glBuffer);

        var size = 3;          // 3 components per iteration
        var type = gl.FLOAT;   // the data is 32bit floats
        var normalize = false; // don't normalize the data
        var stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
        var offset = 0;        // start at the beginning of the buffer
        gl.vertexAttribPointer(
            positionLocation, size, type, normalize, stride, offset);

        // Turn on the color attribute
        gl.enableVertexAttribArray(colorLocation);

        // Bind the color buffer.
        gl.bindBuffer(gl.ARRAY_BUFFER, attributes.attributes['color'].glBuffer);

        // Tell the attribute how to get data out of colorBuffer (ARRAY_BUFFER)
        var size = 3;                 // 3 components per iteration
        var type = gl.UNSIGNED_BYTE;  // the data is 8bit unsigned values
        var normalize = true;         // normalize the data (convert from 0-255 to 0-1)
        var stride = 0;               // 0 = move forward size * sizeof(type) each iteration to get the next position
        var offset = 0;               // start at the beginning of the buffer
        gl.vertexAttribPointer(
            colorLocation, size, type, normalize, stride, offset);

        // Set the matrix.
        const matrix = mat4.create();
        mat4.translate(matrix, base_matrix, transform.position);
        mat4.scale(matrix, mat4.clone(matrix), transform.scale)
        // matrix = m4.translate(matrix, translation[0], translation[1], translation[2]);
        // matrix = m4.xRotate(matrix, rotation[0]);
        // matrix = m4.yRotate(matrix, rotation[1]);
        // matrix = m4.zRotate(matrix, rotation[2]);
        // matrix = m4.scale(matrix, scale[0], scale[1], scale[2]);
        gl.uniformMatrix4fv(matrixLocation, false, matrix);

        // Draw the geometry.
        var primitiveType = gl.TRIANGLES;
        var offset = 0;
        var count = 16 * 6;
        gl.drawArrays(primitiveType, offset, count);
    });


})

// TODO: animation system

world.addSystem(compilerSystem)
world.addSystem(renderMeshSystem)

world.update();

