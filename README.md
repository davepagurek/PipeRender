# PipeRender
I was interested in making and printing a generative art poster for myself. To print at arbitrary sizes, I wanted to export to a vector format like SVG, but I was also interested in rendering 3D content, so this project was born to bridge that gap.

At its core, this is a library to render 3d lines with a given radius into a 2D SVG. To apply effects like focal blur, after projecting the lines into 2D, it divides them up into a series of short segments that can be independently coloured and blurred. The resulting SVGs are kind of huge unfortunately, due to them having a lot of tiny paths, all with their own blur filters.

<img src="https://github.com/davepagurek/PipeRender/blob/master/img/Screen%20Shot%202019-07-20%20at%209.03.47%20AM.png?raw=true" />
<img src="https://github.com/davepagurek/PipeRender/blob/master/img/Screen%20Shot%202019-07-19%20at%2011.05.23%20AM.png?raw=true" />
<img src="https://github.com/davepagurek/PipeRender/blob/master/img/Screen%20Shot%202019-07-20%20at%209.09.58%20AM.png?raw=true" />
