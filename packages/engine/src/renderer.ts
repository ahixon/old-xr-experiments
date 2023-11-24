import { Entity } from "@realityshell/ecs";
import { mat4 } from "gl-matrix";

import { ModelComponent } from "./components/ModelComponent";
import { Camera } from "./camera";
import { MeshBufferType, MeshInstance, MeshPart } from "./mesh";
import type { Material } from "./materials/types";
import { UnlitMaterial } from "./materials/unlit-material";

export type CompiledMaterial = {
    program: WebGLProgram;
    uniformLocationCache: Map<string, WebGLUniformLocation>;
    attributeLocationCache: Map<string, number>;
}

const compileMaterial = (gl: WebGL2RenderingContext, material: Material): CompiledMaterial => {
    if (material instanceof UnlitMaterial) {
        const program = gl.createProgram()!;
        const vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
        gl.shaderSource(vertexShader, `#version 300 es
            precision mediump float;

            uniform mat4 u_viewProjectionMatrix;
            uniform mat4 u_worldMatrix;

            in vec3 a_position;

            void main() {
                gl_Position = u_viewProjectionMatrix * u_worldMatrix * vec4(a_position, 1.0);
            }
        `);
        gl.compileShader(vertexShader);
        if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
            throw new Error('vertex shader compile error: ' + gl.getShaderInfoLog(vertexShader));
        }

        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
        gl.shaderSource(fragmentShader, `#version 300 es
            precision mediump float;
            
            uniform vec3 u_displayColor;
            
            out vec4 outColor;
            
            void main() {
                outColor = vec4(u_displayColor, 1.0);
                // outColor = vec4(vec3(1, 0, 1), 1.0);
            }`);
        gl.compileShader(fragmentShader);
        if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
            throw new Error('fragment shader compile error: ' + gl.getShaderInfoLog(fragmentShader));
        }

        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw new Error('program link error: ' + gl.getProgramInfoLog(program));
        }

        const uniformLocationCache = new Map<string, WebGLUniformLocation>();
        uniformLocationCache.set('u_viewProjectionMatrix', gl.getUniformLocation(program, 'u_viewProjectionMatrix')!);
        uniformLocationCache.set('u_worldMatrix', gl.getUniformLocation(program, 'u_worldMatrix')!);
        uniformLocationCache.set('u_displayColor', gl.getUniformLocation(program, 'u_displayColor')!);

        const attributeLocationCache = new Map<string, number>();
        attributeLocationCache.set('a_position', gl.getAttribLocation(program, 'a_position')!);

        return { program, uniformLocationCache, attributeLocationCache };
    }

    throw new Error('unsupported material type');
}

type RenderState = {
    lastProgramInfo: CompiledMaterial | null;
}

function concatenateTransforms(...transforms: mat4[]) {
    let totalLength = 0;
    for (const arr of transforms) {
        totalLength += arr.length * 4;
    }

    const combinedView = new Float32Array(new ArrayBuffer(totalLength));

    let offset = 0;
    for (const transform of transforms) {
        combinedView.set(transform, offset);
        offset += transform.length * 4 / Float32Array.BYTES_PER_ELEMENT;
    }

    return combinedView;
}

export class Renderer {
    private gl: WebGL2RenderingContext;
    private renderState: RenderState;
    private programCache: Map<Material, CompiledMaterial> = new Map();
    private vaoCache: Map<MeshPart, WebGLVertexArrayObject> = new Map();
    private lastProgramInfo: CompiledMaterial | null = null;

    constructor(gl: WebGL2RenderingContext) {
        this.gl = gl;
    }

