# html-to-pdfmake-v2

Convert HTML to PDFMake format with ease. This library bridges the gap between HTML content and [PDFMake](https://pdfmake.github.io/docs/) document definitions, allowing you to generate PDFs from basic HTML while maintaining based styling and structure.

**Note**: if you need to convert a complex HTML (e.g. something produced by a Rich Text Editor), check some online solutions, like [Doppio](https://doppio.sh/), or you could try to convert [your HTML to canvas](https://github.com/chearon/dropflow) or [to an image](https://github.com/zumerlab/snapdom) and then to [export it to PDF](https://github.com/parallax/jsPDF).

This library will have the same limitation as PDFMake. If you need to verify if a style is supported by PDFMake, you can check [its documentation](https://deepwiki.com/bpampuch/pdfmake).

## Features

- Convert HTML to PDFMake-compatible format
- Preserve basic styling and structure
- Support for tables, lists, images, and more
- Customizable styling options
- Works in both browser and Node.js environments
- Handle nested elements
- Custom tag support
- Image handling with reference support

## Quick Start

### Browser Usage

```html
<!DOCTYPE html>
<html>
<head>
  <!-- Include required libraries. vfs_fonts.js must load after pdfmake.js -->
  <script src="https://cdn.jsdelivr.net/npm/pdfmake@0.3/build/pdfmake.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/pdfmake@0.3/build/vfs_fonts.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@prose-eng/html-to-pdfmake/dist/browser.js"></script>
</head>
<body>
  <script>
    // Convert HTML to PDFMake format
    const html = `
      <div>
        <h1>Sample Document</h1>
        <p>This is a <strong>simple</strong> example with <em>formatted</em> text.</p>
      </div>
    `;
    
    const converted = htmlToPdfmake(html);
    const docDefinition = { content: converted };
    
    // Generate PDF
    pdfMake.createPdf(docDefinition).download('document.pdf');
  </script>
</body>
</html>
```

### Node based Project Usage

```bash
npm install @prose-eng/html-to-pdfmake pdfmake jsdom
```

The example below targets **pdfmake 0.3**. See [pdfmake 0.2 compatibility](#pdfmake-02-compatibility) if you are still on 0.2.

```javascript
const pdfMake = require('pdfmake');
const htmlToPdfmake = require('@prose-eng/html-to-pdfmake');
// if you need to run it in a terminal console using "node", then you need the below two lines:
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

// pdfmake 0.3 ships no default fonts server-side, so register them explicitly
const fontsDir = 'node_modules/pdfmake/fonts/Roboto';
pdfMake.setFonts({
  Roboto: {
    normal: `${fontsDir}/Roboto-Regular.ttf`,
    bold: `${fontsDir}/Roboto-Medium.ttf`,
    italics: `${fontsDir}/Roboto-Italic.ttf`,
    bolditalics: `${fontsDir}/Roboto-MediumItalic.ttf`,
  },
});
// pdfmake 0.3 warns unless you declare what it may read from disk and the network
pdfMake.setLocalAccessPolicy((path) => path.startsWith(fontsDir));
pdfMake.setUrlAccessPolicy(() => false);

// if you need to run it in a terminal console using "node", then you need to initiate the "window" object with the below line:
const { window } = new JSDOM('');

// Convert HTML to PDFMake format
const html = `
  <div>
    <h1>Sample Document</h1>
    <p>This is a <strong>simple</strong> example with <em>formatted</em> text.</p>
  </div>
`;

const converted = htmlToPdfmake(html, { window });
const docDefinition = { content: converted };

// Generate PDF. In pdfmake 0.3 getBuffer() returns a promise
pdfMake.createPdf(docDefinition).getBuffer().then((buffer) => {
  // when running the command in a terminal console using "node", then we can save the file using the 'fs' native package
  require('fs').writeFileSync('output.pdf', buffer);
});
```

## pdfmake 0.2 compatibility

This library emits a plain pdfmake document definition and never imports pdfmake itself, so it works with **both pdfmake 0.2 and 0.3**. The peer dependency is `^0.2.20 || ^0.3.0` and it is optional.

Only the code that *drives* pdfmake differs between the two. If you stay on 0.2, keep using the 0.2 form:

```javascript
const pdfMake = require('pdfmake/build/pdfmake');
const pdfFonts = require('pdfmake/build/vfs_fonts');
pdfMake.vfs = pdfFonts;

pdfMake.createPdf(docDefinition).getBuffer((buffer) => { /* ... */ });
```

Beware that these 0.2 calls **fail silently** on 0.3 rather than throwing:

| 0.2 form | On 0.3 |
| --- | --- |
| `pdfMake.vfs = pdfFonts` | assignment succeeds, fonts never register |
| `getBuffer(callback)` | returns a promise, the callback never fires |
| `createPdf(dd, tableLayouts)` | 2nd argument is now `options`; use `pdfMake.addTableLayouts(...)` |

One conversion behavior differs by pdfmake version: an `<svg>` with **no** `width`/`height` **and no** `viewBox` cannot be sized, so it is skipped with a `console.warn`. pdfmake 0.2 rendered it as a zero-size no-op; pdfmake 0.3 throws on it.

## Supported HTML Elements

### Block Elements
- `<div>`, `<p>`, `<h1>` to `<h6>`
- `<table>`, `<thead>`, `<tbody>`, `<tfoot>`, `<tr>`, `<th>`, `<td>`
- `<ul>`, `<ol>`, `<li>`
- `<pre>`

### Inline Elements
- `<span>`, `<strong>`, `<b>`, `<em>`, `<i>`, `<s>`
- `<a>` (with support for external and internal links)
- `<sub>`, `<sup>`
- `<img>`, `<svg>`
- `<br>`, `<hr>`

### CSS Properties Support

The library handles these CSS properties:

| Property | Support Details |
|----------|----------------|
| `background-color` | Good support |
| `border` | Including individual borders |
| `color` | Good support, including opacity |
| `font-family` | Basic support |
| `font-style` | Support for `italic` |
| `font-weight` | Support for `bold` |
| `height` | For tables and images |
| `width` | For tables and images |
| `margin` | Including individual margins |
| `text-align` | Good support |
| `text-decoration` | Support for `underline`, `line-through` |
| `text-indent` | Basic support |
| `white-space` | Support for `nowrap`, `pre`, `break-spaces` |
| `line-height` | Basic support |
| `list-style-type` | Good support |

## Configuration Options

The `htmlToPdfmake` function accepts an options object as its second parameter:

```javascript
const options = {
  defaultStyles: {
    // Override default element styles that are defined below
    b: {bold:true},
    strong: {bold:true},
    u: {decoration:'underline'},
    del: {decoration:'lineThrough'},
    s: {decoration: 'lineThrough'},
    em: {italics:true},
    i: {italics:true},
    h1: {fontSize:24, bold:true, marginBottom:5},
    h2: {fontSize:22, bold:true, marginBottom:5},
    h3: {fontSize:20, bold:true, marginBottom:5},
    h4: {fontSize:18, bold:true, marginBottom:5},
    h5: {fontSize:16, bold:true, marginBottom:5},
    h6: {fontSize:14, bold:true, marginBottom:5},
    a: {color:'blue', decoration:'underline'},
    strike: {decoration: 'lineThrough'},
    p: {margin:[0, 5, 0, 10]},
    ul: {marginBottom:5,marginLeft:5},
    table: {marginBottom:5},
    th: {bold:true, fillColor:'#EEEEEE'}
  },
  tableAutoSize: false,  // Enable automatic table sizing
  imagesByReference: false,  // Handle images by reference
  removeExtraBlanks: false,  // Remove extra whitespace
  removeTagClasses: false,  // Keep HTML tag classes
  window: window,  // Required for Node.js usage
  ignoreStyles: [],  // Style properties to ignore
  fontSizes: [10, 14, 16, 18, 20, 24, 28], // Font sizes for legacy <font> tag
  customTag: function(params) { /* Custom tag handler */ }
};

const converted = htmlToPdfmake(html, options);
```

### Options Explained

#### defaultStyles

Object to override the default element styling. Useful for consistent document appearance:

```javascript
const options = {
  defaultStyles: {
    h1: { fontSize: 24, bold: true, marginBottom: 10 },
    p: { margin: [0, 5, 0, 10] },
    a: { color: 'purple', decoration: null }
  }
};
```

#### tableAutoSize

Boolean that enables automatic table sizing based on content and CSS properties

Example:
```html
const result = htmlToPdfmake(`<table>
  <tr style="height:100px">
    <td style="width:250px">height:100px / width:250px</td>
    <td>height:100px / width:'auto'</td>
  </tr>
  <tr>
    <td style="width:100px">Here it will use 250px for the width because we have to use the largest col's width</td>
    <td style="height:200px">height:200px / width:'auto'</td>
  </tr>
</table>`, { tableAutoSize:true });
```

#### imagesByReference

*For Web browser only, not for Node*

Boolean that enables the images handling by reference instead of embedding. It will automatically load your images in your PDF using the [`{images}` option of PDFMake](https://pdfmake.github.io/docs/document-definition-object/images/).

Using this option will change the output that will return an object with `{content, images}`.

```javascript
const html = `<img src="https://picsum.photos/seed/picsum/200">`;
const result = htmlToPdfmake(html, { imagesByReference:true });
// 'result' contains:
//  {
//    "content":[
//      [
//        {
//          "nodeName":"IMG",
//          "image":"img_ref_0",
//          "style":["html-img"]
//        }
//      ]
//    ],
//    "images":{
//      "img_ref_0":"https://picsum.photos/seed/picsum/200"
//    }
//  }

pdfMake.createPdf(result).download();
```

#### customTag

Function to handle custom HTML tags or modify existing tag behavior:

```javascript
const options = {
  customTag: function({ element, ret, parents }) {
    if (element.nodeName === 'CUSTOM-TAG') {
      // Handle custom tag
      ret.text = 'Custom content';
      ret.style = ['custom-style'];
    }
    return ret;
  }
};
```

Example with a QR code generator:

```javascript
const html = htmlToPdfMake(`<code typecode="QR" style="foreground:black;background:yellow;fit:300px">texto in code</code>`, {
  customTag:function(params) {
    let ret = params.ret;
    let element = params.element;
    let parents = params.parents;
    switch(ret.nodeName) {
      case "CODE": {
        ret = this.applyStyle({ret:ret, parents:parents.concat([element])});
        ret.qr = ret.text[0].text;
        switch(element.getAttribute("typecode")){
          case 'QR':
            delete ret.text;
            ret.nodeName='QR';
            if(!ret.style || !Array.isArray(ret.style)){
              ret.style = [];
            }
            ret.style.push('html-qr');
            break;
        }
        break;
      }
    }
    return ret;
  }
});
```

#### removeExtraBlanks

Boolean that will remove extra unwanted blank spaces from the PDF.

In some cases these blank spaces could appear. Using this option could be quite resource consuming.

#### showHidden

Boolean to display the hidden elements (`display:none`) in the PDF.

#### removeTagClasses

Boolean that permits to remove the `html-TAG` classes added for each node.

#### ignoreStyles

Array of string to define a list of style properties that should not be parsed.

For example, to ignore `font-family`:
```javascript
htmlToPdfmake("[the html code here]", { ignoreStyles:['font-family'] })
```

#### fontSizes

Array of 7 integers to overwrite the default sizes for the old HTML4 tag `<font>`.
  
#### replaceText

Function with two parameters (`text` and `nodes`) to modify the text of all the nodes in your HTML document.

Example:
```javascript
const result = htmlToPdfmake(`<p style='text-align: justify;'>Lorem Ipsum is simply d-ummy text of th-e printing and typese-tting industry. Lorem Ipsum has b-een the industry's standard dummy text ever since the 1500s</p>`, {
  replaceText:function(text, nodes) {
    // 'nodes' contains all the parent nodes for the text
    return text.replace(/-/g, "\\u2011"); // it will replace any occurrence of '-' with '\\u2011' in "Lorem Ipsum is simply d-ummy text […] dummy text ever since the 1500s"
  }
});
```

## Advanced Features

### Custom Styling with data-pdfmake

Apply PDFMake-specific properties using the `data-pdfmake` attribute:

```html
<!-- Custom table properties -->
<table data-pdfmake='{"widths": [100, "*", "auto"], "heights": 40}'>
  <tr>
    <td>Fixed Width</td>
    <td>Fill Space</td>
    <td>Auto Width</td>
  </tr>
</table>

<!-- Custom HR styling -->
<hr data-pdfmake='{"color": "red", "thickness": 2}'>
```

### Page Breaks

Control page breaks using CSS classes and PDFMake's [`pageBreakBefore`](https://pdfmake.github.io/docs/document-definition-object/page/):

```javascript
const html = `
  <div>
    <h1>First Page</h1>
    <h1 class="page-break">Second Page</h1>
  </div>
`;

const docDefinition = {
  content: htmlToPdfmake(html),
  pageBreakBefore: function(node) {
    return node.style && node.style.includes('page-break');
  }
};
```

### Image Handling

Support for various image formats and references:

```html
<!-- Best option: Base64 encoded image -->
<!-- Required for Node environment -->
<img src="data:image/jpeg;base64,/9j/4AAQ...">

<!-- Image by URL (with imagesByReference option) -->
<!-- Only works with Web Browser -->
<img src="https://example.com/image.jpg">

<!-- Image with custom headers -->
<img data-src='{"url": "https://example.com/image.jpg", "headers": {"Authorization": "Bearer token"}}'>
```

For Base64 encoded image, please refer to the [PDFMake documentation](https://pdfmake.github.io/docs/document-definition-object/images/). And you can check [this Stackoverflow question](https://stackoverflow.com/questions/934012/get-image-data-in-javascript/42916772#42916772) to know the different ways to get a base64 encoded content from an image.

## Common Use Cases

### Tables with Complex Layouts

```html
<table>
  <thead>
    <tr>
      <th colspan="2">Header</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td rowspan="2">Cell 1</td>
      <td>Cell 2</td>
    </tr>
    <tr>
      <td>Cell 3</td>
    </tr>
  </tbody>
</table>
```

### Styled Lists

```html
<ul style="margin-left: 20px">
  <li>First item</li>
  <li style="color: red">Second item</li>
  <li>
    Nested list:
    <ol style="list-style-type: lower-alpha">
      <li>Sub-item a</li>
      <li>Sub-item b</li>
    </ol>
  </li>
</ul>
```

### Links and Anchors

```html
<!-- External link -->
<a href="https://example.com">Visit Website</a>

<!-- Internal link -->
<a href="#section1">Jump to Section</a>
<h2 id="section1">Section 1</h2>
```

### Columns

PDFMake has a concept of [`columns`](https://pdfmake.github.io/docs/0.3/document-definition-object/columns/). We use `<div data-pdfmake-type="columns"></div>` to identify it.
  
Example to center a table in the page:
```html
<div data-pdfmake-type="columns">
  <div data-pdfmake='{"width":"*"}'></div>
  <div style="width:auto">
    <table><tr><th>Table</th><tr><tr><td>Centered</td></tr></table>
  </div>
  <div data-pdfmake='{"width":"*"}'></div>
</div>
```

## Examples

You can find more examples in [example.ts](example.ts) which will create [example.pdf](example.pdf):

```bash
bun install
bun run example
```

## Development

This library is written in **TypeScript** and tooled with **[Bun](https://bun.sh)**.

```bash
bun install        # install dependencies
bun test           # run the test suite (with coverage; thresholds enforced)
bun test --watch   # watch mode
bun run typecheck  # tsc --noEmit (strict)
bun run lint       # biome check
bun run build      # emit dist/{index.mjs,index.cjs,browser.js,index.d.ts}
```

Coverage is collected on every `bun test` run and enforced against the
thresholds in `bunfig.toml` (currently 97% lines / 95% functions on `src/`).

The library ships three entry points, resolved automatically via the `exports`
map in `package.json`:

| Consumer | Entry |
| --- | --- |
| ESM `import` | `dist/index.mjs` |
| CommonJS `require` | `dist/index.cjs` (returns the function directly) |
| Browser `<script>` | `dist/browser.js` (global `htmlToPdfmake`) |

Type declarations are generated at `dist/index.d.ts`.
