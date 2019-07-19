const svg = document.getElementById('stage');
const pipe = new PipeDream(svg);

const rand = (a, b) => a + Math.random()*(b-a);

noise.seed(Math.random());
const noiseOctaves = (x, y, o) => {
  let height = 0;
  for (let i = 0; i < o; i++) {
    const power = Math.pow(2,i);
    height += noise.simplex2(x*power, y*power)/power;
  }
  return (height + 2) / 4;
}

const drawLine = pipe.shader({
  vert: ({ point, color }, uniforms, emit) => {
    emit({
      point,
      color,
      radius: 3
    });
  },
  type: 'linear'
});

pipe.clear();

const rotation = glMatrix.mat4.fromRotation(
  glMatrix.mat4.create(),
  -Math.PI/8,
  glMatrix.vec3.normalize(
    glMatrix.vec3.create(),
    glMatrix.vec3.fromValues(2, 0, -1)));
const translation = glMatrix.mat4.fromTranslation(
  glMatrix.mat4.create(),
  glMatrix.vec3.fromValues(0, 5, -20));

const cA = glMatrix.vec3.fromValues(rand(0,1), rand(0,1), rand(0,1));
const cB = glMatrix.vec3.fromValues(rand(0,1), rand(0,1), rand(0,1));
pipe.applyMatrix(rotation, () => {
  pipe.applyMatrix(translation, () => {
    for (let z = 10; z >= -15; z -= 2.5) {
      const points = [];
      for (let x = 0; x < 100; x++) {
        const t = noiseOctaves(x/100, z/50, 4);
        const color = glMatrix.vec3.lerp(
          glMatrix.vec3.create(), cA, cB, t);
        const point = glMatrix.vec3.fromValues(x*0.25-12.5, t*10-5, z);

        points.push({ point, color });
      }

      drawLine({ attributes: points });
    }
  });
});

pipe.postprocess(pipe.stackBlur(-25, 0.75));

pipe.draw();

document.getElementById('downloadSVG').addEventListener('click', () => pipe.exportSVG('export.svg'));
document.getElementById('downloadPNG').addEventListener('click', () => pipe.exportPNG(4, 'export.png'));
