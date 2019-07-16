const ns = 'http://www.w3.org/2000/svg';

const lerp = (a, b, t) => {
  return a + (b - a) * t;
};

class Path {
  constructor() {
    this.controlPoints = [];
  }

  push({ point, color, radius }) {
    this.controlPoints.push({ point, color, radius });
  }

  getProjection(point, projection, width, height) {
    const p = glMatrix.vec4.fromValues(point[0], point[1], point[2], 1);
    glMatrix.vec4.transformMat4(p, p, projection);

    return [
      (p[0] / p[3] + 1) / 2 * width,
      (p[1] / p[3] + 1) / 2 * height,
      (p[2] / p[3] + 1) / 2,
      p[3]
    ];
  }

  pointToXYZ(point) {
    const [ x, y, z ] = point;
    return { x, y, z };
  }

  makeBezierPaths(projection, width, height) {
    const paths = [];

    let lastColor = glMatrix.vec3.fromValues(0,0,0);
    let lastRadius = 1;
    for (let i = 0; i < this.controlPoints.length-3; i += 3) {
      lastColor = this.controlPoints[i].color || lastColor;
      lastRadius = this.controlPoints[i].radius !== undefined ? this.controlPoints[i].radius : lastRadius;

      const colorA = lastColor;
      const radiusA = lastRadius;

      const bezier = new Bezier(
        this.pointToXYZ(this.controlPoints[i].point),
        this.pointToXYZ(this.controlPoints[i+1].point),
        this.pointToXYZ(this.controlPoints[i+2].point),
        this.pointToXYZ(this.controlPoints[i+3].point));

      lastColor = this.controlPoints[i+3].color || lastColor;
      lastRadius = this.controlPoints[i+3].radius !== undefined ? this.controlPoints[i+3].radius : lastRadius;

      paths.push({
        bezier,
        colorA,
        radiusA,
        colorB: lastColor,
        radiusB: lastRadius
      });
    }

    return paths;
  }

  splitPath(paths, perspective, width, height, precision) {
    const segments = [];
    const points = [];
    const radii = [];
    const colors = [];
    const depths = [];
    const zs = [];

    console.log(paths);
    paths.forEach((path, idx) => {
      const total = path.bezier.length();
      const n = idx === paths.length-1 ?
        Math.ceil(total / precision) : Math.floor(total / precision);

      for (let i = 0; i < n; i++) {
        const { x, y, z } = path.bezier.get(i / (n - 1));
        const projected = this.getProjection([ x, y, z ], perspective, width, height);

        const last = points[points.length - 1];
        if (last && projected.every((v, i) => v === last[i])) {
          continue;
        }
        points.push(projected);
        colors.push(glMatrix.vec3.lerp(glMatrix.vec3.create(), path.colorA, path.colorB, i / (n - 1)));
        radii.push(lerp(path.radiusA, path.radiusB, i / (n - 1)) / projected[3]);
        depths.push(projected[2]);
        zs.push(z);
      }
    });

    /*for (let i = 0; i < points.length; i++) {
      const depth = depths[i];
      const z = zs[i];

      const element = document.createElementNS(ns, 'circle');
      element.setAttribute('cx', points[i][0].toFixed(8));
      element.setAttribute('cy', points[i][1].toFixed(8));
      element.setAttribute('r', radii[i].toFixed(8));

      const colorStr = `rgba(${colors[i].map(c => (c*255).toFixed(8)).join(',')})`;
      element.setAttribute('fill', colorStr);
      element.setAttribute('stroke', colorStr);
      element.setAttribute('stroke-width', 0.5);

      segments.push({element, depth, z});
    }*/

    for (let i = 0; i < points.length-1; i++) {
      const a = points[i];
      const b = points[i+1];
      const rA = radii[i];
      const rB = radii[i+1];
      const depth = (depths[i] + depths[i+1]) / 2;
      const z = (zs[i] + zs[i+1]) / 2;

      const d = [0, 1].map(i => (b[i]-a[i]) / Math.sqrt(Math.pow(b[0]-a[0], 2) + Math.pow(b[1]-a[1], 2)));
      const normal = [d[1]*width/a[3], -d[0]*height/a[3]];

      let normalB = normal;
      if (i+1 < points.length-1) {
        const c = points[i+2];
        const d2 = [0, 1].map(i => (c[i]-b[i]) / Math.sqrt(Math.pow(c[0]-b[0], 2) + Math.pow(c[1]-b[1], 2)));
        normalB = [d2[1]*width/b[3], -d2[0]*height/b[3]];
      }

      const element = document.createElementNS(ns, 'path');
      const commands = [];
      commands.push(`M ${(a[0] - normal[0]*rA).toFixed(8)}, ${(a[1] - normal[1]*rA).toFixed(8)}`);
      commands.push(`L ${(b[0] - normalB[0]*rB).toFixed(8)}, ${(b[1] - normalB[1]*rB).toFixed(8)}`)
      commands.push(`L ${(b[0] + normalB[0]*rB).toFixed(8)}, ${(b[1] + normalB[1]*rB).toFixed(8)}`)
      commands.push(`L ${(a[0] + normal[0]*rA).toFixed(8)}, ${(a[1] + normal[1]*rA).toFixed(8)}`);
      commands.push('Z');
      element.setAttribute('d', commands.join(' '));

      const colorA = colors[i];
      const colorB = colors[i+1];
      const colorStr = `rgba(${colorA.map(c => (c*255).toFixed(8)).join(',')})`;
      element.setAttribute('fill', colorStr);
      element.setAttribute('stroke', colorStr);
      element.setAttribute('stroke-width', '0.5');
      element.setAttribute('stroke-linecap', 'round');

      segments.push({element, depth, z});
    }

    return segments;
  }

