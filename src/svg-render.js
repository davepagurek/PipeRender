const ns = 'http://www.w3.org/2000/svg';

const lerp = (a, b, t) => {
  return a + (b - a) * t;
};

class Path {
  constructor() {
    this.controlPoints = [];
  }

  push({ point, path, radius }) {
    this.controlPoints.push({ point, path, radius });
  }

  makeBezierPaths(projection) {
    const paths = [];

    let lastColor = '#000000';
    let lastRadius = 1;
    for (let i = 0; i < this.controlPoints.length; i += 3) {
      const element = document.createElementNS(ns, 'path');
      const commands = [];

      commands.push(`M ${this.getProjection(this.controlPoints[i], projection)}`);
      lastColor = this.controlPoints[i].color || lastColor;
      lastRadius = this.controlPoints[i].radius !== undefined ? this.controlPoints[i].radius : lastRadius;

      const colorA = lastColor;
      const radiusA = lastRadius;

      commands.push('C');
      let points = [];
      for (let j = 1; j < 4; j++) {
        points.push(this.getProjection(this.controlPoints[i + j], projection));
      }
      commands.push(points.join(' '));

      lastColor = this.controlPoints[i+4].color || lastColor;
      lastRadius = this.controlPoints[i+4].radius !== undefined ? this.controlPoints[i+4].radius : lastRadius;

      element.setAttribute('d', commands.join(' '));
      paths.push({
        element,
        colorA,
        radiusA,
        colorB: lastColor,
        radiusB: lastRadius
      });
    }

    return paths;
  }

  splitPath(path, perspective, width, height, precision) {
    const segments = [];

    const total = path.element.getTotalLength();
    const n = Math.ceil(total / precision);

    const points = [];
    const radii = [];
    const colors = [];
    for (let i = 0; i < n; i++) {
      const distance = Math.min(total, i * precision);
      const point = glMatrix.vec4.fromValues(...path.element.getPointAtDistance(distance), 1);
      points.push(glMatrix.vec4.transformMat4(
        point,
        point,
        perspective));
      colors.push(lerp(path.colorA, path.colorB, i / (n - 1)));
      radii.push(lerp(path.radiusA, path.radiusB, i / (n - 1)));
    }

    for (let i = 0; i < n-1; i++) {
      const [ a, b ] = [i, i+1].map(offset => [
        (points[n][0] / points[n][3] + 1) / 2 * width,
        (-points[n][1] / points[n][3] + 1) / 2 * height
      ]);
      const rA = radii[i];
      const rB = radii[i+1];
      const depth = (points[i][2]/points[i][3] + points[i+1][2]/points[i+1][3])/2;

      const d = [0, 1].map(i => (b[i]-a[i]) / Math.sqrt(Math.pow(b[0]-a[0], 2) + Math.pow(b[1]-a[1], 2)));
      const normal = [d[1], -d[0]];

      let normalB = normal;
      if (i+1 < n-1) {
        // TODO calculate normal at next point
      }

      const element = document.createElementNS(ns, 'path');
      const commands = [];
      commands.push(`M ${a[0] - normal[0]*rA}, ${a[1] - normal[1]*rA}`);
      commands.push(`L ${b[0] - normalB[0]*rB}, ${a[1] - normalB[1]*rA}`)
      commands.push(`L ${b[0] + normalB[0]*rB}, ${a[1] + normalB[1]*rA}`)
      commands.push(`L ${a[0] + normal[0]*rA}, ${a[1] + normal[1]*rA}`);
      commands.push('Z');
      element.setAttribute('d', commands.join(' '));
      element.setAttribute('fill', colors[i]); // TODO make gradient
      element.setAttribute('stroke-width', '0');

      segments.push({element, depth});
    }

    return segments;
  }

  makeSegments(projection, width, height, precision = 4) {
    const segments = [];
    makeBezierPaths(projection).forEach(path => segments.push(...splitPath(path, perspective, width, height, precision)));

    return segments;
  }
}

class SVGRenderer {
  constructor(svg) {
    this.svg = svg || document.createElementNS(ns, 'svg');
    this.segments = [];


    this.projectionMatrix = glMatrix.mat4.create();
    this.matrix = glMatrix.mat4.create();

    const fieldOfView = Math.PI / 4;
    const aspect = this.svg.width / this.svg.height;
    const zNear = 1;
    const zFar = 1000;
    glMatrix.mat4.perspective(this.projectionMatrix, fieldOfView, aspect, zNear, zFar);
  }

  replaceMatrix(m, callback) {
    let prevMatrix = this.matrix;
    this.matrix = m;

    callback();

    this.matrix = prevMatrix;
  }

  applyMatrix(m, callback) {
    this.replaceMatrix(glMatrix.mat4.multiply(
      glMatrix.mat4.create(),
      this.matrix,
      m),
      callback);
  }

  shader(settings) {
    const path = new Path();

    const emit = ({ point, color, radius }) => {
      const p = glMatrix.vec4.fromValues(point[0], point[1], point[2], 1);
      path.push(
        glMatrix.transformMat4(p, o, this.matrix),
        color,
        radius
      );
    };

    return (inputs) => {
      inputs.attributes.forEach(attr => {
        settings.vert(attr, settings.uniforms, emit);
      });

      if (inputs.postprocess) {
        inputs.postprocess(controlPoints);
      }

      this.segments.push(...path.generateSegments(this.projectionMatrix));
    };
  }

  clear() {
    this.segments = [];
    while (this.svg.firstChild) this.svg.removeChild(this.svg.firstChild);
  }

  draw() {
    // Higher depth first so that closer elements get drawn last
    this.segments.sort((a, b) => b.depth - a.depth);
    this.segments.forEach(segment => this.svg.appendChild(...segment.makeElement(this.svg.width, this.svg.height).map(s => s.element)));
  }
}
