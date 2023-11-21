import { System } from "@realityshell/ecs";
import { ModelComponent } from "./components/ModelComponent";
import { WebGLAttribute, WebGLAttributesComponent } from "./components/WebGLAttributesComponent";
import { MeshBufferType } from "./mesh";

export const compilerSystem = (world, gl): System => ({
    matchers: new Set([ModelComponent]),
    update({entities}) {
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
                            console.log('creating buffer for attr', meshKey)
                            const bufferData = part.buffers.get(meshKey)!;
                            acc[meshKey] = new WebGLAttribute(gl, bufferData, false, gl.ARRAY_BUFFER);
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

                    locs.set(attribInfo.name.split('_').slice(1, ).join('_'), attribPointer);
                }

                world.addComponent(entity, new WebGLAttributesComponent(attributes, locs));
            }
        }
    }
})