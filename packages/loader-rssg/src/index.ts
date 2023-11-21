import { TransformComponent } from '@realityshell/engine/components/TransformComponent';

import { mat4, vec2, vec3 } from 'gl-matrix'

import { World } from "@realityshell/ecs";
import { Mesh, MeshBufferType, MeshModel, MeshPart } from "@realityshell/engine/mesh";
import { Program } from '@realityshell/engine/program'
import libtess from 'libtess';
import { SizedArray } from "../../engine/src/array";
import { calculateNormals, calculateTangentsWithoutUV } from "@realityshell/engine/utils";
import { ModelComponent } from "@realityshell/engine/components/ModelComponent";
import { ParentComponent } from '@realityshell/engine/components/ParentComponent';

export function loadScene(world: World, gl, metadata, bin) {
    const defaultNode = metadata.nodes[metadata.default];
    addEntity(world, gl, metadata, bin, defaultNode, null);
    console.log('done')
}

function calculateTangentsWithUV(vertices, normals, uvs) {
    let tangents = [];

    for (let i = 0; i < vertices.length; i += 9) {
        // Get vertices and UVs of the triangle
        let v0 = [vertices[i], vertices[i + 1], vertices[i + 2]];
        let v1 = [vertices[i + 3], vertices[i + 4], vertices[i + 5]];
        let v2 = [vertices[i + 6], vertices[i + 7], vertices[i + 8]];

        let uv0 = [uvs[i / 3], uvs[i / 3 + 1]];
        let uv1 = [uvs[i / 3 + 2], uvs[i / 3 + 3]];
        let uv2 = [uvs[i / 3 + 4], uvs[i / 3 + 5]];

        // Calculate differences in x, y, z and UV coordinates
        let deltaPos1 = [v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]];
        let deltaPos2 = [v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]];

        let deltaUV1 = [uv1[0] - uv0[0], uv1[1] - uv0[1]];
        let deltaUV2 = [uv2[0] - uv0[0], uv2[1] - uv0[1]];

        // Calculate tangent
        let r = 1.0 / (deltaUV1[0] * deltaUV2[1] - deltaUV1[1] * deltaUV2[0]);
        let tangent = [
            (deltaPos1[0] * deltaUV2[1] - deltaPos2[0] * deltaUV1[1]) * r,
            (deltaPos1[1] * deltaUV2[1] - deltaPos2[1] * deltaUV1[1]) * r,
            (deltaPos1[2] * deltaUV2[1] - deltaPos2[2] * deltaUV1[1]) * r
        ];

        // Add the calculated tangent to the tangents array for each vertex of the triangle
        tangents.push(...tangent, ...tangent, ...tangent);
    }

    return tangents;
}


