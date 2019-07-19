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

  makeSegment(a, b, c, rA, rB, colorA, width, height) {
    const d = [0, 1].map(i => (b[i]-a[i]) / Math.sqrt(Math.pow(b[0]-a[0], 2) + Math.pow(b[1]-a[1], 2)));
    const normal = [d[1]*width/a[3], -d[0]*height/a[3]];

    let normalB = normal;
    if (c) {
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

    const colorStr = makeColor(colorA);
    element.setAttribute('fill', colorStr);
    element.setAttribute('stroke', colorStr);
    element.setAttribute('stroke-width', '0.5');
    element.setAttribute('stroke-linecap', 'round');

    return element;
  }

  generateSegments(perspective, width, height, precision = 0.1) {
    throw new Error('Unimplemented');
  }
}

class LinearPath extends Path {
  generateSegments(perspective, width, height, precision = 0.1) {
    const points = [];
    const radii = [];
    const colors = [];
    let lastColor = glMatrix.vec3.fromValues(0,0,0);
    let nextColor = lastColor;
    let lastRadius = 1;
    let nextRadius = 1;

    for (let i = 0; i < this.controlPoints.length - 1; i++) {
      const a = this.controlPoints[i];
      const b = this.controlPoints[i+1];
      const n = Math.ceil(glMatrix.vec3.distance(a.point,b.point) / precision);
      lastColor = a.color || nextColor;
      nextColor = b.color || nextColor;
      lastRadius = a.radius || nextRadius;
      nextRadius = b.radius || nextRadius;

      for (let j = 0; j < n; j++) {
        const a = glMatrix.vec3.lerp(
          glMatrix.vec3.create(),
          this.controlPoints[i].point,
          this.controlPoints[i+1].point,
          j / n);

        points.push(a);

        const rA = lerp(this.controlPoints[i].radius, this.controlPoints[i+1].radius, j/n);
        radii.push(rA);

        colors.push(glMatrix.vec3.lerp(glMatrix.vec3.create(), lastColor, nextColor, j/n));
      }
    }

    const segments = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i+1];
      const c = points[i+2];

      const [a2D, b2D, c2D] = [a,b,c].map(p => p ? this.getProjection(p, perspective, width, height) : null);
      const rA = radii[i] / a2D[3];
      const rB = radii[i+1] / b2D[3];

      const element = this.makeSegment(a2D, b2D, c2D, rA, rB, colors[i], width, height);

      const depth = (a2D[2] + b2D[2]) / 2;
      const z = (a[2] + b[2]) / 2;

      segments.push({element, depth, z});
    }

    return segments;
  }
}

class CubicBezierPath extends Path {
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

    for (let i = 0; i < points.length-1; i++) {
      const a = points[i];
      const b = points[i+1];
      const c = points[i+2];
      const rA = radii[i];
      const rB = radii[i+1];
      const depth = (depths[i] + depths[i+1]) / 2;
      const z = (zs[i] + zs[i+1]) / 2;

      const element = this.makeSegment(a, b, c, rA, rB, colors[i], width, height);

      segments.push({element, depth, z});
    }

    return segments;
  }

  generateSegments(perspective, width, height, precision = 0.1) {
    const segments = this.splitPath(this.makeBezierPaths(perspective), perspective, width, height, precision);

    return segments;
  }
}
