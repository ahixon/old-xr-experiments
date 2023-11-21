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
    console.log(defaultNode)
    return addEntity(world, gl, metadata, bin, defaultNode, null);

}

function calculateTangentsWithNormals(vertices, normals) {
    let tangents = [];

    for (let i = 0; i < normals.length; i += 9) {
        // Get the normal
        let n0 = [normals[i], normals[i + 1], normals[i + 2]];
        let n1 = [normals[i + 3], normals[i + 4], normals[i + 5]];
        let n2 = [normals[i + 6], normals[i + 7], normals[i + 8]];

        // Get vertices of the triangle
        let v0 = [vertices[i], vertices[i + 1], vertices[i + 2]];
        let v1 = [vertices[i + 3], vertices[i + 4], vertices[i + 5]];

        // Calculate vector between two vertices
        let v = [v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]];

        // Calculate tangents
        let t0 = calculateTangent(n0, v);
        let t1 = calculateTangent(n1, v);
        let t2 = calculateTangent(n2, v);

        // Add the tangents to the tangents array
        tangents.push(...t0, ...t1, ...t2);
    }

    return tangents;
}

function calculateTangent(normal, v) {
    // Calculate cross product of normal and v
    let t = [normal[1] * v[2] - normal[2] * v[1], normal[2] * v[0] - normal[0] * v[2], normal[0] * v[1] - normal[1] * v[0]];

    // Subtract the component of t in the direction of n
    let dot = normal[0] * t[0] + normal[1] * t[1] + normal[2] * t[2];
    t[0] -= dot * normal[0];
    t[1] -= dot * normal[1];
    t[2] -= dot * normal[2];

    // Normalize t
    let length = Math.sqrt(t[0] * t[0] + t[1] * t[1] + t[2] * t[2]);
    t[0] /= length;
    t[1] /= length;
    t[2] /= length;

    return t;
}

