// Browser entry: bundled as an IIFE for classic <script> usage. It exposes the
// default export as the global `htmlToPdfmake`.
import htmlToPdfmake from "./index";

(globalThis as { htmlToPdfmake?: typeof htmlToPdfmake }).htmlToPdfmake = htmlToPdfmake;
