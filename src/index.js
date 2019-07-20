const svg = document.getElementById('stage');
const pipe = new PipeRender(svg);

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
  glMatrix.vec3.fromValues(0, 5, -100));

const cA = glMatrix.vec3.fromValues(rand(0,1), rand(0,1), rand(0,1));
const cB = glMatrix.vec3.fromValues(rand(0,1), rand(0,1), rand(0,1));
pipe.applyMatrix(rotation, () => {
  pipe.applyMatrix(translation, () => {
    const dt = 3;
    for (let curve = 0; curve < 18; curve++) {
      const points = [];
      const addPoint = (p,h) => points.push({
        point: glMatrix.vec3.fromValues(p[0], h*50-25, p[1]),
        color: glMatrix.vec3.lerp(
          glMatrix.vec3.create(), cA, cB, h)
      });

      let point = [rand(-10, 10), rand(-10, 10)];
      let h = noiseOctaves(point[0]/100, point[1]/100, 4);
      addPoint(point, h);
      let angle = rand(0, 2*Math.PI);

      for (let step = 0; step < 40; step++) {
        let lastPoint = point;
        let lastH = h;
        let lastAngle = angle;

        h = null;

        for (let t = lastAngle-Math.PI/2; t <= lastAngle+Math.PI/2; t += Math.PI/20) {
          let step = [dt*Math.cos(t), dt*Math.sin(t)];
          let nextPoint = [0,1].map(i => lastPoint[i]+step[i]);
          let nextH = noiseOctaves(nextPoint[0]/100, nextPoint[1]/100, 4);

          if (h === null || Math.abs(lastH-nextH)<Math.abs(lastH-h)) {
            h = nextH;
            point = nextPoint;
            angle = t;
          }
        }

        addPoint(point, h);
      }

      drawLine({ attributes: points });
    }
  });
});

pipe.postprocess(pipe.stackBlur(-100, 0.1));

pipe.draw();

document.getElementById('downloadSVG').addEventListener('click', () => pipe.exportSVG('export.svg'));
document.getElementById('downloadPNG').addEventListener('click', () => pipe.exportPNG(4, 'export.png'));
