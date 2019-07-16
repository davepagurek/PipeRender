const pipe = new PipeDream(document.getElementById('stage'));

const rand = (a, b) => a + Math.random()*(b-a);

const drawLine = pipe.shader({
  vert: ({ point, color }, uniforms, emit) => {
    emit({
      point,
      color,
      radius: 10
    });
  },
  postprocess: (path) => {
    const points = path.controlPoints.map(p => p.point);
    console.log(points);
    for (let i = 0; i < points.length-1; i++) {
      console.log(points[i].map((v,x) => points[i+1][x]-v));
    }
  },
  continuous: true
});

pipe.clear();

const points = [];
let point = glMatrix.vec3.fromValues(-5, 0, -30);
for (let i = 0; i < 8; i++) {
  const color = glMatrix.vec3.fromValues(Math.random(), Math.random(), Math.random());
  points.push({ point, color });
  point = glMatrix.vec3.add(
    glMatrix.vec3.create(),
    point,
    glMatrix.vec3.fromValues(rand(-1, 1) + 2, rand(-3, 3), rand(-3, 3)));
}

drawLine({ attributes: points });

pipe.draw();
