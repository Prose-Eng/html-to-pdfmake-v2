// Browser entry: bundled as an IIFE for classic <script> usage. It exposes the
// default export as the global `htmlToPdfmake`, matching the original package's
// `browserify --standalone htmlToPdfmake` behaviour.
import htmlToPdfmake from "./index";

// biome-ignore lint/suspicious/noExplicitAny: attaching to the global object
(globalThis as any).htmlToPdfmake = htmlToPdfmake;