export const addEntity = (world: World, gl, sceneJson, sceneBin, sceneEntity: any, parent: any) => {
    const bottle = world.addEntity();

    // console.log('loading', sceneEntity)

    const bottleMesh = new Mesh();
    if (sceneEntity.points) {
        const bottleModel = new MeshModel('bottle');

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

        let normals;
        if (sceneEntity.normals) {
            const normalsSlice = sceneBin.slice(sceneEntity.normals.offset, sceneEntity.normals.offset + sceneEntity.normals.size)
            normals = new Float32Array(normalsSlice);
        }

        const bottlePart = new MeshPart(`mesh`, 0);

        const trianglePositions = [];
        const uvs = [];
        const triangleNormals = [];

        let faceIndexPointer = 0;
        for (let i = 0; i < faceCounts.length; i++) {
            const faceCount = faceCounts[i];
            if (faceCount === 3) {
                const facePosIndices = faceIndices.slice(faceIndexPointer, faceIndexPointer + faceCount).map(idx => idx * 3);
                const faceUvIndices = (uvIndices || []).slice(faceIndexPointer, faceIndexPointer + faceCount).map(idx => idx * 2);

                const flatTriangleVerts = Array.from(facePosIndices).map(posIdx => [pos[posIdx], pos[posIdx + 1], pos[posIdx + 2]]).flat();
                trianglePositions.push(...flatTriangleVerts);

                if (normals) {
                    const flatTriangleNormals = Array.from(facePosIndices).map(posIdx => [normals[posIdx], normals[posIdx + 1], normals[posIdx + 2]]).flat();
                    triangleNormals.push(...flatTriangleNormals);
                }

                if (uvValues) {
                    const flatTriangleUvs = Array.from(faceUvIndices).map(uvIdx => [uvValues[uvIdx], 1 - uvValues[uvIdx + 1]]).flat();
                    uvs.push(...flatTriangleUvs);
                }

                faceIndexPointer += faceCount;
            } else {
                var tessy = (function initTesselator() {
                    // function called for each vertex of tesselator output
                    function vertexCallback(data, { tesselatedTrianglePositions, tesselatedUvs }) {
                        //   console.log(data);
                        const { coords } = data;
                        tesselatedTrianglePositions[tesselatedTrianglePositions.length] = coords[0];
                        tesselatedTrianglePositions[tesselatedTrianglePositions.length] = coords[1];
                        tesselatedTrianglePositions[tesselatedTrianglePositions.length] = coords[2];

                        if (tesselatedUvs && data.uv) {
                            tesselatedUvs.push(data.uv)
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
                        // console.log('combine callback', coords, dataBeingCombined);

                        // Interpolate UVs
                        let u = 0, v = 0;
                        for (let i = 0; i < dataBeingCombined.length; i++) {
                            if (dataBeingCombined[i] && dataBeingCombined[i].uv) {
                                u += weight[i] * dataBeingCombined[i].uv[0];
                                v += weight[i] * dataBeingCombined[i].uv[1];
                            }
                        }

                        return {
                            coords: [coords[0], coords[1], coords[2]],
                            uv: [u, v]
                        };
                    }

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

                const facePosIndices = faceIndices.slice(faceIndexPointer, faceIndexPointer + faceCount).map(idx => idx * 3);
                const faceUvIndices = (uvIndices || []).slice(faceIndexPointer, faceIndexPointer + faceCount).map(idx => idx * 2);

                let inputUVs = [];
                const inputVertices = Array.from(facePosIndices).map(posIdx => [pos[posIdx], pos[posIdx + 1], pos[posIdx + 2]]);

                if (uvValues) {
                    inputUVs = Array.from(faceUvIndices).map(uvIdx => [uvValues[uvIdx], 1 - uvValues[uvIdx + 1]]);
                }

                const tesselatedTrianglePositions = [];
                const tesselatedUvs = [];

                tessy.gluTessBeginPolygon({
                    tesselatedTrianglePositions,
                    tesselatedUvs
                });

                tessy.gluTessBeginContour();

                for (let j = 0; j < inputVertices.length; j++) {
                    const vertex = inputVertices[j];
                    const uv = inputUVs[j];

                    tessy.gluTessVertex(vertex, { coords: vertex, uv });
                }

                tessy.gluTessEndContour();

                tessy.gluTessEndPolygon();

                trianglePositions.push(...tesselatedTrianglePositions);
                if (uvValues) {
                    uvs.push(...tesselatedUvs);
                }

                faceIndexPointer += faceCount;

            }
        }

        bottlePart.buffers.set(MeshBufferType.Positions, new SizedArray(new Float32Array(trianglePositions), 3))

        let usedNormals;
        if (triangleNormals.length && false) {
            bottlePart.buffers.set(MeshBufferType.Normals, new SizedArray(new Float32Array(triangleNormals), 3))
            usedNormals = triangleNormals;
        } else {
            var calculatedNormals = calculateNormals(trianglePositions);
            const normalsFlat = new Float32Array(calculatedNormals);
            bottlePart.buffers.set(MeshBufferType.Normals, new SizedArray(normalsFlat, 3))
            usedNormals = normalsFlat;
        }

        if (uvs.length) {
            bottlePart.buffers.set(MeshBufferType.UV, new SizedArray(new Float32Array(uvs), 2));
        }

        const tangents = calculateTangentsWithNormals(trianglePositions, usedNormals)
        bottlePart.buffers.set(MeshBufferType.Tangent, new SizedArray(new Float32Array(tangents), 2))

        bottleModel.parts.push(bottlePart)
        bottleMesh.models.push(bottleModel);

        let material = null;
        let textures = new Map();

        if (sceneEntity.material && false) {
            for (const variableName of Object.keys(sceneEntity.material.variables)) {
                const variable = sceneEntity.material.variables[variableName];
                if (variable.type === 'filename') {
                    console.log('need to load', variable)

                    const str = variable.value;
                    const regex = /\[(.+)\]$/;
                    const match = str.match(regex);
                    const filename = match ? match[1] : null;

                    if (!filename) {
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
                        // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
                        // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
                        // // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, s.filter);
                        // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                        gl.generateMipmap(gl.TEXTURE_2D);

                        console.log('loaded texture', filename, 'to', texture, event.target);

                        textures.set(variableName, texture)
                    });

                    textures.set(variableName, texture)
                }
            }

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
                          float lighting = dot(normal, vec3(0.2, 0.9, 0.2));
                        
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
    if (parent !== null && parent !== undefined) {
        world.addComponent(bottle, new ParentComponent(parent))
    }

    for (const child of sceneEntity.children) {
        addEntity(world, gl, sceneJson, sceneBin, sceneJson.nodes[child], bottle)
    }

    return bottle;
}