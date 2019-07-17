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
  //continuous: true
});

pipe.clear();

const points = [];
let point = glMatrix.vec3.fromValues(-5, 0, -35);
for (let i = 0; i < 10; i++) {
  const color = glMatrix.vec3.fromValues(Math.random(), Math.random(), Math.random());
  points.push({ point, color });
  if (i >= 3 && (i - 3) % 3 == 0) {
    const b = points[points.length - 1].point;
    const a = points[points.length - 2].point;
    point = glMatrix.vec3.sub(
      glMatrix.vec3.create(),
      glMatrix.vec3.fromValues(b[0]*2, b[1]*2, b[2]*2),
      a);
  } else {
    point = glMatrix.vec3.add(
      glMatrix.vec3.create(),
      point,
      glMatrix.vec3.fromValues(rand(-1, 1) + 2, rand(-3, 3), rand(-1, 3)));
  }
}

drawLine({ attributes: points });

pipe.postprocess(pipe.stackBlur(-30, 1));

pipe.draw();
