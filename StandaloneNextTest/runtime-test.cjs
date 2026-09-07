console.log("=== NODE RUNTIME ===");
console.log("cwd =", process.cwd());
console.log("exec =", process.execPath);
console.log("version =", process.version);

console.log("=== PNPM/NPM ENV ===");

for (const k of Object.keys(process.env).sort()) {
    if (/^(npm_|pnpm_|NODE|NEXT|TURBO|TURBOPACK)/i.test(k)) {
        console.log(k + "=" + process.env[k]);
    }
}
