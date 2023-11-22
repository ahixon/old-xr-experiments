        // const decimateGeom = new DecimateGeometry();        
        // const triangles = [];
        // for (let i = 0; i < uniqueIndices.length; i += 3) {
        //     const index1 = uniqueIndices[i];
        //     const index2 = uniqueIndices[i + 1];
        //     const index3 = uniqueIndices[i + 2];

        //     const tri = new DecimateTriangle();
        //     tri.indices = [index1, index2, index3];
        //     triangles.push(tri)
        // }

        // decimateGeom.triangles = triangles
        // const verticesAtPositions = []
        // for (let i = 0; i < uniquePositions.length; i += 3) {
        //     verticesAtPositions.push([uniquePositions[i], uniquePositions[i + 1], uniquePositions[i + 2]])
        // }

        // decimateGeom.vertices = verticesAtPositions;

        // const decimatedGeom = decimate(decimateGeom, 200);

        // // console.log(decimatedGeom)

        // const decimatedIndices = [];
        // const decimatedPositions = [];
        // for (const tri of decimatedGeom.triangles) {
        //     decimatedIndices.push(...tri.indices)
        // }

        // for (const vert of decimatedGeom.vertices) {
        //     decimatedPositions.push(...vert)
        // }