    render(entity: Entity, camera: Camera) {
        // TODO: render opaque and transparent meshes separately (transparent meshes in far to near order)

        // walk scene and figure out what parts of each mesh are assigned to each material
        // and the attached instances
        const materialGroups = new Map<Material, { entity: Entity, part: MeshPart, instances: MeshInstance[] }[]>();

        const entityQueue = [entity]
        while (entityQueue.length > 0) {
            const entity = entityQueue.pop()!

            // TODO: cull entities that are outside the camera frustum

            const model = entity.getComponent(ModelComponent);
            if (model) {
                for (const submodel of model.meshData.models) {
                    // find instances of this submodel, so they all get a copy of the part
                    const instances = model.meshData.instances.filter(instance => instance.model === submodel);
                    for (const part of submodel.parts) {
                        const material = model.materials[part.materialIndex];
                        if (!materialGroups.has(material)) {
                            materialGroups.set(material, []);
                        }

                        materialGroups.get(material)!.push({ entity, part, instances });
                    }
                }
            }

            // walk children
            entityQueue.push(...entity.getChildren())
        }

        for (const [material, partInfos] of materialGroups.entries()) {
            this.renderMeshPartsWithMaterial(partInfos, camera, material);
        }

    }

    renderMeshPartsWithMaterial = (partInfos: { entity: Entity, part: MeshPart, instances: MeshInstance[] }[], camera: Camera, material: Material) => {
        // compile material or get from cache
        let compiledMaterial = this.programCache.get(material);
        if (!compiledMaterial) {
            const programInfo = compileMaterial(this.gl, material);
            this.programCache.set(material, programInfo);
            compiledMaterial = programInfo;
        }

        // load the program
        if (this.lastProgramInfo !== compiledMaterial) {
            this.gl.useProgram(compiledMaterial.program);
            console.log('loading program', compiledMaterial.program)
            this.lastProgramInfo = compiledMaterial;
        }

        // upload camera uniforms
        const viewProjectionMatrixPos = compiledMaterial.uniformLocationCache.get('u_viewProjectionMatrix');
        if (viewProjectionMatrixPos) {
            this.gl.uniformMatrix4fv(viewProjectionMatrixPos, false, camera.viewProjectionMatrix);
        }

        // TODO: bind material textures once we support textures

        // render all the instances of each part using VAOs
        for (const { part, instances } of partInfos) {
            const worldMatrices: Float32Array = concatenateTransforms(...instances.map(instance => instance.transform));

            // Bind VAO for part
            if (!this.vaoCache.has(part)) {
                console.log('creating vao for', part)
                const vao = this.gl.createVertexArray()!;
                this.gl.bindVertexArray(vao);

                // Bind buffers
                for (const bufferType of part.buffers.keys()) {
                    if (bufferType === MeshBufferType.TriangleIndicies) {
                        // we bind the indices buffer later
                        continue
                    }

                    const buffer = part.buffers.get(bufferType as MeshBufferType)!;

                    let attribName;
                    if (bufferType === MeshBufferType.Positions) {
                        attribName = 'a_position';
                    } else {
                        console.warn('unsupported buffer type', bufferType);
                        continue;
                    }

                    const attribPointer = compiledMaterial.attributeLocationCache.get(attribName);
                    if (attribPointer === undefined) {
                        console.warn('missing attribute pointer for', attribName);
                        continue;
                    }

                    let glBufferType;
                    if (buffer.arr instanceof Int8Array) {
                        glBufferType = this.gl.BYTE;
                    } else if (buffer.arr instanceof Uint8Array) {
                        glBufferType = this.gl.UNSIGNED_BYTE;
                    } else if (buffer.arr instanceof Int16Array) {
                        glBufferType = this.gl.SHORT;
                    } else if (buffer.arr instanceof Uint16Array) {
                        glBufferType = this.gl.UNSIGNED_SHORT;
                    } else if (buffer.arr instanceof Int32Array) {
                        glBufferType = this.gl.INT;
                    } else if (buffer.arr instanceof Uint32Array) {
                        glBufferType = this.gl.UNSIGNED_INT;
                    } else if (buffer.arr instanceof Float32Array) {
                        glBufferType = this.gl.FLOAT;
                    } else {
                        throw new Error('unsupported buffer type');
                    }
                    
                    console.log('binding', attribName, 'to', attribPointer, 'with type', glBufferType);

                    const glBuffer = this.gl.createBuffer();
                    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, glBuffer);
                    this.gl.bufferData(this.gl.ARRAY_BUFFER, buffer.arr, this.gl.STATIC_DRAW);

                    this.gl.enableVertexAttribArray(attribPointer);
                    this.gl.vertexAttribPointer(
                        attribPointer, buffer.components, glBufferType, false, 0, 0
                    );
                }

                // now bind the indices
                if (part.buffers.has(MeshBufferType.TriangleIndicies)) {
                    console.log('binding indices')
                    const glBuffer = this.gl.createBuffer();
                    const buffer = part.buffers.get(MeshBufferType.TriangleIndicies)!;
                    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, glBuffer);
                    this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, buffer.arr, this.gl.STATIC_DRAW);
                }

