class SVGRenderer {
  const ns = 'http://www.w3.org/2000/svg';

  constructor(svg) {
    this.svg = svg || document.createElementNS('svg');
  }

}