  generateSegments(perspective, width, height, precision = 0.1) {
    const segments = this.splitPath(this.makeBezierPaths(perspective), perspective, width, height, precision);

    return segments;
  }
}

class PipeDream {
  constructor(svg) {
    this.svg = svg || document.createElementNS(ns, 'svg');
    this.segments = [];


    this.projectionMatrix = glMatrix.mat4.create();
    this.matrix = glMatrix.mat4.create();
    this.width = this.svg.getAttribute('width');
    this.height = this.svg.getAttribute('height');

    const fieldOfView = Math.PI / 4;
    const aspect = this.width / this.height;
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
      if (settings.continuous && path.controlPoints.length >= 4 && (path.controlPoints.length - 4) % 3 == 0) {
        const b = path.controlPoints[path.controlPoints.length - 1].point;
        const a = path.controlPoints[path.controlPoints.length - 2].point;
        path.push({
          point: glMatrix.vec4.sub(
            glMatrix.vec4.create(),
            glMatrix.vec4.fromValues(b[0]*2, b[1]*2, b[2]*2, 2),
            a)
        });
      }

      const p = glMatrix.vec4.fromValues(point[0], point[1], point[2], 1);
      path.push({
        point: glMatrix.vec4.transformMat4(p, p, this.matrix),
        color,
        radius
      });
    };

    return (inputs) => {
      inputs.attributes.forEach(attr => {
        settings.vert(attr, settings.uniforms, emit);
      });

      this.segments.push(...path.generateSegments(this.projectionMatrix, this.width, this.height));
    };
  }

  postprocess(callback) {
    callback(this.segments);
  }

  stackBlur(focalDistance, blurAmount) {
    return (segments) => {
      for (let i = 0; i < segments.length; i++) {
        const stdDev = blurAmount * Math.abs(segments[i].z - focalDistance);

        const blurred = document.createElementNS(ns, 'g');
        const filter = document.createElementNS(ns, 'filter');
        const filterID = `stack_blur_${i}`;
        filter.setAttribute('id', filterID);
        filter.setAttribute('x', '-40%');
        filter.setAttribute('y', '-40%');
        filter.setAttribute('width', '180%');
        filter.setAttribute('height', '180%');
        filter.setAttribute('filterUnits', 'userSpaceOnUse');
        const dilate = document.createElementNS(ns, 'feMorphology');
        dilate.setAttribute('operator', 'dilate');
        dilate.setAttribute('radius', ( 1.5*stdDev ).toFixed(8));
        dilate.setAttribute('in', 'SourceGraphic');
        const gaussianBlur = document.createElementNS(ns, 'feGaussianBlur');
        gaussianBlur.setAttribute('stdDeviation', stdDev.toFixed(8));
        //const merge = document.createElementNS(ns, 'feMerge');
        //const mergeNode1 = document.createElementNS(ns, 'feMergeNode');
        //const mergeNode2 = document.createElementNS(ns, 'feMergeNode');
        //mergeNode2.setAttribute('in', 'SourceGraphic');
        //merge.appendChild(mergeNode1);
        //merge.appendChild(mergeNode2);
        filter.appendChild(dilate);
        filter.appendChild(gaussianBlur);
        //filter.appendChild(merge);
        blurred.appendChild(filter);
        segments[i].element.setAttribute('filter', `url(#${filterID})`);
        //segments[i].element.setAttribute('stroke-width', (0.5 + 2*stdDev).toFixed(8));
        blurred.appendChild(segments[i].element);

        segments[i].element = blurred;
      }
    };
  }

  clear(bgColor = glMatrix.vec3.fromValues(1,1,1)) {
    this.segments = [];
    while (this.svg.firstChild) this.svg.removeChild(this.svg.firstChild);
    const bg = document.createElementNS(ns, 'rect');
    bg.setAttribute('width', this.width);
    bg.setAttribute('height', this.height);
    bg.setAttribute('fill', `rgba(${bgColor.map(c => (c*255).toFixed(8)).join(',')})`);
    bg.setAttribute('stroke-width', 0);
    this.svg.appendChild(bg);
  }

  draw() {
    // Higher depth first so that closer elements get drawn last
    this.segments.sort((a, b) => b.depth - a.depth);
    this.segments.forEach(s => this.svg.appendChild(s.element));
  }
}