                this.vaoCache.set(part, vao);
            } else {
                this.gl.bindVertexArray(this.vaoCache.get(part)!);
            }

            // upload world matrices
            // FIXME: this is wrong, it should upload it so it can be accessed as a per-instance attribute
            // not as a uniform
            const worldMatrixPos = compiledMaterial.uniformLocationCache.get('u_worldMatrix');
            if (worldMatrixPos) {
                this.gl.uniformMatrix4fv(worldMatrixPos, false, worldMatrices);
            }

            // FIXME: making binding for uniforms more generic
            const colorPos = compiledMaterial.uniformLocationCache.get('u_displayColor');
            if (colorPos) {
                this.gl.uniform3fv(colorPos, material.color);
            }

            // Render instances
            if (part.buffers.has(MeshBufferType.TriangleIndicies)) {
                const buffer = part.buffers.get(MeshBufferType.TriangleIndicies)!;

                // FIXME: determine length based on type
                this.gl.drawElementsInstanced(this.gl.TRIANGLES, buffer.arr.length, this.gl.UNSIGNED_SHORT, 0, instances.length);
            } else if (part.buffers.has(MeshBufferType.Positions)) {
                const buffer = part.buffers.get(MeshBufferType.Positions)!;
                this.gl.drawArraysInstanced(this.gl.TRIANGLES, 0, buffer.arr.length / buffer.components, instances.length);
            }
        }
    }
}

// TODO: move this

// let lightPos = [-0.7112688926164376, -10.4790139227525348, -0.5144338871083584]

// var viewProjectionMatrixLocation;
// let lastProg = null;
// var displayColorLocation;
// export const rendererSystem = (world, gl): System<{ camera: Camera }> => ({
//     matchers: new Set([TransformComponent, WebGLAttributesComponent]),
//     update({ entities, data: { camera, updatedCamera: defaultUpdatedCamera } }) {
//         let updatedCamera = defaultUpdatedCamera;

//         for (const entity of entities.keys()) {
//             const transform = world.getComponents(entity)?.get(TransformComponent)!;
//             const attributes = world.getComponents(entity)?.get(WebGLAttributesComponent)!;

//             const model = world.getComponents(entity)?.get(ModelComponent)!;

//             if (!lastProg) {
//                 gl.useProgram(model.material.program.program);
//                 lastProg = model.material.program.program;
//             }

//             if (!viewProjectionMatrixLocation) {
//                 viewProjectionMatrixLocation = gl.getUniformLocation(lastProg, "u_viewProjectionMatrix");
//                 displayColorLocation = gl.getUniformLocation(lastProg, "u_displayColor");
//             }

//             if (!updatedCamera) {
//                 gl.uniformMatrix4fv(viewProjectionMatrixLocation, false, camera.viewProjectionMatrix);
//                 updatedCamera = true;
//             }

