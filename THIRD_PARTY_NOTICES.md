# Third-party notices

## Formula 1 circuit centre-line data

The GPS centre-line coordinates used for Spa-Francorchamps, Monza, Silverstone, Suzuka and Monaco in `formula-one.html` are adapted from the GeoJSON circuit data maintained by Tomislav Bacinger:

- Project: https://github.com/bacinger/f1-circuits
- Source files: `circuits/be-1925.geojson`, `circuits/it-1922.geojson`, `circuits/gb-1948.geojson`, `circuits/jp-1962.geojson`, and `circuits/mc-1929.geojson`
- Copyright: Copyright (c) 2019-2025 Tomislav Bacinger
- Licence: MIT

The source coordinates are projected from longitude/latitude into a local metre-based coordinate frame for the simulation, then sampled by the game engine. The centre-line source is not a full 3D elevation or venue asset pack.

### MIT licence

Copyright (c) 2019-2025 Tomislav Bacinger

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