export const addEntity = (world: World, gl, sceneJson, sceneBin, sceneEntity: any, parent: any) => {
    const bottle = world.addEntity();

    // console.log('loading', sceneEntity)

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

        let uvValues;
        let uvIndices;
        if (sceneEntity.uvValues) {
            const uvValuesSlice = sceneBin.slice(sceneEntity.uvValues.offset, sceneEntity.uvValues.offset + sceneEntity.uvValues.size)
            uvValues = new Float32Array(uvValuesSlice);

            const uvIndicesSlice = sceneBin.slice(sceneEntity.uvIndices.offset, sceneEntity.uvIndices.offset + sceneEntity.uvIndices.size)
            uvIndices = new Uint16Array(uvIndicesSlice);
        }
        
        var tessy = (function initTesselator() {
            // function called for each vertex of tesselator output
            function vertexCallback(data, {trianglePositions, uvs}) {
                //   console.log(data);
                const { coords } = data;
                trianglePositions[trianglePositions.length] = coords[0];
                trianglePositions[trianglePositions.length] = coords[1];
                trianglePositions[trianglePositions.length] = coords[2];

                if (uvs && data.uv) {
                    uvs.push(data.uv)
                }
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
            // In the combinecallback function
            function combinecallback(coords, dataBeingCombined, weight) {
                console.log('combine callback', coords, dataBeingCombined);

                // Interpolate UVs
                let u = 0, v = 0;
                for (let i = 0; i < dataBeingCombined.length; i++) {
                    if (dataBeingCombined[i]) {
                        u += weight[i] * dataBeingCombined[i].uv[0];
                        v += weight[i] * dataBeingCombined[i].uv[1];
                    }
                }

                return {
                    coords: [coords[0], coords[1], coords[2]],
                    uv: [u, v]
                };
            }
            // function edgeCallback(flag, data) {
            //     // don't really care about the flag, but need no-strip/no-fan behavior
            //     //   console.log('edge flag: ' + flag, data);
            // }

            var tessy = new libtess.GluTesselator();
            tessy.gluTessProperty(libtess.gluEnum.GLU_TESS_WINDING_RULE, libtess.windingRule.GLU_TESS_WINDING_POSITIVE);
            tessy.gluTessCallback(libtess.gluEnum.GLU_TESS_VERTEX_DATA, vertexCallback);
            tessy.gluTessCallback(libtess.gluEnum.GLU_TESS_BEGIN, begincallback);
            tessy.gluTessCallback(libtess.gluEnum.GLU_TESS_ERROR, errorcallback);
            tessy.gluTessCallback(libtess.gluEnum.GLU_TESS_COMBINE, combinecallback);
            // tessy.gluTessCallback(libtess.gluEnum.GLU_TESS_EDGE_FLAG, edgeCallback);
            tessy.gluTessProperty(libtess.gluEnum.GLU_TESS_TOLERANCE, 0.1);

            return tessy;
        })();


        // TODO: support holes in meshes

        let vertexIndexPointer = 0;
        const totalPositions = [];
        const meshUvs = [];

        for (let i = 0; i < faceCounts.length; i++) {
            const numVertices = faceCounts[i];

            var trianglePositions = [];
            var uvs = []
            if (numVertices !== 3) {
                const faceIndicesForCurrentPolygon = [];

                tessy.gluTessBeginPolygon({
                    trianglePositions,
                    uvs
                });

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

                    let uv;
                    if (uvIndices && uvValues) {
                        const uvIndex = uvIndices[vertexIndexPointer - 1];
                
                        const u = uvValues[2 * uvIndex];
                        const v = 1 - uvValues[2 * uvIndex + 1];
                        uv = [u, v];
                    }

                    tessy.gluTessVertex(coords, { coords, uv });

                    // Store vertex index for later normal computation
                    faceIndicesForCurrentPolygon.push(vertexIndex);
                }

                tessy.gluTessEndContour();

                tessy.gluTessEndPolygon();
            } else {
                for (let j = 0; j < numVertices; j++) {
                    const vertexIndex = faceIndices[vertexIndexPointer++];

                    const positionPointer = 3 * vertexIndex;

                    // Retrieve 3D position for the current vertex
                    const x = pos[positionPointer];
                    const y = pos[positionPointer + 1];
                    const z = pos[positionPointer + 2];

                    let uv;
                    if (uvIndices && uvValues) {
                        const uvIndex = uvIndices[vertexIndexPointer - 1];
                
                        const u = uvValues[2 * uvIndex];
                        const v = 1 - uvValues[2 * uvIndex + 1];
                        uv = [u, v];
                        uvs.push(uv)
                    }


                    trianglePositions.push(x, y, z);
                }
            }

            totalPositions.push([...trianglePositions]);
            meshUvs.push(...uvs.flat());
        }

        const flatTriangleVerts = new Float32Array(totalPositions.flat())

        bottlePart.buffers.set(MeshBufferType.Positions, new SizedArray(flatTriangleVerts, 3))

        var normals = calculateNormals(flatTriangleVerts);
        const normalsFlat = new Float32Array(normals);
        bottlePart.buffers.set(MeshBufferType.Normals, new SizedArray(normalsFlat, 3))

        if (meshUvs.length) {
            console.log('setting uvs on', sceneEntity, 'to', meshUvs)
            const meshUvsFloat = new Float32Array(meshUvs)
            bottlePart.buffers.set(MeshBufferType.UV, new SizedArray(meshUvsFloat, 2));

            const tangents = calculateTangentsWithUV(flatTriangleVerts, normalsFlat, meshUvsFloat)
            bottlePart.buffers.set(MeshBufferType.Tangent, new SizedArray(new Float32Array(tangents), 2))
        } else {
            const tangents = calculateTangentsWithoutUV(flatTriangleVerts, normalsFlat)
            bottlePart.buffers.set(MeshBufferType.Tangent, new SizedArray(new Float32Array(tangents), 2))
        }

        bottleModel.parts.push(bottlePart)
        bottleMesh.models.push(bottleModel);

        let material = null;
        let textures = new Map();

        for (const variableName of Object.keys(sceneEntity.material.variables)) {
            const variable = sceneEntity.material.variables[variableName];
            if (variable.type === 'filename') {
                console.log('need to load', variable)

                const str = variable.value;
                const regex = /\[(.+)\]$/;
                const match = str.match(regex);
                const filename = match ? match[1] : null;

                if (!filename){
                    console.warn('missing filename in', str)
                    continue;
                }


                var texture = gl.createTexture();
                gl.bindTexture(gl.TEXTURE_2D, texture);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
                    new Uint8Array([0, 0, 255, 255]));

                var image = new Image();
                image.src = filename;
                image.addEventListener('load', function (event) {
                    // Load the texture
                    var texture = gl.createTexture();
                    gl.bindTexture(gl.TEXTURE_2D, texture);
                    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, event.target);
                    gl.generateMipmap(gl.TEXTURE_2D);
                    
                    console.log('loaded texture', filename, 'to', texture, event.target);
                    
                    textures.set(variableName, texture)
                });

                textures.set(variableName, texture)
            }
        }

        if (sceneEntity.material) {
            // console.log(sceneEntity, 'had shader', sceneEntity.material.frag)
            material = {
                program: new Program(gl, sceneEntity.material.vert, sceneEntity.material.frag),
                variables: sceneEntity.material.variables,
                textures,
            }
        } else {
            console.warn('no material defined')
            const debugFrag = `#version 300 es
                        precision mediump float;
                        
                        in vec3 normalWorld;
                        out vec4 outColor;
                        
                        void main() {
                          // Normalize the normal vector
                          vec3 normal = normalize(normalWorld);
                        
                          // Use the normal to calculate the lighting
                          float lighting = dot(normal, vec3(0.0, 0.0, 1.0));
                        
                          // Use the lighting to calculate the color
                          outColor = vec4(lighting, lighting, lighting, 1.0);
                        }`;

            const debugVert = `#version 300 es

            precision mediump float;
            
            // Uniform block: PrivateUniforms
            uniform mat4 u_worldMatrix;
            uniform mat4 u_viewProjectionMatrix;
            uniform mat4 u_worldInverseTransposeMatrix;
            
            // Inputs block: VertexInputs
            in vec3 i_position;
            in vec3 i_tangent;
            in vec3 i_normal;
            
            out vec3 tangentWorld;
            out vec3 normalWorld;
            out vec3 positionWorld;
            
            void main()
            {
                vec4 hPositionWorld = u_worldMatrix * vec4(i_position, 1.0);
                gl_Position = u_viewProjectionMatrix * hPositionWorld;
                tangentWorld = normalize((u_worldMatrix * vec4(i_tangent, 0.0)).xyz);
                normalWorld = normalize((u_worldInverseTransposeMatrix * vec4(i_normal, 0.0)).xyz);
                positionWorld = hPositionWorld.xyz;
            }`;

            material = {
                program: new Program(gl, debugVert, debugFrag),
                variables: {},
                textures,
            }
        }

        // console.log('loaded', bottle)

        world.addComponent(bottle, new ModelComponent(bottleMesh, material))
    }

    const m = mat4.fromValues(...sceneEntity.transform.flat());
    world.addComponent(bottle, new TransformComponent(m));
    if (parent) {
        world.addComponent(bottle, new ParentComponent(parent))
    }

    for (const child of sceneEntity.children) {
        addEntity(world, gl, sceneJson, sceneBin, sceneJson.nodes[child], bottle)
    }
}