//             for (const partName of attributes.attributesForPart.keys()) {
//                 const part = attributes.attributesForPart.get(partName)!;
//                 for (let attribName of attributes.locs.keys()) {
//                     // console.log(attribName)

//                     let lookupAttribName = attribName;

//                     if (attribName == 'texcoord_0') {
//                         lookupAttribName = 'uv';
//                     }

//                     const partAttr = part[lookupAttribName];
//                     if (!partAttr) {
//                         // console.warn('attributes for part missing', lookupAttribName, part)
//                         continue;
//                     }

//                     const attribPointer = attributes.locs.get(attribName)!;

//                     // console.log('binding', attribName, 'to', attribPointer)

//                     gl.bindBuffer(gl.ARRAY_BUFFER, partAttr.glBuffer);
//                     gl.enableVertexAttribArray(attribPointer);
//                     gl.vertexAttribPointer(
//                         attribPointer, partAttr.backingArray.components, partAttr.componentType, partAttr.normalize,
//                         0, // b.stride || 0, 
//                         0, // b.offset || 0
//                     );
//                 }

//                 const indices = part['indices']
//                 if (indices) {
//                     gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, part['indices'].glBuffer);
//                 }

//                 // const worldMatrix = transform.transform;

//                 // Pass the matrix to the shader
//                 // gl.uniformMatrix4fv(worldMatrixLocation, false, worldMatrix);

//                 // gl.uniformMatrix4fv(worldInverseTransposeMatrixLocation, false, transform.inverseTransform);

//                 // Create and populate the world matrix buffer
//                 // const inverseTransposeMatrix = transform.inverseTransform



//                 // Get the indices of the uniform blocks
//                 const worldMatrixBlockIndex = attributes.locs.get('WorldMatrixBlock')
//                 // const inverseTransposeMatrixBlockIndex = attributes.locs.get('InverseTransposeMatrixBlock')

//                 // Bind the buffers to the uniform blocks
//                 gl.bindBufferBase(gl.UNIFORM_BUFFER, worldMatrixBlockIndex, attributes.compiledPositions.worldMatrixBuffer);
//                 // gl.bindBufferBase(gl.UNIFORM_BUFFER, inverseTransposeMatrixBlockIndex, attributes.compiledPositions.inverseTransposeMatrixBuffer);

//                 // // Create a new Float32Array to hold the data
//                 // let worldMatrixData = new Float32Array(16);
//                 // let inverseTransposeMatrixData = new Float32Array(16);

//                 // Read back the data from the buffers
//                 //                 gl.bindBuffer(gl.UNIFORM_BUFFER, attributes.compiledPositions.worldMatrixBuffer);
//                 // gl.getBufferSubData(gl.UNIFORM_BUFFER, 0, worldMatrixData, 0, 16);

//                 // gl.bindBuffer(gl.UNIFORM_BUFFER, attributes.compiledPositions.inverseTransposeMatrixBuffer);
//                 // gl.getBufferSubData(gl.UNIFORM_BUFFER, 0, inverseTransposeMatrixData, 0, 16);

//                 // Log the data
//                 // console.log(worldMatrixData);
//                 // console.log(inverseTransposeMatrixData);

//                 // if (worldMatrixData.toString() !== transform.transform.toString()) {
//                 //     console.log('mismatch', worldMatrixData, transform.transform)
//                 //     throw new Error('uh oh')
//                 // }

//                 // var lightTypePos = gl.getUniformLocation(model.material.program.program, "u_lightData[0].type");
//                 // var lightDirectionPos = gl.getUniformLocation(model.material.program.program, "u_lightData[0].direction");

//                 // var lightColorPos = gl.getUniformLocation(model.material.program.program, "u_lightData[0].color");
//                 // var lightColorIntensity = gl.getUniformLocation(model.material.program.program, "u_lightData[0].intensity");

//                 // var activeLightPos = gl.getUniformLocation(model.material.program.program, "u_numActiveLightSources");

