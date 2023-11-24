Rendering performance in WebGL is a complex topic and depends on many factors. However, here are some general tips that might help you:

Minimize state changes: State changes, such as switching shaders (calling gl.useProgram) or changing textures, can be expensive. Try to group your rendering by shader and texture so that you switch as infrequently as possible. In your case, you could sort your instances by material before rendering.

Use instanced rendering: If you have many instances of the same mesh, you can use instanced rendering to draw them all with a single draw call. This can be much more efficient than drawing each instance individually.

Use Vertex Buffer Objects (VBOs): Store your vertex data in VBOs and use gl.drawElements or gl.drawArrays to render. This is usually faster than passing vertex data directly to the draw calls.

Batch draw calls: If you have many small meshes, it can be more efficient to combine them into a single larger mesh and draw it with a single draw call. This reduces the overhead of the draw call itself.

Use efficient data structures: For example, use typed arrays for vertex data, and consider using an array of structures (AoS) layout rather than a structure of arrays (SoA) if your data is accessed in a way that benefits from it.

Cull invisible objects: Don't waste time drawing objects that aren't visible. Use frustum culling, occlusion culling, or other techniques to skip drawing objects that the camera can't see.

Here's a rough pseudocode of how you might implement some of these tips:

// Pseudocode
sort instances by material
for each material:
  gl.useProgram(material.program)
  bind material textures
  for each instance with this material:
    if instance is not visible:
      continue
    bind instance vertex buffer
    set uniform variables for instance
    gl.drawElements or gl.drawArrays
Remember that the specifics will depend on your application and data. Always measure performance to see what works best in your case.