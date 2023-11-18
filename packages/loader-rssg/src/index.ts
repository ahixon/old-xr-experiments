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
}
  

const addEntity = (world: World, gl, sceneJson, sceneBin, sceneEntity: any, parent: any) => {
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

        const flatTriangleVerts = new Float32Array(totalPositions.flat())
        
        bottlePart.buffers.set(MeshBufferType.Positions, new SizedArray(flatTriangleVerts, 3))

        var normals = calculateNormals(flatTriangleVerts);
        const normalsFlat = new Float32Array(normals);
        bottlePart.buffers.set(MeshBufferType.Normals, new SizedArray(normalsFlat, 3))

        // if (sceneEntity.uv) {
        //     const uvSlice = sceneBin.slice(sceneEntity.uv.offset, sceneEntity.uv.offset + sceneEntity.uv.size)
        //     bottlePart.buffers.set(MeshBufferType.UV, new SizedArray(new Float32Array(uvSlice), 2))
        // }

        const tangents = calculateTangentsWithoutUV(flatTriangleVerts, normalsFlat)
        bottlePart.buffers.set(MeshBufferType.Tangent, new SizedArray(new Float32Array(tangents), 2))

        bottleModel.parts.push(bottlePart)
        bottleMesh.models.push(bottleModel);

        let material = null;
        if (sceneEntity.material) {
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
        addEntity(world, gl, sceneJson, sceneBin, sceneJson.nodes[child], bottle)
    }
}