//                 // var viewPositionPos = gl.getUniformLocation(model.material.program.program, "u_viewPosition");

//                 // const envMatrixPos = gl.getUniformLocation(model.material.program.program, "u_envMatrix")


//                 // let textureUnitIndex = 0;
//                 // for (const variable of Object.keys(model.material.variables)) {
//                 //     const type = model.material.variables[variable].type;
//                 //     const value = model.material.variables[variable].value;

//                 //     var uniformLocation = gl.getUniformLocation(model.material.program.program, variable);

//                 //     if (type === 'integer') {
//                 //         gl.uniform1i(uniformLocation, value)
//                 //     } else if (type === 'float') {
//                 //         gl.uniform1f(uniformLocation, value)
//                 //     } else if (type === 'vec3float') {
//                 //         gl.uniform3fv(uniformLocation, value)
//                 //     } else if (type === 'matrix4float') {
//                 //         gl.uniformMatrix4fv(uniformLocation, false, value);
//                 //     } else if (type === 'filename') {
//                 //         const texture = model.material.textures.get(variable);
//                 //         if (!texture) {
//                 //             console.warn('no texture for', variable)
//                 //             textureUnitIndex++;
//                 //             continue;
//                 //         }
//                 //         // console.log('loading texture from', variable, 'into texture unit', textureUnitIndex, 'with variable', variable)
//                 //         gl.activeTexture(gl.TEXTURE0 + textureUnitIndex);
//                 //         gl.bindTexture(gl.TEXTURE_2D, texture);

//                 //         // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
//                 //         // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
//                 //         // // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, s.filter);
//                 //         // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

//                 //         const textureLoc = gl.getUniformLocation(model.material.program.program, variable)
//                 //         if (!textureLoc) {
//                 //             // console.warn('no texture loc for', variable);
//                 //         }

//                 //         gl.uniform1i(textureLoc, textureUnitIndex);
//                 //         textureUnitIndex++;
//                 //         // console.log('binding', variable, 'to', textureUnitIndex, texture)
//                 //     } else {
//                 //         throw new Error('unsupported type ' + type)
//                 //     }
//                 // }

//                 // const worldPosition = mat4.getTranslation(vec3.create(), camera.cameraMatrixWorld);

//                 // gl.uniform1i(lightTypePos, 1) // directional
//                 // gl.uniform3fv(lightDirectionPos, lightPos)
//                 // gl.uniform3fv(lightColorPos, [1, 1, 1])
//                 // gl.uniform3fv(viewPositionPos, worldPosition)
//                 // gl.uniform1f(lightColorIntensity, 1.5277600288391113)
//                 // gl.uniform1i(activeLightPos, 1)


//                 // gl.uniformMatrix4fv(envMatrixPos, false, [
//                 //     6.123233995736766e-17,
//                 //     0,
//                 //     -1,
//                 //     0,
//                 //     0,
//                 //     1,
//                 //     0,
//                 //     0,
//                 //     1,
//                 //     0,
//                 //     6.123233995736766e-17,
//                 //     0,
//                 //     0,
//                 //     0,
//                 //     0,
//                 //     1
//                 // ])

//                 if (model.material.variables.u_color) {
//                     gl.uniform3fv(displayColorLocation, model.material.variables.u_color.value);
//                 } else {
//                     // console.warn('no color')
//                     gl.uniform3fv(displayColorLocation, [1, 1, 1]);
//                 }

//                 var primitiveType = gl.TRIANGLES;
//                 var offset = 0;

//                 if (!indices) {
//                     const triangleCount = part['position'].backingArray.arr.length / part['position'].backingArray.components;
//                     gl.drawArrays(primitiveType, offset, triangleCount);
//                 } else {
//                     const triangleCount = indices.backingArray.arr.length;
//                     gl.drawElements(primitiveType, triangleCount, gl.UNSIGNED_SHORT, 0)
//                 }
//             }
//         }
//     }
// })