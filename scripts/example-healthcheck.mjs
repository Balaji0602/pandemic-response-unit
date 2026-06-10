// Minimal example: how to call the API from a script.
// Run: node example-healthcheck.mjs
const res = await fetch('http://localhost:3000/hospital-status');
const data = await res.json();
console.log('Current inventory:', data);
