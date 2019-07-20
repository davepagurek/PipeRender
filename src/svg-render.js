const ns = 'http://www.w3.org/2000/svg';

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function makeColor(c) {
  return '#' + [ ...c ].map(v => {
    const chunk = Math.round(v * 255).toString(16).toUpperCase();
    if (chunk.length === 1) {
      return '0' + chunk;
    }
    return chunk;
  }).join('');
}

class PipeRender {
  constructor(svg) {
    this.svg = svg || document.createElementNS(ns, 'svg');
    this.segments = [];


    this.projectionMatrix = glMatrix.mat4.create();
    this.matrix = glMatrix.mat4.create();
    this.width = this.svg.getAttribute('width');
    this.height = this.svg.getAttribute('height');
    this.svg.setAttribute('viewBox', `0 0 ${this.width} ${this.height}`);

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
      m,
      this.matrix),
      callback);
  }

  shader(settings) {
    const types = {
      'linear': () => new LinearPath(),
      'cubic': () => new CubicBezierPath()
    };

    return (inputs) => {
      const path = types[settings.type || 'linear']();

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

      inputs.attributes.forEach(attr => {
        settings.vert(attr, settings.uniforms, emit);
      });

      this.segments.push(...path.generateSegments(this.projectionMatrix, this.width, this.height, 0.5));
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
        dilate.setAttribute('radius', 1); //( 1.5*stdDev ).toFixed(8));
        dilate.setAttribute('in', 'SourceGraphic');
        const gaussianBlur = document.createElementNS(ns, 'feGaussianBlur');
        gaussianBlur.setAttribute('stdDeviation', stdDev.toFixed(8));
        filter.appendChild(dilate);
        filter.appendChild(gaussianBlur);
        blurred.appendChild(filter);
        segments[i].element.setAttribute('filter', `url(#${filterID})`);
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
    bg.setAttribute('fill', makeColor(bgColor));
    bg.setAttribute('stroke-width', 0);
    this.svg.appendChild(bg);
  }

  draw() {
    // Higher depth first so that closer elements get drawn last
    this.segments.sort((a, b) => b.depth - a.depth);
    this.segments.forEach(s => this.svg.appendChild(s.element));
  }

  exportSVG(filename = 'export.svg') {
    const serializer = new XMLSerializer();
    const src = serializer.serializeToString(this.svg);
    const blob = new Blob([src], { type: 'text/plain;charset=utf-8' });
    const downloader = document.createElement('a');
    downloader.setAttribute('href', URL.createObjectURL(blob));
    downloader.setAttribute('download', filename);
    document.body.appendChild(downloader);
    setTimeout(() => {
      downloader.click();
      document.body.removeChild(downloader);
    }, 0);
  }

  exportPNG(scale = 1, filename = 'export.png') {
    const serializer = new XMLSerializer();
    const canvas = document.createElement('canvas');
    canvas.setAttribute('width', this.width * scale);
    canvas.setAttribute('height', this.height * scale);

    const exportSvg = this.svg.cloneNode(true);
    exportSvg.setAttribute('width', this.width * scale);
    exportSvg.setAttribute('height', this.height * scale);
    exportSvg.setAttribute('style', `width: ${this.width*scale}px; height: ${this.height*scale}px;`);

    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((pngBlob) => {
        const downloader = document.createElement('a');
        downloader.setAttribute('href', URL.createObjectURL(pngBlob));
        downloader.setAttribute('download', 'export.png');
        document.body.appendChild(downloader);
        downloader.click();
        console.log('clicked');
        document.body.removeChild(downloader);
      }, 'image/png');
    };
    img.onerror = (e) => {
      throw e;
    };

    img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(serializer.serializeToString(exportSvg));
  }
}
